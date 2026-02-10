from services.database_service import DatabaseService
from models import Vendor, DailyExpense
from sqlmodel import select, col

def debug_expense_linkage():
    service = DatabaseService()
    session = service.session
    
    target_names = ['찬들농산(김영민)', '홍성상회', '은제민(고구마켓)']
    print(f"Checking linkage for: {target_names}\n")

    for name in target_names:
        print(f"--- Vendor: {name} ---")
        # 1. Start by finding the Vendor ID
        vendor = session.exec(select(Vendor).where(Vendor.name == name)).first()
        if not vendor:
            print(f"  [ERROR] Vendor record NOT FOUND in 'Vendor' table.")
            # Verify if maybe partial match?
            partial = session.exec(select(Vendor).where(col(Vendor.name).contains(name[:2]))).all()
            if partial:
                print(f"  Did you mean: {[v.name for v in partial]}?")
            continue
            
        print(f"  Vendor ID: {vendor.id}")
        
        # 2. Check DailyExpense records for 2026-01
        start_date = '2026-01-01'
        end_date = '2026-01-31'
        
        # Check by vendor_id
        expenses_by_id = session.exec(
            select(DailyExpense)
            .where(DailyExpense.vendor_id == vendor.id)
            .where(DailyExpense.date >= start_date)
            .where(DailyExpense.date <= end_date)
        ).all()
        
        sum_by_id = sum(e.amount for e in expenses_by_id)
        print(f"  Expenses linked by vendor_id ({vendor.id}): Count={len(expenses_by_id)}, Sum={sum_by_id}")
        
        # Check by vendor_name text (how Monthly Expenses likely sees it if not linked)
        expenses_by_name = session.exec(
            select(DailyExpense)
            .where(DailyExpense.vendor_name == name)
            .where(DailyExpense.date >= start_date)
            .where(DailyExpense.date <= end_date)
        ).all()
        
        sum_by_name = sum(e.amount for e in expenses_by_name)
        print(f"  Expenses with vendor_name='{name}': Count={len(expenses_by_name)}, Sum={sum_by_name}")
        
        # Discrepancy Check
        unlinked = [e for e in expenses_by_name if e.vendor_id != vendor.id]
        if unlinked:
            print(f"  [WARNING] Found {len(unlinked)} expenses with correct name but WRONG/NULL vendor_id!")
            for e in unlinked[:3]:
                print(f"    - ID: {e.id}, Date: {e.date}, Amount: {e.amount}, linked vendor_id: {e.vendor_id}")
        else:
            print(f"  [OK] All text-matched expenses are correctly linked to vendor_id.")

if __name__ == "__main__":
    debug_expense_linkage()
