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
        
        # --- SuperAdmin auto-upsert from .env ---
        import os
        sa_username = os.getenv("SUPERADMIN_USERNAME")
        sa_password = os.getenv("SUPERADMIN_PASSWORD")
        if sa_username and sa_password:
            sa_stmt = select(User).where(User.username == sa_username)
            sa_user = service.session.exec(sa_stmt).first()
            if not sa_user:
                print(f"Creating SuperAdmin user: {sa_username}")
                sa_user = User(
                    username=sa_username,
                    hashed_password=get_password_hash(sa_password),
                    role="superadmin",
                    grade="admin",
                    real_name="플랫폼 총괄",
                )
                service.session.add(sa_user)
                service.session.commit()
                print(f"SuperAdmin user created: {sa_username}")
            else:
                # Ensure role is superadmin and password is up to date
                sa_user.role = "superadmin"
                sa_user.grade = "admin"
                sa_user.hashed_password = get_password_hash(sa_password)
                service.session.add(sa_user)
                service.session.commit()
                print(f"SuperAdmin user updated: {sa_username}")
    finally:
        service.close()

def _run_migrations():
    """Auto-add missing columns to existing tables. Supports both SQLite and PostgreSQL."""
    migrations = [
        ("inventorycheck", "items_json", "TEXT"),
        # 2026-04-27: bank-sync 자동 분류 → 매출관리/매입관리(DailyExpense) 연동
        ("banktransaction", "linked_daily_id", "INTEGER"),
    ]
    import os
    db_url = os.environ.get("DATABASE_URL", "")
    is_sqlite = not db_url or "sqlite" in db_url
    
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                if is_sqlite:
                    result = conn.execute(text(f"PRAGMA table_info({table})"))
                    cols = [row[1] for row in result.fetchall()]
                    col_exists = column in cols
                else:
                    result = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name=:table AND column_name=:col"
                    ), {"table": table, "col": column})
                    col_exists = result.fetchone() is not None
                
                if not col_exists:
                    print(f"  Migration: Adding {column} to {table}...")
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    conn.commit()
                    print(f"  [OK] {column} added successfully")
                else:
                    print(f"  [OK] {table}.{column} already exists")
            except Exception as e:
                print(f"  [SKIP] Migration {table}.{column}: {e}")

if __name__ == "__main__":
    init_db()
