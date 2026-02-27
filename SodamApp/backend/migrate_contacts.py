"""One-time migration: add store_id/note to emergencycontact, create announcement table"""
from services.database_service import DatabaseService
from sqlalchemy import text

def migrate():
    s = DatabaseService()
    try:
        # Add store_id column
        try:
            s.session.execute(text("ALTER TABLE emergencycontact ADD COLUMN store_id TEXT DEFAULT ''"))
            print("Added store_id column")
        except Exception as e:
            s.session.rollback()
            print(f"store_id: {e}")

        # Add note column
        try:
            s.session.execute(text("ALTER TABLE emergencycontact ADD COLUMN note TEXT DEFAULT ''"))
            print("Added note column")
        except Exception as e:
            s.session.rollback()
            print(f"note: {e}")

        # Create announcement table
        try:
            s.session.execute(text("""
                CREATE TABLE IF NOT EXISTS announcement (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT DEFAULT '',
                    pinned BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            print("Created announcement table")
        except Exception as e:
            s.session.rollback()
            print(f"announcement: {e}")

        s.session.commit()
        print("Migration complete!")
    finally:
        s.close()

if __name__ == "__main__":
    migrate()
