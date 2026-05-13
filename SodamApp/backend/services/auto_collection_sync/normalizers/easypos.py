"""EasyPosSaleReceipt → SyncEvent[] (결제수단별 분해).

자세한 매핑은 spec § 5.3 참조.

Card 결제는 CardSalesApproval (sle205) 가 있으면 카드사별로 분해해서 emit —
매출관리 화면에 "신한 / KB국민 / BC ..." 별로 행이 나오게 하려는 목적.
없을 땐 EasyPosSaleReceipt.card_amount 합계 단일 행으로 fallback (이전 동작).
"""
import datetime
from collections import defaultdict
from sqlmodel import Session, select
from models import EasyPosSaleReceipt, CardSalesApproval
from ..sync_event import SyncEvent


PAYMENT_METHOD_COLUMNS = {
    "Cash": "cash_amount",
    "Card": "card_amount",
    "Point": "point_amount",
    "Voucher": "voucher_amount",
    "Cashback": "cashback_amount",
    "Prepaid": "prepaid_card_amount",
    "Credit": "credit_amount",
    "Exchange": "exchange_voucher_amount",
    "EmployeeCard": "employee_card_amount",
    "EMoney": "e_money_amount",
}


def normalize_easypos(session: Session, business_id: int,
                      start: datetime.date, end: datetime.date):
    """기간 내 일자별로 결제수단별 합계 SyncEvent yield.

    Card 만 CardSalesApproval 기반으로 카드사별 분해. 나머지는 receipts 집계.
    """
    current = start
    while current <= end:
        receipts = session.exec(
            select(EasyPosSaleReceipt).where(
                EasyPosSaleReceipt.business_id == business_id,
                EasyPosSaleReceipt.sale_date == current,
            )
        ).all()
        for pm, col in PAYMENT_METHOD_COLUMNS.items():
            if pm == "Card":
                yield from _emit_card_events(session, business_id, current, receipts)
                continue
            total = sum(getattr(r, col, 0) or 0 for r in receipts)
            if total <= 0:
                continue
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="store",
                payment_method=pm, amount=int(total),
                source="auto_easypos",
                source_ref=f"easypos:{business_id}:{current.isoformat()}:{pm}",
                raw_payload={"receipt_count": len(receipts), "payment_method": pm},
            )
        current += datetime.timedelta(days=1)


def _emit_card_events(session: Session, business_id: int,
                      day: datetime.date, receipts: list):
    """CardSalesApproval 이 있으면 카드사별 net (승인-취소) 분해, 없으면 단일 fallback."""
    approvals = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == business_id,
            CardSalesApproval.approval_date == day,
            CardSalesApproval.source == "easypos",
        )
    ).all()

    if approvals:
        by_corp: dict[str, int] = defaultdict(int)
        counts: dict[str, int] = defaultdict(int)
        for a in approvals:
            corp = (a.card_corp or "").strip() or "기타"
            amt = int(a.amount or 0)
            # 취소 행은 음수로 반영. EasyPOS 가 취소 금액을 양수로 저장하는 경우 대비.
            if a.status == "취소":
                amt = -abs(amt)
            by_corp[corp] += amt
            counts[corp] += 1
        for corp, total in by_corp.items():
            if total <= 0:
                continue
            yield SyncEvent(
                business_id=business_id, date=day,
                event_type="revenue",
                vendor_lookup_key=f"store_card:{corp}",
                payment_method="Card", amount=int(total),
                source="auto_easypos",
                source_ref=f"easypos:{business_id}:{day.isoformat()}:Card:{corp}",
                raw_payload={
                    "approval_count": counts[corp],
                    "card_corp": corp,
                    "payment_method": "Card",
                },
            )
        return

    # Fallback — CardSalesApproval 미수집 일자. receipts 의 card_amount 합계 단일 행.
    total = sum(getattr(r, "card_amount", 0) or 0 for r in receipts)
    if total <= 0:
        return
    yield SyncEvent(
        business_id=business_id, date=day,
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=int(total),
        source="auto_easypos",
        source_ref=f"easypos:{business_id}:{day.isoformat()}:Card",
        raw_payload={"receipt_count": len(receipts), "payment_method": "Card"},
    )
