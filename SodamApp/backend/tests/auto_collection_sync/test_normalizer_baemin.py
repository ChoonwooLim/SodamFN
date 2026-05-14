import datetime
from models import Business, BaeminOrder, BaeminSettlement


def test_normalizer_emits_revenue_and_fee_breakdown(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    # 매출 raw
    o = BaeminOrder(
        business_id=1, store_id="10", order_id="ORD1",
        ordered_at=datetime.datetime(2026, 5, 13, 12, 0),
        total_sale_price=245_000, cancelled=False,
    )
    session.add(o)
    # 정산 raw (분해) — settlement_type=COMPLETE 만 카운트
    s = BaeminSettlement(
        business_id=1, store_id="10",
        settlement_date=datetime.date(2026, 5, 13),
        settlement_type="COMPLETE", amount=180_000,
        total_sales=245_000,
        fee_brokerage=44_000, fee_payment=12_000,
        fee_delivery=8_000, fee_advertising=1_000,
        fee_coupon_owner=0,
    )
    session.add(s)
    session.commit()

    from services.auto_collection_sync.normalizers.baemin import normalize_baemin
    events = list(normalize_baemin(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    # 1 revenue + 4 expense
    rev = [e for e in events if e.event_type == "revenue"]
    exp = [e for e in events if e.event_type == "expense"]
    assert len(rev) == 1 and rev[0].amount == 245_000
    assert rev[0].vendor_lookup_key == "baemin"
    assert rev[0].source == "auto_baemin"
    fees = {e.vendor_lookup_key: e.amount for e in exp}
    assert fees["baemin_fee_brokerage"] == -44_000
    assert fees["baemin_fee_payment"] == -12_000
    assert fees["baemin_fee_delivery"] == -8_000
    assert fees["baemin_fee_advertising"] == -1_000
    # 0원 항목은 emit 안 됨 (coupon_owner)
    assert "baemin_fee_coupon_owner" not in fees


def test_normalizer_skips_non_complete_settlements(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    # REQUEST 상태 정산은 무시
    s = BaeminSettlement(
        business_id=1, store_id="10",
        settlement_date=datetime.date(2026, 5, 13),
        settlement_type="REQUEST", amount=180_000,
        total_sales=245_000,
        fee_brokerage=44_000,
    )
    session.add(s)
    session.commit()

    from services.auto_collection_sync.normalizers.baemin import normalize_baemin
    events = list(normalize_baemin(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    # REQUEST 는 fan-out 안 됨, 매출도 없으므로 이벤트 0건
    assert len(events) == 0


def test_normalizer_skips_cancelled_orders(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    o = BaeminOrder(
        business_id=1, store_id="10", order_id="ORD_C",
        ordered_at=datetime.datetime(2026, 5, 13, 12, 0),
        total_sale_price=100_000, cancelled=True,
    )
    session.add(o)
    session.commit()

    from services.auto_collection_sync.normalizers.baemin import normalize_baemin
    events = list(normalize_baemin(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 0
