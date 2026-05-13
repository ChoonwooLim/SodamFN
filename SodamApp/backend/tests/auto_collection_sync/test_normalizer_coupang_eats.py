import datetime
from models import Business, CoupangEatsOrder, CoupangEatsSettlement


def test_normalizer_emits_revenue_and_fee_breakdown(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    # 매출 raw
    o = CoupangEatsOrder(
        business_id=1, store_id=10, order_id="ORD1",
        ordered_at=datetime.datetime(2026, 5, 13, 12, 0),
        total_sale_price=245_000, cancelled=False,
    )
    session.add(o)
    # 정산 raw (분해)
    s = CoupangEatsSettlement(
        business_id=1, store_id=10,
        settlement_date=datetime.date(2026, 5, 13),
        settlement_type="SETTLEMENT", amount=180_000,
        total_sales=245_000,
        fee_brokerage=44_000, fee_payment=12_000,
        fee_delivery=8_000, fee_advertising=1_000,
        fee_membership=0, fee_other=0, deduction_etc=0,
    )
    session.add(s)
    session.commit()

    from services.auto_collection_sync.normalizers.coupang_eats import normalize_coupang_eats
    events = list(normalize_coupang_eats(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    # 1 revenue + 4 expense
    rev = [e for e in events if e.event_type == "revenue"]
    exp = [e for e in events if e.event_type == "expense"]
    assert len(rev) == 1 and rev[0].amount == 245_000
    fees = {e.vendor_lookup_key: e.amount for e in exp}
    assert fees["coupang_eats_fee_brokerage"] == -44_000
    assert fees["coupang_eats_fee_payment"] == -12_000
    assert fees["coupang_eats_fee_delivery"] == -8_000
    assert fees["coupang_eats_fee_advertising"] == -1_000
    # 0원 항목은 emit 안 됨 (membership/other/deduction)
    assert "coupang_eats_fee_membership" not in fees
    assert "coupang_eats_fee_other" not in fees


def test_extract_settlement_breakdown_with_fallback_keys():
    from services.coupang_eats_service import _extract_settlement_breakdown
    raw = {
        "totalSaleAmount": "245000",  # fallback key, string value
        "feeBrokerage": 44000,
        "pgFee": 12000,               # fallback for payment fee
        "deliveryFee": 8000,
    }
    b = _extract_settlement_breakdown(raw)
    assert b["total_sales"] == 245000
    assert b["fee_brokerage"] == 44000
    assert b["fee_payment"] == 12000
    assert b["fee_delivery"] == 8000
    assert b["fee_advertising"] == 0  # missing → 0
    assert b["fee_membership"] == 0
