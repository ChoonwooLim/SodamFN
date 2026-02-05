from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import MonthlyProfitLoss, DailyExpense, Revenue
from pydantic import BaseModel
from typing import Optional, List
import datetime

router = APIRouter(prefix="/api/profitloss", tags=["profitloss"])

# --- Pydantic Schemas ---

class MonthlyPLCreate(BaseModel):
    year: int
    month: int
    revenue_store: int = 0
    revenue_coupang: int = 0
    revenue_baemin: int = 0
    revenue_yogiyo: int = 0
    revenue_ddangyo: int = 0
    expense_labor: int = 0
    expense_rent: int = 0
    expense_rent_fee: int = 0  # 임대관리비
    expense_utility: int = 0
    expense_vat: int = 0
    expense_biz_tax: int = 0
    expense_income_tax: int = 0
    expense_card_fee: int = 0
    expense_material: int = 0
    expense_retirement: int = 0

class MonthlyPLUpdate(BaseModel):
    revenue_store: Optional[int] = None
    revenue_coupang: Optional[int] = None
    revenue_baemin: Optional[int] = None
    revenue_yogiyo: Optional[int] = None
    revenue_ddangyo: Optional[int] = None
    expense_labor: Optional[int] = None
    expense_rent: Optional[int] = None
    expense_rent_fee: Optional[int] = None  # 임대관리비
    expense_utility: Optional[int] = None
    expense_vat: Optional[int] = None
    expense_biz_tax: Optional[int] = None
    expense_income_tax: Optional[int] = None
    expense_card_fee: Optional[int] = None
    expense_material: Optional[int] = None
    expense_retirement: Optional[int] = None

class DailyExpenseCreate(BaseModel):
    date: datetime.date
    vendor_name: str
    amount: int
    category: Optional[str] = None
    note: Optional[str] = None

class DeliveryRevenueCreate(BaseModel):
    date: datetime.date
    channel: str  # Coupang, Baemin, Yogiyo, Ddangyo
    amount: int
    description: Optional[str] = None

# --- Helpers ---

# 거래처 카테고리 → 손익계산서 필드 매핑
CATEGORY_TO_PL_FIELD = {
    "임대료": "expense_rent",
    "임대관리비": "expense_rent_fee",
    "재료비": "expense_material",
    "식자재": "expense_material",
    "제세공과금": "expense_utility",
    "카드수수료": "expense_card_fee",
    "부가가치세": "expense_vat",
    "사업소득세": "expense_biz_tax",
    "근로소득세": "expense_income_tax",
    "퇴직금적립": "expense_retirement",
}

def sync_all_expenses(year: int, month: int, session: Session):
    """
    Aggregate DailyExpense by vendor category and update MonthlyProfitLoss.
    Uses vendor.category to determine which P/L field to update.
    """
    from sqlmodel import func
    from models import Vendor
    
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # Get all daily expenses for the month with their vendor info
    expenses = session.exec(
        select(DailyExpense)
        .where(DailyExpense.date >= start_date, DailyExpense.date < end_date)
    ).all()
    
    # Build vendor_id → category map
    vendor_ids = [e.vendor_id for e in expenses if e.vendor_id]
    vendor_category_map = {}
    if vendor_ids:
        vendors = session.exec(select(Vendor).where(Vendor.id.in_(vendor_ids))).all()
        vendor_category_map = {v.id: v.category for v in vendors}
    
    # Aggregate by category
    category_totals = {}
    for expense in expenses:
        category = None
        # First try vendor category
        if expense.vendor_id and vendor_category_map.get(expense.vendor_id):
            category = vendor_category_map[expense.vendor_id]
        # Fallback to expense's own category
        elif expense.category:
            category = expense.category
        
        if category:
            pl_field = CATEGORY_TO_PL_FIELD.get(category)
            if pl_field:
                category_totals[pl_field] = category_totals.get(pl_field, 0) + expense.amount
    
    # Find or create P/L record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        # Update fields from aggregated totals
        for field, total in category_totals.items():
            setattr(pl_record, field, total)
        session.add(pl_record)
    else:
        # Create new record with aggregated values
        pl_record = MonthlyProfitLoss(year=year, month=month, **category_totals)
        session.add(pl_record)
    
    session.commit()
    return category_totals

def sync_summary_material_cost(year: int, month: int, session: Session):
    """Aggregate DailyExpense '재료비' for a given month and update MonthlyProfitLoss"""
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # Calculate sum of material expenses from DailyExpense
    from sqlmodel import func
    total_material = session.exec(
        select(func.sum(DailyExpense.amount))
        .where(
            DailyExpense.date >= start_date, 
            DailyExpense.date < end_date,
            DailyExpense.category == "재료비"
        )
    ).one() or 0
    
    # Find or create summary record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        pl_record.expense_material = int(total_material)
        session.add(pl_record)
    else:
        # If no summary record exists, we don't necessarily want to create one 
        # just for material sync, as other fields (rent, labor) would be 0/null.
        # But for consistency, having a record is usually better.
        pass
    
    session.commit()


def sync_labor_cost(year: int, month: int, session: Session):
    """
    Aggregate all Payroll total_pay for a given month and update MonthlyProfitLoss.expense_labor
    This includes all staff payroll (base pay + bonuses - deductions = net pay to employees)
    """
    from models import Payroll
    from sqlmodel import func
    
    month_str = f"{year}-{month:02d}"
    
    # Calculate sum of all payroll total_pay for the month
    total_labor = session.exec(
        select(func.sum(Payroll.total_pay))
        .where(Payroll.month == month_str)
    ).one() or 0
    
    # Find or create MonthlyProfitLoss record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        pl_record.expense_labor = int(total_labor)
        session.add(pl_record)
    else:
        # Create a new record if it doesn't exist
        pl_record = MonthlyProfitLoss(
            year=year,
            month=month,
            expense_labor=int(total_labor)
        )
        session.add(pl_record)
    
    session.commit()
    return int(total_labor)

# --- Monthly P/L Endpoints ---

@router.post("/sync-labor/{year}/{month}")
def sync_labor_cost_endpoint(year: int, month: int, session: Session = Depends(get_session)):
    """
    Manually sync labor costs from Payroll table to MonthlyProfitLoss.
    Useful for backfilling existing payroll data.
    """
    total_labor = sync_labor_cost(year, month, session)
    return {
        "status": "success", 
        "message": f"{year}년 {month}월 인건비 {total_labor:,}원이 손익계산서에 반영되었습니다.",
        "total_labor": total_labor
    }

@router.post("/sync-expenses/{year}/{month}")
def sync_expenses_endpoint(year: int, month: int, session: Session = Depends(get_session)):
    """
    Sync all expenses from DailyExpense by vendor category to MonthlyProfitLoss.
    Aggregates expenses based on vendor.category mapping to P/L fields.
    """
    category_totals = sync_all_expenses(year, month, session)
    return {
        "status": "success", 
        "message": f"{year}년 {month}월 비용이 카테고리별로 동기화되었습니다.",
        "category_totals": category_totals
    }

@router.get("/monthly")
def get_monthly_profitloss(year: Optional[int] = None, session: Session = Depends(get_session)):
    """Get all monthly P/L records, optionally filtered by year"""
    query = select(MonthlyProfitLoss)
    if year:
        query = query.where(MonthlyProfitLoss.year == year)
    query = query.order_by(MonthlyProfitLoss.year, MonthlyProfitLoss.month)
    results = session.exec(query).all()
    
    # Calculate totals for each record (no auto-sync in GET for performance)
    output = []
    for r in results:
        total_revenue = r.revenue_store + r.revenue_coupang + r.revenue_baemin + r.revenue_yogiyo + r.revenue_ddangyo
        expense_rent_fee = getattr(r, 'expense_rent_fee', 0) or 0
        total_expense = (r.expense_labor + r.expense_rent + expense_rent_fee + r.expense_utility + 
                        r.expense_vat + r.expense_biz_tax + r.expense_income_tax + 
                        r.expense_card_fee + r.expense_material + r.expense_retirement)
        profit = total_revenue - total_expense
        
        output.append({
            **r.model_dump(),
            "total_revenue": total_revenue,
            "total_expense": total_expense,
            "profit": profit
        })
    return output

@router.get("/monthly/{year}/{month}")
def get_monthly_profitloss_single(year: int, month: int, session: Session = Depends(get_session)):
    """Get a specific month's P/L record"""
    result = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Record not found")
    return result

@router.post("/monthly")
def create_monthly_profitloss(data: MonthlyPLCreate, session: Session = Depends(get_session)):
    """Create or update a monthly P/L record"""
    existing = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == data.year, MonthlyProfitLoss.month == data.month)
    ).first()
    
    if existing:
        for key, value in data.model_dump().items():
            setattr(existing, key, value)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        new_record = MonthlyProfitLoss(**data.model_dump())
        session.add(new_record)
        session.commit()
        session.refresh(new_record)
        return new_record

@router.put("/monthly/{id}")
def update_monthly_profitloss(id: int, data: MonthlyPLUpdate, session: Session = Depends(get_session)):
    """Update a monthly P/L record"""
    record = session.get(MonthlyProfitLoss, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    
    session.add(record)
    session.commit()
    session.refresh(record)
    return record

@router.delete("/monthly/{id}")
def delete_monthly_profitloss(id: int, session: Session = Depends(get_session)):
    """Delete a monthly P/L record"""
    record = session.get(MonthlyProfitLoss, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    session.delete(record)
    session.commit()
    return {"message": "Deleted successfully"}

# --- Daily Expense Endpoints ---

@router.get("/expenses/{year}/{month}")
def get_daily_expenses(year: int, month: int, session: Session = Depends(get_session)):
    """Get daily expenses for a specific month"""
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    results = session.exec(
        select(DailyExpense)
        .where(DailyExpense.date >= start_date, DailyExpense.date < end_date)
        .order_by(DailyExpense.date, DailyExpense.vendor_name)
    ).all()
    return results

@router.post("/expenses")
def create_daily_expense(data: DailyExpenseCreate, session: Session = Depends(get_session)):
    """Create a new daily expense entry"""
    new_expense = DailyExpense(**data.model_dump())
    session.add(new_expense)
    session.commit()
    session.refresh(new_expense)
    
    # Trigger sync to P/L summary
    sync_all_expenses(data.date.year, data.date.month, session)
    
    return new_expense

@router.put("/expenses/{id}")
def update_daily_expense(id: int, data: DailyExpenseCreate, session: Session = Depends(get_session)):
    """Update a daily expense entry"""
    record = session.get(DailyExpense, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    # Trigger sync to P/L summary
    sync_all_expenses(data.date.year, data.date.month, session)
    
    return record

@router.delete("/expenses/{id}")
def delete_daily_expense(id: int, session: Session = Depends(get_session)):
    """Delete a daily expense entry"""
    record = session.get(DailyExpense, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    session.delete(record)
    session.commit()
    return {"message": "Deleted successfully"}

# --- Delivery App Revenue Endpoints (쿠팡/배민/요기요/땡겨요) ---

@router.get("/delivery/{channel}/{year}")
def get_delivery_revenue(channel: str, year: int, session: Session = Depends(get_session)):
    """Get delivery app revenue for a specific channel and year"""
    start_date = datetime.date(year, 1, 1)
    end_date = datetime.date(year + 1, 1, 1)
    
    results = session.exec(
        select(Revenue)
        .where(Revenue.channel == channel)
        .where(Revenue.date >= start_date, Revenue.date < end_date)
        .order_by(Revenue.date)
    ).all()
    return results

@router.get("/delivery/{channel}/{year}/{month}")
def get_delivery_revenue_monthly(channel: str, year: int, month: int, session: Session = Depends(get_session)):
    """Get delivery app revenue for a specific channel, year and month"""
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    results = session.exec(
        select(Revenue)
        .where(Revenue.channel == channel)
        .where(Revenue.date >= start_date, Revenue.date < end_date)
        .order_by(Revenue.date)
    ).all()
    return results

@router.post("/delivery")
def create_delivery_revenue(data: DeliveryRevenueCreate, session: Session = Depends(get_session)):
    """Create a new delivery revenue entry"""
    new_revenue = Revenue(**data.model_dump())
    session.add(new_revenue)
    session.commit()
    session.refresh(new_revenue)
    return new_revenue

@router.put("/delivery/{id}")
def update_delivery_revenue(id: int, data: DeliveryRevenueCreate, session: Session = Depends(get_session)):
    """Update a delivery revenue entry"""
    record = session.get(Revenue, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    
    session.add(record)
    session.commit()
    session.refresh(record)
    return record

@router.delete("/delivery/{id}")
def delete_delivery_revenue(id: int, session: Session = Depends(get_session)):
    """Delete a delivery revenue entry"""
    record = session.get(Revenue, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    session.delete(record)
    session.commit()
    return {"message": "Deleted successfully"}

