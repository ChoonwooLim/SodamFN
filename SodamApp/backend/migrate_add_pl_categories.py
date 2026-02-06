"""
Add expense_ingredient and expense_other fields to MonthlyProfitLoss table.
"""
from sqlmodel import Session, create_engine, text
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn"
)

engine = create_engine(DATABASE_URL)

def migrate():
    with Session(engine) as session:
        # Add expense_ingredient column
        try:
            session.execute(text("ALTER TABLE monthlyprofitloss ADD COLUMN expense_ingredient INTEGER DEFAULT 0"))
            print("✓ Added expense_ingredient column")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("- expense_ingredient column already exists")
            else:
                print(f"Error adding expense_ingredient: {e}")
        
        # Add expense_other column
        try:
            session.execute(text("ALTER TABLE monthlyprofitloss ADD COLUMN expense_other INTEGER DEFAULT 0"))
            print("✓ Added expense_other column")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("- expense_other column already exists")
            else:
                print(f"Error adding expense_other: {e}")
        
        session.commit()
        print("\n마이그레이션 완료!")

if __name__ == "__main__":
    migrate()
