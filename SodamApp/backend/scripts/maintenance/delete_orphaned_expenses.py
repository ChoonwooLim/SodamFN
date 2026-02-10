from sqlmodel import select, Session
from database import engine
from models import DailyExpense, Vendor
import sys
import os

# Add current directory to path just in case
sys.path.append(os.getcwd())

def cleanup():
    print("Starting cleanup...")
    try:
        with Session(engine) as session:
            # 1. Get all valid vendor IDs
            vendor_ids = session.exec(select(Vendor.id)).all()
            existing_vendor_ids = set(vendor_ids)
            print(f"Found {len(existing_vendor_ids)} valid vendors.")

            # 2. Find expenses with vendor_id that does not exist in Vendor table
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
                # Show first 10 names
                names_list = list(deleted_names)
                print(f"🗑️  Deleted Vendors: {', '.join(names_list[:10])}{'...' if len(names_list) > 10 else ''}")
            else:
                print("✨ No orphaned expenses found. Database is clean.")
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()
