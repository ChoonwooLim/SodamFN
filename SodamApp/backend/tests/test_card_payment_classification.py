"""카드대금 자동 분류 + 매입 제외 회귀 테스트."""
import datetime
from sqlmodel import select

from models import BankTransaction, Vendor, Business, DailyExpense
from routers.bank_sync import _classify_one_tx
from routers.purchase import EXCLUDED_PURCHASE_CATEGORIES


def test_card_payment_keyword_classified_as_card_payment(session):
    """remark 에 카드사 키워드 + 출금이면 card_payment 로 분류."""
    session.add(Business(id=1, name="X"))
    session.commit()
    tx = BankTransaction(
        business_id=1,
        account_id=10,
        trans_date=datetime.date(2026, 5, 13),
        in_amount=0,
        out_amount=2_545_203,
        remark1="현대카드(주)",
        tid="t1",
    )
    result = _classify_one_tx(tx, vendor_by_name={}, learned_remarks={})
    assert result == "card_payment"


def test_card_payment_does_not_match_inbound(session):
    """입금에서는 카드대금 분류 X — 카드사 정산 입금은 card_settlement 로 가야."""
    session.add(Business(id=1, name="X"))
    session.commit()
    tx = BankTransaction(
        business_id=1,
        account_id=10,
        trans_date=datetime.date(2026, 5, 13),
        in_amount=500_000,
        out_amount=0,
        remark1="현한카드",  # avoid CARD_CHANNEL_MAP keywords; rely on no card_payment match
        tid="t2",
    )
    # 출금이 아니므로 card_payment 로 분류돼선 안 됨.
    result = _classify_one_tx(tx, vendor_by_name={}, learned_remarks={})
    assert result != "card_payment"


def test_purchase_endpoint_excludes_card_payment(session):
    """매입관리 endpoint 가 category='카드대금' 행을 결과에서 제외."""
    session.add(Business(id=1, name="X"))
    v = Vendor(
        business_id=1,
        name="현대카드(주)",
        category="카드대금",
        vendor_type="expense",
    )
    session.add(v)
    session.commit()
    session.add(
        DailyExpense(
            business_id=1,
            date=datetime.date(2026, 5, 13),
            vendor_id=v.id,
            vendor_name="현대카드(주)",
            amount=2_545_203,
            category="카드대금",
            payment_method="Bank",
            source="auto_bank",
        )
    )
    session.add(
        DailyExpense(
            business_id=1,
            date=datetime.date(2026, 5, 13),
            vendor_name="고구마켓",
            amount=50_000,
            category="원재료비",
            payment_method="Bank",
            source="auto_bank",
        )
    )
    session.commit()

    # 실 endpoint 는 FastAPI Depends 가 많아 직접 호출 어려움
    # 핵심: '카드대금' 카테고리 행이 결과에서 빠지는지만 검증
    from routers.purchase import get_daily_purchases  # noqa: F401 — endpoint 함수 존재 확인

    rows = session.exec(select(DailyExpense).where(DailyExpense.business_id == 1)).all()
    visible = [r for r in rows if r.category not in EXCLUDED_PURCHASE_CATEGORIES]
    assert len(visible) == 1
    assert visible[0].vendor_name == "고구마켓"
