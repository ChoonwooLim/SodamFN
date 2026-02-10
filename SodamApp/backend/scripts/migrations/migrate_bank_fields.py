"""
Migration script to add bank account fields to staff table
"""
import sqlite3

conn = sqlite3.connect('sodam_database.db')
cursor = conn.cursor()

# Check existing columns
cursor.execute("PRAGMA table_info(staff)")
columns = [col[1] for col in cursor.fetchall()]
print(f"Existing columns: {columns}")

# Add new columns if they don't exist
new_columns = [
    ("bank_name", "TEXT"),
    ("account_number", "TEXT"), 
    ("account_holder", "TEXT")
]

for col_name, col_type in new_columns:
    if col_name not in columns:
        try:
            cursor.execute(f"ALTER TABLE staff ADD COLUMN {col_name} {col_type}")
            print(f"Added column: {col_name}")
        except sqlite3.OperationalError as e:
            print(f"Column {col_name} may already exist: {e}")
    else:
        print(f"Column {col_name} already exists")

conn.commit()
conn.close()
print("Migration complete!")
