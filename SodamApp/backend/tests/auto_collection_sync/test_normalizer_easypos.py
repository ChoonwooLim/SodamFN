import datetime
from models import Business, EasyPosSaleReceipt


def _seed_receipt(session, business_id, sale_date, cash=0, card=0, point=0):
    r = EasyPosSaleReceipt(
        business_id=business_id, sale_date=sale_date,
        pos_no="1", receipt_no="R1",
        total_amount=cash + card + point, net_amount=cash + card + point,
        cash_amount=cash, card_amount=card, point_amount=point,
    )
    session.add(r)
    session.commit()
    return r


def test_normalizer_splits_payment_methods(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000, point=42_000)
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    by_pm = {e.payment_method: e for e in events}
    assert by_pm["Cash"].amount == 350_000
    assert by_pm["Card"].amount == 2_100_000
    assert by_pm["Point"].amount == 42_000
    assert all(e.event_type == "revenue" and e.source == "auto_easypos" for e in events)


def test_normalizer_skips_zero_methods(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000)  # only cash
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    pms = {e.payment_method for e in events}
    assert pms == {"Cash"}


def test_easypos_to_dailyexpense_end_to_end(session):
    """normalize_easypos → fan_out.apply → DailyExpense 행 생성."""
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000)
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    apply(session, 1, events)
    rows = session.exec(select(DailyExpense)).all()
    by_pm = {r.payment_method: r for r in rows}
    assert by_pm["Cash"].amount == 350_000
    assert by_pm["Card"].amount == 2_100_000
