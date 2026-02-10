from services.database_service import DatabaseService
from models import Vendor, DailyExpense
from sqlmodel import select

def fix_missing_vendor_ids():
    service = DatabaseService()
    session = service.session
    
    # 1. Find all vendors to create a name -> id map
    vendors = session.exec(select(Vendor)).all()
    vendor_map = {v.name: v.id for v in vendors}
    print(f"Loaded {len(vendor_map)} vendors.")
    
    # 2. Find expenses with NULL vendor_id but valid vendor_name
    stmt = select(DailyExpense).where(DailyExpense.vendor_id == None)
    expenses = session.exec(stmt).all()
    print(f"Found {len(expenses)} expenses with NULL vendor_id.")
    
    updated_count = 0
    for expense in expenses:
        if expense.vendor_name in vendor_map:
            expense.vendor_id = vendor_map[expense.vendor_name]
            session.add(expense)
            updated_count += 1
            if updated_count % 100 == 0:
                print(f"  Linked {updated_count} expenses...")
    
    if updated_count > 0:
        session.commit()
        print(f"Successfully linked {updated_count} expenses to existing vendors.")
    else:
        print("No expenses needed linking.")

if __name__ == "__main__":
    fix_missing_vendor_ids()
