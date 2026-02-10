"""
Migration: Add expense_rent_fee column to MonthlyProfitLoss table
임대료(월세)와 임대관리비를 분리하기 위한 마이그레이션
"""
import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), "sodam_database.db")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(monthlyprofitloss)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'expense_rent_fee' not in columns:
            print("Adding expense_rent_fee column...")
            cursor.execute("ALTER TABLE monthlyprofitloss ADD COLUMN expense_rent_fee INTEGER DEFAULT 0")
            conn.commit()
            print("✅ expense_rent_fee column added successfully!")
        else:
            print("expense_rent_fee column already exists.")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
