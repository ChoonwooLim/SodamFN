import sqlite3

def migrate():
    conn = sqlite3.connect('sodam_database.db')
    cursor = conn.cursor()
    columns = [
        ('bonus_meal', 'INTEGER DEFAULT 0'),
        ('bonus_holiday', 'INTEGER DEFAULT 0'),
        ('deduction_np', 'INTEGER DEFAULT 0'),
        ('deduction_hi', 'INTEGER DEFAULT 0'),
        ('deduction_ei', 'INTEGER DEFAULT 0'),
        ('deduction_lti', 'INTEGER DEFAULT 0'),
        ('deduction_it', 'INTEGER DEFAULT 0'),
        ('deduction_lit', 'INTEGER DEFAULT 0'),
        ('holiday_w1', 'INTEGER DEFAULT 0'),
        ('holiday_w2', 'INTEGER DEFAULT 0'),
        ('holiday_w3', 'INTEGER DEFAULT 0'),
        ('holiday_w4', 'INTEGER DEFAULT 0'),
        ('holiday_w5', 'INTEGER DEFAULT 0'),
        ('details_json', 'TEXT')
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE payroll ADD COLUMN {col_name} {col_type}")
            print(f"Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding {col_name}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
