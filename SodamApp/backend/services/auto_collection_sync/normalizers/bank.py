"""은행 거래내역 (classified) → SyncEvent[].

기존 routers/bank_sync._sync_classified_to_models 로직을 SyncEvent emit 형태로 재포장.
원본 함수는 호환을 위해 유지하되, 추후 이 normalizer 를 표준으로 사용.
"""
import datetime
from sqlmodel import Session, select
from models import BankTransaction
from ..sync_event import SyncEvent


def _accrual_date(session: Session, tx: BankTransaction) -> datetime.date:
    """지출 귀속일 — 임대료/임차료 월초(1~7일) 이체는 전월 말일로 귀속.

    임차료는 당월 말일 납부인데 말일이 주말/연휴면 다음달 1~3일로 밀려
    (예: 5/31 일요일 → 6/1 이체) 달력월 기준으로 한 달은 0원, 다음 달은
    두 달치가 잡힌다. purchase_parser 신한은행 업로드의 [날짜조정]과 동일 규칙.
    """
    d = tx.trans_date
    if d.day <= 7 and (tx.out_amount or 0) > 0 and tx.vendor_id:
        from models import Vendor
        v = session.get(Vendor, tx.vendor_id)
        if v and (v.category or "") in ("임대료", "임차료"):
            return d.replace(day=1) - datetime.timedelta(days=1)
    return d


def normalize_bank(session: Session, business_id: int,
                    start: datetime.date, end: datetime.date):
    """기간 내 classified_as 가 설정된 BankTransaction 을 SyncEvent 로 변환.

    - revenue / cash_revenue → revenue event
    - expense / purchase     → expense event (vendor_id 가 있는 경우만)
    - card / pay / delivery  → 별도 테이블이 처리하므로 emit 안 함
    """
    rows = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= start,
            BankTransaction.trans_date <= end,
            BankTransaction.classified_as.isnot(None),
        )
    ).all()
    for tx in rows:
        # CRITICAL: skip if 기존 bank_sync._materialize_link 가 이미 DailyExpense 를 만들어
        # 이중 적재 방지. tx.linked_daily_id 가 set 되면 그 row 가 source='manual' 또는
        # 다른 source 로 이미 존재. Task 5 의 점진 리팩토링 전략에 따라 기존 흐름 우선.
        if tx.linked_daily_id is not None:
            continue
        cls = (tx.classified_as or "").lower()
        if cls in ("revenue", "cash_revenue"):
            yield SyncEvent(
                business_id=business_id, date=tx.trans_date,
                event_type="revenue",
                vendor_lookup_key="store",  # 일반 매출은 매장 vendor 로
                payment_method="Cash" if cls == "cash_revenue" else "Bank",
                amount=int(tx.in_amount or 0),
                source="auto_bank",
                source_ref=f"banktx:{tx.id}",
                raw_payload={"tid": tx.tid, "remark1": tx.remark1 or ""},
            )
        elif cls in ("expense", "purchase"):
            # 비용은 기존 bank_sync 의 vendor 매칭 결과 (tx.vendor_id) 를 사용.
            # vendor_id 가 None 이면 emit 안 함 (사장님 수동 분류 대기).
            if not tx.vendor_id:
                continue
            yield SyncEvent(
                business_id=business_id,
                date=_accrual_date(session, tx),
                event_type="expense",
                vendor_lookup_key=f"_existing_vendor:{tx.vendor_id}",
                payment_method="Bank",
                amount=-int(tx.out_amount or 0),
                source="auto_bank",
                source_ref=f"banktx:{tx.id}",
                raw_payload={"tid": tx.tid, "remark1": tx.remark1 or ""},
            )
        # 'card', 'pay', 'delivery' 는 emit 안 함 — 각각 CardPayment/PayPayment/DeliveryRevenue
        # 별도 흐름 (기존 코드) 이 유지됨.
