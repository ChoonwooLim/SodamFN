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

router = APIRouter()

@router.post("/upload/sales")
async def upload_sales_approval(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        data = parse_sales_approval(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            existing = service.session.exec(
                select(CardSalesApproval).where(
                    CardSalesApproval.approval_number == item["approval_number"],
                    CardSalesApproval.approval_date == item["approval_date"]
                )
            ).first()
            
            if not existing:
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
async def upload_card_payment(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        data = parse_payment_history(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            existing = service.session.exec(
                select(CardPayment).where(
                    CardPayment.payment_date == item["payment_date"],
                    CardPayment.card_corp == item["card_corp"],
                    CardPayment.net_deposit == item["net_deposit"]
                )
            ).first()
            
            if not existing:
                new_payment = CardPayment(**item)
                service.session.add(new_payment)
                count += 1
        
        service.session.commit()
        return {"status": "success", "message": f"{count} payment records imported"}
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
def get_sales_stats(start_date: date, end_date: date, current_user = Depends(get_current_user)):
    """
    Get card sales stats from DailyExpense records linked to revenue-type vendors.
    Uses Vendor.vendor_type='revenue' to find card revenue entries.
    """
    from models import Vendor
    
    with Session(engine) as session:
        # Get all revenue-type vendor IDs
        revenue_vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == 'revenue')
        ).all()
        revenue_vendor_ids = {v.id for v in revenue_vendors}
        vendor_id_to_name = {v.id: v.name for v in revenue_vendors}
        
        # Get DailyExpense entries linked to revenue vendors in date range
        expenses = session.exec(
            select(DailyExpense).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
            )
        ).all()
        
        # Filter to revenue entries only (by vendor_id or known vendor_name patterns)
        card_entries = []
        for entry in expenses:
            vn = entry.vendor_name or ''
            
            # Match by vendor_id (linked to revenue vendor)
            if entry.vendor_id and entry.vendor_id in revenue_vendor_ids:
                corp = _extract_card_corp(vn)
                if corp:
                    card_entries.append({
                        'date': entry.date,
                        'amount': entry.amount,
                        'card_corp': corp,
                    })
                continue
            
            # Match by vendor_name pattern (for unlinked entries)
            if '카드매출' in vn or vn == '카드매출(통합)':
                corp = _extract_card_corp(vn) or '카드매출(통합)'
                card_entries.append({
                    'date': entry.date,
                    'amount': entry.amount,
                    'card_corp': corp,
                })
        
        # Group by date for daily_trend
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
        
        # Group by card corp for pie chart
        corp_map = {}
        for e in card_entries:
            corp = e['card_corp']
            corp_map[corp] = corp_map.get(corp, 0) + e['amount']
        
        by_corp = [
            {'name': corp, 'value': amount}
            for corp, amount in sorted(corp_map.items(), key=lambda x: -x[1])
        ]
        
        return {
            "status": "success",
            "daily_trend": daily_trend,
            "by_corp": by_corp,
        }


@router.get("/stats/payment")
def get_payment_stats(start_date: date, end_date: date, current_user = Depends(get_current_user)):
    """
    Get card payment stats. First tries CardPayment table,
    then falls back to DailyExpense card revenue data.
    """
    with Session(engine) as session:
        # Try CardPayment table first
        payments = session.exec(
            select(CardPayment)
            .where(CardPayment.payment_date >= start_date)
            .where(CardPayment.payment_date <= end_date)
            .order_by(CardPayment.payment_date)
        ).all()
        
        if payments:
            return {"status": "success", "data": payments}
        
        # Fallback: synthesize from DailyExpense card revenue
        card_revenue = session.exec(
            select(DailyExpense).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
                DailyExpense.amount > 0,
            )
        ).all()
        
        # Group by card corp
        corp_totals = {}
        for entry in card_revenue:
            vn = entry.vendor_name or ''
            corp = _extract_card_corp(vn)
            if not corp:
                if '카드' in vn or entry.category in ('매장매출',):
                    corp = vn or '기타'
                else:
                    continue
            
            if corp not in corp_totals:
                corp_totals[corp] = {'sales_amount': 0, 'count': 0}
            corp_totals[corp]['sales_amount'] += entry.amount
            corp_totals[corp]['count'] += 1
        
        # Estimate fees (~2% average for small businesses)
        FEE_RATE = 0.02
        synthetic_data = []
        for corp, totals in sorted(corp_totals.items(), key=lambda x: -x[1]['sales_amount']):
            fees = int(totals['sales_amount'] * FEE_RATE)
            synthetic_data.append({
                'card_corp': corp,
                'sales_amount': totals['sales_amount'],
                'fees': fees,
                'net_deposit': totals['sales_amount'] - fees,
            })
        
        return {"status": "success", "data": synthetic_data}
