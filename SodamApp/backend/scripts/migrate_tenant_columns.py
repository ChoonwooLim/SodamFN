import sqlite3

db_path = "sodam_database.db"

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables_to_patch = [
        "uploadhistory",
        "vendorrule",
        "cardsalesapproval",
        "cardpayment",
        "worklocation"
    ]

    for table in tables_to_patch:
        # Add column
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN business_id INTEGER REFERENCES business(id)")
            print(f"Added business_id to {table}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print(f"business_id already exists in {table}")
            else:
                print(f"Error adding column to {table}: {e}")
                
        # Add index
        try:
            cursor.execute(f"CREATE INDEX ix_{table}_business_id ON {table} (business_id)")
            print(f"Added index to {table}")
        except sqlite3.OperationalError as e:
            if "already exists" in str(e).lower():
                print(f"Index already exists for {table}")
            else:
                print(f"Error adding index to {table}: {e}")

    conn.commit()
    conn.close()
    
if __name__ == "__main__":
    migrate()
