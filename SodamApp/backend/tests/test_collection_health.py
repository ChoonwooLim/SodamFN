# SodamApp/backend/tests/test_collection_health.py
import importlib, os, tempfile, datetime
import pytest
from sqlmodel import SQLModel, Session


@pytest.fixture
def db(monkeypatch):
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{f.name}")
    import database
    importlib.reload(database)
    import models  # noqa: F401 — create_all 전 전체 테이블 등록 보장 (conftest.py 패턴)
    SQLModel.metadata.create_all(database.engine)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


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
