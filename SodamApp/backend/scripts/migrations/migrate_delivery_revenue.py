"""
Migration: Create DeliveryRevenue table
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import SQLModel
from database import engine
from models import DeliveryRevenue

def migrate():
    print("Creating DeliveryRevenue table...")
    SQLModel.metadata.create_all(engine, tables=[DeliveryRevenue.__table__])
    print("Done! DeliveryRevenue table created.")

if __name__ == "__main__":
    migrate()
