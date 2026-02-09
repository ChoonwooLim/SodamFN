"""Check Payroll table columns in PostgreSQL"""
from sqlalchemy import inspect
from database import engine

inspector = inspect(engine)

print("=== Payroll table columns ===")
cols = inspector.get_columns("payroll")
for c in cols:
    print(f"  {c['name']}: {c['type']}")

print("\n=== Staff table columns ===")
cols = inspector.get_columns("staff")
for c in cols:
    print(f"  {c['name']}: {c['type']}")
