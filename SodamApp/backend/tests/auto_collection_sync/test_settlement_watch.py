"""Task 9 TDD — 입금 모니터링 (Settlement Watch)."""
import datetime
from sqlmodel import select
from models import (
    Business, CardSalesApproval, BankTransaction, BankAccount,
    SettlementWatchAlert, CoupangEatsSettlement,
)


def test_card_overdue_creates_alert(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    # 5/6 매출, 5/13 현재 → 삼성 D+2 영업일 + grace 3 = 5/11 이전 deadline
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 6),
        card_corp="삼성", amount=540_000, status="승인", source="codef",
    ))
    session.commit()

    from services.auto_collection_sync import settlement_watch
    settlement_watch.run_for_business(session, business_id=1,
                                       today=datetime.date(2026, 5, 13))
    alerts = session.exec(select(SettlementWatchAlert)).all()
    assert any(a.alert_type == "card_overdue" and a.channel_or_corp == "삼성"
               for a in alerts)


def test_coupang_overdue_creates_alert(session):
    session.add(Business(id=1, name="X")); session.commit()
    session.add(CoupangEatsSettlement(
        business_id=1, store_id=10,
        settlement_date=datetime.date(2026, 5, 8),
        settlement_type="SETTLEMENT", amount=245_000,
    ))
    session.commit()
    from services.auto_collection_sync import settlement_watch
    settlement_watch.run_for_business(session, business_id=1,
                                       today=datetime.date(2026, 5, 13))
    alerts = session.exec(select(SettlementWatchAlert)).all()
    assert any(a.alert_type == "delivery_overdue" and a.channel_or_corp == "쿠팡이츠"
               for a in alerts)


def test_late_deposit_auto_closes_alert(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    a = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=540_000, deadline=datetime.date(2026, 5, 13),
        status="open", raw_ref="card_approval_group:test",
    )
    session.add(a); session.commit()
    session.add(BankTransaction(
        business_id=1, account_id=10,
        trans_date=datetime.date(2026, 5, 15),
        in_amount=540_000, remark1="삼성카드", tid="t-late",
    ))
    session.commit()

    from services.auto_collection_sync import settlement_watch
    settlement_watch.auto_close_received_alerts(session, business_id=1)
    refreshed = session.get(SettlementWatchAlert, a.id)
    assert refreshed.status == "received"
    assert refreshed.received_amount == 540_000


def test_run_is_idempotent(session):
    """같은 cron 두 번 돌려도 중복 alert 안 생김."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 6),
        card_corp="삼성", amount=540_000, status="승인", source="codef",
    ))
    session.commit()

    from services.auto_collection_sync import settlement_watch
    settlement_watch.run_for_business(session, business_id=1, today=datetime.date(2026, 5, 13))
    settlement_watch.run_for_business(session, business_id=1, today=datetime.date(2026, 5, 13))
    alerts = session.exec(select(SettlementWatchAlert)).all()
    assert len(alerts) == 1
