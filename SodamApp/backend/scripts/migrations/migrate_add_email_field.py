import sqlite3
import os

def migrate():
    db_path = "sodam_database.db"
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding email column to staff table...")
    
    try:
        cursor.execute("ALTER TABLE staff ADD COLUMN email TEXT")
        print("Added email column.")
    except sqlite3.OperationalError as e:
        print(f"Skipped email: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
