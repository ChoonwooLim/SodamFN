import sys
import os
from datetime import date
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor, Revenue

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def analyze_revenue():
    year = 2026
    month = 1
    start_date = date(year, month, 1)
    end_date = date(year, month + 1, 1)

    with Session(engine) as session:
        print(f"--- Analysis for {year}-{month} ---")

        # 1. Revenue Management Logic (get_revenue_summary)
        revenue_vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == "revenue")
        ).all()
        vendor_ids = [v.id for v in revenue_vendors]
        
        # DailyExpense (Store + some Delivery)
        expenses = session.exec(
            select(DailyExpense)
            .where(
                DailyExpense.vendor_id.in_(vendor_ids),
                DailyExpense.date >= start_date,
                DailyExpense.date < end_date
            )
        ).all()
        
        rev_mgmt_expense_total = sum(e.amount or 0 for e in expenses)
        print(f"[RevMgmt] DailyExpense Total: {rev_mgmt_expense_total:,}")
        
        # Group by category
        by_cat = {}
        for e in expenses:
            cat = e.category or "None"
            by_cat[cat] = by_cat.get(cat, 0) + (e.amount or 0)
        print(f"[RevMgmt] Expense Breakdown: {by_cat}")

        # Revenue Table (Delivery Apps)
        revenue_entries = session.exec(
            select(Revenue)
            .where(Revenue.date >= start_date, Revenue.date < end_date)
        ).all()
        rev_mgmt_revenue_table_total = sum(r.amount or 0 for r in revenue_entries)
        print(f"[RevMgmt] Revenue Table Total: {rev_mgmt_revenue_table_total:,}")
        
        rev_mgmt_total = rev_mgmt_expense_total + rev_mgmt_revenue_table_total
        print(f"[RevMgmt] GRAND TOTAL: {rev_mgmt_total:,}")
        
        print("-" * 30)

        # 2. Profit & Loss Logic (sync_revenue_to_pl)
        
        # Store Revenue (My Fix Logic)
        store_vendors = session.exec(
            select(Vendor).where(
                Vendor.vendor_type == "revenue", 
                Vendor.category == "store"
            )
        ).all()
        store_vendor_ids = [v.id for v in store_vendors]
        
        pl_store_expenses = session.exec(
            select(DailyExpense)
            .where(
                DailyExpense.vendor_id.in_(store_vendor_ids),
                DailyExpense.date >= start_date,
                DailyExpense.date < end_date,
            )
        ).all()
        pl_store_total = sum(e.amount or 0 for e in pl_store_expenses)
        print(f"[P/L] Store Revenue (Fixed Logic): {pl_store_total:,}")

        # Delivery Revenue
        # Logic: DailyExpense(category='delivery') + Revenue Table
        
        # 2a. DailyExpense(category='delivery')
        pl_delivery_expenses = session.exec(
            select(DailyExpense)
            .where(
                DailyExpense.category == "delivery",
                DailyExpense.date >= start_date,
                DailyExpense.date < end_date,
            )
        ).all()
        pl_delivery_expense_total = sum(e.amount or 0 for e in pl_delivery_expenses)
        print(f"[P/L] Delivery Expense (DailyExpense): {pl_delivery_expense_total:,}")
        
        # 2b. Revenue Table (Same as above)
        print(f"[P/L] Delivery Revenue (Revenue Table): {rev_mgmt_revenue_table_total:,}")
        
        pl_delivery_total = pl_delivery_expense_total + rev_mgmt_revenue_table_total
        print(f"[P/L] Total Delivery: {pl_delivery_total:,}")
        
        pl_grand_total = pl_store_total + pl_delivery_total
        print(f"[P/L] GRAND TOTAL: {pl_grand_total:,}")

if __name__ == "__main__":
    analyze_revenue()
