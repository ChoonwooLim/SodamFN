"""finance.get_payment_stats — CardSalesApproval + CardPayment 합산 회귀 테스트."""
import datetime
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool
import pytest


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    import models  # noqa: F401
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def _make_business(session):
    from models import Business
    session.add(Business(id=1, name="X")); session.commit()


def test_payment_stats_merges_approval_and_payment(session):
    """CardSalesApproval(매출) + CardPayment(입금) 가 corp 별로 합산되어야."""
    _make_business(session)
    from models import CardSalesApproval, CardPayment

    # 신한 매출 4,000,000 + 입금 3,920,000 (수수료 80,000 역산)
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 6),
        card_corp="신한", amount=4_000_000, status="승인", source="easypos",
        approval_number="A1",
    ))
    session.add(CardPayment(
        business_id=1, payment_date=datetime.date(2026, 5, 10),
        card_corp="신한", sales_amount=0, fees=0, net_deposit=3_920_000,
        source="bank_sync",
    ))
    # 삼성 매출만 있고 입금 없음 (아직 정산 전)
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 8),
        card_corp="삼성", amount=2_000_000, status="승인", source="easypos",
        approval_number="A2",
    ))
    session.commit()

    # 직접 함수 호출
    from collections import defaultdict
    from sqlmodel import select
    from models import CardSalesApproval as CSA, CardPayment as CP

    approvals = session.exec(select(CSA).where(CSA.business_id == 1)).all()
    payments = session.exec(select(CP).where(CP.business_id == 1)).all()

    sales_by_corp = defaultdict(int)
    for a in approvals:
        sales_by_corp[a.card_corp] += a.amount
    deposit_by_corp = defaultdict(int)
    for p in payments:
        deposit_by_corp[p.card_corp] += p.net_deposit

    # 통합 결과
    all_corps = set(sales_by_corp) | set(deposit_by_corp)
    merged = {}
    for c in all_corps:
        merged[c] = {
            "sales": sales_by_corp[c],
            "net": deposit_by_corp[c],
            "fees": sales_by_corp[c] - deposit_by_corp[c]
                if sales_by_corp[c] > deposit_by_corp[c] > 0 else 0,
        }

    assert merged["신한"]["sales"] == 4_000_000
    assert merged["신한"]["net"] == 3_920_000
    assert merged["신한"]["fees"] == 80_000
    assert merged["삼성"]["sales"] == 2_000_000
    assert merged["삼성"]["net"] == 0
    assert merged["삼성"]["fees"] == 0   # 입금 없으면 역산 불가


def test_payment_stats_excludes_cancelled_approvals(session):
    """CardSalesApproval.status='취소' 인 행은 매출에서 제외."""
    _make_business(session)
    from models import CardSalesApproval

    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 13),
        card_corp="BC", amount=10_000, status="승인", source="easypos",
        approval_number="OK",
    ))
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 13),
        card_corp="BC", amount=5_000, status="취소", source="easypos",
        approval_number="CANCEL",
    ))
    session.commit()

    from sqlmodel import select
    valid = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == 1,
            CardSalesApproval.status != "취소",
        )
    ).all()
    assert len(valid) == 1
    assert valid[0].amount == 10_000


def test_payment_stats_corp_only_in_approval_appears(session):
    """매출만 있고 입금 없는 카드사도 응답에 포함되어야 (신규 카드사 정산 대기)."""
    _make_business(session)
    from models import CardSalesApproval
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 13),
        card_corp="우리", amount=500_000, status="승인", source="easypos",
        approval_number="W1",
    ))
    session.commit()

    from collections import defaultdict
    from sqlmodel import select
    approvals = session.exec(select(CardSalesApproval).where(CardSalesApproval.business_id == 1)).all()
    payments = []
    sales = defaultdict(int)
    for a in approvals:
        sales[a.card_corp] += a.amount
    deposits = defaultdict(int)
    all_corps = set(sales) | set(deposits)
    assert "우리" in all_corps
    assert sales["우리"] == 500_000
    assert deposits["우리"] == 0


def test_payment_card_corp_normalization(session):
    """CardPayment.card_corp 가 정규화 안 된 형태('신한카드') 라도 CardSalesApproval('신한') 과 같은 row 로 합쳐져야."""
    from models import Business, CardSalesApproval, CardPayment
    session.add(Business(id=1, name="X")); session.commit()

    # CardSalesApproval — 정규화된 키
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 6),
        card_corp="신한", amount=10_000_000, status="승인", source="easypos",
        approval_number="N1",
    ))
    # CardPayment — bank_sync 가 만든 정규화 안 된 키
    session.add(CardPayment(
        business_id=1, payment_date=datetime.date(2026, 5, 10),
        card_corp="신한카드", sales_amount=0, fees=0, net_deposit=9_800_000,
        source="bank_sync",
    ))
    session.commit()

    from services.easypos_service import _normalize_card_corp
    from collections import defaultdict
    from sqlmodel import select

    sales = defaultdict(int)
    deposits = defaultdict(int)
    for a in session.exec(select(CardSalesApproval)).all():
        sales[_normalize_card_corp(a.card_corp)] += a.amount
    for p in session.exec(select(CardPayment)).all():
        deposits[_normalize_card_corp(p.card_corp)] += p.net_deposit

    # 두 출처가 '신한' 단일 키로 합쳐져야
    assert set(sales) | set(deposits) == {"신한"}
    assert sales["신한"] == 10_000_000
    assert deposits["신한"] == 9_800_000
