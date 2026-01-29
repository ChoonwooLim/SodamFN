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

# --- Monthly P/L Endpoints ---

@router.get("/monthly")
def get_monthly_profitloss(year: Optional[int] = None, session: Session = Depends(get_session)):
    """Get all monthly P/L records, optionally filtered by year"""
    query = select(MonthlyProfitLoss)
    if year:
        query = query.where(MonthlyProfitLoss.year == year)
    query = query.order_by(MonthlyProfitLoss.year, MonthlyProfitLoss.month)
    results = session.exec(query).all()
    
    # Calculate totals for each record
    output = []
    for r in results:
        # Auto-sync material cost if it's 0 (backfill)
        if r.expense_material == 0:
            start_date = datetime.date(r.year, r.month, 1)
            if r.month == 12:
                end_date = datetime.date(r.year + 1, 1, 1)
            else:
                end_date = datetime.date(r.year, r.month + 1, 1)
            
            from sqlmodel import func
            total_material = session.exec(
                select(func.sum(DailyExpense.amount))
                .where(
                    DailyExpense.date >= start_date, 
                    DailyExpense.date < end_date,
                    DailyExpense.category == "재료비"
                )
            ).one() or 0
            
            if total_material > 0:
                r.expense_material = int(total_material)
                session.add(r)
                session.commit()
                session.refresh(r)

        total_revenue = r.revenue_store + r.revenue_coupang + r.revenue_baemin + r.revenue_yogiyo + r.revenue_ddangyo
        total_expense = (r.expense_labor + r.expense_rent + r.expense_utility + 
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
    
    # Trigger sync to summary
    sync_summary_material_cost(data.date.year, data.date.month, session)
    
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

