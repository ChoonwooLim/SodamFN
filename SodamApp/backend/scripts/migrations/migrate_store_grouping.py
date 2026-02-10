from services.database_service import DatabaseService
from models import Vendor, DailyExpense
from sqlmodel import select

def migrate_store_grouping():
    service = DatabaseService()
    session = service.session
    
    print("Starting Store Grouping Migration...")
    
    # 1. Handle redundant '소담김밥' vendor (ID 263 presumably)
    sodam_vendor = session.exec(select(Vendor).where(Vendor.name == '소담김밥')).first()
    cash_vendor = session.exec(select(Vendor).where(Vendor.name == '현금매출')).first()
    
    if sodam_vendor and cash_vendor:
        print(f"  Found '소담김밥' (ID: {sodam_vendor.id}) and '현금매출' (ID: {cash_vendor.id}).")
        
        # Reassign expenses
        expenses = session.exec(select(DailyExpense).where(DailyExpense.vendor_id == sodam_vendor.id)).all()
        if expenses:
            print(f"    Reassigning {len(expenses)} expenses from '소담김밥' to '현금매출'...")
            for exp in expenses:
                exp.vendor_id = cash_vendor.id
                session.add(exp)
        
        # Delete redundant vendor
        print("    Deleting '소담김밥' vendor...")
        session.delete(sodam_vendor)
    elif sodam_vendor and not cash_vendor:
        print("  [WARNING] '소담김밥' found but '현금매출' NOT found. Renaming '소담김밥' to '현금매출' instead.")
        sodam_vendor.name = '현금매출'
        sodam_vendor.item = '소담김밥:cash' # Will be set in loop, but setting here for safety
        session.add(sodam_vendor)
        cash_vendor = sodam_vendor # Treat as cash vendor now
        
    session.flush()
    
    # 2. Update item strings for grouping
    # Target format: "StoreName:Type" (e.g., "소담김밥:cash", "소담김밥:card")
    
    store_vendors = session.exec(select(Vendor).where(Vendor.category == 'store')).all()
    print(f"  Updating {len(store_vendors)} store vendors...")
    
    for v in store_vendors:
        current_item = v.item or ''
        
        # If already migrated (contains colon), skip
        if ':' in current_item:
            continue
            
        new_item = current_item
        
        # Default grouping for existing vendors is '소담김밥'
        if current_item == 'cash':
            new_item = '소담김밥:cash'
        elif current_item == 'card':
            new_item = '소담김밥:card'
        else:
            # Fallback for others
            new_item = f"소담김밥:{current_item if current_item else 'other'}"
            
        if new_item != current_item:
            v.item = new_item
            session.add(v)
            print(f"    Updated '{v.name}': '{current_item}' -> '{new_item}'")
            
    session.commit()
    print("Migration Complete.")

if __name__ == "__main__":
    migrate_store_grouping()
