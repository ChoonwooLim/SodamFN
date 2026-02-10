from sqlmodel import select, Session
from database import engine
from models import DailyExpense
import sys
import os

# Add current directory to path just in case
sys.path.append(os.getcwd())

def cleanup_uncategorized():
    print("Starting cleanup of uncategorized expenses...")
    try:
        with Session(engine) as session:
            # Find expenses with vendor_id IS NULL
            uncategorized_expenses = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == None)
            ).all()
            
            count = len(uncategorized_expenses)
            
            if count > 0:
                print(f"Found {count} uncategorized expenses.")
                
                # Delete them
                for expense in uncategorized_expenses:
                    session.delete(expense)
                
                session.commit()
                print(f"✅ Successfully deleted {count} uncategorized expense records.")
            else:
                print("✨ No uncategorized expenses found.")
                
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup_uncategorized()
