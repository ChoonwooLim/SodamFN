from sqlmodel import Session
from database import engine
from services.profit_loss_service import sync_all_expenses

def run_backfill():
    print("Starting P/L Backfill for 2025...")
    with Session(engine) as session:
        for month in range(1, 13):
            print(f"Syncing 2025-{month:02d}...")
            sync_all_expenses(2025, month, session)
            
        # Optional: 2024 if needed
        # for month in range(1, 13):
        #     sync_all_expenses(2024, month, session)
            
    print("Backfill Complete!")

if __name__ == "__main__":
    run_backfill()
