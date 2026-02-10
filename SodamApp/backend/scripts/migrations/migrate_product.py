"""Migration to add new fields to product table"""
import sqlite3

def migrate():
    conn = sqlite3.connect('sodam_database.db')
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(product)')
    columns = [col[1] for col in cursor.fetchall()]
    print('Existing columns:', columns)

    if 'spec' not in columns:
        cursor.execute('ALTER TABLE product ADD COLUMN spec TEXT')
        print('Added spec column')
    if 'tax_type' not in columns:
        cursor.execute("ALTER TABLE product ADD COLUMN tax_type TEXT DEFAULT 'taxable'")
        print('Added tax_type column')
    if 'note' not in columns:
        cursor.execute('ALTER TABLE product ADD COLUMN note TEXT')
        print('Added note column')
        
    conn.commit()
    conn.close()
    print('Migration complete!')

if __name__ == "__main__":
    migrate()
