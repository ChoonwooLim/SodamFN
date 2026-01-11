import sqlite3
import os

def inspect_contracts():
    db_path = os.path.join("backend", "sodam_database.db")
    if not os.path.exists(db_path):
        db_path = "sodam_database.db"

    print(f"Connecting to: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, title, length(content), content FROM electroniccontract")
        rows = cursor.fetchall()
        print(f"Found {len(rows)} contracts:")
        for row in rows:
            content_preview = row[3][:50] if row[3] else "NULL/EMPTY"
            print(f"ID: {row[0]}, Title: {row[1]}, Length: {row[2]}, Content Preview: {content_preview}...")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    inspect_contracts()
