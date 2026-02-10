import sqlite3

import os
DB_PATH = os.path.join("backend", "sodam_database.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    new_columns = [
        ("contract_start_date", "DATE"),
        ("contract_end_date", "DATE"),
        ("work_start_time", "TEXT"),
        ("work_end_time", "TEXT"),
        ("rest_start_time", "TEXT"),
        ("rest_end_time", "TEXT"),
        ("working_days", "TEXT"),
        ("weekly_holiday", "TEXT"),
        ("job_description", "TEXT"),
        ("bonus_enabled", "BOOLEAN DEFAULT 0"),
        ("bonus_amount", "TEXT"),
        ("salary_payment_date", "TEXT DEFAULT '매월 말일'"),
        ("salary_payment_method", "TEXT DEFAULT '근로자 계좌 입금'")
    ]
    
    table_name = "staff"
    
    # Check existing columns
    cursor.execute(f"PRAGMA table_info({table_name});")
    existing_cols = [info[1] for info in cursor.fetchall()]
    
    for col_name, col_type in new_columns:
        if col_name not in existing_cols:
            print(f"Adding column {col_name} ({col_type})...")
            try:
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
