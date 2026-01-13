import sqlite3

def patch_db():
    try:
        conn = sqlite3.connect('sodam_database.db')
        cursor = conn.cursor()
        
        # Check current columns
        cursor.execute("PRAGMA table_info(staff)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print("Current columns:", columns)
        
        if 'nationality' not in columns:
            print("Adding nationality column...")
            cursor.execute("ALTER TABLE staff ADD COLUMN nationality TEXT DEFAULT 'South Korea'")
        else:
            print("nationality column already exists.")
        
        if 'visa_type' not in columns:
            print("Adding visa_type column...")
            cursor.execute("ALTER TABLE staff ADD COLUMN visa_type TEXT")
        else:
            print("visa_type column already exists.")
            
        conn.commit()
        conn.close()
        print("Database patch completed successfully.")
    except Exception as e:
        print(f"Error patching database: {e}")

if __name__ == "__main__":
    patch_db()
