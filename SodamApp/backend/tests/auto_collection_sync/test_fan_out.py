import datetime
import pytest
from services.auto_collection_sync.sync_event import SyncEvent

def _make_biz(session):
    from models import Business
    biz = Business(id=1, name="X"); session.add(biz); session.commit(); return biz

def test_revenue_event_upserts_dailyexpense(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select

    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="easypos:1:2026-05-13",
    )
    report = apply(session, business_id=1, events=[ev])
    rows = session.exec(select(DailyExpense)).all()
    assert len(rows) == 1
    assert rows[0].amount == 2_100_000
    assert rows[0].source == "auto_easypos"
    assert report.counts["revenue:auto_easypos"] == 1

def test_duplicate_event_updates_in_place(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select

    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="r1",
    )
    apply(session, 1, [ev])
    ev2 = SyncEvent(**{**ev.__dict__, "amount": 2_500_000})
    apply(session, 1, [ev2])
    rows = session.exec(select(DailyExpense)).all()
    assert len(rows) == 1
    assert rows[0].amount == 2_500_000

def test_expense_event_creates_expense_row(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="expense", vendor_lookup_key="coupang_eats_fee_brokerage",
        payment_method="Delivery", amount=-44_000,
        source="auto_coupang", source_ref="x",
    )
    apply(session, 1, [ev])
    rows = session.exec(select(DailyExpense)).all()
    assert rows[0].amount == -44_000
    assert rows[0].vendor_name == "쿠팡이츠 중개수수료"
