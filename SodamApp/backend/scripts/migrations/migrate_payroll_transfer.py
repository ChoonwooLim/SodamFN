import sqlite3

def migrate():
    conn = sqlite3.connect('sodam_database.db')
    cursor = conn.cursor()

    print("Adding transfer tracking columns to payroll table...")
    
    try:
        cursor.execute("ALTER TABLE payroll ADD COLUMN transfer_status TEXT DEFAULT '대기'")
        print("Added transfer_status column.")
    except sqlite3.OperationalError:
        print("transfer_status column already exists.")

    try:
        cursor.execute("ALTER TABLE payroll ADD COLUMN transferred_at DATETIME")
        print("Added transferred_at column.")
    except sqlite3.OperationalError:
        print("transferred_at column already exists.")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
