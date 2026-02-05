from sqlmodel import select, Session
from database import engine
from models import DailyExpense, Vendor

def cleanup():
    with Session(engine) as session:
        # 1. Get all valid vendor IDs
        vendor_ids = session.exec(select(Vendor.id)).all()
        existing_vendor_ids = set(vendor_ids)

        # 2. Find expenses with vendor_id that does not exist in Vendor table
        # We process in batches or fetch all if not too many. Fetching all for now.
        orphaned_expenses = session.exec(
            select(DailyExpense).where(DailyExpense.vendor_id != None)
        ).all()
        
        deleted_count = 0
        deleted_names = set()

        for expense in orphaned_expenses:
            if expense.vendor_id not in existing_vendor_ids:
                deleted_names.add(expense.vendor_name or f"ID:{expense.vendor_id}")
                session.delete(expense)
                deleted_count += 1
        
        if deleted_count > 0:
            session.commit()
            print(f"✅ Successfully deleted {deleted_count} orphaned expense records.")
            print(f"🗑️  Deleted Vendors: {', '.join(list(deleted_names)[:10])}{'...' if len(deleted_names) > 10 else ''}")
        else:
            print("✨ No orphaned expenses found. Database is clean.")

if __name__ == "__main__":
    cleanup()
