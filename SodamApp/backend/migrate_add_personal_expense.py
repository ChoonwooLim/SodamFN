from sqlmodel import Session, text
from database import engine

def migrate():
    with Session(engine) as session:
        print("Adding expense_personal column to monthlyprofitloss table...")
        try:
            session.exec(text("ALTER TABLE monthlyprofitloss ADD COLUMN expense_personal INTEGER DEFAULT 0"))
            session.commit()
            print("Migration successful: Added expense_personal to monthlyprofitloss.")
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    migrate()
