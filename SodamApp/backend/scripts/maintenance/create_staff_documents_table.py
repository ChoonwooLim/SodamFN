from sqlmodel import Session
from database import engine, SQLModel
from models import StaffDocument

def migrate_documents():
    # Only create the new table
    try:
        StaffDocument.__table__.create(engine)
        print("Created StaffDocument table.")
    except Exception as e:
        print(f"Table might exist or error: {e}")

if __name__ == "__main__":
    migrate_documents()
