"""auto-migration 가드 함수 테스트.

idempotent — 2회 호출해도 ALTER TABLE 에러 없이 통과.
백필 — legacy(source 컬럼 없는) 테이블에 마이그레이션 수행 시 'excel' 백필.
"""
import importlib
import os
import tempfile
import pytest
from sqlmodel import SQLModel
from sqlalchemy import text


@pytest.fixture
def temp_db_engine(monkeypatch):
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    db_url = f"sqlite:///{f.name}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    # database 모듈을 reload 해 새 engine 으로 갱신
    import database
    importlib.reload(database)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


def test_migration_idempotent(temp_db_engine):
    """동일 마이그레이션을 2회 호출해도 ALTER TABLE 에러 없이 끝남"""
    SQLModel.metadata.create_all(temp_db_engine.engine)

    temp_db_engine._run_codef_phase1_migrations(temp_db_engine.engine)
    temp_db_engine._run_codef_phase1_migrations(temp_db_engine.engine)


def test_migration_columns_exist_after_run(temp_db_engine):
    """마이그레이션 후 cardsalesapproval/cardpayment 에 4컬럼 모두 존재"""
    SQLModel.metadata.create_all(temp_db_engine.engine)
    temp_db_engine._run_codef_phase1_migrations(temp_db_engine.engine)

    expected = {"source", "source_meta", "connection_id", "synced_at"}
    for table in ("cardsalesapproval", "cardpayment"):
        assert temp_db_engine._column_exists(temp_db_engine.engine, table, "source"), \
            f"{table}.source missing"
        for col in expected:
            assert temp_db_engine._column_exists(temp_db_engine.engine, table, col), \
                f"{table}.{col} missing after migration"


def test_migration_backfill_via_legacy_table(temp_db_engine):
    """legacy 테이블 시뮬레이션 — source 컬럼 없는 raw 테이블에 row 삽입 후
    마이그레이션이 컬럼 추가 + 백필을 정상 수행하는지 검증.

    SQLModel.metadata.create_all 은 처음부터 source 를 NOT NULL 로 만들어
    ORM 으로 legacy 시뮬이 불가능 → raw DDL 로 source 없는 테이블 미리 생성.
    """
    eng = temp_db_engine.engine
    # source 등 4컬럼 없는 최소 스키마로 두 테이블 모두 생성 + 1행 INSERT
    with eng.begin() as conn:
        conn.execute(text("""
            CREATE TABLE cardsalesapproval (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                approval_date DATE NOT NULL,
                approval_time VARCHAR,
                card_corp VARCHAR NOT NULL,
                card_number VARCHAR,
                approval_number VARCHAR,
                amount INTEGER NOT NULL,
                installment VARCHAR,
                status VARCHAR DEFAULT '승인',
                shop_name VARCHAR
            )
        """))
        conn.execute(text("""
            CREATE TABLE cardpayment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER,
                payment_date DATE NOT NULL,
                card_corp VARCHAR NOT NULL,
                sales_amount INTEGER DEFAULT 0,
                fees INTEGER DEFAULT 0,
                vat_on_fees INTEGER DEFAULT 0,
                net_deposit INTEGER DEFAULT 0,
                bank VARCHAR
            )
        """))
        conn.execute(text("""
            INSERT INTO cardsalesapproval (business_id, approval_date, card_corp, amount)
            VALUES (1, '2026-04-29', '신한카드', 15000)
        """))
        conn.execute(text("""
            INSERT INTO cardpayment (business_id, payment_date, card_corp, net_deposit)
            VALUES (1, '2026-04-29', '삼성카드', 100000)
        """))

    # 마이그레이션 실행 → 4컬럼 ALTER 추가 + 백필
    temp_db_engine._run_codef_phase1_migrations(eng)

    with eng.begin() as conn:
        approval_source = conn.execute(text("SELECT source FROM cardsalesapproval")).fetchall()
        payment_source = conn.execute(text("SELECT source FROM cardpayment")).fetchall()
        assert approval_source[0][0] == "excel"
        assert payment_source[0][0] == "excel"
