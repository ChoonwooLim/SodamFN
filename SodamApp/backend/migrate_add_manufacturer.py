import sqlite3
import os

def migrate_product_manufacturer():
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
        cursor.execute("PRAGMA table_info(product)")
        columns = [info[1] for info in cursor.fetchall()]
        print(f"Existing columns: {columns}")
        
        if "manufacturer" not in columns:
            print("Adding manufacturer column to product table...")
            cursor.execute("ALTER TABLE product ADD COLUMN manufacturer TEXT")
            conn.commit()
            print("Migration successful: manufacturer column added.")
        else:
            print("Column 'manufacturer' already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_product_manufacturer()
