from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool, NullPool
import os
from dotenv import load_dotenv

# Load .env file (contains DATABASE_URL for Orbitron PostgreSQL)
# override=True: .env 가 시스템 환경변수보다 우선 (dev 환경에서 잘못된 시스템 변수 회피)
# production(Orbitron)에는 .env 파일이 없어 자동으로 시스템 환경변수만 사용
load_dotenv(override=True)

# DATABASE_URL: Orbitron PostgreSQL server
# Fallback to SQLite only if DATABASE_URL is not set (emergency fallback)
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    # SQLAlchemy requires postgresql:// scheme
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    sqlite_file_name = "sodam_database.db"
    DATABASE_URL = f"sqlite:///{sqlite_file_name}"
    connect_args = {"check_same_thread": False} # SQLite specific
else:
    connect_args = {} # Postgres doesn't need this

DEBUG_SQL = os.environ.get("DEBUG_SQL", "false").lower() == "true"

# Different engine configuration for SQLite vs PostgreSQL
if DATABASE_URL.startswith("sqlite"):
    # SQLite: Use NullPool to avoid connection issues
    engine = create_engine(
        DATABASE_URL, 
        echo=DEBUG_SQL, 
        connect_args=connect_args,
        poolclass=StaticPool  # Single connection for SQLite
    )
else:
    # PostgreSQL: Use connection pooling
    engine = create_engine(
        DATABASE_URL, 
        echo=DEBUG_SQL, 
        connect_args=connect_args,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True
    )

def create_db_and_tables():
    """수동 스크립트 전용 (scripts/maintenance/migrate_*). 운영 startup 은 init_db.init_db() 사용."""
    SQLModel.metadata.create_all(engine)
    _run_codef_phase1_migrations(engine)
    _run_private_payment_migrations(engine)
    _run_revenue_channel_migration(engine)

def get_session():
    with Session(engine) as session:
        yield session


# ─────────────────────────────────────────────────────────
# CODEF Phase 1 — auto-migration 가드 함수
# spec: docs/superpowers/specs/2026-04-29-codef-card-sales-phase1-design.md § 5.3
# ─────────────────────────────────────────────────────────
from sqlalchemy import text, inspect


def _column_exists(engine_, table: str, column: str) -> bool:
    inspector = inspect(engine_)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def _ensure_column(engine_, table: str, column: str, ddl: str):
    if _column_exists(engine_, table, column):
        return
    with engine_.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _run_codef_phase1_migrations(engine_):
    """CODEF Phase 1 마이그레이션 — idempotent.

    cardsalesapproval / cardpayment 에 source / source_meta / connection_id /
    synced_at 컬럼을 안전하게 추가하고, source NULL 행을 'excel'로 백필.
    """
    for table in ("cardsalesapproval", "cardpayment"):
        _ensure_column(engine_, table, "source", "VARCHAR DEFAULT 'excel'")
        _ensure_column(engine_, table, "source_meta", "TEXT")
        _ensure_column(engine_, table, "connection_id", "INTEGER")
        _ensure_column(engine_, table, "synced_at", "TIMESTAMP")
        with engine_.begin() as conn:
            conn.execute(text(f"UPDATE {table} SET source = 'excel' WHERE source IS NULL"))


def _run_private_payment_migrations(engine_):
    """사업주 전용 비공개 지급 정보 마이그레이션 — idempotent.

    Staff 에 private_payment_method / private_actual_payee_* / private_tax_unreported /
    private_owner_note 6 컬럼을 안전하게 추가.
    spec: docs/superpowers/specs/2026-04-30-private-payment-info-design.md
    """
    table = "staff"
    _ensure_column(engine_, table, "private_payment_method", "VARCHAR DEFAULT 'transfer'")
    _ensure_column(engine_, table, "private_actual_payee_name", "VARCHAR")
    _ensure_column(engine_, table, "private_actual_payee_relation", "VARCHAR")
    _ensure_column(engine_, table, "private_actual_payee_account", "VARCHAR")
    _ensure_column(engine_, table, "private_tax_unreported", "BOOLEAN DEFAULT FALSE")
    _ensure_column(engine_, table, "private_owner_note", "TEXT")
    with engine_.begin() as conn:
        conn.execute(text("UPDATE staff SET private_payment_method = 'transfer' WHERE private_payment_method IS NULL"))
        conn.execute(text("UPDATE staff SET private_tax_unreported = FALSE WHERE private_tax_unreported IS NULL"))


def _run_revenue_channel_migration(engine_):
    """Revenue 채널명 한글 통일 — idempotent (ORM, DB 중립).

    'Store'→'매장', 'CoupangEats'→'쿠팡이츠'. 같은 (business_id, date)에
    영문+한글이 공존하면 한글 행에 amount 합산 후 영문 행 삭제.
    spec: 2026-06-22 Revenue 채널명 한글 통일 Part B Task 2
    """
    from sqlmodel import Session, select
    from models import Revenue
    renames = {"Store": "매장", "CoupangEats": "쿠팡이츠"}
    with Session(engine_) as s:
        for eng_name, kor_name in renames.items():
            eng_rows = s.exec(select(Revenue).where(Revenue.channel == eng_name)).all()
            for er in eng_rows:
                dup = s.exec(select(Revenue).where(
                    Revenue.channel == kor_name,
                    Revenue.business_id == er.business_id,
                    Revenue.date == er.date,
                )).first()
                if dup:
                    dup.amount = (dup.amount or 0) + (er.amount or 0)
                    s.add(dup)
                    s.delete(er)
                else:
                    er.channel = kor_name
                    s.add(er)
        s.commit()
