import sqlite3
import os

def migrate():
    db_path = "sodam_database.db"
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding tax-related columns to staff table...")
    
    try:
        cursor.execute("ALTER TABLE staff ADD COLUMN dependents_count INTEGER DEFAULT 1")
        print("Added dependents_count column.")
    except sqlite3.OperationalError as e:
        print(f"Skipped dependents_count: {e}")

    try:
        cursor.execute("ALTER TABLE staff ADD COLUMN children_count INTEGER DEFAULT 0")
        print("Added children_count column.")
    except sqlite3.OperationalError as e:
        print(f"Skipped children_count: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
