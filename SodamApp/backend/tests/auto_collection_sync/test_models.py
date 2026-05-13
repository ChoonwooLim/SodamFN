"""Task 1 TDD — DB 모델 변경 검증 (DailyExpense source / 신규 테이블 / 제약조건)."""


def test_dailyexpense_has_source_column(session):
    from models import DailyExpense
    cols = DailyExpense.__table__.columns
    assert "source" in cols
    assert cols["source"].default.arg == "manual"


def test_dailyexpense_unique_constraint(session):
    from models import DailyExpense
    constraints = [c.name for c in DailyExpense.__table_args__ if hasattr(c, "name")]
    assert "uq_dailyexpense_natural" in constraints


def test_settlement_watch_alert_creatable(session):
    from models import SettlementWatchAlert
    import datetime
    a = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=1240000, deadline=datetime.date(2026, 5, 13),
    )
    session.add(a)
    session.commit()
    assert a.id is not None
    assert a.status == "open"
