"""Task 6 TDD — 수수료 자동 추정 (3경로 + 학습 + 배달)."""
import datetime
from sqlmodel import select
from models import (
    Business, CardPayment, CardSalesApproval, BankTransaction, BankAccount,
    CardFeeMatchLog, CardFeeRateLearned, Vendor,
)


def test_codef_settlement_takes_precedence(session):
    session.add(Business(id=1, name="X")); session.commit()
    session.add(CardPayment(
        business_id=1, payment_date=datetime.date(2026, 5, 10),
        card_corp="삼성", sales_amount=5_000_000,
        fees=158_000, net_deposit=4_842_000, source="codef",
    ))
    session.commit()
    from services.auto_collection_sync.fee_estimator import estimate_card_fee
    e = estimate_card_fee(session, business_id=1, card_corp="삼성", year=2026, month=5)
    assert e.amount == 158_000
    assert e.source == "codef_settlement"
    assert e.confidence == 1.0


def test_deposit_match_creates_card_fee_match_log(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    for d, a in [(6, 300_000), (7, 400_000), (8, 300_000)]:
        session.add(CardSalesApproval(
            business_id=1, approval_date=datetime.date(2026, 5, d),
            card_corp="삼성", amount=a, status="승인", source="codef",
        ))
    # 입금 1주일 이내인 날짜로 (오늘 - period_days 90일 안에 들어와야 함)
    today = datetime.date.today()
    deposit_day = max(datetime.date(2026, 5, 10), today - datetime.timedelta(days=80))
    # 정렬: 승인 일자는 입금일 이전이어야 함. 같은 비율 유지하면서 날짜 조정
    if deposit_day != datetime.date(2026, 5, 10):
        # 테스트는 시간 종속성 있으니 cutoff 안에 있는 날짜로 재설정
        offset = (deposit_day - datetime.date(2026, 5, 10)).days
        # 기존 승인 데이터를 deposit_day 이전으로 시프트
        for ap in session.exec(select(CardSalesApproval)).all():
            ap.approval_date = ap.approval_date + datetime.timedelta(days=offset)
            session.add(ap)
        session.commit()
    session.add(BankTransaction(
        business_id=1, account_id=10,
        trans_date=deposit_day,
        in_amount=978_000, remark1="삼성카드", tid="t1",
    ))
    session.commit()

    from services.auto_collection_sync.fee_estimator import run_deposit_match
    n = run_deposit_match(session, business_id=1)
    assert n >= 1
    logs = session.exec(select(CardFeeMatchLog)).all()
    assert len(logs) == 1
    assert logs[0].sales_amount == 1_000_000
    assert logs[0].deposit_amount == 978_000
    assert logs[0].effective_fee == 22_000
    assert 0.021 < logs[0].effective_rate < 0.023


def test_update_learned_rate_writes_with_confidence(session):
    session.add(Business(id=1, name="X")); session.commit()
    # 학습 cutoff (오늘-90일) 안에 들어오도록 matched_at 자동 설정 활용
    for i in range(15):
        session.add(CardFeeMatchLog(
            business_id=1, card_corp="삼성",
            deposit_date=datetime.date(2026, 4, 1) + datetime.timedelta(days=i),
            approval_dates_start=datetime.date(2026, 3, 25),
            approval_dates_end=datetime.date(2026, 3, 30),
            sales_amount=1_000_000, deposit_amount=978_000,
            effective_fee=22_000, effective_rate=0.022,
        ))
    session.commit()

    from services.auto_collection_sync.fee_estimator import update_learned_rate
    update_learned_rate(session, business_id=1, card_corp="삼성", period_days=3650)
    row = session.exec(select(CardFeeRateLearned)).first()
    assert row is not None
    assert 0.021 < row.learned_rate < 0.023
    assert row.sample_size == 15
    assert 0.3 < row.confidence < 1.0


def test_estimate_delivery_fee_coupang_direct():
    from services.auto_collection_sync.fee_estimator import estimate_delivery_fee
    # 쿠팡이츠는 0 + coupang_direct
    e = estimate_delivery_fee(None, business_id=1, channel="쿠팡이츠",
                                settlement_date=datetime.date(2026, 5, 13),
                                settlement_amount=100_000)
    assert e.source == "coupang_direct"
    assert e.amount == 0


def test_estimate_delivery_fee_owner_input_rate(session):
    from models import DeliveryFeeRate
    session.add(Business(id=1, name="X")); session.commit()
    session.add(DeliveryFeeRate(
        business_id=1, channel="배민", rate=0.068,
        effective_from=datetime.date(2026, 1, 1),
    ))
    session.commit()
    from services.auto_collection_sync.fee_estimator import estimate_delivery_fee
    # 입금 932,000 → 매출 1,000,000 추정 (0.068 수수료)
    e = estimate_delivery_fee(session, business_id=1, channel="배민",
                                settlement_date=datetime.date(2026, 5, 13),
                                settlement_amount=932_000)
    assert e.source == "owner_input_rate"
    assert e.confidence == 0.7
    # estimated_sales = 932_000 / (1 - 0.068) ≈ 1,000,000
    # estimated_fee = 1,000,000 - 932,000 = 68,000
    assert 65_000 <= e.amount <= 72_000


def test_estimate_delivery_fee_no_rate(session):
    session.add(Business(id=1, name="X")); session.commit()
    from services.auto_collection_sync.fee_estimator import estimate_delivery_fee
    e = estimate_delivery_fee(session, business_id=1, channel="요기요",
                                settlement_date=datetime.date(2026, 5, 13),
                                settlement_amount=100_000)
    assert e.source == "unavailable"
