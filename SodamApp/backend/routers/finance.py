from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel import Session, select, func
from typing import List, Optional
from datetime import date
from models import CardSalesApproval, CardPayment, DailyExpense
from database import engine
from services.database_service import DatabaseService
from services.financial_parser import parse_sales_approval, parse_payment_history
from routers.auth import get_current_user
from sqlalchemy import text
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

@router.post("/upload/sales")
async def upload_sales_approval(file: UploadFile = File(...), current_user = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        data = parse_sales_approval(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            existing = service.session.exec(
                apply_bid_filter(select(CardSalesApproval), CardSalesApproval, bid).where(
                    CardSalesApproval.approval_number == item["approval_number"],
                    CardSalesApproval.approval_date == item["approval_date"]
                )
            ).first()
            
            if not existing:
                item['business_id'] = bid
                new_sales = CardSalesApproval(**item)
                service.session.add(new_sales)
                count += 1
                
        service.session.commit()
        return {"status": "success", "message": f"{count} new sales records imported"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        service.close()

@router.post("/upload/payment")
async def upload_card_payment(file: UploadFile = File(...), current_user = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        data = parse_payment_history(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            existing = service.session.exec(
                apply_bid_filter(select(CardPayment), CardPayment, bid).where(
                    CardPayment.payment_date == item["payment_date"],
                    CardPayment.card_corp == item["card_corp"],
                    CardPayment.net_deposit == item["net_deposit"]
                )
            ).first()
            
            if not existing:
                item['business_id'] = bid
                new_payment = CardPayment(**item)
                service.session.add(new_payment)
                count += 1
        
        service.session.commit()
        
        # Sync card fees to MonthlyProfitLoss
        from models import MonthlyProfitLoss
        from collections import defaultdict
        all_payments = service.session.exec(
            apply_bid_filter(select(CardPayment), CardPayment, bid)
        ).all()
        monthly_fees = defaultdict(int)
        for p in all_payments:
            monthly_fees[(p.payment_date.year, p.payment_date.month)] += p.fees
        
        for (year, month), total_fee in monthly_fees.items():
            pl = service.session.exec(
                apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                    MonthlyProfitLoss.year == year,
                    MonthlyProfitLoss.month == month,
                )
            ).first()
            if pl:
                pl.expense_card_fee = total_fee
                service.session.add(pl)
            else:
                pl = MonthlyProfitLoss(year=year, month=month, business_id=bid, expense_card_fee=total_fee)
                service.session.add(pl)
        service.session.commit()
        
        return {"status": "success", "message": f"{count} payment records imported. Card fees synced to P/L."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        service.close()


# ─── Card company keywords for matching vendor_name in DailyExpense ───
CARD_KEYWORDS = {
    '신한카드': '신한카드', '신한': '신한카드',
    '삼성카드': '삼성카드', '삼성': '삼성카드',
    '현대카드': '현대카드', '현대': '현대카드',
    'KB카드': 'KB카드', 'KB': 'KB카드', '국민카드': 'KB카드', '국민': 'KB카드',
    '롯데카드': '롯데카드', '롯데': '롯데카드',
    'BC카드': 'BC카드', 'BC': 'BC카드', '비씨': 'BC카드',
    '하나카드': '하나카드', '하나': '하나카드',
    '우리카드': '우리카드', '우리': '우리카드',
    'NH카드': 'NH카드', 'NH': 'NH카드', '농협카드': 'NH카드',
    '씨티카드': '씨티카드',
    '제로페이': '제로페이', 'ZeroPay': '제로페이',
}

def _extract_card_corp(vendor_name: str) -> Optional[str]:
    """Extract card company name from DailyExpense vendor_name."""
    if not vendor_name:
        return None
    for keyword, corp in CARD_KEYWORDS.items():
        if keyword in vendor_name:
            return corp
    # Fallback: if vendor_name contains '카드', use it as-is
    if '카드' in vendor_name:
        return vendor_name.replace('매출', '').replace('(통합)', '').strip()
    return None


@router.get("/stats/sales")
def get_sales_stats(start_date: date, end_date: date, current_user = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    """
    Get card sales stats. Prioritizes CardSalesApproval data,
    falls back to DailyExpense revenue entries.
    """
    from models import Vendor
    
    with Session(engine) as session:
        # Try CardSalesApproval first (real 여신금융협회 data)
        approvals = session.exec(
            apply_bid_filter(select(CardSalesApproval), CardSalesApproval, bid).where(
                CardSalesApproval.approval_date >= start_date,
                CardSalesApproval.approval_date <= end_date,
            )
        ).all()
        
        if approvals:
            # Group by date
            daily_map = {}
            corp_map = {}
            for a in approvals:
                d = str(a.approval_date)
                if d not in daily_map:
                    daily_map[d] = {'total': 0, 'count': 0}
                daily_map[d]['total'] += a.amount
                daily_map[d]['count'] += 1
                
                corp = a.card_corp or '기타'
                corp_map[corp] = corp_map.get(corp, 0) + a.amount
            
            daily_trend = [
                {'date': d, 'total': v['total'], 'count': v['count']}
                for d, v in sorted(daily_map.items())
            ]
            by_corp = [
                {'name': corp, 'value': amount}
                for corp, amount in sorted(corp_map.items(), key=lambda x: -x[1])
            ]
            return {"status": "success", "daily_trend": daily_trend, "by_corp": by_corp}
        
        # Fallback: DailyExpense revenue entries with card company detection
        revenue_vendors = session.exec(
            apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.vendor_type == 'revenue')
        ).all()
        revenue_vendor_ids = {v.id for v in revenue_vendors}
        
        expenses = session.exec(
            apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
            )
        ).all()
        
        card_entries = []
        for entry in expenses:
            vn = entry.vendor_name or ''
            if entry.vendor_id and entry.vendor_id in revenue_vendor_ids:
                corp = _extract_card_corp(vn)
                if corp:
                    card_entries.append({'date': entry.date, 'amount': entry.amount, 'card_corp': corp})
                continue
            if '카드매출' in vn or vn == '카드매출(통합)':
                corp = _extract_card_corp(vn) or '카드매출(통합)'
                card_entries.append({'date': entry.date, 'amount': entry.amount, 'card_corp': corp})
        
        daily_map = {}
        for e in card_entries:
            d = str(e['date'])
            if d not in daily_map:
                daily_map[d] = {'total': 0, 'count': 0}
            daily_map[d]['total'] += e['amount']
            daily_map[d]['count'] += 1
        
        daily_trend = [
            {'date': d, 'total': v['total'], 'count': v['count']}
            for d, v in sorted(daily_map.items())
        ]
        
        corp_map = {}
        for e in card_entries:
            corp_map[e['card_corp']] = corp_map.get(e['card_corp'], 0) + e['amount']
        
        by_corp = [
            {'name': corp, 'value': amount}
            for corp, amount in sorted(corp_map.items(), key=lambda x: -x[1])
        ]
        
        return {"status": "success", "daily_trend": daily_trend, "by_corp": by_corp}


@router.get("/stats/payment")
def get_payment_stats(start_date: date, end_date: date, current_user = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    """
    Get card payment stats. First tries CardPayment table,
    then falls back to real card fee data from MonthlyProfitLoss (bank deposit analysis).
    """
    with Session(engine) as session:
        # Try CardPayment table first
        payments = session.exec(
            apply_bid_filter(select(CardPayment), CardPayment, bid)
            .where(CardPayment.payment_date >= start_date)
            .where(CardPayment.payment_date <= end_date)
            .order_by(CardPayment.payment_date)
        ).all()
        
        if payments:
            return {"status": "success", "data": payments}
        
        # Fallback: Use real card fees from MonthlyProfitLoss + card sales from DailyExpense
        from models import MonthlyProfitLoss, Vendor
        
        # Get months in date range
        months_in_range = set()
        current = start_date.replace(day=1)
        while current <= end_date:
            months_in_range.add((current.year, current.month))
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        # Get real card fees from P/L
        total_card_fee = 0
        for (year, month) in months_in_range:
            pl = session.exec(
                apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                    MonthlyProfitLoss.year == year,
                    MonthlyProfitLoss.month == month,
                )
            ).first()
            if pl:
                total_card_fee += pl.expense_card_fee
        
        # Get card sales by company from DailyExpense (revenue vendors)
        revenue_vendors = session.exec(
            apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.vendor_type == 'revenue')
        ).all()
        revenue_vendor_ids = {v.id for v in revenue_vendors}
        
        all_expenses = session.exec(
            apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
            )
        ).all()
        
        corp_totals = {}
        total_sales = 0
        for entry in all_expenses:
            vn = entry.vendor_name or ''
            corp = None
            # Match by vendor_id (linked to revenue vendor)
            if entry.vendor_id and entry.vendor_id in revenue_vendor_ids:
                corp = _extract_card_corp(vn)
            # Match by vendor_name pattern
            elif '카드매출' in vn or vn == '카드매출(통합)':
                corp = _extract_card_corp(vn) or '카드매출(통합)'
            
            if corp:
                if corp not in corp_totals:
                    corp_totals[corp] = 0
                corp_totals[corp] += entry.amount
                total_sales += entry.amount
        
        # Distribute card fee proportionally across card companies
        synthetic_data = []
        for corp, sales in sorted(corp_totals.items(), key=lambda x: -x[1]):
            ratio = sales / total_sales if total_sales > 0 else 0
            fees = int(total_card_fee * ratio)
            synthetic_data.append({
                'card_corp': corp,
                'sales_amount': sales,
                'fees': fees,
                'net_deposit': sales - fees,
            })
        
        return {"status": "success", "data": synthetic_data, "source": "bank_deposit_analysis"}
