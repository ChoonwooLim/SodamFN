import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy import text, inspect
from database import engine

inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('staff')]

if 'tax_support_enabled' not in columns:
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE staff ADD COLUMN tax_support_enabled BOOLEAN DEFAULT FALSE'))
    print('[OK] Added tax_support_enabled column')
else:
    print('[OK] tax_support_enabled already exists')

with engine.begin() as conn:
    conn.execute(text("UPDATE staff SET tax_support_enabled = TRUE WHERE name = '김금순'"))
    print('[OK] 김금순 tax_support_enabled = True')
