from services.database_service import DatabaseService
from models import Vendor, DailyExpense
from sqlmodel import select, func

def debug_monthly_stats(year, month):
    service = DatabaseService()
    print(f"Checking for {year}-{month}...")
    
    # Check if any expense exists for that month
    from datetime import date
    import calendar
    start_date = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end_date = date(year, month, last_day)
    
    stmt = select(func.count(DailyExpense.id)).where(DailyExpense.date >= start_date, DailyExpense.date <= end_date)
    count = service.session.exec(stmt).one()
    print(f"Total expenses in {year}-{month}: {count}")
    
    # Check get_vendors output
    vendors = service.get_vendors(year=year, month=month)
    print(f"Vendors found: {len(vendors)}")
    for v in vendors[:5]:
        print(f"Vendor: {v['name']}, Amount: {v['total_transaction_amount']}")

if __name__ == "__main__":
    debug_monthly_stats(2026, 1)
