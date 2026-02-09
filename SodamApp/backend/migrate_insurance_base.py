"""
Migration: Add insurance_base_salary to Staff and bonus_tax_support to Payroll
Supports both SQLite and PostgreSQL via DATABASE_URL
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    # Fallback to SQLite
    DATABASE_URL = "sqlite:///sodam_database.db"

from sqlalchemy import create_engine, text, inspect

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # Check and add insurance_base_salary to staff table
        staff_columns = [col['name'] for col in inspector.get_columns('staff')]
        
        if "insurance_base_salary" not in staff_columns:
            conn.execute(text("ALTER TABLE staff ADD COLUMN insurance_base_salary INTEGER DEFAULT 0"))
            print("✅ Added 'insurance_base_salary' column to staff table")
        else:
            print("ℹ️  'insurance_base_salary' column already exists in staff table")
        
        # Check and add bonus_tax_support to payroll table
        payroll_columns = [col['name'] for col in inspector.get_columns('payroll')]
        
        if "bonus_tax_support" not in payroll_columns:
            conn.execute(text("ALTER TABLE payroll ADD COLUMN bonus_tax_support INTEGER DEFAULT 0"))
            print("✅ Added 'bonus_tax_support' column to payroll table")
        else:
            print("ℹ️  'bonus_tax_support' column already exists in payroll table")
        
        conn.commit()
    
    print(f"\n🎉 Migration completed successfully!")
    print(f"📦 Database: {'PostgreSQL' if 'postgresql' in DATABASE_URL else 'SQLite'}")

if __name__ == "__main__":
    migrate()
