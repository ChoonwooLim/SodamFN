import sqlite3
import os

# Adjust path to point to the actual database file
# Typically backend runs from c:\WORK\SodamFN\SodamApp\backend
DB_PATH = "sodam_database.db" 

if not os.path.exists(DB_PATH):
    # Try finding it relative to script location if we run from scripts dir
    DB_PATH = "../../../backend/sodam_database.db"

if not os.path.exists(DB_PATH):
    # Try absolute path
    DB_PATH = r"c:\WORK\SodamFN\SodamApp\backend\sodam_database.db"

print(f"Target DB: {DB_PATH}")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(dailyexpense)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "payment_method" in columns:
            print("Column 'payment_method' already exists. Skipping.")
        else:
            cursor.execute("ALTER TABLE dailyexpense ADD COLUMN payment_method VARCHAR DEFAULT 'Card'")
            conn.commit()
            print("Migration successful: Added payment_method to dailyexpense")
            
            # Backfill existing (optional, default handles it for new inserts but existing rows get default)
            # cursor.execute("UPDATE dailyexpense SET payment_method = 'Card' WHERE payment_method IS NULL")
            # conn.commit()
            
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
