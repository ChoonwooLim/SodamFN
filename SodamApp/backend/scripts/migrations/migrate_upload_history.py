from sqlmodel import Session, create_engine, text
from database import engine

def migrate_upload_history():
    print("Starting migration for UploadHistory...")
    with Session(engine) as session:
        # 1. Create UploadHistory table
        # SQLite doesn't support "IF NOT EXISTS" easily in create table via simple text if using complex schema, 
        # but pure SQL works. SQLModel create_all usually handles this, but since we are migrating, we do it manually or via alembic (which we don't have setup).
        # We'll try to check if it exists first.
        try:
            session.exec(text("SELECT id FROM uploadhistory LIMIT 1"))
            print("Table 'uploadhistory' already exists.")
        except Exception:
            print("Creating 'uploadhistory' table...")
            session.exec(text("""
            CREATE TABLE IF NOT EXISTS uploadhistory (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                filename VARCHAR NOT NULL, 
                upload_type VARCHAR NOT NULL, 
                created_at DATETIME NOT NULL, 
                record_count INTEGER NOT NULL, 
                status VARCHAR NOT NULL
            )
            """))

        # 2. Add upload_id to dailyexpense
        # SQLite doesn't support IF NOT EXISTS for columns. We try to add and ignore error if exists.
        try:
            session.exec(text("ALTER TABLE dailyexpense ADD COLUMN upload_id INTEGER REFERENCES uploadhistory(id)"))
            print("Added 'upload_id' column to 'dailyexpense'.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("'upload_id' column already exists in 'dailyexpense'.")
            else:
                print(f"Error adding 'upload_id' to 'dailyexpense': {e}")
                
        # 3. Add created_by_upload_id to vendor
        try:
            session.exec(text("ALTER TABLE vendor ADD COLUMN created_by_upload_id INTEGER"))
            print("Added 'created_by_upload_id' column to 'vendor'.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("'created_by_upload_id' column already exists in 'vendor'.")
            else:
                print(f"Error adding 'created_by_upload_id' to 'vendor': {e}")

        session.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate_upload_history()
