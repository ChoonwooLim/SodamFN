from sqlmodel import SQLModel, select
from database import engine
from models import User, Suggestion, StaffChatMessage, InventoryItem, InventoryCheck  # noqa: F401 - import all models so create_all creates their tables
from services.database_service import DatabaseService
from routers.auth import get_password_hash
from sqlalchemy import text

def init_db():
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)

    # --- Auto-migration: add missing columns ---
    _run_migrations()
    
    service = DatabaseService()
    try:
        # Check if admin already exists
        stmt = select(User).where(User.username == "admin")
        admin = service.session.exec(stmt).first()
        
        if not admin:
            print("Creating initial admin user...")
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin1234"),
                role="admin"
            )
            service.session.add(admin_user)
            service.session.commit()
            print("Admin user created: username=admin, password=admin1234")
        else:
            print("Admin user already exists.")
    finally:
        service.close()

def _run_migrations():
    """Auto-add missing columns to existing tables."""
    migrations = [
        ("inventorycheck", "items_json", "TEXT"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=:table AND column_name=:col"
            ), {"table": table, "col": column})
            if result.fetchone() is None:
                print(f"  Migration: Adding {column} to {table}...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                print(f"  ✅ {column} added successfully")
            else:
                print(f"  ✓ {table}.{column} already exists")

if __name__ == "__main__":
    init_db()
