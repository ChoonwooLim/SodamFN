import sys
import os
from datetime import date
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor
from services.profit_loss_service import sync_revenue_to_pl

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def migrate_revenue_to_gross():
    # Target period: Jan 2026 (and potentially Dec 2025 if needed, but user focused on Jan)
    # Let's do Jan 2026 only for now as requested.
    year = 2026
    month = 1
    start_date = date(year, month, 1)
    end_date = date(year, month + 1, 1)

    with Session(engine) as session:
        print(f"--- Migrating Revenue to Gross for {year}-{month} ---")
        
        # 1. Get Store Vendors
        store_vendors = session.exec(
            select(Vendor).where(
                Vendor.vendor_type == "revenue", 
                Vendor.category == "store"
            )
        ).all()
        store_vendor_ids = [v.id for v in store_vendors]
        
        # 2. Get Expenses
        expenses = session.exec(
            select(DailyExpense)
            .where(
                DailyExpense.vendor_id.in_(store_vendor_ids),
                DailyExpense.date >= start_date,
                DailyExpense.date < end_date
            )
        ).all()
        
        print(f"Found {len(expenses)} store revenue records.")
        old_total = sum(e.amount or 0 for e in expenses)
        print(f"Old Total (Net): {old_total:,}")
        
        # 3. Update Amount
        # Apply 1.1 multiplier (Net -> Gross approx)
        # Note regarding integer truncation: int(val * 1.1)
        for e in expenses:
            if e.amount:
                # To be precise: The VAT ratio is usually 1.1. 
                # e.amount is Net. New Amount = Net * 1.1.
                new_amount = int(e.amount * 1.1)
                e.amount = new_amount
                session.add(e)
        
        session.commit()
        
        # Refresh to check
        new_total = sum(e.amount or 0 for e in expenses)
        print(f"New Total (Gross): {new_total:,}")
        print(f"Increase: {new_total - old_total:,}")
        
        # 4. Sync P/L
        print("Syncing to Profit & Loss...")
        sync_revenue_to_pl(year, month, session)
        
        print("Migration Complete.")

if __name__ == "__main__":
    migrate_revenue_to_gross()
