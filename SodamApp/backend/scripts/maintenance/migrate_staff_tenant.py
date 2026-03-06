# -*- coding: utf-8 -*-
"""
직원앱 테넌트 분리 마이그레이션
- 8개 테이블에 business_id 컬럼 추가
- 기존 데이터에 business_id 자동 채움
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, text
from database import engine

TABLES_WITH_STAFF_FK = [
    "suggestion",
    "staffchatmessage",
    "purchaserequest",
    "inventorycheck",
    "electroniccontract",
    "attendance",
]

TABLES_WITHOUT_STAFF_FK = [
    "emergencycontact",
    "inventoryitem",
]

ALL_TABLES = TABLES_WITH_STAFF_FK + TABLES_WITHOUT_STAFF_FK


def run():
    with Session(engine) as s:
        # 1. Add business_id columns (idempotent)
        print("\n[1/3] Adding business_id columns...")
        for table in ALL_TABLES:
            try:
                s.exec(text(f'ALTER TABLE "{table}" ADD COLUMN business_id INTEGER REFERENCES business(id)'))
                print(f"  + {table}.business_id added")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"  ~ {table}.business_id already exists (skip)")
                else:
                    print(f"  ! {table}: {e}")
                s.rollback()

        # Create indexes
        print("\n[2/3] Creating indexes...")
        for table in ALL_TABLES:
            try:
                s.exec(text(f'CREATE INDEX IF NOT EXISTS "ix_{table}_business_id" ON "{table}" (business_id)'))
                print(f"  + ix_{table}_business_id")
            except Exception as e:
                print(f"  ~ {table} index: {e}")
                s.rollback()
        s.commit()

        # 2. Backfill business_id from staff.business_id
        print("\n[3/3] Backfilling business_id from staff records...")

        # Get default business_id (first business)
        result = s.exec(text("SELECT id FROM business ORDER BY id LIMIT 1")).first()
        if not result:
            print("  ! No business found. Skipping backfill.")
            return
        default_biz_id = result[0]
        print(f"  Default business_id: {default_biz_id}")

        # Tables with staff_id → backfill from staff.business_id
        for table in TABLES_WITH_STAFF_FK:
            try:
                result = s.exec(text(f"""
                    UPDATE "{table}" SET business_id = staff.business_id
                    FROM staff
                    WHERE "{table}".staff_id = staff.id
                    AND "{table}".business_id IS NULL
                    AND staff.business_id IS NOT NULL
                """))
                count = result.rowcount if hasattr(result, 'rowcount') else 0
                print(f"  {table}: {count} rows updated from staff FK")
            except Exception as e:
                print(f"  ! {table}: {e}")
                s.rollback()

        # Remaining NULLs → default business
        for table in ALL_TABLES:
            try:
                result = s.exec(text(f"""
                    UPDATE "{table}" SET business_id = {default_biz_id}
                    WHERE business_id IS NULL
                """))
                count = result.rowcount if hasattr(result, 'rowcount') else 0
                if count > 0:
                    print(f"  {table}: {count} rows set to default business ({default_biz_id})")
            except Exception as e:
                print(f"  ! {table}: {e}")
                s.rollback()

        s.commit()
        print("\n✅ Migration complete!")


if __name__ == "__main__":
    run()
