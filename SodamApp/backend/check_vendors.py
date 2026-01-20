"""Check vendor categories in database"""
from sqlmodel import Session, select
from database import engine
from models import Vendor

with Session(engine) as session:
    vendors = session.exec(select(Vendor)).all()
    print(f'Total vendors: {len(vendors)}')
    
    # Show unique categories
    categories = set()
    for v in vendors:
        categories.add(v.category)
    
    print('Unique categories:', categories)
    
    # Valid categories
    valid_expense = ['food', 'supplies', 'equipment', 'rent', 'utility', 'labor', 'card_fee', 'marketing', 'insurance', 'other']
    valid_revenue = ['delivery', 'store', 'other_revenue']
    all_valid = valid_expense + valid_revenue
    
    # Find vendors with invalid categories
    invalid = [v for v in vendors if v.category not in all_valid]
    print(f'\nVendors with invalid category: {len(invalid)}')
    for v in invalid[:15]:
        print(f'  - {v.name}: "{v.category}"')
