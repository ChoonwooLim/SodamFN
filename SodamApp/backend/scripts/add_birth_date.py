import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy import text, inspect
from database import engine

# 1. Add birth_date column
inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('staff')]

if 'birth_date' not in columns:
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE staff ADD COLUMN birth_date DATE DEFAULT NULL'))
    print('[OK] Added birth_date column')
else:
    print('[OK] birth_date already exists')

# 2. Set 김순복's birth date (she is 60+ as confirmed by user)
# She needs to be born before ~1966 to be 60+ in 2026
# Using 1963 as a reasonable estimate (would be 62-63 in 2026)
with engine.begin() as conn:
    conn.execute(text("UPDATE staff SET birth_date = '1963-01-01' WHERE name = '김순복'"))
    print("[OK] 김순복 birth_date set to 1963-01-01 (placeholder - user should confirm exact date)")
