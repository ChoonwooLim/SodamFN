"""CodefConnection 에 card_password_encrypted 컬럼 추가.

매뉴얼 spec: connectedId 등록 페이로드에는 ID + PW 만 전송 (CF-04000 회피).
카드비번은 별도 보관해 조회 API (approval-list / billing-list / card-list /
result-check-list) 호출 시 ``cardPassword`` 파라미터로 전달 — 현대카드 등
25.10.30~ 인증여부 필수 카드사 대응.

값은 항상 RSA 공개키로 암호화된 상태로 저장 (평문 절대 X).
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from database import engine


def migrate():
    with engine.begin() as conn:
        col_exists = conn.execute(text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name='codefconnection'
              AND column_name='card_password_encrypted'
            """
        )).scalar()

        if col_exists:
            print("  = card_password_encrypted 이미 존재 — skip")
            return

        print("  + ADD COLUMN card_password_encrypted ...")
        conn.execute(text(
            "ALTER TABLE codefconnection "
            "ADD COLUMN card_password_encrypted TEXT"
        ))
        print("Migration done.")


if __name__ == "__main__":
    migrate()
