"""
Migration: Add GPS fields to Attendance table and create WorkLocation table.
(PostgreSQL compatible)
"""
from database import engine
from sqlmodel import Session, text

def migrate():
    with Session(engine) as session:
        # 1. Create WorkLocation table (PostgreSQL)
        session.exec(text("""
            CREATE TABLE IF NOT EXISTS worklocation (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL DEFAULT '소담김밥',
                latitude DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                longitude DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                radius_meters INTEGER NOT NULL DEFAULT 100,
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
        """))
        print("  ✅ WorkLocation table created/verified.")
        
        # 2. Add GPS columns to Attendance table
        columns = [
            ("check_in_lat", "DOUBLE PRECISION"),
            ("check_in_lng", "DOUBLE PRECISION"),
            ("check_out_lat", "DOUBLE PRECISION"),
            ("check_out_lng", "DOUBLE PRECISION"),
            ("check_in_verified", "BOOLEAN DEFAULT FALSE"),
            ("check_out_verified", "BOOLEAN DEFAULT FALSE"),
            ("check_in_distance", "DOUBLE PRECISION"),
            ("check_out_distance", "DOUBLE PRECISION"),
        ]
        
        for col_name, col_type in columns:
            try:
                session.exec(text(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}"))
                print(f"  ✅ Added column: attendance.{col_name}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"  ⏭️ Column already exists: attendance.{col_name}")
                    session.rollback()
                else:
                    print(f"  ⚠️ Error adding {col_name}: {e}")
                    session.rollback()
        
        session.commit()
        print("\n✅ Migration complete: GPS attendance fields and WorkLocation table ready.")

if __name__ == "__main__":
    migrate()
