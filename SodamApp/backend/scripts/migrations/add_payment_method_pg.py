"""
Migration: Add payment_method column to dailyexpense table (PostgreSQL/SQLite compatible)
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlalchemy import text, inspect

def migrate():
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('dailyexpense')]
    
    if 'payment_method' in columns:
        print("Column 'payment_method' already exists. Skipping.")
        return
    
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE dailyexpense ADD COLUMN payment_method VARCHAR DEFAULT 'Card'"))
        conn.commit()
        print("Migration successful: Added payment_method column to dailyexpense")

if __name__ == "__main__":
    migrate()
