import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'SodamApp'))
from sqlmodel import Session, select
from backend.database import engine
from backend.models import Vendor

def list_vendors():
    with Session(engine) as session:
        vendors = session.exec(select(Vendor)).all()
        print(f"Total Vendors: {len(vendors)}")
        print("--- Vendor List ---")
        for v in vendors:
            print(f"ID: {v.id}, Name: '{v.name}', Group: {v.category}, Item: '{v.item}'")

if __name__ == "__main__":
    list_vendors()
