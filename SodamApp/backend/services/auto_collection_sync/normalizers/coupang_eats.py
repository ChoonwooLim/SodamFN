"""쿠팡이츠 → SyncEvent[].

매출은 일자별 1행, 수수료는 정산 항목별로 fan-out. spec § 5.4 참조.
"""
import datetime
from sqlmodel import Session, select
from models import CoupangEatsOrder, CoupangEatsSettlement
from ..sync_event import SyncEvent


FEE_FIELDS = [
    ("fee_brokerage",   "coupang_eats_fee_brokerage"),
    ("fee_payment",     "coupang_eats_fee_payment"),
    ("fee_delivery",    "coupang_eats_fee_delivery"),
    ("fee_advertising", "coupang_eats_fee_advertising"),
    ("fee_membership",  "coupang_eats_fee_membership"),
    ("fee_other",       "coupang_eats_fee_other"),
]


def normalize_coupang_eats(session: Session, business_id: int,
                            start: datetime.date, end: datetime.date):
    current = start
    while current <= end:
        # 1) 매출
        orders = session.exec(
            select(CoupangEatsOrder).where(
                CoupangEatsOrder.business_id == business_id,
                CoupangEatsOrder.ordered_at >= datetime.datetime.combine(current, datetime.time.min),
                CoupangEatsOrder.ordered_at < datetime.datetime.combine(current + datetime.timedelta(days=1), datetime.time.min),
                CoupangEatsOrder.cancelled == False,  # noqa: E712
            )
        ).all()
        total_sale = sum(o.total_sale_price or 0 for o in orders)
        if total_sale > 0:
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="coupang_eats",
                payment_method="Delivery", amount=int(total_sale),
                source="auto_coupang",
                source_ref=f"coupang_orders:{business_id}:{current.isoformat()}",
                raw_payload={"order_count": len(orders)},
            )

        # 2) 정산 수수료 분해
        settlements = session.exec(
            select(CoupangEatsSettlement).where(
                CoupangEatsSettlement.business_id == business_id,
                CoupangEatsSettlement.settlement_date == current,
                CoupangEatsSettlement.settlement_type == "SETTLEMENT",
            )
        ).all()
        for st in settlements:
            for field_name, vendor_key in FEE_FIELDS:
                fee = getattr(st, field_name, 0) or 0
                if fee <= 0:
                    continue
                yield SyncEvent(
                    business_id=business_id, date=current,
                    event_type="expense", vendor_lookup_key=vendor_key,
                    payment_method="Delivery", amount=-int(fee),
                    source="auto_coupang",
                    source_ref=f"coupang_settle:{st.id}:{field_name}",
                    raw_payload={"settlement_id": st.id},
                )
        current += datetime.timedelta(days=1)
