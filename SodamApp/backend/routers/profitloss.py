from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import MonthlyProfitLoss, DailyExpense, Revenue, Vendor
from pydantic import BaseModel
from typing import Optional, List
import datetime
from services.profit_loss_service import (
    sync_all_expenses, 
    sync_labor_cost, 
    sync_summary_material_cost, 
    sync_delivery_revenue_to_pl,
    CATEGORY_TO_PL_FIELD
)

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
    """Get daily expenses for a specific month (revenue vendors excluded)"""
    from models import Vendor
    
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # DailyExpense와 Vendor를 조인하여 최신 벤더 정보를 가져옵니다.
    # revenue vendor는 제외 (매출관리에서 별도 관리)
    statement = (
        select(DailyExpense, Vendor)
        .join(Vendor, DailyExpense.vendor_id == Vendor.id, isouter=True)
        .where(
            DailyExpense.date >= start_date,
            DailyExpense.date < end_date,
        )
        .order_by(DailyExpense.date, DailyExpense.vendor_name)
    )
    
    results = session.exec(statement).all()
    
    output = []
    for expense, vendor in results:
        # Skip revenue vendor expenses — they belong to 매출관리, not 월별비용
        if vendor and vendor.vendor_type == "revenue":
            continue
        if vendor:
            expense.vendor_name = vendor.name
            if vendor.category:
                expense.category = vendor.category
        output.append(expense)
        
    return output

@router.post("/expenses")
def create_daily_expense(data: DailyExpenseCreate, session: Session = Depends(get_session)):
    """Create a new daily expense entry"""
    # Auto-link to Vendor by vendor_name
    if data.vendor_name:
        vendor = session.exec(
            select(Vendor).where(Vendor.name == data.vendor_name)
        ).first()
        if not vendor:
            raise HTTPException(
                status_code=400, 
                detail=f"거래처 '{data.vendor_name}'이(가) 거래처 관리에 등록되어 있지 않습니다. 먼저 거래처를 등록해주세요."
            )
        # Set vendor_id and sync category from Vendor
        expense_data = data.model_dump()
        expense_data['vendor_id'] = vendor.id
        if vendor.category:
            expense_data['category'] = vendor.category
        new_expense = DailyExpense(**expense_data)
    else:
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
    
    # Auto-link to Vendor by vendor_name
    if data.vendor_name:
        vendor = session.exec(
            select(Vendor).where(Vendor.name == data.vendor_name)
        ).first()
        if not vendor:
            raise HTTPException(
                status_code=400, 
                detail=f"거래처 '{data.vendor_name}'이(가) 거래처 관리에 등록되어 있지 않습니다. 먼저 거래처를 등록해주세요."
            )
        record.vendor_id = vendor.id
        if vendor.category:
            record.category = vendor.category
    
    for key, value in data.model_dump().items():
        if key not in ['vendor_id']:  # vendor_id is handled above
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

    # Sync to MonthlyProfitLoss
    sync_delivery_revenue_to_pl(new_revenue.date.year, new_revenue.date.month, session)

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

    # Sync to MonthlyProfitLoss
    sync_delivery_revenue_to_pl(record.date.year, record.date.month, session)

    return record

@router.delete("/delivery/{id}")
def delete_delivery_revenue(id: int, session: Session = Depends(get_session)):
    """Delete a delivery revenue entry"""
    record = session.get(Revenue, id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record_year = record.date.year
    record_month = record.date.month
    session.delete(record)
    session.commit()

    # Sync to MonthlyProfitLoss
    sync_delivery_revenue_to_pl(record_year, record_month, session)

    return {"message": "Deleted successfully"}

