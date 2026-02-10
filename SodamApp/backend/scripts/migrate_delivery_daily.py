"""
Migration: Re-import delivery app revenue as daily records.
Deletes existing monthly-total Revenue records for Jan 2026 and replaces
them with per-day records parsed from the original Excel files.
"""
import sys
sys.path.insert(0, '.')

import pandas as pd
import datetime as dt
from sqlmodel import Session, select
from database import engine
from models import Revenue

# ── Source files for January 2026 ──
DELIVERY_FILES = {
    'Coupang': r'C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\쿠팡\coupang_eats_2026-01.xlsx',
    'Baemin': r'C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\배민\[배달의민족] HONG JI YEON 파트너님 2026년 1월 정산명세서.xlsx',
    'Yogiyo': r'C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\요기요\요기요_2026년_01월_정산내역_639-12-01514.xlsx',
    'Ddangyo': r'C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\땡겨요\202601_땡겨요 정산내역(일별).xls',
}

TARGET_YEAR = 2026
TARGET_MONTH = 1


def parse_coupang(filepath):
    """Parse Coupang Eats: date col=col0, settlement per order, aggregate by date"""
    df = pd.read_excel(filepath)
    # Find actual data (skip header rows)
    # First column is date, look for settlement amount column
    print(f"  Columns: {list(df.columns)}")
    
    # Coupang format: row-per-order, need to find date and settlement columns
    # Let's inspect the structure
    # The file has merged header rows. Let's read with header detection
    df2 = pd.read_excel(filepath, header=None)
    
    # Find the header row - look for '일자' or '주문정보' 
    header_row = None
    for i in range(min(10, len(df2))):
        row_vals = [str(v).strip() for v in df2.iloc[i] if pd.notna(v)]
        if '일자' in row_vals or '주문정보' in row_vals:
            header_row = i
            break
    
    if header_row is not None:
        df = pd.read_excel(filepath, header=header_row)
    
    print(f"  Columns after header fix: {list(df.columns)[:10]}")
    print(f"  Shape: {df.shape}")
    
    # Find date column and settlement/total column
    date_col = None
    settle_col = None
    sales_col = None
    fee_col = None
    
    for c in df.columns:
        cs = str(c).strip().lower()
        if '일자' in cs and date_col is None:
            date_col = c
        elif '정산' in cs and settle_col is None:
            settle_col = c  
        elif '결제' in cs and '금액' in cs:
            sales_col = c
        elif cs == '수수료' or '수수료' in cs:
            fee_col = c
            
    # For Coupang, each row is an order. We need to aggregate by date.
    # The settlement amount per order might need to be calculated
    if date_col is None:
        # Try first column as date
        date_col = df.columns[0]
    
    print(f"  date_col={date_col}, settle_col={settle_col}, sales_col={sales_col}")
    
    daily = {}
    daily_sales = {}
    daily_fees = {}
    daily_orders = {}
    
    for _, row in df.iterrows():
        d = row[date_col]
        if pd.isna(d):
            continue
        try:
            if isinstance(d, str):
                d = pd.to_datetime(d)
            date_str = d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
        except:
            continue
            
        # Try to get amounts
        settle = 0
        sale = 0
        fee = 0
        
        if settle_col and pd.notna(row.get(settle_col)):
            try: settle = int(float(str(row[settle_col]).replace(',','')))
            except: pass
        if sales_col and pd.notna(row.get(sales_col)):
            try: sale = int(float(str(row[sales_col]).replace(',','')))
            except: pass
        if fee_col and pd.notna(row.get(fee_col)):
            try: fee = int(float(str(row[fee_col]).replace(',','')))
            except: pass
            
        # If no settlement column, use sale - fee
        if settle == 0 and sale > 0:
            settle = sale - abs(fee)
            
        daily[date_str] = daily.get(date_str, 0) + settle
        daily_sales[date_str] = daily_sales.get(date_str, 0) + sale
        daily_fees[date_str] = daily_fees.get(date_str, 0) + fee
        daily_orders[date_str] = daily_orders.get(date_str, 0) + 1
    
    results = []
    for date_str in sorted(daily.keys()):
        results.append({
            'date': date_str,
            'amount': daily[date_str],
            'sales': daily_sales.get(date_str, 0),
            'fees': daily_fees.get(date_str, 0),
            'orders': daily_orders.get(date_str, 0),
        })
    return results


def parse_baemin(filepath):
    """Parse Baemin: look for daily settlement rows"""
    # Baemin PDF-style Excel - try multiple sheets
    xf = pd.ExcelFile(filepath)
    print(f"  Sheets: {xf.sheet_names}")
    
    all_daily = {}
    all_sales = {}
    all_fees = {}
    all_orders = {}
    
    for sheet in xf.sheet_names:
        df = pd.read_excel(filepath, sheet_name=sheet, header=None)
        print(f"  Sheet '{sheet}': shape={df.shape}")
        
        # Look for date patterns in any column
        for idx, row in df.iterrows():
            for col_idx, val in enumerate(row):
                if pd.isna(val):
                    continue
                s = str(val).strip()
                # Look for date-like values (2026-01-XX or 01/XX or similar)
                try:
                    if len(s) == 10 and s[4] == '-':
                        date_str = s
                        # Check if there's a numeric amount nearby
                        for j in range(col_idx+1, min(col_idx+5, len(row))):
                            if pd.notna(row.iloc[j]):
                                try:
                                    amt = int(float(str(row.iloc[j]).replace(',','')))
                                    if abs(amt) > 100:
                                        all_daily[date_str] = all_daily.get(date_str, 0) + amt
                                        break
                                except:
                                    pass
                except:
                    pass
    
    # If we couldn't find daily data, try different approach
    if not all_daily:
        print("  Trying alternate Baemin parsing...")
        for sheet in xf.sheet_names:
            df = pd.read_excel(filepath, sheet_name=sheet)
            print(f"  Sheet '{sheet}' columns: {list(df.columns)[:8]}")
            
            # Look for date and amount columns
            for c in df.columns:
                cs = str(c).strip()
                if '일' in cs or '날짜' in cs or '정산일' in cs:
                    for _, row in df.iterrows():
                        d = row[c]
                        if pd.isna(d):
                            continue
                        try:
                            if isinstance(d, str):
                                d = pd.to_datetime(d)
                            date_str = d.strftime('%Y-%m-%d')
                            # Find amount in same row
                            for c2 in df.columns:
                                if '금액' in str(c2) or '정산' in str(c2):
                                    amt = row[c2]
                                    if pd.notna(amt):
                                        try:
                                            amt = int(float(str(amt).replace(',','')))
                                            all_daily[date_str] = all_daily.get(date_str, 0) + amt
                                        except:
                                            pass
                        except:
                            pass
    
    results = []
    for date_str in sorted(all_daily.keys()):
        results.append({
            'date': date_str,
            'amount': all_daily[date_str],
            'sales': all_sales.get(date_str, 0),
            'fees': all_fees.get(date_str, 0),
            'orders': all_orders.get(date_str, 0),
        })
    return results


def parse_yogiyo(filepath):
    """Parse Yogiyo settlement"""
    df = pd.read_excel(filepath)
    print(f"  Columns: {list(df.columns)[:10]}")
    print(f"  Shape: {df.shape}")
    
    daily = {}
    daily_sales = {}
    daily_fees = {}
    daily_orders = {}
    
    # Look for date and settlement columns
    date_col = None
    settle_col = None
    sales_col = None
    
    for c in df.columns:
        cs = str(c).strip()
        if '일자' in cs or '날짜' in cs or '일시' in cs:
            date_col = c
        elif '정산' in cs and '금액' in cs:
            settle_col = c
        elif '주문' in cs and '금액' in cs:
            sales_col = c
    
    if date_col is None:
        # Try first column
        date_col = df.columns[0]
    
    print(f"  date_col={date_col}, settle_col={settle_col}, sales_col={sales_col}")
    
    for _, row in df.iterrows():
        d = row[date_col]
        if pd.isna(d):
            continue
        try:
            if isinstance(d, str):
                d = pd.to_datetime(d)
            date_str = d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
        except:
            continue
        
        amt = 0
        sale = 0
        if settle_col and pd.notna(row.get(settle_col)):
            try: amt = int(float(str(row[settle_col]).replace(',','')))
            except: pass
        if sales_col and pd.notna(row.get(sales_col)):
            try: sale = int(float(str(row[sales_col]).replace(',','')))
            except: pass
            
        if amt != 0:
            daily[date_str] = daily.get(date_str, 0) + amt
            daily_sales[date_str] = daily_sales.get(date_str, 0) + sale
            daily_orders[date_str] = daily_orders.get(date_str, 0) + 1
    
    results = []
    for date_str in sorted(daily.keys()):
        results.append({
            'date': date_str,
            'amount': daily[date_str],
            'sales': daily_sales.get(date_str, 0),
            'fees': daily_fees.get(date_str, 0),
            'orders': daily_orders.get(date_str, 0),
        })
    return results


def parse_ddangyo(filepath):
    """Parse Ddangyo daily settlement"""
    df = pd.read_excel(filepath)
    print(f"  Columns: {list(df.columns)[:10]}")
    print(f"  Shape: {df.shape}")
    
    daily = {}
    daily_sales = {}
    daily_orders = {}
    
    date_col = None
    settle_col = None
    sales_col = None
    
    for c in df.columns:
        cs = str(c).strip()
        if '일자' in cs or '날짜' in cs or '정산일' in cs:
            date_col = c
        elif '정산' in cs and ('금액' in cs or '액' in cs):
            settle_col = c
        elif '주문' in cs and '금액' in cs:
            sales_col = c
    
    if date_col is None:
        date_col = df.columns[0]
    
    print(f"  date_col={date_col}, settle_col={settle_col}, sales_col={sales_col}")
    
    for _, row in df.iterrows():
        d = row[date_col]
        if pd.isna(d):
            continue
        try:
            if isinstance(d, str):
                d = pd.to_datetime(d)
            date_str = d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)[:10]
        except:
            continue
        
        amt = 0
        sale = 0
        if settle_col and pd.notna(row.get(settle_col)):
            try: amt = int(float(str(row[settle_col]).replace(',','')))
            except: pass
        if sales_col and pd.notna(row.get(sales_col)):
            try: sale = int(float(str(row[sales_col]).replace(',','')))
            except: pass
            
        if amt != 0:
            daily[date_str] = daily.get(date_str, 0) + amt
            daily_sales[date_str] = daily_sales.get(date_str, 0) + sale
            daily_orders[date_str] = daily_orders.get(date_str, 0) + 1
    
    results = []
    for date_str in sorted(daily.keys()):
        results.append({
            'date': date_str,
            'amount': daily[date_str],
            'sales': daily_sales.get(date_str, 0),
            'orders': daily_orders.get(date_str, 0),
        })
    return results


PARSERS = {
    'Coupang': parse_coupang,
    'Baemin': parse_baemin,
    'Yogiyo': parse_yogiyo,
    'Ddangyo': parse_ddangyo,
}


def main():
    # Step 1: Analyze each file
    print("=" * 60)
    print("Step 1: Parse delivery Excel files")
    print("=" * 60)
    
    all_records = {}  # channel -> list of daily records
    
    for channel, filepath in DELIVERY_FILES.items():
        print(f"\n--- {channel} ---")
        try:
            parser = PARSERS[channel]
            records = parser(filepath)
            all_records[channel] = records
            total = sum(r['amount'] for r in records)
            print(f"  Result: {len(records)} daily records, total={total:,}원")
            for r in records[:3]:
                print(f"    {r['date']}: {r['amount']:,}원")
            if len(records) > 3:
                print(f"    ... ({len(records) - 3} more)")
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
            all_records[channel] = []
    
    # Step 2: Compare with existing DB
    print("\n" + "=" * 60)
    print("Step 2: Compare with existing DB (monthly totals on 31st)")
    print("=" * 60)
    
    with Session(engine) as session:
        start = dt.date(TARGET_YEAR, TARGET_MONTH, 1)
        end = dt.date(TARGET_YEAR, TARGET_MONTH + 1, 1) if TARGET_MONTH < 12 else dt.date(TARGET_YEAR + 1, 1, 1)
        existing = session.exec(select(Revenue).where(Revenue.date >= start, Revenue.date < end)).all()
        
        for e in existing:
            parsed_total = sum(r['amount'] for r in all_records.get(e.channel, []))
            print(f"  {e.channel}: DB={e.amount:,}원, Parsed={parsed_total:,}원, diff={e.amount - parsed_total:,}원")
    
    # Step 3: Replace monthly with daily
    print("\n" + "=" * 60)
    print("Step 3: Replace monthly totals with daily records")
    print("=" * 60)
    
    with Session(engine) as session:
        # Delete existing monthly records for this period
        existing = session.exec(select(Revenue).where(Revenue.date >= start, Revenue.date < end)).all()
        for e in existing:
            print(f"  Deleting: {e.channel} {e.date} {e.amount:,}원")
            session.delete(e)
        
        # Insert daily records
        inserted = 0
        for channel, records in all_records.items():
            for r in records:
                date_obj = dt.datetime.strptime(r['date'], '%Y-%m-%d').date()
                sales = r.get('sales', 0)
                fees = r.get('fees', 0)
                orders = r.get('orders', 0)
                desc_parts = []
                if sales: desc_parts.append(f"매출:{sales:,}")
                if fees: desc_parts.append(f"수수료:{abs(fees):,}")
                if orders: desc_parts.append(f"주문:{orders}건")
                desc = ' / '.join(desc_parts) if desc_parts else '배달앱 정산'
                
                rev = Revenue(
                    date=date_obj,
                    channel=channel,
                    amount=r['amount'],
                    description=desc,
                )
                session.add(rev)
                inserted += 1
        
        session.commit()
        print(f"  Inserted {inserted} daily records")
    
    # Step 4: Sync P/L
    print("\n" + "=" * 60)
    print("Step 4: Sync P/L")
    print("=" * 60)
    
    with Session(engine) as session:
        from services.profit_loss_service import sync_revenue_to_pl
        sync_revenue_to_pl(TARGET_YEAR, TARGET_MONTH, session)
        session.commit()
        print("  ✅ P/L synced")
    
    print("\n✅ Done!")


if __name__ == '__main__':
    main()
