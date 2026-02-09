"""Backfill: re-sync all P/L data with corrected sync logic."""
from sqlmodel import Session, select
from database import engine
from models import MonthlyProfitLoss
from services.profit_loss_service import sync_all_expenses, sync_delivery_revenue_to_pl, sync_labor_cost

with Session(engine) as session:
    records = session.exec(select(MonthlyProfitLoss)).all()
    
    for pl in records:
        year, month = pl.year, pl.month
        print(f"Syncing {year}-{month:02d}...")
        
        # Re-sync expenses (now excludes revenue vendors)
        expense_result = sync_all_expenses(year, month, session)
        
        # Re-sync revenue (both store & delivery)
        revenue_result = sync_delivery_revenue_to_pl(year, month, session)
        
        # Re-sync labor (from Payroll)
        labor = sync_labor_cost(year, month, session)
        
        print(f"  expenses: {expense_result}")
        print(f"  revenue: {revenue_result}")
        print(f"  labor: {labor}")

print("\n✅ Backfill complete!")
