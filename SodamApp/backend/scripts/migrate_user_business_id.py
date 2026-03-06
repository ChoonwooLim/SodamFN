import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "sodam_database.db")

def migrate():
    print(f"Connecting to {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Add business_id column to user
    try:
        cursor.execute("ALTER TABLE user ADD COLUMN business_id INTEGER REFERENCES business(id)")
        print("Added business_id to user table")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("business_id already exists in user table")
        else:
            print(f"Error adding column: {e}")

    try:
        cursor.execute("CREATE INDEX ix_user_business_id ON user (business_id)")
        print("Added index to user table")
    except sqlite3.OperationalError as e:
        if "already exists" in str(e).lower():
            print("Index already exists")
        else:
            print(f"Error adding index: {e}")

    # 2. Backfill business_id for staff
    # For staff users, we can copy business_id from the staff table
    cursor.execute("""
        UPDATE user 
        SET business_id = (SELECT business_id FROM staff WHERE staff.id = user.staff_id)
        WHERE role = 'staff' AND staff_id IS NOT NULL
    """)
    print(f"Updated {cursor.rowcount} staff users with business_id")

    # For admin users, if they have staff_id ? No, they usually don't.
    # We leave admin business_id alone or we cannot guess without store_application.
    # Alternatively, admins might already have some business_id in `business` table 
    # but wait, business was linked to admin user id?
    # Let's check if business table has user_id
    cursor.execute("PRAGMA table_info(business)")
    business_cols = [c[1] for c in cursor.fetchall()]
    print(f"business columns: {business_cols}")
    
    if "admin_id" in business_cols:
        cursor.execute("""
            UPDATE user
            SET business_id = (SELECT id FROM business WHERE business.admin_id = user.id)
            WHERE role = 'admin'
        """)
        print(f"Updated {cursor.rowcount} admin users with business_id from admin_id")
    elif "owner_id" in business_cols:
         cursor.execute("""
            UPDATE user
            SET business_id = (SELECT id FROM business WHERE business.owner_id = user.id)
            WHERE role = 'admin'
        """)
         print(f"Updated {cursor.rowcount} admin users with business_id from owner_id")

    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    migrate()
