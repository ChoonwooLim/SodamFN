# SodamApp/backend/tests/test_collection_health_dispatch.py
import importlib, os, tempfile, datetime
import pytest
from sqlmodel import SQLModel, Session, select


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


def test_opens_and_sends_once(db):
    """이상 채널 → open + 발송. 재호출 시 재발송 안 함."""
    from models import CoupangEatsCredential, CollectionHealthAlert
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    sms, tg = [], []
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="failed", consecutive_failures=3))
        s.commit()

        r1 = collection_health.dispatch_alerts(
            s, 1, now, sms_send=lambda p, t: sms.append((p, t)),
            tg_send=lambda t: tg.append(t))
        assert "coupang_eats" in r1["opened"]
        assert len(sms) == 1 and len(tg) == 1

        r2 = collection_health.dispatch_alerts(
            s, 1, now, sms_send=lambda p, t: sms.append((p, t)),
            tg_send=lambda t: tg.append(t))
        assert r2["opened"] == [] and len(sms) == 1  # 재발송 없음

        row = s.exec(select(CollectionHealthAlert).where(
            CollectionHealthAlert.channel_key == "coupang_eats")).first()
        assert row.status == "open"


def test_resolves_when_recovered(db):
    """open 이던 채널이 정상화되면 resolved + 정상화 발송."""
    from models import EasyPosCredential, EasyPosSaleReceipt, CollectionHealthAlert
    from services import collection_health
    now = datetime.datetime(2026, 6, 22, 0, 0)
    sms = []
    with Session(db.engine) as s:
        # 처음엔 stale (credential 만 있고 데이터 없음)
        s.add(EasyPosCredential(business_id=1, easypos_id="x",
                                password_encrypted="x", status="active"))
        s.commit()
        collection_health.dispatch_alerts(s, 1, now, sms_send=lambda p, t: sms.append(t),
                                          tg_send=lambda t: None)
        # 데이터 유입 → healthy
        s.add(EasyPosSaleReceipt(business_id=1, sale_date=datetime.date(2026, 6, 21),
                                 pos_no="01", receipt_no="1", net_amount=1000))
        s.commit()
        r = collection_health.dispatch_alerts(s, 1, now, sms_send=lambda p, t: sms.append(t),
                                              tg_send=lambda t: None)
    assert "easypos" in r["resolved"]
    row = s.exec(select(CollectionHealthAlert).where(
        CollectionHealthAlert.channel_key == "easypos")).first()
    assert row.status == "resolved"


def test_renotify_after_days(db):
    """RENOTIFY_DAYS(3일) 경과 후 리마인드 1회 재발송."""
    import datetime as dt
    from models import CoupangEatsCredential
    from services import collection_health
    d = dt.datetime(2026, 6, 22, 0, 0)
    sms = []
    with Session(db.engine) as s:
        s.add(CoupangEatsCredential(business_id=1, status="failed", consecutive_failures=3))
        s.commit()
        collection_health.dispatch_alerts(
            s, 1, d, sms_send=lambda p, t: sms.append(t), tg_send=lambda t: None)
        r = collection_health.dispatch_alerts(
            s, 1, d + dt.timedelta(days=4), sms_send=lambda p, t: sms.append(t), tg_send=lambda t: None)
    assert "coupang_eats" in r["renotified"]
    assert len(sms) == 2
