from sqlmodel import Session, text
from database import engine

def migrate():
    with Session(engine) as session:
        print("Adding vendor_id column to dailyexpense table...")
        try:
            session.exec(text("ALTER TABLE dailyexpense ADD COLUMN vendor_id INTEGER REFERENCES vendor(id)"))
            session.commit()
            print("Migration successful: Added vendor_id to dailyexpense.")
            
            # Since we added vendor_id, let's try to populate it based on vendor_name for existing records?
            # Optional, but good for consistency.
            print("Linking existing expenses to vendors...")
            session.exec(text("""
                UPDATE dailyexpense 
                SET vendor_id = (SELECT id FROM vendor WHERE vendor.name = dailyexpense.vendor_name)
                WHERE vendor_id IS NULL AND vendor_name IS NOT NULL
            """))
            session.commit()
            print("Linkage complete.")
            
        except Exception as e:
            print(f"Migration failed (maybe column exists?): {e}")

if __name__ == "__main__":
    migrate()
