"""Task 1 TDD — DB 모델 변경 검증 (DailyExpense source / 신규 테이블 / 제약조건)."""


def test_dailyexpense_has_source_column(session):
    from models import DailyExpense
    cols = DailyExpense.__table__.columns
    assert "source" in cols
    assert cols["source"].default.arg == "manual"


def test_dailyexpense_unique_constraint(session):
    from models import DailyExpense
    from sqlalchemy.sql.schema import UniqueConstraint
    target = None
    for c in DailyExpense.__table_args__:
        if isinstance(c, UniqueConstraint) and c.name == "uq_dailyexpense_natural":
            target = c
            break
    assert target is not None, "uq_dailyexpense_natural constraint missing"
    cols = [col.name for col in target.columns]
    assert cols == ["business_id", "date", "vendor_id", "payment_method", "source"], \
        f"Unexpected columns: {cols}"


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


def test_settlement_watch_alert_unique_natural_key(session):
    """같은 (business_id, alert_type, channel_or_corp, expected_date) 조합으로
    두 번째 삽입 시 IntegrityError 발생해야 함."""
    from models import SettlementWatchAlert
    import datetime
    from sqlalchemy.exc import IntegrityError

    a1 = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=1240000, deadline=datetime.date(2026, 5, 13),
    )
    session.add(a1)
    session.commit()

    a2 = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=999999, deadline=datetime.date(2026, 5, 14),
    )
    session.add(a2)
    try:
        session.commit()
        assert False, "Expected IntegrityError on duplicate natural key"
    except IntegrityError:
        session.rollback()
