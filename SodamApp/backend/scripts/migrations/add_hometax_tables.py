"""홈택스 수집 테이블 신규 생성 — HometaxRecord + HometaxSyncCursor.

2026-05-15 추가. CODEF organization 0001 (국세청) 통한 현금영수증 매출/매입,
세금계산서 매출/매입, 부가세 신고결과 자동수집.

idempotent: 테이블이 이미 존재하면 skip.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from database import engine


def _table_exists(conn, name: str) -> bool:
    return bool(conn.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_name=:n"
    ), {"n": name}).scalar())


def migrate():
    with engine.begin() as conn:
        if _table_exists(conn, "hometaxrecord"):
            print("  = hometaxrecord 이미 존재 — skip")
        else:
            print("  + CREATE TABLE hometaxrecord ...")
            conn.execute(text("""
                CREATE TABLE hometaxrecord (
                    id SERIAL PRIMARY KEY,
                    business_id INTEGER NOT NULL REFERENCES business(id),
                    record_type VARCHAR(32) NOT NULL,
                    identifier VARCHAR(64) NOT NULL,
                    tx_date DATE NOT NULL,
                    counterparty_name VARCHAR(128),
                    counterparty_corp_num VARCHAR(20),
                    supply_cost INTEGER NOT NULL DEFAULT 0,
                    tax INTEGER NOT NULL DEFAULT 0,
                    total_amount INTEGER NOT NULL DEFAULT 0,
                    item_name VARCHAR(200),
                    raw_json TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text(
                "CREATE INDEX ix_hometaxrecord_business_id ON hometaxrecord (business_id)"
            ))
            conn.execute(text(
                "CREATE INDEX ix_hometaxrecord_record_type ON hometaxrecord (record_type)"
            ))
            conn.execute(text(
                "CREATE INDEX ix_hometaxrecord_identifier ON hometaxrecord (identifier)"
            ))
            conn.execute(text(
                "CREATE INDEX ix_hometaxrecord_tx_date ON hometaxrecord (tx_date)"
            ))
            conn.execute(text(
                "CREATE INDEX ix_hometax_biz_type_date "
                "ON hometaxrecord (business_id, record_type, tx_date)"
            ))
            conn.execute(text(
                "ALTER TABLE hometaxrecord ADD CONSTRAINT uq_hometax_biz_type_identifier "
                "UNIQUE (business_id, record_type, identifier)"
            ))

        if _table_exists(conn, "hometaxsynccursor"):
            print("  = hometaxsynccursor 이미 존재 — skip")
        else:
            print("  + CREATE TABLE hometaxsynccursor ...")
            conn.execute(text("""
                CREATE TABLE hometaxsynccursor (
                    id SERIAL PRIMARY KEY,
                    business_id INTEGER NOT NULL REFERENCES business(id),
                    record_type VARCHAR(32) NOT NULL,
                    last_synced_at TIMESTAMP,
                    last_tx_date DATE,
                    last_status VARCHAR(32),
                    last_error VARCHAR(500),
                    rows_total INTEGER NOT NULL DEFAULT 0
                )
            """))
            conn.execute(text(
                "CREATE INDEX ix_hometaxsynccursor_business_id ON hometaxsynccursor (business_id)"
            ))
            conn.execute(text(
                "CREATE INDEX ix_hometaxsynccursor_record_type ON hometaxsynccursor (record_type)"
            ))
            conn.execute(text(
                "ALTER TABLE hometaxsynccursor ADD CONSTRAINT uq_hometax_cursor_biz_type "
                "UNIQUE (business_id, record_type)"
            ))

        print("Migration done.")


if __name__ == "__main__":
    migrate()
