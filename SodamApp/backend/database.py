from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool, NullPool
import os
from dotenv import load_dotenv

# Load .env file (contains DATABASE_URL for Orbitron PostgreSQL)
load_dotenv()

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
    SQLModel.metadata.create_all(engine)
    _run_codef_phase1_migrations(engine)
    _run_private_payment_migrations(engine)

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
