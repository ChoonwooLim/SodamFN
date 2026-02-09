"""Sync MonthlyProfitLoss revenue fields from DailyExpense data (single source of truth)."""
from database import engine
from sqlmodel import Session, select, text
from services.profit_loss_service import sync_delivery_revenue_to_pl

with Session(engine) as session:
    # Find all distinct year-month combinations in DailyExpense for revenue vendors
    rows = session.exec(text(
        "SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS y, EXTRACT(MONTH FROM date)::int AS m "
        "FROM dailyexpense "
        "WHERE category IN ('store', 'delivery') "
        "ORDER BY y, m"
    )).all()

    print(f"Found {len(rows)} months to sync")
    for y, m in rows:
        result = sync_delivery_revenue_to_pl(y, m, session)
        total = sum(result.values())
        print(f"  {y}-{m:02d}: {result}  (total: {total:,})")

    print("\nDone! All MonthlyProfitLoss records synced from DailyExpense.")
