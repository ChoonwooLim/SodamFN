import sys
import os

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from database import engine
from models import MonthlyProfitLoss
from services.profit_loss_service import sync_revenue_to_pl

def verify_fix():
    year = 2026
    month = 1
    
    with Session(engine) as session:
        # 1. Check current value
        pl_accord = session.exec(
            select(MonthlyProfitLoss)
            .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
        ).first()
        
        old_revenue = pl_accord.revenue_store if pl_accord else 0
        print(f"Old Store Revenue (Jan 2026): {old_revenue:,}")
        
        # 2. Trigger Sync
        print("Triggering sync_revenue_to_pl...")
        sync_revenue_to_pl(year, month, session)
        
        # 3. Check new value
        session.refresh(pl_accord)
        new_revenue = pl_accord.revenue_store
        print(f"New Store Revenue (Jan 2026): {new_revenue:,}")
        
        diff = new_revenue - old_revenue
        print(f"Difference: {diff:,}")

if __name__ == "__main__":
    verify_fix()
