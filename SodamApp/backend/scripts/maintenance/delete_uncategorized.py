"""Delete uncategorized vendors from database"""
from sqlmodel import Session, select
from database import engine
from models import Vendor

def delete_uncategorized():
    with Session(engine) as session:
        valid_expense_cats = ['food', 'supplies', 'equipment', 'rent', 'utility', 'labor', 'card_fee', 'marketing', 'insurance', 'other']
        valid_revenue_cats = ['delivery', 'store', 'other_revenue']
        all_valid = valid_expense_cats + valid_revenue_cats
        
        vendors = session.exec(select(Vendor)).all()
        uncategorized = [v for v in vendors if not v.category or v.category not in all_valid]
        
        print(f'미분류 업체 {len(uncategorized)}개 발견:')
        for v in uncategorized:
            vtype = getattr(v, 'vendor_type', 'unknown')
            print(f'  - {v.name} (category: {v.category}, type: {vtype})')
        
        if uncategorized:
            for v in uncategorized:
                session.delete(v)
            session.commit()
            print(f'\n{len(uncategorized)}개 업체 삭제 완료!')

if __name__ == "__main__":
    delete_uncategorized()
