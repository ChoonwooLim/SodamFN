"""
Migration script to add vendor_type, order_index, and item columns to vendor table
"""
import sqlite3

def migrate():
    conn = sqlite3.connect('sodam_database.db')
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute('PRAGMA table_info(vendor)')
    columns = [col[1] for col in cursor.fetchall()]
    print('Existing columns:', columns)

    # Add missing columns
    if 'vendor_type' not in columns:
        cursor.execute("ALTER TABLE vendor ADD COLUMN vendor_type TEXT DEFAULT 'expense'")
        print('Added vendor_type column')

    if 'order_index' not in columns:
        cursor.execute('ALTER TABLE vendor ADD COLUMN order_index INTEGER DEFAULT 0')
        print('Added order_index column')

    if 'item' not in columns:
        cursor.execute('ALTER TABLE vendor ADD COLUMN item TEXT')
        print('Added item column')

    conn.commit()
    conn.close()
    print('Migration complete!')

if __name__ == "__main__":
    migrate()
