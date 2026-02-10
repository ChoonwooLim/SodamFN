"""
Sync all DailyExpense records to match their Vendor's category and vendor_id.
This ensures both tables have consistent data.
"""
from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense

def sync_expense_to_vendors():
    """Sync DailyExpense category and vendor_id from their Vendor records"""
    with Session(engine) as session:
        # Get all vendors
        vendors = session.exec(select(Vendor)).all()
        vendor_map = {v.name: v for v in vendors}
        
        # Get all expenses
        expenses = session.exec(select(DailyExpense)).all()
        
        updated_count = 0
        orphan_count = 0
        
        for expense in expenses:
            if expense.vendor_name in vendor_map:
                vendor = vendor_map[expense.vendor_name]
                changed = False
                
                # Sync vendor_id
                if expense.vendor_id != vendor.id:
                    expense.vendor_id = vendor.id
                    changed = True
                
                # Sync category
                if vendor.category and expense.category != vendor.category:
                    expense.category = vendor.category
                    changed = True
                
                if changed:
                    session.add(expense)
                    updated_count += 1
            else:
                orphan_count += 1
        
        session.commit()
        
        print(f"총 DailyExpense 레코드: {len(expenses)}")
        print(f"총 Vendor 레코드: {len(vendors)}")
        print(f"✅ 업데이트된 DailyExpense: {updated_count}건")
        print(f"⚠️ 고아 레코드 (Vendor 없음): {orphan_count}건")

if __name__ == "__main__":
    print("=== Vendor → DailyExpense 동기화 ===\n")
    sync_expense_to_vendors()
    print("\n✅ 동기화 완료!")
