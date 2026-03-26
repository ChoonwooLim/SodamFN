"""Add missing business_id column to uploadhistory table."""
from database import engine
from sqlmodel import text, Session

s = Session(engine)

try:
    s.exec(text("ALTER TABLE uploadhistory ADD COLUMN business_id INTEGER REFERENCES business(id)"))
    s.commit()
    print("✅ Added business_id column to uploadhistory table")
except Exception as e:
    print(f"Error (may already exist): {e}")
    s.rollback()

# Verify
result = s.exec(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'uploadhistory' ORDER BY ordinal_position")).all()
cols = [r[0] for r in result]
print(f"uploadhistory columns: {cols}")
print(f"business_id present: {'business_id' in cols}")

s.close()
