from sqlmodel import Session, select
from database import engine
from models import Vendor

def inspect_categories():
    with Session(engine) as session:
        vendors = session.exec(select(Vendor)).all()
        categories = set(v.category for v in vendors)
        print(f"Total Vendors: {len(vendors)}")
        print(f"Distinct Categories: {categories}")
        
        # Check specifically for "unclassified" candidates
        valid_expense = ['식자재', '재료비', '임대료', '임대관리비', '제세공과금', '카드수수료', '부가가치세', '사업소득세', '근로소득세', 'other']
        valid_revenue = ['delivery', 'store', 'other_revenue']
        valid_all = set(valid_expense + valid_revenue)
        
        invalid_vendors = [v for v in vendors if v.category not in valid_all]
        print(f"Vendors with invalid/empty categories: {len(invalid_vendors)}")
        if invalid_vendors:
            print("Sample invalid categories:", set(v.category for v in invalid_vendors))
            print("Sample invalid vendor names:", [v.name for v in invalid_vendors[:5]])

if __name__ == "__main__":
    inspect_categories()
