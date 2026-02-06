from sqlmodel import Session, select, delete
from database import engine
from models import DailyExpense, Vendor
from datetime import date

def delete_data():
    with Session(engine) as session:
        # 1. Delete DailyExpense for Jan/Feb 2026
        start_date = date(2026, 1, 1)
        end_date = date(2026, 2, 28)
        
        statement = select(DailyExpense).where(DailyExpense.date >= start_date).where(DailyExpense.date <= end_date)
        results = session.exec(statement).all()
        
        delete_count = 0
        for expense in results:
            session.delete(expense)
            delete_count += 1
            
        print(f"Deleted {delete_count} DailyExpense records between {start_date} and {end_date}.")

        # 2. Delete Vendors with Invalid Categories
        # Valid categories from VendorSettings.jsx
        valid_categories = {
            '식자재', '재료비', '임대료', '임대관리비', '제세공과금', '카드수수료', 
            '부가가치세', '사업소득세', '근로소득세', 'other',
            'delivery', 'store', 'other_revenue'
        }
        
        # Select all vendors
        all_vendors = session.exec(select(Vendor)).all()
        
        vendor_delete_count = 0
        for vendor in all_vendors:
            # If category is None/Empty OR not in the valid list, delete it.
            if not vendor.category or vendor.category not in valid_categories:
                session.delete(vendor)
                vendor_delete_count += 1
            
        print(f"Deleted {vendor_delete_count} Vendor records with invalid or empty categories.")
        
        session.commit()
        print("Commit successful.")

if __name__ == "__main__":
    delete_data()
