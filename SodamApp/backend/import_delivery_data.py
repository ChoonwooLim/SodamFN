"""
Import delivery app revenue data from Excel files into DB.
Scans C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\ for all platforms.
"""
import sys
import os
import json
import glob

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from database import engine
from models import DeliveryRevenue, MonthlyProfitLoss
from services.delivery_parser import detect_and_parse

BASE_DIR = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"


def import_all():
    """Import all delivery revenue files."""
    results = []
    
    # Walk through all subdirectories
    for channel_dir in sorted(os.listdir(BASE_DIR)):
        channel_path = os.path.join(BASE_DIR, channel_dir)
        if not os.path.isdir(channel_path):
            continue
        
        files = glob.glob(os.path.join(channel_path, "*.xls*"))
        for filepath in sorted(files):
            filename = os.path.basename(filepath)
            print(f"\nParsing: {channel_dir}/{filename}")
            
            try:
                result = detect_and_parse(filepath, filename)
                if result is None:
                    print(f"  ❌ Could not detect platform")
                    continue
                
                if result['year'] is None or result['month'] is None:
                    print(f"  ❌ Could not determine year/month")
                    continue
                
                results.append(result)
                print(f"  ✅ {result['channel']} {result['year']}-{result['month']:02d}")
                print(f"     총매출: {result['total_sales']:,}원")
                print(f"     수수료: {result['total_fees']:,}원")
                print(f"     정산액: {result['settlement_amount']:,}원")
                print(f"     주문수: {result['order_count']}건")
                if result['total_sales'] > 0:
                    rate = result['total_fees'] / result['total_sales'] * 100
                    print(f"     수수료율: {rate:.1f}%")
                
            except Exception as e:
                print(f"  ❌ Error: {e}")
                import traceback
                traceback.print_exc()
    
    # Save to DB
    print(f"\n{'='*60}")
    print(f"Total parsed: {len(results)} files")
    print(f"{'='*60}")
    
    with Session(engine) as session:
        saved = 0
        updated = 0
        
        for r in results:
            # Check existing
            existing = session.exec(
                select(DeliveryRevenue).where(
                    DeliveryRevenue.channel == r['channel'],
                    DeliveryRevenue.year == r['year'],
                    DeliveryRevenue.month == r['month'],
                )
            ).first()
            
            fee_json = json.dumps(r.get('fee_breakdown', {}), ensure_ascii=False)
            
            if existing:
                existing.total_sales = r['total_sales']
                existing.total_fees = r['total_fees']
                existing.settlement_amount = r['settlement_amount']
                existing.order_count = r['order_count']
                existing.fee_breakdown = fee_json
                session.add(existing)
                updated += 1
                print(f"  Updated: {r['channel']} {r['year']}-{r['month']:02d}")
            else:
                record = DeliveryRevenue(
                    channel=r['channel'],
                    year=r['year'],
                    month=r['month'],
                    total_sales=r['total_sales'],
                    total_fees=r['total_fees'],
                    settlement_amount=r['settlement_amount'],
                    order_count=r['order_count'],
                    fee_breakdown=fee_json,
                )
                session.add(record)
                saved += 1
                print(f"  Saved: {r['channel']} {r['year']}-{r['month']:02d}")
        
        session.commit()
        print(f"\nDB Result: {saved} saved, {updated} updated")
    
    # Sync to P/L
    print("\nSyncing to P/L...")
    sync_delivery_to_pl()
    print("Done!")


def sync_delivery_to_pl():
    """Sync DeliveryRevenue data to MonthlyProfitLoss."""
    channel_field_map = {
        "쿠팡": "revenue_coupang",
        "배민": "revenue_baemin",
        "요기요": "revenue_yogiyo",
        "땡겨요": "revenue_ddangyo",
    }
    
    with Session(engine) as session:
        # Get all delivery revenue records
        records = session.exec(select(DeliveryRevenue)).all()
        
        # Group by year-month
        monthly = {}
        for r in records:
            key = (r.year, r.month)
            if key not in monthly:
                monthly[key] = {}
            field = channel_field_map.get(r.channel)
            if field:
                monthly[key][field] = r.settlement_amount
        
        # Update P/L records
        for (year, month), values in monthly.items():
            pl = session.exec(
                select(MonthlyProfitLoss).where(
                    MonthlyProfitLoss.year == year,
                    MonthlyProfitLoss.month == month,
                )
            ).first()
            
            if not pl:
                pl = MonthlyProfitLoss(year=year, month=month)
            
            for field, amount in values.items():
                setattr(pl, field, amount)
            
            session.add(pl)
            print(f"  P/L {year}-{month:02d}: {values}")
        
        session.commit()


if __name__ == "__main__":
    import_all()
