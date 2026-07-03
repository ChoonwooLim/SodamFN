"""manual-cookies 즉시 검증 플로우 테스트.

기존 test_coupang_eats_cookie_refresh.py 패턴:
sqlite in-memory + monkeypatch(coupang_eats.engine / CoupangEatsClient)
+ 엔드포인트 함수 직접 호출 (FastAPI DI 미사용).
"""
import datetime
import types

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select


ADMIN = types.SimpleNamespace(business_id=1, role="admin")

COOKIES = [
    {"name": "unify-token", "value": "tok", "domain": ".coupangeats.com",
     "path": "/", "expires": -1},
    {"name": "bm_sz", "value": "aka", "domain": ".coupangeats.com",
     "path": "/", "expires": 1_800_000_000},
]


def _setup_engine(monkeypatch):
    import models  # noqa: F401  (SQLModel 테이블 등록)
    from routers import coupang_eats

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(coupang_eats, "engine", engine)
    return engine


# ─── Task 1: 헬퍼 단위 테스트 ─────────────────────────────

def test_normalize_stores_absorbs_key_variants():
    from routers.coupang_eats import _normalize_stores

    out = _normalize_stores([
        {"storeId": 823245, "shopName": "소담김밥"},
        {"id": "99", "name": "장인김밥"},
        {"store_id": 7, "storeName": "강동점"},
        {"storeId": "abc"},          # int 변환 불가 → 제외
        {"shopName": "ID없음"},       # store_id 없음 → 제외
    ])
    assert out == [
        {"store_id": 823245, "store_name": "소담김밥"},
        {"store_id": 99, "store_name": "장인김밥"},
        {"store_id": 7, "store_name": "강동점"},
    ]


def test_normalize_stores_empty():
    from routers.coupang_eats import _normalize_stores
    assert _normalize_stores([]) == []
    assert _normalize_stores(None) == []


def test_last_success_sync_date(monkeypatch):
    from models import CoupangEatsSyncLog
    from routers.coupang_eats import _last_success_sync_date

    engine = _setup_engine(monkeypatch)
    with Session(engine) as s:
        s.add(CoupangEatsSyncLog(business_id=1, status="success",
                                 target_start=datetime.date(2026, 6, 20),
                                 target_end=datetime.date(2026, 6, 20)))
        s.add(CoupangEatsSyncLog(business_id=1, status="success",
                                 target_start=datetime.date(2026, 6, 21),
                                 target_end=datetime.date(2026, 6, 21)))
        s.add(CoupangEatsSyncLog(business_id=1, status="failed",
                                 target_start=datetime.date(2026, 6, 22),
                                 target_end=datetime.date(2026, 6, 22)))
        s.add(CoupangEatsSyncLog(business_id=2, status="success",
                                 target_start=datetime.date(2026, 6, 30),
                                 target_end=datetime.date(2026, 6, 30)))
        s.commit()

        assert _last_success_sync_date(s, 1) == datetime.date(2026, 6, 21)
        assert _last_success_sync_date(s, 99) is None


# ─── Task 2: manual-cookies 검증 플로우 ──────────────────

def _make_fake_client(*, whoami_exc=None,
                      stores=None,
                      rotated=None):
    """시나리오별 FakeClient 클래스 생성."""
    class FakeClient:
        def __init__(self, cookies):
            self._cookies = cookies

        def whoami(self):
            if whoami_exc is not None:
                raise whoami_exc
            return {"merchantId": 1}

        def list_stores(self):
            if isinstance(stores, Exception):
                raise stores
            return stores if stores is not None else []

        def get_cookies(self):
            return rotated if rotated is not None else self._cookies

        def close(self):
            pass

    return FakeClient


def _call(monkeypatch, fake_client, *, store_id=None, skip_verify=False,
          cookies=None):
    from routers import coupang_eats
    from routers.coupang_eats import ManualCookiesIn, submit_manual_cookies

    monkeypatch.setattr(coupang_eats, "CoupangEatsClient", fake_client)
    body = ManualCookiesIn(cookies=cookies or COOKIES, store_id=store_id,
                           skip_verify=skip_verify)
    return submit_manual_cookies(body, admin=ADMIN, x_view_as_business=None)


def test_verify_success_saves_and_autodetects_store(monkeypatch):
    from models import CoupangEatsCredential

    engine = _setup_engine(monkeypatch)
    fake = _make_fake_client(stores=[{"storeId": 823245, "shopName": "소담김밥"}])

    res = _call(monkeypatch, fake)

    assert res["ok"] is True
    assert res["verified"] is True
    assert res["verify_warning"] is None
    assert res["stores"] == [{"store_id": 823245, "store_name": "소담김밥"}]

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        assert cred.cookies_encrypted            # 저장됨
        assert cred.store_id == 823245           # 매장 1개 → 자동 감지
        assert cred.shop_name == "소담김밥"
        assert cred.status == "active"


def test_invalid_cookie_rejected_and_not_saved(monkeypatch):
    from models import CoupangEatsCredential
    from services.coupang_eats_service import CookieInvalidError

    engine = _setup_engine(monkeypatch)
    fake = _make_fake_client(whoami_exc=CookieInvalidError("HTTP 401"))

    with pytest.raises(HTTPException) as exc:
        _call(monkeypatch, fake)

    assert exc.value.status_code == 422
    assert "무효" in exc.value.detail

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).first()
        assert cred is None                       # 아무것도 저장 안 됨


def test_network_error_saves_with_warning(monkeypatch):
    from models import CoupangEatsCredential
    from services.coupang_eats_service import CoupangEatsError

    engine = _setup_engine(monkeypatch)
    fake = _make_fake_client(whoami_exc=CoupangEatsError("통신 실패"))

    res = _call(monkeypatch, fake)

    assert res["ok"] is True
    assert res["verified"] is False
    assert "통신 실패" in res["verify_warning"]

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        assert cred.cookies_encrypted             # 저장은 진행됨


def test_skip_verify_never_constructs_client(monkeypatch):
    from models import CoupangEatsCredential

    engine = _setup_engine(monkeypatch)

    class Bomb:
        def __init__(self, cookies):
            raise AssertionError("skip_verify 인데 client 생성됨")

    res = _call(monkeypatch, Bomb, skip_verify=True)

    assert res["ok"] is True
    assert res["verified"] is False

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        assert cred.cookies_encrypted


def test_multi_store_no_autodetect(monkeypatch):
    from models import CoupangEatsCredential

    engine = _setup_engine(monkeypatch)
    fake = _make_fake_client(stores=[
        {"storeId": 1, "shopName": "A점"},
        {"storeId": 2, "shopName": "B점"},
    ])

    res = _call(monkeypatch, fake)

    assert len(res["stores"]) == 2
    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        assert cred.store_id is None              # 복수 매장 → 자동 감지 안 함


def test_response_includes_last_success_sync_date(monkeypatch):
    from models import CoupangEatsSyncLog

    engine = _setup_engine(monkeypatch)
    with Session(engine) as s:
        s.add(CoupangEatsSyncLog(business_id=1, status="success",
                                 target_start=datetime.date(2026, 6, 21),
                                 target_end=datetime.date(2026, 6, 21)))
        s.commit()

    fake = _make_fake_client(stores=[{"storeId": 823245, "shopName": "소담김밥"}])
    res = _call(monkeypatch, fake)

    assert res["last_success_sync_date"] == "2026-06-21"


def test_rotated_cookies_are_saved(monkeypatch):
    from models import CoupangEatsCredential
    from services.crypto_util import decrypt_text
    from services.coupang_eats_service import deserialize_cookies

    engine = _setup_engine(monkeypatch)
    rotated = [{"name": "unify-token", "value": "rotated-tok",
                "domain": ".coupangeats.com", "path": "/", "expires": -1}]
    fake = _make_fake_client(stores=[], rotated=rotated)

    _call(monkeypatch, fake)

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        stored = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
        assert stored == rotated                  # 회전본이 저장됨
