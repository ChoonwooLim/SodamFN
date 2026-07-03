import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    import models  # noqa: F401 — create_all 전 전체 테이블 등록 보장 (conftest.py 패턴)
    SQLModel.metadata.create_all(engine)
    yield SimpleNamespace(engine=engine)


def test_easypos_stale_when_no_recent_data(db):
    """EasyPOS credential active 인데 최근 데이터 0건 → stale."""
    from models import EasyPosCredential
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(EasyPosCredential(business_id=1, easypos_id="x",
                                password_encrypted="x", status="active"))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ez = next(c for c in result if c.channel_key == "easypos")
    assert ez.status == "stale"


def test_easypos_healthy_with_recent_receipt(db):
    """오늘-1 영수증 있으면 healthy."""
    from models import EasyPosCredential, EasyPosSaleReceipt
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(EasyPosCredential(business_id=1, easypos_id="x",
                                password_encrypted="x", status="active"))
        s.add(EasyPosSaleReceipt(business_id=1, sale_date=datetime.date(2026, 6, 21),
                                 pos_no="01", receipt_no="1", net_amount=1000))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ez = next(c for c in result if c.channel_key == "easypos")
    assert ez.status == "healthy"


def test_coupang_failed_when_cookie_invalid(db):
    """쿠팡 credential status=failed → failed."""
    from models import CoupangEatsCredential
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="failed",
                                    consecutive_failures=3))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ce = next(c for c in result if c.channel_key == "coupang_eats")
    assert ce.status == "failed"


def test_easypos_stale_not_contaminated_by_other_business(db):
    """business_id=2의 최신 데이터가 business_id=1 판정에 영향 없어야."""
    from models import EasyPosCredential, EasyPosSaleReceipt
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(EasyPosCredential(business_id=1, easypos_id="x",
                                password_encrypted="x", status="active"))
        s.add(EasyPosSaleReceipt(business_id=2, sale_date=datetime.date(2026, 6, 21),
                                 pos_no="01", receipt_no="99", net_amount=500))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ez = next(c for c in result if c.channel_key == "easypos")
    assert ez.status == "stale"


def test_coupang_expiring_soon(db):
    """쿠키 만료 6시간 전 → expiring_soon."""
    import datetime as dt
    from models import CoupangEatsCredential
    from services import collection_health
    now = dt.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="active",
                                    cookies_expires_at=now + dt.timedelta(hours=6)))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ce = next(c for c in result if c.channel_key == "coupang_eats")
    assert ce.status == "expiring_soon"


def test_coupang_expiring_soon_estimated_from_obtained_at(db):
    """세션 쿠키(만료 NULL)라도 cookies_obtained_at + 추정 TTL 로 expiring_soon 발화.

    회귀 방지: 과거엔 raw cookies_expires_at 만 보아 NULL 이면 사전경보가
    영영 안 나갔음. 추정 폴백을 알림 경로에도 적용.
    발급 20시간 전 + 추정 TTL 30h → 추정 만료 +10h ≤ 12h → expiring_soon.
    """
    import datetime as dt
    from models import CoupangEatsCredential
    from services import collection_health
    now = dt.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="active",
                                    cookies_expires_at=None,
                                    cookies_obtained_at=now - dt.timedelta(hours=20)))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ce = next(c for c in result if c.channel_key == "coupang_eats")
    assert ce.status == "expiring_soon"


def test_coupang_not_expiring_when_recently_obtained_session_cookie(db):
    """방금 발급된 세션 쿠키(만료 NULL, 발급 2h 전)는 추정 만료 +28h → 아직 아님.

    최근 주문 데이터가 있으면 healthy 여야 하고, expiring_soon 오탐이 없어야.
    """
    import datetime as dt
    from models import CoupangEatsCredential, CoupangEatsOrder
    from services import collection_health
    now = dt.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="active",
                                    cookies_expires_at=None,
                                    cookies_obtained_at=now - dt.timedelta(hours=2)))
        s.add(CoupangEatsOrder(business_id=1, store_id=1, order_id="o1",
                               ordered_at=now - dt.timedelta(hours=3)))
        s.commit()
        result = collection_health.evaluate_channels(s, 1, now)
    ce = next(c for c in result if c.channel_key == "coupang_eats")
    assert ce.status == "healthy"
