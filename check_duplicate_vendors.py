import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'SodamApp'))
from sqlmodel import Session, select, func
from backend.database import engine
from backend.models import Vendor

def check_duplicates():
    with Session(engine) as session:
        # Count vendors by name
        stmt = select(Vendor.name, func.count(Vendor.id)).group_by(Vendor.name).having(func.count(Vendor.id) > 1)
        results = session.exec(stmt).all()
        
        print(f"Found {len(results)} names with duplicates:")
        for name, count in results:
            print(f"- {name}: {count}")

        # Specifically check '현금매출'
        cash_stmt = select(Vendor).where(Vendor.name == '현금매출')
        cash_vendors = session.exec(cash_stmt).all()
        print(f"\n'현금매출' vendors: {len(cash_vendors)}")
        for v in cash_vendors:
            print(f"  ID: {v.id}, Name: {v.name}, Item: {v.item}, Group: {v.category}")

if __name__ == "__main__":
    check_duplicates()
