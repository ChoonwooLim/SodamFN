import sys
import os

# Add the project root to the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from database import engine

def apply_indexes():
    print("Applying optimization indexes to the database...")
    queries = [
        # DailyExpense
        "CREATE INDEX IF NOT EXISTS ix_dailyexpense_business_date ON dailyexpense (business_id, date);",
        "CREATE INDEX IF NOT EXISTS ix_dailyexpense_business_vendor ON dailyexpense (business_id, vendor_id);",
        
        # MonthlyProfitLoss
        "ALTER TABLE monthlyprofitloss ADD CONSTRAINT uq_monthlypl_business_year_month UNIQUE (business_id, year, month);",
        
        # Attendance
        "CREATE INDEX IF NOT EXISTS ix_attendance_staff_date ON attendance (staff_id, date);",
        
        # Payroll
        "ALTER TABLE payroll ADD CONSTRAINT uq_payroll_staff_month UNIQUE (staff_id, month);"
    ]
    
    with engine.connect() as conn:
        for q in queries:
            try:
                conn.execute(text(q))
                print(f"Success: {q}")
            except Exception as e:
                # E.g. constraints might already exist
                error_msg = str(e)
                if 'already exists' in error_msg.lower():
                    print(f"Skipped (Already exists): {q}")
                else:
                    print(f"Error applying {q}: {e}")
        
        conn.commit()
    print("Done applying optimization indexes.")

if __name__ == "__main__":
    apply_indexes()
