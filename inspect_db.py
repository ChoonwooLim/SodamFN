import sqlite3
import os

db_path = r"c:\WORK\SodamFN\SodamApp\backend\sodam_database.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, phone, email, status FROM staff")
        rows = cursor.fetchall()
        if not rows:
            print("No records found in 'staff' table.")
        for row in rows:
            print(f"ID: {row[0]}, Name: {row[1]}, Phone: {row[2]}, Email: {row[3]}, Status: {row[4]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
