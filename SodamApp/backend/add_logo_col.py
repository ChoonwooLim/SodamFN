from sqlmodel import create_engine, text
from database import DATABASE_URL, connect_args

engine = create_engine(DATABASE_URL, connect_args=connect_args)
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE business ADD COLUMN logo_url VARCHAR;"))
        print("Column added successfully")
    except Exception as e:
        if "duplicate column name" in str(e).lower():
            print("Column already exists")
        else:
            raise
