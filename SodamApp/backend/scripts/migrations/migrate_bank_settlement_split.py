"""bank-sync 자동분류 settlement 분리 마이그레이션 (2026-05-12)

기존에 카드사/페이/배달앱 입금이 모두 classified_as='revenue' 로 분류되어
DailyExpense (매출관리) 에 적재된 상황을 정정한다.

동작:
  1) classified_as='revenue' 이고 linked_daily_id 가 있는 BankTransaction 조회
  2) 각 tx 의 remark1/remark2 로 카드/페이/배달 키워드 매칭 시도
     - 매칭되면 → classified_as 를 card_settlement / pay_settlement / delivery_settlement 로 갱신
     - 기존 DailyExpense 삭제 (매출 중복 차단)
     - CardPayment / PayPayment / DeliveryRevenue 신규 생성 (수수료 역산 데이터)
  3) 매칭 안 되면 그대로 둠 (사용자 수동 매출 입력으로 간주)

실행:
  cd backend && python -m scripts.migrations.migrate_bank_settlement_split [--dry-run] [--business 7]

옵션:
  --dry-run : 실제 변경 없이 영향 받을 건수만 출력
  --business <id> : 특정 business_id 로 제한 (없으면 전체)
"""
import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# project root (backend/) 를 path 에 추가
BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))

from sqlmodel import select  # noqa: E402
from database import engine   # noqa: E402
from services.database_service import DatabaseService  # noqa: E402
from models import BankTransaction, DailyExpense  # noqa: E402
from routers.bank_sync import (  # noqa: E402
    _resolve_settlement,
    _link_card_settlement,
    _create_pay_settlement,
    _link_delivery_settlement,
)


def run(dry_run: bool = False, business_id: int = None):
    service = DatabaseService()
    sess = service.session
    try:
        stmt = select(BankTransaction).where(
            BankTransaction.classified_as == "revenue",
            BankTransaction.in_amount > 0,
        )
        if business_id is not None:
            stmt = stmt.where(BankTransaction.business_id == business_id)
        candidates = sess.exec(stmt).all()

        counts = {
            "scanned": len(candidates),
            "card": 0, "pay": 0, "delivery": 0,
            "unchanged": 0,
        }

        for tx in candidates:
            s = _resolve_settlement(tx.remark1, tx.remark2)
            if s is None:
                counts["unchanged"] += 1
                continue

            stype, _name = s
            target_class = {
                "card": "card_settlement",
                "pay": "pay_settlement",
                "delivery": "delivery_settlement",
            }[stype]

            if dry_run:
                counts[stype] += 1
                print(
                    f"[DRY] tx#{tx.id} biz#{tx.business_id} "
                    f"{tx.trans_date} {tx.in_amount:>10,}원 "
                    f"'{(tx.remark1 or '')[:18]}' → {target_class}"
                )
                continue

            # 1) 기존 DailyExpense 삭제 (중복 매출 차단)
            if tx.linked_daily_id:
                old = sess.get(DailyExpense, tx.linked_daily_id)
                if old:
                    sess.delete(old)
                tx.linked_daily_id = None

            # 2) classified_as 변경
            tx.classified_as = target_class
            tx.classified_by = "migration_2026_05_12"
            tx.classified_at = datetime.now()

            # 3) 적절한 settlement 레코드 생성/매칭
            if stype == "card":
                cp = _link_card_settlement(sess, tx)
                if cp:
                    tx.linked_card_payment_id = cp.id
            elif stype == "pay":
                pp = _create_pay_settlement(sess, tx)
                if pp:
                    tx.linked_pay_payment_id = pp.id
            elif stype == "delivery":
                dr = _link_delivery_settlement(sess, tx)
                if dr:
                    tx.linked_delivery_revenue_id = dr.id

            sess.add(tx)
            counts[stype] += 1

        if not dry_run:
            sess.commit()

        print()
        print("=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"  scanned (revenue + 입금):  {counts['scanned']}")
        print(f"  → card_settlement:          {counts['card']}")
        print(f"  → pay_settlement:           {counts['pay']}")
        print(f"  → delivery_settlement:      {counts['delivery']}")
        print(f"  unchanged (키워드 미매칭):   {counts['unchanged']}")
        print(f"  mode:                        {'DRY-RUN' if dry_run else 'APPLIED'}")
    finally:
        service.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="bank-sync settlement 분리 마이그레이션")
    parser.add_argument("--dry-run", action="store_true", help="변경 없이 영향 건수만 출력")
    parser.add_argument("--business", type=int, default=None, help="특정 business_id 로 제한")
    args = parser.parse_args()
    print(f"DB: {os.getenv('DATABASE_URL', 'sqlite (default)')[:40]}...")
    print(f"mode: {'DRY-RUN' if args.dry_run else 'APPLY'} / business: {args.business or 'ALL'}")
    print()
    run(dry_run=args.dry_run, business_id=args.business)
