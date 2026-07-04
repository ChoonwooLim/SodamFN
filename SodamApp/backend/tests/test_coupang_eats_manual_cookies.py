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


def test_rotated_cookies_are_merged_not_replaced(monkeypatch):
    """회전본은 원본에 병합 — 원본에만 있는 쿠키(bm_sz)가 유실되면 안 됨."""
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
        stored = {c["name"]: c for c in
                  deserialize_cookies(decrypt_text(cred.cookies_encrypted))}
        assert stored["unify-token"]["value"] == "rotated-tok"   # 갱신 반영
        assert stored["bm_sz"]["value"] == "aka"                 # 원본 유지


# ─── 회전 쿠키 오염 방지 (2026-07-04 운영 장애 재현) ──────────
#
# whoami 응답의 Set-Cookie 가 _abck 를 즉시만료로 회전시키고 access-token 을
# 빈 값으로 지움. 이를 통째로 저장하면 브라우저에서 복사한 검증된 원본이
# 오염되어 바로 다음 sync 부터 401/403.

def test_merge_rotated_cookies_drops_poison():
    from services.coupang_eats_service import merge_rotated_cookies

    now = 1_751_000_000.0
    original = [
        {"name": "_abck", "value": "GOOD", "domain": ".coupangeats.com",
         "path": "/", "expires": -1},
        {"name": "access-token", "value": "orig-at",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
        {"name": "unify-token", "value": "old-tok",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
    ]
    rotated = [
        # 서버가 즉시만료로 무효화한 _abck → 스킵, 원본 유지
        {"name": "_abck", "value": "CHALLENGE", "domain": ".coupangeats.com",
         "path": "/", "expires": now - 1},
        # 서버가 빈 값으로 지운 access-token → 스킵, 원본 유지
        {"name": "access-token", "value": "", "domain": ".coupangeats.com",
         "path": "/", "expires": -1},
        # 정상 회전된 인증 토큰 → 값 갱신
        {"name": "unify-token", "value": "new-tok",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
        # 원본에 없던 미래 만료 쿠키 → 추가
        {"name": "ak_bmsc", "value": "fresh", "domain": ".coupangeats.com",
         "path": "/", "expires": now + 7200},
    ]

    merged = {c["name"]: c for c in
              merge_rotated_cookies(original, rotated, now=now)}

    assert merged["_abck"]["value"] == "GOOD"
    assert merged["access-token"]["value"] == "orig-at"
    assert merged["unify-token"]["value"] == "new-tok"
    assert merged["ak_bmsc"]["value"] == "fresh"


def test_merge_rotated_cookies_empty_original_returns_rotated():
    from services.coupang_eats_service import merge_rotated_cookies

    rotated = [{"name": "unify-token", "value": "tok",
                "domain": ".coupangeats.com", "path": "/", "expires": -1}]
    assert merge_rotated_cookies([], rotated) == rotated
    assert merge_rotated_cookies(rotated, []) == rotated


def test_fetch_orders_by_day_chunks_and_aggregates(monkeypatch):
    """하루 단위 순회가 각 날짜를 개별 조회해 합산하는지 + degrade 재시도 검증."""
    import datetime as _dt
    from services.coupang_eats_service import CoupangEatsClient, OrderFetchResult

    client = CoupangEatsClient(COOKIES)
    try:
        # 날짜별 주문 수 (6/1=2건, 6/2=0건, 6/3=1건)
        per_day = {
            _dt.date(2026, 6, 1): [{"orderId": "a"}, {"orderId": "b"}],
            _dt.date(2026, 6, 2): [],
            _dt.date(2026, 6, 3): [{"orderId": "c"}],
        }

        def fake_fetch_orders(store_id, start, end, *, page_number=0, page_size=10):
            day = start.date()
            n = len(per_day.get(day, []))
            return OrderFetchResult(0, n, 0, [], {})   # page0: 총건수 보고용

        def fake_fetch_all(store_id, start, end, *, page_size=10, request_delay=0.0):
            return list(per_day.get(start.date(), []))

        monkeypatch.setattr(client, "fetch_orders", fake_fetch_orders)
        monkeypatch.setattr(client, "fetch_all_orders", fake_fetch_all)

        out = client.fetch_orders_by_day(
            823245, _dt.date(2026, 6, 1), _dt.date(2026, 6, 3),
            page_delay=0, day_delay=0)
        assert [o["orderId"] for o in out] == ["a", "b", "c"]
    finally:
        client.close()


def test_fetch_orders_by_day_retries_on_undercollection(monkeypatch):
    """중간 degrade(총건수 미달) 시 1회 재시도로 완전 수집."""
    import datetime as _dt
    from services.coupang_eats_service import CoupangEatsClient, OrderFetchResult

    client = CoupangEatsClient(COOKIES)
    try:
        calls = {"n": 0}

        def fake_fetch_orders(store_id, start, end, *, page_number=0, page_size=10):
            return OrderFetchResult(0, 3, 0, [], {})   # 총 3건이라 보고

        def fake_fetch_all(store_id, start, end, *, page_size=10, request_delay=0.0):
            calls["n"] += 1
            if calls["n"] == 1:
                return [{"orderId": "x"}]               # 1차: 3건 중 1건만 (degrade)
            return [{"orderId": "x"}, {"orderId": "y"}, {"orderId": "z"}]  # 재시도: 완전

        monkeypatch.setattr(client, "fetch_orders", fake_fetch_orders)
        monkeypatch.setattr(client, "fetch_all_orders", fake_fetch_all)

        out = client.fetch_orders_by_day(
            823245, _dt.date(2026, 6, 1), _dt.date(2026, 6, 1),
            page_delay=0, day_delay=0)
        assert len(out) == 3
        assert calls["n"] == 2                          # 재시도 발생
    finally:
        client.close()


def test_common_headers_include_fetch_metadata():
    """민감 endpoint(orders/settlements) Akamai 통과에 필수인 sec-fetch-* 헤더 검증.
    2026-07-04: 이 헤더 누락으로 order/condition 이 403 Access Denied 되던 회귀 방지."""
    from services.coupang_eats_service import CoupangEatsClient

    client = CoupangEatsClient(COOKIES)
    try:
        h = client._common_headers("https://store.coupangeats.com/x",
                                   content_type="application/json;charset=UTF-8")
    finally:
        client.close()
    assert h["sec-fetch-site"] == "same-origin"
    assert h["sec-fetch-mode"] == "cors"
    assert h["sec-fetch-dest"] == "empty"
    assert "sec-ch-ua" in h
    assert h["content-type"] == "application/json;charset=UTF-8"


def test_earliest_expiry_ignores_akamai_infra_cookies():
    """Akamai 회전 쿠키(2~4h TTL)가 세션 만료 추정을 오염시키면 안 됨."""
    from services.coupang_eats_service import earliest_cookie_expiry

    cookies = [
        {"name": "ak_bmsc", "expires": 1_751_000_000},      # 곧 만료 (제외 대상)
        {"name": "bm_sv", "expires": 1_751_000_000},
        {"name": "_abck", "expires": 1_751_000_000},
        {"name": "account-id", "expires": 1_753_600_000},   # 인증 쿠키 (+30일)
        {"name": "unify-token", "expires": -1},             # 세션 쿠키
    ]
    result = earliest_cookie_expiry(cookies)
    assert result == datetime.datetime.utcfromtimestamp(1_753_600_000)

    # 인증 쿠키에 만료가 없으면 None → cookie_expiry.py 의 보수적 추정 폴백
    assert earliest_cookie_expiry([
        {"name": "bm_sz", "expires": 1_751_000_000},
        {"name": "unify-token", "expires": -1},
    ]) is None


def test_registration_survives_server_side_cookie_invalidation(monkeypatch):
    """등록 시 whoami 가 _abck 즉시만료 + access-token 삭제를 회전시켜도
    저장본은 브라우저 원본을 유지해야 한다 (오늘 운영 장애 시나리오)."""
    import datetime as _dt
    from models import CoupangEatsCredential
    from services.crypto_util import decrypt_text
    from services.coupang_eats_service import deserialize_cookies

    engine = _setup_engine(monkeypatch)
    now = _dt.datetime.now(_dt.timezone.utc).timestamp()
    pasted = [
        {"name": "_abck", "value": "BROWSER-VALID",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
        {"name": "access-token", "value": "browser-at",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
        {"name": "unify-token", "value": "browser-tok",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
    ]
    rotated = [
        {"name": "_abck", "value": "DEAD", "domain": ".coupangeats.com",
         "path": "/", "expires": now},            # 즉시만료 회전
        {"name": "access-token", "value": "",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
        {"name": "unify-token", "value": "browser-tok",
         "domain": ".coupangeats.com", "path": "/", "expires": -1},
    ]
    fake = _make_fake_client(stores=[], rotated=rotated)

    _call(monkeypatch, fake, cookies=pasted)

    with Session(engine) as s:
        cred = s.exec(select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == 1)).one()
        stored = {c["name"]: c for c in
                  deserialize_cookies(decrypt_text(cred.cookies_encrypted))}
        assert stored["_abck"]["value"] == "BROWSER-VALID"
        assert stored["access-token"]["value"] == "browser-at"
