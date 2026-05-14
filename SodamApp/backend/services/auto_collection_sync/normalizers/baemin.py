"""배민 → SyncEvent[].

매출은 일자별 1행, 수수료는 정산 항목별로 fan-out. 쿠팡이츠 normalizer 와 동일 패턴.

수수료 출처: BaeminSettlement.fee_* 컬럼 (현재 0 으로 채워져 있음 — Task 5 의 fetch_settlements
응답에 수수료 분해 없음. 향후 BaeminOrder.raw_json 의 settle.orderBrokerageItems 등에서 집계
필요). 1차 구현은 코퐝 패턴 그대로 fee_brokerage/fee_payment/fee_delivery/fee_advertising/
fee_coupon_owner 모두 0 인 상태 — fan-out 실행되어도 yield 안 됨 (fee <= 0).
"""
import datetime
from sqlmodel import Session, select
from models import BaeminOrder, BaeminSettlement
from ..sync_event import SyncEvent


FEE_FIELDS = [
    ("fee_brokerage",      "baemin_fee_brokerage"),
    ("fee_payment",        "baemin_fee_payment"),
    ("fee_delivery",       "baemin_fee_delivery"),
    ("fee_advertising",    "baemin_fee_advertising"),
    ("fee_coupon_owner",   "baemin_fee_coupon_owner"),
]


def normalize_baemin(session: Session, business_id: int,
                     start: datetime.date, end: datetime.date):
    """BaeminOrder + BaeminSettlement → SyncEvent generator.

    매출: 일자별 BaeminOrder.total_sale_price 합계 (cancelled 제외) → event_type='revenue'.
    수수료: SETTLEMENT 타입 BaeminSettlement 의 fee_* 컬럼별 fan-out → event_type='expense'.
    """
    current = start
    while current <= end:
        # 1) 매출
        day_start = datetime.datetime.combine(current, datetime.time.min)
        day_end = datetime.datetime.combine(
            current + datetime.timedelta(days=1), datetime.time.min
        )
        orders = session.exec(
            select(BaeminOrder).where(
                BaeminOrder.business_id == business_id,
                BaeminOrder.ordered_at >= day_start,
                BaeminOrder.ordered_at < day_end,
                BaeminOrder.cancelled == False,  # noqa: E712
            )
        ).all()
        total_sale = sum(o.total_sale_price or 0 for o in orders)
        if total_sale > 0:
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="baemin",
                payment_method="Delivery", amount=int(total_sale),
                source="auto_baemin",
                source_ref=f"baemin_orders:{business_id}:{current.isoformat()}",
                raw_payload={"order_count": len(orders)},
            )

        # 2) 정산 수수료 분해 (현재는 0 — 컬럼 채워지면 yield)
        settlements = session.exec(
            select(BaeminSettlement).where(
                BaeminSettlement.business_id == business_id,
                BaeminSettlement.settlement_date == current,
                # 배민 settlement_type 는 giveStatus = "REQUEST"/"COMPLETE" 등.
                # SETTLEMENT 라는 고정 문자열은 사용 안 함. 일단 COMPLETE 만 카운트.
                BaeminSettlement.settlement_type == "COMPLETE",
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
                    source="auto_baemin",
                    source_ref=f"baemin_settle:{st.id}:{field_name}",
                    raw_payload={"settlement_id": st.id},
                )
        current += datetime.timedelta(days=1)
