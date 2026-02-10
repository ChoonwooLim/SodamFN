"""Add new expense category columns to MonthlyProfitLoss table."""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "..", "sodam_database.db")
db_path = os.path.abspath(db_path)
print(f"DB path: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables to find correct table name
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cursor.fetchall()]
print(f"Tables: {tables}")

# Find the profit loss table
pl_table = None
for t in tables:
    if "profit" in t.lower() or "pl" in t.lower() or "monthly" in t.lower():
        pl_table = t
        break

if not pl_table:
    print("ERROR: Could not find MonthlyProfitLoss table!")
    conn.close()
    exit(1)

print(f"Found PL table: {pl_table}")

# Check existing columns
cursor.execute(f"PRAGMA table_info({pl_table})")
existing_cols = {row[1] for row in cursor.fetchall()}
print(f"Existing columns: {sorted(existing_cols)}")

# Add new columns
new_cols = ["expense_repair", "expense_depreciation", "expense_tax", "expense_insurance"]
for col in new_cols:
    if col in existing_cols:
        print(f"  {col} already exists, skipping")
    else:
        cursor.execute(f"ALTER TABLE {pl_table} ADD COLUMN {col} INTEGER DEFAULT 0")
        print(f"  Added {col}")

conn.commit()
conn.close()
print("Migration complete!")
