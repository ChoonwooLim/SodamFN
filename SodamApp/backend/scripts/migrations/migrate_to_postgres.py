"""
Migrate data from local SQLite to Render PostgreSQL
Run this script locally to copy all data to the production database.
"""
import os
from sqlmodel import Session, create_engine, select
from models import (
    Vendor, DailyExpense, Revenue, Expense, MonthlyProfitLoss, 
    Staff, Payroll, Attendance, Product, User, ElectronicContract, CompanyHoliday,
    StaffDocument, CardSalesApproval, CardPayment, Inventory, GlobalSetting
)

# Source: Local SQLite
SQLITE_URL = "sqlite:///sodam_database.db"
sqlite_engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})

# Target: Render PostgreSQL (paste your External Database URL here)
POSTGRES_URL = os.environ.get("TARGET_DATABASE_URL")

if not POSTGRES_URL:
    print("ERROR: Set TARGET_DATABASE_URL environment variable")
    print("Example: set TARGET_DATABASE_URL=postgresql://sodamfn_user:PASSWORD@HOST/sodamfn")
    exit(1)

# Fix postgres:// to postgresql://
if POSTGRES_URL.startswith("postgres://"):
    POSTGRES_URL = POSTGRES_URL.replace("postgres://", "postgresql://", 1)

postgres_engine = create_engine(POSTGRES_URL)

# Models to migrate (in order of dependencies)
MODELS = [
    Vendor,
    Product,
    Inventory,
    Staff,
    User,
    DailyExpense,
    Revenue,
    Expense,
    MonthlyProfitLoss,
    Payroll,
    Attendance,
    ElectronicContract,
    CompanyHoliday,
    StaffDocument,
    CardSalesApproval,
    CardPayment,
    GlobalSetting,
]

def migrate():
    print("Starting migration from SQLite to PostgreSQL...")
    
    # Create tables in PostgreSQL
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(postgres_engine)
    print("✓ Created tables in PostgreSQL")
    
    with Session(sqlite_engine) as sqlite_session:
        with Session(postgres_engine) as pg_session:
            for model in MODELS:
                try:
                    records = sqlite_session.exec(select(model)).all()
                    count = len(records)
                    
                    if count == 0:
                        print(f"  {model.__name__}: 0 records (skipped)")
                        continue
                    
                    for record in records:
                        # Create a new instance with same data
                        data = record.model_dump()
                        new_record = model(**data)
                        pg_session.merge(new_record)  # merge handles existing IDs
                    
                    pg_session.commit()
                    print(f"✓ {model.__name__}: {count} records migrated")
                    
                except Exception as e:
                    print(f"✗ {model.__name__}: Error - {str(e)[:100]}")
                    pg_session.rollback()
    
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    migrate()
