import datetime
from sqlmodel import select
from models import Business, SubscriptionPlan, DailyExpense, EasyPosSaleReceipt


def test_run_one_business_skips_if_plan_disables_auto(session):
    plan = SubscriptionPlan(id=1, name="Basic", feature_auto_collection=False)
    session.add(plan); session.commit()
    session.add(Business(id=1, name="X", plan_id=1)); session.commit()
    from services.auto_collection_sync.orchestrator import run_one_business
    report = run_one_business(session, 1,
                              period_start=datetime.date(2026, 5, 13),
                              period_end=datetime.date(2026, 5, 13))
    assert report.total_events == 0
    assert report.skipped_reason == "plan_disabled"


def test_run_one_business_processes_easypos(session):
    plan = SubscriptionPlan(id=1, name="Premium", feature_auto_collection=True)
    session.add(plan); session.commit()
    session.add(Business(id=1, name="X", plan_id=1))
    session.commit()
    session.add(EasyPosSaleReceipt(
        business_id=1, sale_date=datetime.date(2026, 5, 13),
        pos_no="1", receipt_no="R1",
        total_amount=350_000, net_amount=350_000, cash_amount=350_000,
    ))
    session.commit()

    from services.auto_collection_sync.orchestrator import run_one_business
    report = run_one_business(session, 1,
                              period_start=datetime.date(2026, 5, 13),
                              period_end=datetime.date(2026, 5, 13))
    assert report.total_events >= 1
    rows = session.exec(select(DailyExpense)).all()
    assert any(r.source == "auto_easypos" for r in rows)


def test_run_one_business_no_plan_is_skipped(session):
    session.add(Business(id=1, name="X")); session.commit()  # no plan_id
    from services.auto_collection_sync.orchestrator import run_one_business
    report = run_one_business(session, 1)
    assert report.skipped_reason == "plan_disabled"
