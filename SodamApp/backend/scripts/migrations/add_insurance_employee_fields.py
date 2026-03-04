"""
Migration: Add expense_insurance_employee and expense_tax_employee columns
to monthlyprofitloss table.
"""
import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlalchemy import text, inspect

def migrate():
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('monthlyprofitloss')]
    
    with engine.begin() as conn:
        if 'expense_insurance_employee' not in columns:
            conn.execute(text(
                "ALTER TABLE monthlyprofitloss ADD COLUMN expense_insurance_employee INTEGER DEFAULT 0"
            ))
            print("  [OK] Added expense_insurance_employee column")
        else:
            print("  [OK] expense_insurance_employee already exists")
        
        if 'expense_tax_employee' not in columns:
            conn.execute(text(
                "ALTER TABLE monthlyprofitloss ADD COLUMN expense_tax_employee INTEGER DEFAULT 0"
            ))
            print("  [OK] Added expense_tax_employee column")
        else:
            print("  [OK] expense_tax_employee already exists")
    
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
