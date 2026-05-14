"""CodefConnection 에 connection_type 컬럼 추가 + UNIQUE 제약 갱신.

기존:  UNIQUE(business_id, organization_code, organization_type)
신규:  UNIQUE(business_id, organization_code, organization_type, connection_type)

같은 카드사라도 매출(card_sales) 과 매입(card_purchase) connectedId 는 분리되어야 함.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from database import engine


OLD_UQ = "codefconnection_business_id_organization_code_organization__key"
NEW_UQ = "uq_codef_conn_biz_org_type_conntype"


def migrate():
    with engine.begin() as conn:
        # 1) connection_type 컬럼 존재 확인
        col_exists = conn.execute(text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name='codefconnection' AND column_name='connection_type'
            """
        )).scalar()

        if not col_exists:
            print("  + ADD COLUMN connection_type ...")
            conn.execute(text(
                "ALTER TABLE codefconnection "
                "ADD COLUMN connection_type VARCHAR(32) NOT NULL DEFAULT 'card_sales'"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_codefconnection_connection_type "
                "ON codefconnection (connection_type)"
            ))
        else:
            print("  = connection_type 이미 존재 — skip ADD COLUMN")

        # 2) 기존 UNIQUE 제약 제거 + 신규 추가
        new_uq_exists = conn.execute(text(
            """
            SELECT 1 FROM pg_constraint WHERE conname=:n
            """
        ), {"n": NEW_UQ}).scalar()

        if not new_uq_exists:
            old_uq_exists = conn.execute(text(
                "SELECT 1 FROM pg_constraint WHERE conname=:n"
            ), {"n": OLD_UQ}).scalar()
            if old_uq_exists:
                print(f"  - DROP CONSTRAINT {OLD_UQ}")
                conn.execute(text(
                    f'ALTER TABLE codefconnection DROP CONSTRAINT "{OLD_UQ}"'
                ))
            print(f"  + ADD CONSTRAINT {NEW_UQ}")
            conn.execute(text(
                f'ALTER TABLE codefconnection '
                f'ADD CONSTRAINT "{NEW_UQ}" '
                f'UNIQUE (business_id, organization_code, organization_type, connection_type)'
            ))
        else:
            print(f"  = {NEW_UQ} 이미 존재 — skip")

    print("Migration done.")


if __name__ == "__main__":
    migrate()
