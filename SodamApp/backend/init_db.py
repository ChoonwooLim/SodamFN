from sqlmodel import SQLModel, select
from database import engine
from models import User, Suggestion, StaffChatMessage, InventoryItem, InventoryCheck, BusinessStore, PayPayment  # noqa: F401 - import all models so create_all creates their tables
from services.database_service import DatabaseService
from routers.auth import get_password_hash
from sqlalchemy import text

def init_db():
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)

    # --- Auto-migration: add missing columns ---
    _run_migrations()

    # --- Seed default BusinessStore for existing businesses (idempotent) ---
    _seed_default_stores()
    
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
        # 2026-04-30: 사업주 전용 비공개 지급 정보
        # spec: docs/superpowers/specs/2026-04-30-private-payment-info-design.md
        ("staff", "private_payment_method", "VARCHAR DEFAULT 'transfer'"),
        ("staff", "private_actual_payee_name", "VARCHAR"),
        ("staff", "private_actual_payee_relation", "VARCHAR"),
        ("staff", "private_actual_payee_account", "VARCHAR"),
        ("staff", "private_tax_unreported", "BOOLEAN DEFAULT FALSE"),
        ("staff", "private_owner_note", "TEXT"),
        # 2026-04-30: 팩스 다중 파일 묶음 발송 시 첨부 파일 list 보존
        ("faxtransmission", "attachment_files", "TEXT"),
        # 2026-04-30: 외국인 직원 영문 이름 (증명서/계약서용)
        ("staff", "name_eng", "VARCHAR"),
        # 2026-05-12: 카드/페이/배달앱 정산 분류 (bank-sync 매출 중복 방지 + 수수료 역산)
        ("banktransaction", "linked_card_payment_id", "INTEGER"),
        ("banktransaction", "linked_pay_payment_id", "INTEGER"),
        ("banktransaction", "linked_delivery_revenue_id", "INTEGER"),
        # DeliveryRevenue 가 multi-tenant 격리 위해 business_id 필요 — 기존엔 누락되어 있었음
        ("deliveryrevenue", "business_id", "INTEGER"),
        ("deliveryrevenue", "source", "VARCHAR DEFAULT 'excel'"),
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

def _seed_default_stores():
    """기존 사업장에 default BusinessStore 1개를 자동 생성 (idempotent).

    - 이미 store 가 있는 사업장은 건너뜀.
    - settings_json.work_location 값이 있으면 그 이름으로, 없으면 business.name + ' 매장' 으로 생성.
    - is_default=True 로 설정해 신규 직원 자동 매핑 + 단일매장 사용처 폴백.
    """
    import json
    from models import Business, BusinessStore
    service = DatabaseService()
    try:
        businesses = service.session.exec(select(Business)).all()
        created = 0
        skipped = 0
        for biz in businesses:
            existing = service.session.exec(
                select(BusinessStore).where(BusinessStore.business_id == biz.id)
            ).first()
            if existing:
                skipped += 1
                continue
            # settings.work_location 우선
            settings = {}
            if biz.settings_json:
                try:
                    settings = json.loads(biz.settings_json)
                except Exception:
                    settings = {}
            store_name = (settings.get("work_location") or "").strip() \
                or (f"{biz.name} 매장" if biz.name else "기본 매장")
            store = BusinessStore(
                business_id=biz.id,
                name=store_name,
                address=biz.address or "",
                phone=biz.phone or "",
                is_default=True,
                is_active=True,
                sort_order=0,
            )
            service.session.add(store)
            created += 1
        if created:
            service.session.commit()
            print(f"  Seeded {created} default BusinessStore(s) (skipped {skipped} existing).")
        else:
            print(f"  BusinessStore seed: all {skipped} business(es) already have stores.")
    except Exception as e:
        print(f"  [SKIP] _seed_default_stores: {e}")
    finally:
        service.close()


if __name__ == "__main__":
    init_db()
