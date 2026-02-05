import sqlite3

conn = sqlite3.connect('SodamApp/backend/sodam_database.db')
c = conn.cursor()

# List all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print("Tables:", [t[0] for t in c.fetchall()])

# Check data count
c.execute('SELECT COUNT(*) FROM dailyexpense')
print(f"DailyExpense count: {c.fetchone()[0]}")

# Check indexes
c.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='dailyexpense'")
indexes = c.fetchall()
print(f"\nIndexes on dailyexpense: {len(indexes)}")
for idx in indexes:
    print(f"  - {idx[0]}: {idx[1]}")

# Check table structure
c.execute("PRAGMA table_info(dailyexpense)")
print(f"\nTable columns:")
for col in c.fetchall():
    print(f"  - {col[1]} ({col[2]})")

conn.close()
