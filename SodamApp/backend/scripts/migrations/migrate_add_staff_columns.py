import sqlite3
import os

def migrate_staff_columns():
    # Adjusted path to point to backend/sodam_database.db assuming running from project root
    db_path = os.path.join("backend", "sodam_database.db")
    if not os.path.exists(db_path):
        # Fallback to current dir if running from backend dir
        db_path = "sodam_database.db"

    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(staff)")
        columns = [info[1] for info in cursor.fetchall()]
        print(f"Existing columns: {columns}")
        
        if "address" not in columns:
            print("Adding address column to staff table...")
            cursor.execute("ALTER TABLE staff ADD COLUMN address TEXT")
            
        if "resident_number" not in columns:
            print("Adding resident_number column to staff table...")
            cursor.execute("ALTER TABLE staff ADD COLUMN resident_number TEXT")
            
        conn.commit()
        print("Migration successful: address and resident_number columns added.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_staff_columns()
