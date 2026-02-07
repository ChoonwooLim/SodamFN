from services.database_service import DatabaseService
from models import Vendor
from sqlmodel import select

def add_store_revenue_vendors():
    service = DatabaseService()
    session = service.session
    
    # 1. Define vendors to add
    # Format: (Name, Item/Group)
    new_vendors = [
        ("현금매출", "cash"),
        ("신한카드", "card"),
        ("삼성카드", "card"),
        ("현대카드", "card"),
        ("KB국민카드", "card"),
        ("롯데카드", "card"),
        ("하나카드", "card"),
        ("우리카드", "card"),
        ("NH농협카드", "card"),
        ("비씨카드", "card"),
        ("기타카드", "card")
    ]
    
    added_count = 0
    print("Adding Store Revenue Vendors...")
    
    for name, item_group in new_vendors:
        # Check if already exists in 'store' category
        existing = session.exec(
            select(Vendor)
            .where(Vendor.name == name)
            .where(Vendor.category == 'store')
        ).first()
        
        if existing:
            print(f"  [SKIP] '{name}' already exists.")
            # Update item group if missing
            if existing.item != item_group:
                existing.item = item_group
                session.add(existing)
                print(f"    -> Updated item to '{item_group}'")
        else:
            new_vendor = Vendor(
                name=name,
                category='store',
                vendor_type='revenue',
                item=item_group,  # identifying group on frontend
                order_index=100  # Default order
            )
            session.add(new_vendor)
            print(f"  [ADD] '{name}' created.")
            added_count += 1
            
    # Check existing '소담김밥' vendor
    sodam = session.exec(select(Vendor).where(Vendor.name == '소담김밥')).first()
    if sodam:
        print(f"  [INFO] Found existing '소담김밥' vendor (ID: {sodam.id}). Leaving as is.")
        # We might want to migrate its data or just keep it. 
        # For now, we keep it. Frontend can handle display.

    if added_count > 0:
        session.commit()
        print(f"Successfully added {added_count} new vendors.")
    else:
        session.commit() # Commit updates if any
        print("No new vendors added (updates committed).")

if __name__ == "__main__":
    add_store_revenue_vendors()
