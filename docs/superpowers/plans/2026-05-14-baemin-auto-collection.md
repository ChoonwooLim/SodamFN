# 배민(배달의민족) 매출/정산 자동수집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ceo.baemin.com 사장님 포털에서 매일 자동으로 주문/정산 데이터를 수집해 손익 페이지의 배민 매출·수수료 정확도를 100%로 끌어올린다.

**Architecture:** 쿠팡이츠 자동수집(`SodamApp/backend/routers/coupang_eats.py`, `services/coupang_eats_service.py`)과 동일한 4계층 (Credential / Service / Router / Models). 수동 쿠키 인증만 사용 (Playwright 생략 — Q2). 채널별 분리 테이블. Cron 04:30 KST.

**Tech Stack:** FastAPI + SQLModel(PostgreSQL) + curl_cffi(Chrome TLS) + Fernet 암호화 + React/Vite frontend + Orbitron cron.

**Spec:** `docs/superpowers/specs/2026-05-14-baemin-auto-collection-design.md`

---

## File Structure

**Create** (backend):
- `SodamApp/backend/services/baemin_service.py` — BaeminClient + utilities
- `SodamApp/backend/services/auto_collection_sync/normalizers/baemin.py` — SyncEvent generator (DeliveryRevenue 매칭)
- `SodamApp/backend/routers/baemin.py` — 10 endpoints
- `SodamApp/backend/tests/baemin/__init__.py`
- `SodamApp/backend/tests/baemin/test_models.py`
- `SodamApp/backend/tests/baemin/test_service.py`
- `SodamApp/backend/tests/baemin/test_router.py`
- `SodamApp/backend/tests/baemin/fixtures/__init__.py`
- `SodamApp/backend/tests/baemin/fixtures/orders_sample.json` — HAR 캡처 후 채움
- `SodamApp/backend/tests/baemin/fixtures/settlements_sample.json` — HAR 캡처 후 채움

**Create** (frontend):
- `SodamApp/frontend/src/pages/BaeminModuleDetail.jsx` — 카드 페이지

**Modify**:
- `SodamApp/backend/models.py` — 4개 클래스 추가 끝부분
- `SodamApp/backend/main.py:176-177` 근처 — router 등록
- `SodamApp/backend/routers/auto_collection.py` — `/cron/baemin` endpoint 추가
- `SodamApp/frontend/src/pages/ExternalIntegration.jsx` — 배민 카드 statistics fetch
- `SodamApp/frontend/src/App.jsx` — `/external-integration/baemin` 라우트 추가
- `SodamApp/frontend/src/components/codef/ModuleGrid.jsx` — 배민 카드 prop 추가
- `Orbitron.yaml:209-233` 근처 — `auto-collection-baemin` cron 추가

**Migration**: `SQLModel.metadata.create_all(engine)` 패턴 — 새 테이블 4개 자동 생성. 기존 컬럼 변경 없음.

---

## Critical Dependency: HAR 캡처

**Task 4 시작 전에 사장님 HAR 캡처 필요.** Task 1~3 은 HAR 없이도 진행 가능 (모델/스켈레톤). Task 4 부터 실제 API URL/응답 스키마 필요.

사장님 작업:
1. ceo.baemin.com 로그인
2. 매출/정산 페이지 클릭 (주문관리, 정산관리 페이지 둘 다 한 번씩)
3. F12 → Network 탭 → "Preserve log" 켜기 → 페이지 새로고침 + 클릭 몇 번
4. Network 탭 우클릭 → "Save all as HAR with content" → 파일 전달

받은 HAR 에서 추출할 정보:
- `BASE_URL` — ceo.baemin.com
- 매출 조회 endpoint (POST/GET URL + body/query 파라미터)
- 정산 조회 endpoint
- 응답 JSON 구조 (총매출 / 주문 list / 페이지네이션 / 정산 행)
- 필수 헤더 (referer, user-agent, x-* 커스텀 헤더)
- 인증 쿠키 이름

---

## Task 1: 데이터 모델 4개 + 마이그레이션

**Files:**
- Modify: `SodamApp/backend/models.py` (end of file)
- Create: `SodamApp/backend/tests/baemin/__init__.py` (빈 파일)
- Create: `SodamApp/backend/tests/baemin/test_models.py`

- [ ] **Step 1: Test 작성**

```python
# SodamApp/backend/tests/baemin/test_models.py
"""BaeminCredential / Order / Settlement / SyncLog 모델 검증."""
import datetime
import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from models import (
    BaeminCredential, BaeminOrder, BaeminSettlement, BaeminSyncLog, Business,
)


@pytest.fixture
def s():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as sess:
        biz = Business(id=1, name="test", subscription_status="active")
        sess.add(biz)
        sess.commit()
        yield sess


def test_credential_unique_per_business(s):
    s.add(BaeminCredential(business_id=1, login_id="boss@example.com"))
    s.commit()
    # 같은 business_id 로 2번째 insert 시 UNIQUE 위반
    s.add(BaeminCredential(business_id=1, login_id="other"))
    with pytest.raises(Exception):
        s.commit()


def test_order_unique_per_business_order_id(s):
    s.add(BaeminOrder(business_id=1, store_id="A1", order_id="O1",
                     ordered_at=datetime.datetime(2026, 5, 1, 12, 0)))
    s.commit()
    # 같은 business_id + order_id 중복 차단
    s.add(BaeminOrder(business_id=1, store_id="A1", order_id="O1"))
    with pytest.raises(Exception):
        s.commit()


def test_settlement_unique_key(s):
    s.add(BaeminSettlement(
        business_id=1, store_id="A1",
        settlement_date=datetime.date(2026, 5, 1),
        settlement_type="SETTLEMENT",
        seller_transfer_id="T1", amount=100000))
    s.commit()
    s.add(BaeminSettlement(
        business_id=1, store_id="A1",
        settlement_date=datetime.date(2026, 5, 1),
        settlement_type="SETTLEMENT",
        seller_transfer_id="T1", amount=100000))
    with pytest.raises(Exception):
        s.commit()


def test_synclog_defaults(s):
    log = BaeminSyncLog(business_id=1)
    s.add(log)
    s.commit()
    s.refresh(log)
    assert log.status == "running"
    assert log.orders_fetched == 0
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/test_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'BaeminCredential' from 'models'`

- [ ] **Step 3: 모델 4개 추가**

`SodamApp/backend/models.py` 끝에 다음 4개 클래스 추가 (마지막 클래스 정의 후, alembic/마이그레이션 metadata 보다 앞):

```python
# ─────────────────────────────────────────────────────────────
# 배민(배달의민족) 자동수집 — ceo.baemin.com 스크래핑
# spec: docs/superpowers/specs/2026-05-14-baemin-auto-collection-design.md
# ─────────────────────────────────────────────────────────────

class BaeminCredential(SQLModel, table=True):
    """배민 사장님사이트 자격증명 + 쿠키 (business 당 1건, 수동 쿠키 only)."""
    __table_args__ = (Index("ix_baemin_cred_business", "business_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)

    login_id: Optional[str] = Field(default=None, description="표시용 — 인증엔 미사용")
    store_id: Optional[str] = Field(default=None, index=True,
                                    description="배민 가맹점 ID")
    shop_name: Optional[str] = None

    cookies_encrypted: Optional[str] = Field(default=None,
                                             description="Fernet(json.dumps(cookies))")
    cookies_obtained_at: Optional[datetime.datetime] = None
    cookies_expires_at: Optional[datetime.datetime] = None
    last_verified_at: Optional[datetime.datetime] = None

    status: str = Field(default="active")
    last_failed_at: Optional[datetime.datetime] = None
    last_error_message: Optional[str] = None
    consecutive_failures: int = 0

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminOrder(SQLModel, table=True):
    """배민 주문 단위 raw."""
    __table_args__ = (
        UniqueConstraint("business_id", "order_id", name="uq_baemin_order"),
        Index("ix_baemin_order_biz_date", "business_id", "ordered_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)
    order_id: str = Field(max_length=64)

    ordered_at: Optional[datetime.datetime] = Field(default=None, index=True)
    delivered_at: Optional[datetime.datetime] = None

    total_sale_price: int = 0
    discount_amount: int = 0
    cancelled: bool = Field(default=False)

    payment_method: Optional[str] = Field(default=None, max_length=32)
    order_status: Optional[str] = Field(default=None, max_length=32)
    delivery_type: Optional[str] = Field(default=None, max_length=32)

    raw_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminSettlement(SQLModel, table=True):
    """배민 일별 정산 + 수수료 분해."""
    __table_args__ = (
        UniqueConstraint(
            "business_id", "settlement_date", "settlement_type", "seller_transfer_id",
            name="uq_baemin_settlement",
        ),
        Index("ix_baemin_settle_biz_date", "business_id", "settlement_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)

    settlement_date: datetime.date = Field(index=True)
    settlement_type: str = Field(max_length=16)
    amount: int = 0
    balance: int = 0
    seller_transfer_id: Optional[str] = Field(default=None, max_length=64, index=True)

    # 수수료 분해 (HAR 후 추가 컬럼 가능 — raw_json 으로 우선 보관)
    total_sales: int = 0
    fee_brokerage: int = 0
    fee_payment: int = 0
    fee_delivery: int = 0
    fee_advertising: int = 0
    fee_coupon_owner: int = 0

    raw_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminSyncLog(SQLModel, table=True):
    """배민 동기화 이력."""
    __table_args__ = (Index("ix_baemin_synclog_biz_date", "business_id", "started_at"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    sync_mode: str = Field(default="full")

    target_start: Optional[datetime.date] = None
    target_end: Optional[datetime.date] = None
    started_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    finished_at: Optional[datetime.datetime] = None
    status: str = Field(default="running")

    orders_fetched: int = 0
    orders_inserted: int = 0
    orders_updated: int = 0
    settlements_fetched: int = 0
    settlements_inserted: int = 0
    settlements_updated: int = 0
    total_sales: int = 0

    error_message: Optional[str] = None
    triggered_by: str = Field(default="cron")
    auth_refreshed: bool = Field(default=False)
```

- [ ] **Step 4: 테스트 다시 실행 — PASS 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/test_models.py -v`
Expected: 4 passed

- [ ] **Step 5: prod 테이블 생성**

```bash
cd SodamApp/backend && python scripts/create_missing_tables.py
```

Expected: "Done" (4 new tables: baemincredential, baeminorder, baeminsettlement, baeminsynclog)

- [ ] **Step 6: 커밋**

```bash
cd c:/WORK/SodamFN
git add SodamApp/backend/models.py SodamApp/backend/tests/baemin/
git commit -m "feat(baemin): 배민 자동수집용 모델 4개 (Credential/Order/Settlement/SyncLog)"
```

---

## Task 2: BaeminClient 스켈레톤 + 쿠키 유틸리티

HAR 받기 전 단계 — `whoami` 만 placeholder URL 로 두고 (`/api/whoami`), 실제 매출/정산 메소드는 Task 5 에서 채움. 쿠키 직렬화 / 헤더 빌더 / 에러 클래스 / Session 초기화 까지 작성.

**Files:**
- Create: `SodamApp/backend/services/baemin_service.py`
- Create: `SodamApp/backend/tests/baemin/test_service.py`

- [ ] **Step 1: 서비스 단위 테스트 작성**

```python
# SodamApp/backend/tests/baemin/test_service.py
"""BaeminClient 기본 동작 — HAR 없이 검증 가능한 부분."""
import json
import pytest
from services.baemin_service import (
    BaeminClient, BaeminError, CookieInvalidError,
    serialize_cookies, deserialize_cookies, earliest_cookie_expiry,
)


def test_serialize_roundtrip():
    cookies = [{"name": "AUTH", "value": "abc", "domain": "ceo.baemin.com"}]
    blob = serialize_cookies(cookies)
    assert deserialize_cookies(blob) == cookies


def test_deserialize_invalid_returns_empty():
    assert deserialize_cookies("") == []
    assert deserialize_cookies("not-json") == []


def test_earliest_expiry_skips_session_cookies():
    import datetime
    cookies = [
        {"name": "A", "value": "1", "expires": -1},
        {"name": "B", "value": "2", "expires": 1750000000.0},
        {"name": "C", "value": "3", "expires": 1700000000.0},
    ]
    earliest = earliest_cookie_expiry(cookies)
    assert earliest == datetime.datetime.utcfromtimestamp(1700000000.0)


def test_client_can_be_constructed_with_no_cookies():
    c = BaeminClient(cookies=[])
    assert c is not None
    c.close()


def test_client_loads_cookies_without_error():
    cookies = [{"name": "AUTH", "value": "abc"}]
    c = BaeminClient(cookies=cookies)
    out = c.get_cookies()
    # curl_cffi 가 jar 에 cookie 를 넣고 다시 빼낼 수 있는지만 검증
    assert any(x["name"] == "AUTH" for x in out)
    c.close()
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/test_service.py -v`
Expected: FAIL with `ModuleNotFoundError: services.baemin_service`

- [ ] **Step 3: 서비스 스켈레톤 작성**

```python
# SodamApp/backend/services/baemin_service.py
"""배민 사장님사이트 (ceo.baemin.com) 자동수집 어댑터.

쿠팡이츠와 동일 패턴 — curl_cffi (Chrome TLS) + 수동 쿠키 only.
HAR 캡처 후 fetch_orders / fetch_settlements 의 실제 URL·파라미터·응답 파싱을 채운다.
"""
from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

try:
    from curl_cffi import requests as curl_requests  # type: ignore
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    _CURL_CFFI_AVAILABLE = False
    curl_requests = None  # type: ignore


BASE_URL = "https://ceo.baemin.com"
DEFAULT_TIMEOUT = 30.0
DEFAULT_IMPERSONATE = "chrome120"

log = logging.getLogger("baemin")


class BaeminError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class CookieInvalidError(BaeminError):
    """쿠키 만료/무효 — 사장님 쿠키 갱신 필요."""


@dataclass
class OrderFetchResult:
    total_sale_price: int
    total_order_count: int
    orders: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


@dataclass
class SettlementFetchResult:
    total_elements: int
    total_pages: int
    contents: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


def serialize_cookies(cookies: list[dict]) -> str:
    return json.dumps(cookies, ensure_ascii=False)


def deserialize_cookies(blob: str) -> list[dict]:
    if not blob:
        return []
    try:
        data = json.loads(blob)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def earliest_cookie_expiry(cookies: list[dict]) -> Optional[datetime.datetime]:
    candidates: list[float] = []
    for c in cookies:
        exp = c.get("expires")
        if exp is None or exp == -1:
            continue
        try:
            candidates.append(float(exp))
        except (TypeError, ValueError):
            continue
    if not candidates:
        return None
    try:
        return datetime.datetime.utcfromtimestamp(min(candidates))
    except (OSError, OverflowError, ValueError):
        return None


class BaeminClient:
    """ceo.baemin.com 세션 클라이언트. 인스턴스당 1매장 + 1세션."""

    def __init__(self,
                 cookies: Optional[list[dict]] = None,
                 *,
                 impersonate: str = DEFAULT_IMPERSONATE,
                 timeout: float = DEFAULT_TIMEOUT,
                 user_agent: Optional[str] = None,
                 accept_language: str = "ko-KR"):
        if not _CURL_CFFI_AVAILABLE:
            raise BaeminError("curl_cffi 미설치. pip install curl_cffi")
        self._timeout = timeout
        self._impersonate = impersonate
        self._user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/148.0.0.0 Safari/537.36"
        )
        self._accept_language = accept_language

        self._session = curl_requests.Session(impersonate=impersonate)
        if cookies:
            self._load_cookies(cookies)

    def _load_cookies(self, cookies: list[dict]):
        for c in cookies:
            name = c.get("name")
            value = c.get("value")
            if not name or value is None:
                continue
            domain = c.get("domain") or "ceo.baemin.com"
            path = c.get("path") or "/"
            try:
                self._session.cookies.set(name, value, domain=domain, path=path)
            except Exception as e:  # noqa: BLE001
                log.warning("cookie set failed [%s]: %s", name, e)

    def get_cookies(self) -> list[dict]:
        out = []
        try:
            for c in self._session.cookies.jar:
                out.append({
                    "name": c.name,
                    "value": c.value,
                    "domain": c.domain,
                    "path": c.path,
                    "expires": c.expires if c.expires else -1,
                    "secure": bool(c.secure),
                })
        except Exception as e:  # noqa: BLE001
            log.warning("get_cookies failed: %s", e)
        return out

    def close(self):
        try:
            self._session.close()
        except Exception:
            pass

    def __enter__(self): return self
    def __exit__(self, *exc): self.close()

    def _common_headers(self, referer: str,
                        content_type: Optional[str] = None) -> dict:
        h = {
            "accept": "application/json",
            "accept-language": self._accept_language,
            "origin": BASE_URL,
            "referer": referer,
            "user-agent": self._user_agent,
            "x-requested-with": "XMLHttpRequest",
        }
        if content_type:
            h["content-type"] = content_type
        return h

    def _check_response(self, r) -> None:
        body_preview = ""
        try:
            body_preview = (r.text or "")[:240].replace("\n", " ")
        except Exception:
            pass
        if r.status_code in (401, 403):
            raise CookieInvalidError(
                f"세션 쿠키 거부 (HTTP {r.status_code}). 응답: {body_preview}",
                status_code=r.status_code,
            )
        if r.status_code >= 400:
            raise BaeminError(
                f"배민 API 오류 HTTP {r.status_code}: {body_preview}",
                status_code=r.status_code,
            )
        ctype = r.headers.get("content-type", "")
        if "application/json" not in ctype.lower():
            raise CookieInvalidError(
                f"배민이 JSON 대신 {ctype} 반환 (HTTP {r.status_code}) — "
                f"차단 페이지 가능성. 응답: {body_preview}",
                status_code=r.status_code,
            )

    # ───── 인증 검증 (HAR 후 URL 확정) ─────
    def whoami(self) -> dict:
        """세션 검증. HAR 후 실제 endpoint 로 교체."""
        url = f"{BASE_URL}/api/whoami"  # TODO(HAR): 실제 URL 로 교체
        referer = f"{BASE_URL}/"
        r = self._session.get(url, headers=self._common_headers(referer),
                              timeout=self._timeout)
        self._check_response(r)
        return r.json()

    # ───── 매출 / 정산 (Task 5 에서 HAR 기반 구현) ─────
    def fetch_orders(self, store_id: str,
                     start: datetime.datetime,
                     end: datetime.datetime,
                     *, page_number: int = 0,
                     page_size: int = 50) -> OrderFetchResult:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_all_orders(self, store_id: str,
                         start: datetime.datetime,
                         end: datetime.datetime) -> list[dict]:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_settlements(self, store_id: str,
                          start_date: datetime.date,
                          end_date: datetime.date,
                          *, page_num: int = 0,
                          page_size: int = 100) -> SettlementFetchResult:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_all_settlements(self, store_id: str,
                              start_date: datetime.date,
                              end_date: datetime.date) -> list[dict]:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/test_service.py -v`
Expected: 5 passed

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/services/baemin_service.py SodamApp/backend/tests/baemin/test_service.py
git commit -m "feat(baemin): BaeminClient 스켈레톤 + 쿠키 유틸리티 (curl_cffi 기반)"
```

---

## Task 3: 라우터 — 자격증명 CRUD + manual-cookies + sync 골격

HAR 없이도 구현 가능한 부분. Sync 메소드는 BaeminClient 가 NotImplementedError 던지므로 통합 테스트는 mock 으로.

**Files:**
- Create: `SodamApp/backend/routers/baemin.py`
- Create: `SodamApp/backend/tests/baemin/test_router.py`
- Modify: `SodamApp/backend/main.py`

- [ ] **Step 1: 라우터 테스트 작성**

```python
# SodamApp/backend/tests/baemin/test_router.py
"""배민 라우터 통합 — credential CRUD + manual-cookies."""
import json
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from models import Business, User, BaeminCredential
from main import app
from database import get_session


@pytest.fixture
def client(monkeypatch):
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        biz = Business(id=1, name="test", subscription_status="active")
        admin = User(id=1, email="admin@x.com", role="admin",
                     business_id=1, password_hash="x")
        s.add(biz); s.add(admin); s.commit()
    def _override(): 
        with Session(eng) as s: yield s
    app.dependency_overrides[get_session] = _override

    # admin auth bypass
    from routers.auth import get_admin_user
    def _admin():
        with Session(eng) as s:
            return s.exec(select(User).where(User.id == 1)).first()
    app.dependency_overrides[get_admin_user] = _admin
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_credential_register_then_get(client):
    r = client.post("/api/baemin/credential", json={
        "login_id": "boss@example.com",
        "store_id": "STORE_A",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["login_id"] == "boss@example.com"
    assert body["store_id"] == "STORE_A"
    assert body["cookies_present"] is False

    r2 = client.get("/api/baemin/credential")
    assert r2.status_code == 200
    assert r2.json()["registered"] is True


def test_manual_cookies_upload(client):
    # 자격증명 없이도 쿠키 업로드만으로 동작
    cookies = [{"name": "AUTH", "value": "abc", "domain": "ceo.baemin.com"}]
    r = client.post("/api/baemin/manual-cookies", json={
        "cookies": cookies,
        "store_id": "STORE_A",
        "shop_name": "소담김밥",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["cookies_present"] is True
    assert body["status"] == "active"
    assert body["shop_name"] == "소담김밥"


def test_manual_cookies_empty_list_rejected(client):
    r = client.post("/api/baemin/manual-cookies", json={"cookies": []})
    assert r.status_code == 400


def test_credential_delete(client):
    client.post("/api/baemin/credential",
                json={"login_id": "x", "store_id": "STORE_A"})
    r = client.delete("/api/baemin/credential")
    assert r.status_code == 200
    r2 = client.get("/api/baemin/credential")
    assert r2.json()["registered"] is False


def test_sync_logs_empty(client):
    r = client.get("/api/baemin/sync/logs")
    assert r.status_code == 200
    assert r.json() == []
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/test_router.py -v`
Expected: FAIL (라우터 없음)

- [ ] **Step 3: 라우터 작성**

```python
# SodamApp/backend/routers/baemin.py
"""배민(ceo.baemin.com) 사장님사이트 매출/정산 자동수집 라우터.

수동 쿠키 only — 자동 로그인 없음 (spec Q2). 쿠키 만료 시 사장님이 갱신.

엔드포인트:
  POST   /api/baemin/credential        — 자격증명 (로그인 ID + 매장 ID) 등록/갱신
  GET    /api/baemin/credential        — 등록 상태 + 쿠키 만료 조회
  DELETE /api/baemin/credential        — 자격증명 + 쿠키 삭제
  POST   /api/baemin/manual-cookies    — 사장님 쿠키 붙여넣기 (메인 인증 흐름)
  POST   /api/baemin/sync/manual       — 기간 지정 동기화 (최대 91일)
  POST   /api/baemin/sync/cron-trigger — Orbitron cron 호출 (X-Cron-Secret)
  GET    /api/baemin/sync/logs         — 동기화 이력 (최대 200건)
  GET    /api/baemin/dashboard         — 잔액 / 예상정산 / 주간 합계
  GET    /api/baemin/debug/probe       — superadmin 쿠키 진단
  GET    /api/baemin/debug/raw-orders  — superadmin 응답 raw
"""
from __future__ import annotations

import datetime
import logging
import os
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine
from models import (
    BaeminCredential, BaeminOrder, BaeminSettlement, BaeminSyncLog, User,
)
from routers.auth import get_admin_user
from services.crypto_util import encrypt_text, decrypt_text
from services.baemin_service import (
    BaeminClient, BaeminError, CookieInvalidError,
    serialize_cookies, deserialize_cookies, earliest_cookie_expiry,
)
from utils.datetime_utils import utc_iso

log = logging.getLogger("baemin.router")
router = APIRouter(prefix="/api/baemin", tags=["baemin"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


def _cred_dto(row: BaeminCredential) -> dict:
    return {
        "id": row.id,
        "login_id": row.login_id,
        "store_id": row.store_id,
        "shop_name": row.shop_name,
        "status": row.status,
        "cookies_present": bool(row.cookies_encrypted),
        "cookies_obtained_at": utc_iso(row.cookies_obtained_at),
        "cookies_expires_at": utc_iso(row.cookies_expires_at),
        "last_verified_at": utc_iso(row.last_verified_at),
        "last_failed_at": utc_iso(row.last_failed_at),
        "last_error_message": row.last_error_message,
        "consecutive_failures": row.consecutive_failures,
        "updated_at": utc_iso(row.updated_at),
    }


def _log_dto(row: BaeminSyncLog) -> dict:
    return {
        "id": row.id,
        "sync_mode": row.sync_mode,
        "target_start": utc_iso(row.target_start),
        "target_end": utc_iso(row.target_end),
        "started_at": utc_iso(row.started_at),
        "finished_at": utc_iso(row.finished_at),
        "status": row.status,
        "orders_fetched": row.orders_fetched,
        "orders_inserted": row.orders_inserted,
        "orders_updated": row.orders_updated,
        "settlements_fetched": row.settlements_fetched,
        "settlements_inserted": row.settlements_inserted,
        "settlements_updated": row.settlements_updated,
        "total_sales": row.total_sales,
        "error_message": row.error_message,
        "triggered_by": row.triggered_by,
        "auth_refreshed": row.auth_refreshed,
    }


def _save_cookies(session: Session, cred: BaeminCredential,
                  cookies: list[dict], *,
                  store_id: Optional[str] = None,
                  shop_name: Optional[str] = None) -> None:
    cred.cookies_encrypted = encrypt_text(serialize_cookies(cookies))
    cred.cookies_obtained_at = datetime.datetime.utcnow()
    cred.cookies_expires_at = earliest_cookie_expiry(cookies)
    if store_id: cred.store_id = store_id
    if shop_name: cred.shop_name = shop_name
    cred.status = "active"
    cred.last_verified_at = datetime.datetime.utcnow()
    cred.last_failed_at = None
    cred.last_error_message = None
    cred.consecutive_failures = 0
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _record_failure(session: Session, cred: BaeminCredential,
                    message: str, status: str = "failed") -> None:
    cred.last_failed_at = datetime.datetime.utcnow()
    cred.last_error_message = message[:500] if message else None
    cred.consecutive_failures = (cred.consecutive_failures or 0) + 1
    cred.status = status
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _make_client(business_id: int) -> tuple[BaeminClient, BaeminCredential]:
    """저장된 쿠키 → BaeminClient 인스턴스 생성. 호출자가 close 책임."""
    with Session(engine) as s:
        cred = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == business_id
            )
        ).first()
        if not cred:
            raise HTTPException(404, "배민 자격증명이 등록되지 않았습니다.")
        if not cred.cookies_encrypted:
            raise HTTPException(
                422,
                "쿠키가 없습니다. F12 → Application → Cookies 복사해서 입력해주세요.",
            )
        try:
            cookies = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
        except Exception as e:  # noqa: BLE001
            raise HTTPException(500, f"쿠키 복호화 실패: {e}") from e
    return BaeminClient(cookies), cred


# ─── DTOs ───
class CredentialIn(BaseModel):
    login_id: str = Field(..., min_length=3, max_length=128)
    store_id: Optional[str] = None


class ManualCookiesIn(BaseModel):
    cookies: list[dict]
    store_id: Optional[str] = None
    shop_name: Optional[str] = None


class ManualSyncIn(BaseModel):
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    sync_orders: bool = True
    sync_settlements: bool = True


# ─── 1) 자격증명 ───
@router.post("/credential")
def upsert_credential(
    body: CredentialIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    now = datetime.datetime.utcnow()
    with Session(engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if row:
            row.login_id = body.login_id.strip()
            if body.store_id: row.store_id = body.store_id
            row.status = "active"
            row.last_failed_at = None
            row.last_error_message = None
            row.consecutive_failures = 0
            row.updated_at = now
            s.add(row)
        else:
            row = BaeminCredential(
                business_id=bid,
                login_id=body.login_id.strip(),
                store_id=body.store_id,
                status="active",
            )
            s.add(row)
        s.commit()
        s.refresh(row)
        return _cred_dto(row)


@router.get("/credential")
def get_credential(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not row:
            return {"registered": False}
        return {"registered": True, **_cred_dto(row)}


@router.delete("/credential")
def delete_credential(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not row:
            raise HTTPException(404, "등록된 자격증명이 없습니다.")
        s.delete(row)
        s.commit()
        return {"ok": True}


# ─── 2) 수동 쿠키 ───
@router.post("/manual-cookies")
def submit_manual_cookies(
    body: ManualCookiesIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    if not body.cookies:
        raise HTTPException(400, "쿠키 list 가 비어있습니다.")
    with Session(engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not row:
            row = BaeminCredential(business_id=bid, status="active")
            s.add(row)
            s.commit()
            s.refresh(row)
        _save_cookies(s, row, body.cookies,
                      store_id=body.store_id or row.store_id,
                      shop_name=body.shop_name or row.shop_name)
        s.refresh(row)
        return {"ok": True, **_cred_dto(row)}


# ─── 3) 수동 동기화 ───
@router.post("/sync/manual")
def sync_manual(
    body: ManualSyncIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    start = body.start_date or yesterday
    end = body.end_date or start
    if end < start:
        raise HTTPException(400, "end_date 가 start_date 보다 빠릅니다.")
    if (end - start).days > 90:
        raise HTTPException(400, "한 번에 최대 91일까지만 동기화할 수 있습니다.")
    summary = _run_sync(bid, start, end,
                        sync_orders=body.sync_orders,
                        sync_settlements=body.sync_settlements,
                        triggered_by="manual")
    return {"ok": True, **summary}


# ─── 4) Cron 트리거 ───
@router.post("/sync/cron-trigger")
def sync_cron_trigger(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(401, "invalid cron secret")
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    with Session(engine) as s:
        bids = [r for r in s.exec(
            select(BaeminCredential.business_id).where(
                BaeminCredential.status.in_(["active"])
            )
        )]
    results = []
    for bid in bids:
        try:
            r = _run_sync(bid, yesterday, yesterday,
                          sync_orders=True, sync_settlements=True,
                          triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:  # noqa: BLE001
            log.error("cron sync failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})
    return {"ok": True, "target_date": yesterday.isoformat(),
            "business_count": len(bids), "results": results}


# ─── 5) 이력 ───
@router.get("/sync/logs")
def list_sync_logs(
    limit: int = 30,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        rows = s.exec(
            select(BaeminSyncLog)
            .where(BaeminSyncLog.business_id == bid)
            .order_by(BaeminSyncLog.started_at.desc())
            .limit(min(max(limit, 1), 200))
        ).all()
        return [_log_dto(r) for r in rows]


# ─── 6) 핵심 sync 로직 (Task 6 에서 fetch 호출 채움) ───
def _run_sync(business_id: int,
              start_date: datetime.date,
              end_date: datetime.date,
              *, sync_orders: bool = True,
              sync_settlements: bool = True,
              triggered_by: str = "manual") -> dict:
    """기간 내 주문 + 정산 수집 → DB upsert + Revenue 일자집계.

    HAR 캡처 전엔 BaeminClient.fetch_* 가 NotImplementedError 던지므로
    이 함수는 Task 6 에서 실제 구현됨. 지금은 SyncLog 만 기록 + NotImplementedError 전파.
    """
    summary = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "orders": {"fetched": 0, "inserted": 0, "updated": 0},
        "settlements": {"fetched": 0, "inserted": 0, "updated": 0},
        "total_sales": 0,
        "errors": [],
    }
    log_id: Optional[int] = None
    with Session(engine) as s:
        sl = BaeminSyncLog(business_id=business_id,
                           sync_mode="full",
                           target_start=start_date,
                           target_end=end_date,
                           triggered_by=triggered_by,
                           status="running")
        s.add(sl); s.commit(); s.refresh(sl)
        log_id = sl.id
    try:
        # 실제 fetch 는 Task 6 에서 — 지금은 NotImplementedError 전파
        raise NotImplementedError("HAR 캡처 후 Task 6 에서 fetch_orders/settlements 채움")
    except Exception as e:
        with Session(engine) as s:
            sl = s.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s.add(sl); s.commit()
        summary["errors"].append({"error": str(e)})
        raise
    return summary
```

- [ ] **Step 4: main.py 에 라우터 등록**

`SodamApp/backend/main.py` line 176-177 근처 (coupang_eats import 다음 줄):

```python
from routers import coupang_eats
app.include_router(coupang_eats.router)
from routers import baemin
app.include_router(baemin.router)
```

- [ ] **Step 5: 테스트 실행 — PASS 확인**

Run: `cd SodamApp/backend && pytest tests/baemin/ -v`
Expected: 5 router tests + 5 service tests + 4 model tests = 14 passed

- [ ] **Step 6: 커밋**

```bash
git add SodamApp/backend/routers/baemin.py SodamApp/backend/tests/baemin/test_router.py SodamApp/backend/main.py
git commit -m "feat(baemin): 자격증명 CRUD + 수동쿠키 + sync 골격 (fetch 메소드는 HAR 후 구현)"
```

---

## Task 4: 🛑 HAR 캡처 받기 (블로커)

**책임**: 사장님 (Owner) — Claude 가 못 함.

- [ ] **Step 1: 사장님께 HAR 캡처 요청**

화면 안내 또는 메시지:

```
배민 자동수집을 위한 HAR 캡처 요청:

1. https://ceo.baemin.com 에 로그인
2. 키보드 F12 → Network 탭 열기 → "Preserve log" 체크
3. 다음 페이지를 순서대로 클릭:
   ㄱ. 매출 관리 (주문 list 가 보이는 페이지)
   ㄴ. 정산 관리 (입금 내역이 보이는 페이지)
4. Network 탭에 row 가 충분히 쌓인 뒤 (50~100건) 우클릭 → "Save all as HAR with content"
5. HAR 파일을 c:/WORK/SodamFN/2026소득분석/배달앱매출/baemin_har_2026-05.har 로 저장
```

- [ ] **Step 2: HAR 분석 → 메모 작성**

받은 HAR 을 열어 다음 항목 추출 후 `docs/superpowers/specs/2026-05-14-baemin-har-notes.md` 에 기록:

- 매출 조회: HTTP 메소드 / URL / Query·Body 파라미터 / 응답 JSON 구조 (총매출 위치, 주문 list 위치, 페이지네이션 필드)
- 정산 조회: 동일
- 잔액 조회 (있으면): 동일
- 필수 헤더 / 인증 쿠키 이름

- [ ] **Step 3: 검증 — HAR 노트 commit**

```bash
git add docs/superpowers/specs/2026-05-14-baemin-har-notes.md
git commit -m "docs(baemin): HAR 캡처 분석 메모 — API endpoint 와 응답 구조"
```

---

## Task 5: BaeminClient 실제 API 메소드 구현 (HAR 후)

HAR 노트 기반으로 `fetch_orders` / `fetch_all_orders` / `fetch_settlements` / `fetch_all_settlements` / `whoami` / `fetch_balance` (있으면) 구현.

**Files:**
- Modify: `SodamApp/backend/services/baemin_service.py` (NotImplementedError 메소드)
- Create: `SodamApp/backend/tests/baemin/fixtures/orders_sample.json` — HAR 응답 1건 copy
- Create: `SodamApp/backend/tests/baemin/fixtures/settlements_sample.json`
- Modify: `SodamApp/backend/tests/baemin/test_service.py` (fixture 기반 파싱 테스트 추가)

- [ ] **Step 1: HAR 응답 fixture 추출**

HAR 의 매출 응답 JSON 1건 → `orders_sample.json` 으로 저장.
HAR 의 정산 응답 JSON 1건 → `settlements_sample.json` 으로 저장.

- [ ] **Step 2: fixture 기반 파싱 테스트 작성**

```python
# tests/baemin/test_service.py 끝에 추가
import json
import datetime
from pathlib import Path
from unittest.mock import patch, MagicMock
from services.baemin_service import BaeminClient, OrderFetchResult

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_fetch_orders_parses_har_sample():
    """HAR 응답 raw 를 OrderFetchResult 로 정상 파싱."""
    sample = json.loads((FIXTURE_DIR / "orders_sample.json").read_text(encoding="utf-8"))
    c = BaeminClient(cookies=[])
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.json.return_value = sample
    mock_resp.text = json.dumps(sample)
    with patch.object(c._session, "get", return_value=mock_resp):
        result = c.fetch_orders(
            store_id="STORE_A",
            start=datetime.datetime(2026, 5, 1),
            end=datetime.datetime(2026, 5, 1, 23, 59),
        )
    assert isinstance(result, OrderFetchResult)
    # 핵심: 응답에서 매출 합/주문 개수가 추출됐는지
    assert result.total_sale_price >= 0
    assert result.total_order_count >= 0
    assert isinstance(result.orders, list)
    c.close()


def test_fetch_settlements_parses_har_sample():
    sample = json.loads((FIXTURE_DIR / "settlements_sample.json").read_text(encoding="utf-8"))
    c = BaeminClient(cookies=[])
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.json.return_value = sample
    mock_resp.text = json.dumps(sample)
    with patch.object(c._session, "get", return_value=mock_resp):
        result = c.fetch_settlements(
            store_id="STORE_A",
            start_date=datetime.date(2026, 5, 1),
            end_date=datetime.date(2026, 5, 31),
        )
    assert isinstance(result.contents, list)
    c.close()
```

- [ ] **Step 3: 실제 fetch 메소드 구현**

`baemin_service.py` 의 `fetch_orders` / `fetch_all_orders` / `fetch_settlements` / `fetch_all_settlements` 의 NotImplementedError 본문을 HAR 노트 기반으로 교체.

쿠팡이츠 `services/coupang_eats_service.py:331-530` 패턴 참고. 핵심 차이:
- BASE_URL = "https://ceo.baemin.com"
- URL/파라미터/응답 키 이름은 HAR 노트의 값 그대로
- 응답 wrapping (data root) 다양성 처리 — `raw` / `raw["data"]` 둘 다 시도
- `_check_response` 호출 후 `r.json()` 파싱 + 빈 응답·null 케이스 방어

`whoami` 의 `/api/whoami` placeholder URL 도 HAR 노트의 실제 URL 로 교체.

- [ ] **Step 4: 테스트 실행 — PASS**

Run: `cd SodamApp/backend && pytest tests/baemin/test_service.py -v`
Expected: 7 passed (기존 5 + 신규 2)

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/services/baemin_service.py SodamApp/backend/tests/baemin/
git commit -m "feat(baemin): fetch_orders/settlements 실제 구현 (HAR 응답 기반)"
```

---

## Task 6: _run_sync upsert 로직 + DeliveryRevenue 연동

NotImplementedError 던지던 `_run_sync` 를 실제 upsert 로직으로 채움. 쿠팡이츠 `routers/coupang_eats.py:824-957` 패턴 참고.

**Files:**
- Modify: `SodamApp/backend/routers/baemin.py` — `_run_sync` 본문
- Create: `SodamApp/backend/services/baemin_service.py` — `upsert_orders`, `upsert_settlements`, `upsert_revenue_from_orders` 헬퍼 추가
- Modify: `SodamApp/backend/tests/baemin/test_router.py` — sync flow 통합 테스트

- [ ] **Step 1: upsert 헬퍼 테스트 작성**

`test_service.py` 에 추가:

```python
from sqlmodel import Session, SQLModel, create_engine, select
from models import Business, BaeminOrder, BaeminSettlement, DeliveryRevenue


def test_upsert_orders_idempotent():
    from services.baemin_service import upsert_orders
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        s.add(Business(id=1, name="t", subscription_status="active")); s.commit()
        orders = [
            {"orderNo": "ORDER_A1", "orderedAt": "2026-05-01T12:30:00",
             "totalPrice": 25000, "status": "DELIVERED"},
            {"orderNo": "ORDER_A2", "orderedAt": "2026-05-01T13:00:00",
             "totalPrice": 18000, "status": "DELIVERED"},
        ]
        r1 = upsert_orders(s, business_id=1, store_id="STORE_A", orders=orders)
        assert r1["inserted"] == 2
        # 같은 데이터 다시 → 0 inserted
        r2 = upsert_orders(s, business_id=1, store_id="STORE_A", orders=orders)
        assert r2["inserted"] == 0


def test_upsert_revenue_from_orders_daily_aggregate():
    from services.baemin_service import upsert_orders, upsert_revenue_from_orders
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        s.add(Business(id=1, name="t", subscription_status="active")); s.commit()
        orders = [
            {"orderNo": "O1", "orderedAt": "2026-05-01T10:00:00",
             "totalPrice": 25000, "status": "DELIVERED"},
            {"orderNo": "O2", "orderedAt": "2026-05-01T11:00:00",
             "totalPrice": 18000, "status": "DELIVERED"},
            {"orderNo": "O3", "orderedAt": "2026-05-01T12:00:00",
             "totalPrice": 12000, "status": "CANCELLED"},
        ]
        upsert_orders(s, business_id=1, store_id="STORE_A", orders=orders)
        total = upsert_revenue_from_orders(s, business_id=1,
                                            date=datetime.date(2026, 5, 1))
        # cancelled 제외 → 25000 + 18000 = 43000
        assert total == 43000
        # DeliveryRevenue 행 확인
        dr = s.exec(
            select(DeliveryRevenue).where(
                DeliveryRevenue.business_id == 1,
                DeliveryRevenue.year == 2026,
                DeliveryRevenue.month == 5,
                DeliveryRevenue.channel == "배달의민족",
            )
        ).first()
        assert dr is not None
        assert dr.total_sales == 43000
```

- [ ] **Step 2: upsert 헬퍼 구현**

`baemin_service.py` 끝에 추가:

```python
# ─── DB upsert 헬퍼 ───

from sqlmodel import Session, select


def _parse_order_dt(value: Optional[str]) -> Optional[datetime.datetime]:
    if not value:
        return None
    # 다양한 포맷 시도 (HAR 응답에 따라)
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.datetime.strptime(value[:len(fmt)+5], fmt)
        except (ValueError, TypeError):
            continue
    return None


def upsert_orders(session: Session, business_id: int,
                  store_id: str, orders: list[dict]) -> dict:
    """배민 주문 list → BaeminOrder upsert.

    응답 키 이름은 HAR 후 확정. 일반 추정: orderNo / orderedAt / totalPrice / status.
    """
    from models import BaeminOrder
    inserted = 0
    updated = 0
    for o in orders:
        order_id = str(o.get("orderNo") or o.get("orderId")
                       or o.get("id") or "").strip()
        if not order_id:
            continue
        existing = session.exec(
            select(BaeminOrder).where(
                BaeminOrder.business_id == business_id,
                BaeminOrder.order_id == order_id,
            )
        ).first()
        ordered_at = _parse_order_dt(
            o.get("orderedAt") or o.get("orderTime") or o.get("createdAt")
        )
        total_price = int(float(o.get("totalPrice")
                                or o.get("totalSalePrice") or 0))
        status_val = (o.get("status") or o.get("orderStatus") or "").strip()
        cancelled_flag = status_val.upper() in ("CANCELLED", "CANCELED", "취소")
        if existing:
            existing.ordered_at = ordered_at or existing.ordered_at
            existing.total_sale_price = total_price
            existing.cancelled = cancelled_flag
            existing.order_status = status_val[:32] or existing.order_status
            existing.raw_json = json.dumps(o, ensure_ascii=False)
            session.add(existing)
            updated += 1
        else:
            session.add(BaeminOrder(
                business_id=business_id, store_id=store_id, order_id=order_id,
                ordered_at=ordered_at, total_sale_price=total_price,
                cancelled=cancelled_flag, order_status=status_val[:32] or None,
                raw_json=json.dumps(o, ensure_ascii=False),
            ))
            inserted += 1
    session.commit()
    return {"inserted": inserted, "updated": updated}


def upsert_settlements(session: Session, business_id: int,
                       store_id: str, settlements: list[dict]) -> dict:
    """배민 정산 list → BaeminSettlement upsert. 응답 키는 HAR 후 확정."""
    from models import BaeminSettlement
    inserted = 0
    updated = 0
    for st in settlements:
        # TODO(HAR): 실제 응답 키로 교체 — 아래는 추정
        st_date_raw = st.get("settlementDate") or st.get("paidAt")
        try:
            st_date = datetime.date.fromisoformat(str(st_date_raw)[:10])
        except (ValueError, TypeError):
            continue
        st_type = (st.get("type") or st.get("settlementType")
                   or "SETTLEMENT")[:16]
        transfer_id = str(st.get("transferId") or st.get("sellerTransferId")
                          or "") or None
        existing = session.exec(
            select(BaeminSettlement).where(
                BaeminSettlement.business_id == business_id,
                BaeminSettlement.settlement_date == st_date,
                BaeminSettlement.settlement_type == st_type,
                BaeminSettlement.seller_transfer_id == transfer_id,
            )
        ).first()
        amount = int(float(st.get("amount") or st.get("paidAmount") or 0))
        if existing:
            existing.amount = amount
            existing.raw_json = json.dumps(st, ensure_ascii=False)
            session.add(existing)
            updated += 1
        else:
            session.add(BaeminSettlement(
                business_id=business_id, store_id=store_id,
                settlement_date=st_date, settlement_type=st_type,
                seller_transfer_id=transfer_id, amount=amount,
                raw_json=json.dumps(st, ensure_ascii=False),
            ))
            inserted += 1
    session.commit()
    return {"inserted": inserted, "updated": updated}


def upsert_revenue_from_orders(session: Session, business_id: int,
                                date: datetime.date) -> int:
    """그 날짜 BaeminOrder 합계 → DeliveryRevenue(channel='배달의민족') upsert."""
    from models import BaeminOrder, DeliveryRevenue
    day_start = datetime.datetime.combine(date, datetime.time.min)
    day_end = datetime.datetime.combine(date + datetime.timedelta(days=1),
                                         datetime.time.min)
    rows = session.exec(
        select(BaeminOrder).where(
            BaeminOrder.business_id == business_id,
            BaeminOrder.ordered_at >= day_start,
            BaeminOrder.ordered_at < day_end,
            BaeminOrder.cancelled == False,  # noqa: E712
        )
    ).all()
    total = sum(o.total_sale_price or 0 for o in rows)
    # 월별 DeliveryRevenue 누적 (한 달 전체 재계산이 더 안전 — 부분 갱신 회피)
    month_start = datetime.date(date.year, date.month, 1)
    if date.month == 12:
        month_end = datetime.date(date.year + 1, 1, 1)
    else:
        month_end = datetime.date(date.year, date.month + 1, 1)
    month_rows = session.exec(
        select(BaeminOrder).where(
            BaeminOrder.business_id == business_id,
            BaeminOrder.ordered_at >= datetime.datetime.combine(month_start, datetime.time.min),
            BaeminOrder.ordered_at < datetime.datetime.combine(month_end, datetime.time.min),
            BaeminOrder.cancelled == False,  # noqa: E712
        )
    ).all()
    month_total = sum(o.total_sale_price or 0 for o in month_rows)
    month_count = len(month_rows)

    dr = session.exec(
        select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == business_id,
            DeliveryRevenue.year == date.year,
            DeliveryRevenue.month == date.month,
            DeliveryRevenue.channel == "배달의민족",
        )
    ).first()
    if dr:
        dr.total_sales = month_total
        dr.order_count = month_count
        dr.source = "bank_sync"  # 자동수집은 'bank_sync' 마커
        session.add(dr)
    else:
        session.add(DeliveryRevenue(
            business_id=business_id, channel="배달의민족",
            year=date.year, month=date.month,
            total_sales=month_total, order_count=month_count,
            source="bank_sync",
        ))
    session.commit()
    return total
```

- [ ] **Step 3: `_run_sync` 본문 교체**

`routers/baemin.py` 의 `_run_sync` 함수에서 `raise NotImplementedError(...)` 부분을 다음으로 교체:

```python
    try:
        client, cred = _make_client(business_id)
        store_id = cred.store_id
        if not store_id:
            raise HTTPException(422, "매장 ID 가 없습니다. 자격증명에 store_id 를 입력해주세요.")

        try:
            # 1) 주문
            if sync_orders:
                start_dt = datetime.datetime.combine(start_date, datetime.time.min)
                end_dt = datetime.datetime.combine(end_date, datetime.time.max)
                orders = client.fetch_all_orders(store_id, start_dt, end_dt)
                from services.baemin_service import (
                    upsert_orders, upsert_revenue_from_orders,
                )
                with Session(engine) as s:
                    up = upsert_orders(s, business_id, store_id, orders)
                summary["orders"]["fetched"] = len(orders)
                summary["orders"]["inserted"] = up["inserted"]
                summary["orders"]["updated"] = up["updated"]
                # Revenue 일자집계
                for offset in range((end_date - start_date).days + 1):
                    d = start_date + datetime.timedelta(days=offset)
                    with Session(engine) as s:
                        total = upsert_revenue_from_orders(s, business_id, d)
                    summary["total_sales"] += total

            # 2) 정산
            if sync_settlements:
                settlements = client.fetch_all_settlements(store_id, start_date, end_date)
                from services.baemin_service import upsert_settlements
                with Session(engine) as s:
                    up = upsert_settlements(s, business_id, store_id, settlements)
                summary["settlements"]["fetched"] = len(settlements)
                summary["settlements"]["inserted"] = up["inserted"]
                summary["settlements"]["updated"] = up["updated"]

            # P/L 동기화 호출 (DeliveryRevenue → MonthlyProfitLoss)
            from services.profit_loss_service import sync_delivery_revenue_to_pl
            with Session(engine) as s:
                sync_delivery_revenue_to_pl(start_date.year, start_date.month, s, business_id)
                if (start_date.year, start_date.month) != (end_date.year, end_date.month):
                    sync_delivery_revenue_to_pl(end_date.year, end_date.month, s, business_id)
        finally:
            client.close()

        # 완료
        with Session(engine) as s:
            sl = s.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "success"
                sl.orders_fetched = summary["orders"]["fetched"]
                sl.orders_inserted = summary["orders"]["inserted"]
                sl.orders_updated = summary["orders"]["updated"]
                sl.settlements_fetched = summary["settlements"]["fetched"]
                sl.settlements_inserted = summary["settlements"]["inserted"]
                sl.settlements_updated = summary["settlements"]["updated"]
                sl.total_sales = summary["total_sales"]
                s.add(sl); s.commit()
    except CookieInvalidError as e:
        with Session(engine) as s:
            cred_row = s.exec(
                select(BaeminCredential).where(
                    BaeminCredential.business_id == business_id
                )
            ).first()
            if cred_row:
                _record_failure(s, cred_row, str(e), status="cookie_invalid")
            sl = s.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s.add(sl); s.commit()
        summary["errors"].append({"error": str(e), "kind": "cookie_invalid"})
        raise HTTPException(422, f"쿠키 만료: {e}") from e
    except Exception as e:
        with Session(engine) as s:
            sl = s.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s.add(sl); s.commit()
        summary["errors"].append({"error": str(e)})
        log.error("baemin sync failed bid=%s: %s", business_id, e, exc_info=True)
        raise
    return summary
```

- [ ] **Step 4: 테스트 실행**

Run: `cd SodamApp/backend && pytest tests/baemin/ -v`
Expected: 16 passed (기존 14 + upsert 2)

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/services/baemin_service.py SodamApp/backend/routers/baemin.py SodamApp/backend/tests/baemin/
git commit -m "feat(baemin): upsert orders/settlements + DeliveryRevenue 일자집계 + P/L sync"
```

---

## Task 7: 디버그 라우터 + 대시보드

**Files:**
- Modify: `SodamApp/backend/routers/baemin.py`

- [ ] **Step 1: `/dashboard` + `/debug/probe` + `/debug/raw-orders` 추가**

`routers/baemin.py` 끝에 추가:

```python
@router.get("/dashboard")
def fetch_dashboard(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    # 주간 합계 (최근 7일)
    today = datetime.date.today()
    week_start = today - datetime.timedelta(days=6)
    with Session(engine) as s:
        from sqlalchemy import func
        weekly = s.exec(
            select(
                func.count(BaeminOrder.id),
                func.coalesce(func.sum(BaeminOrder.total_sale_price), 0),
            ).where(
                BaeminOrder.business_id == bid,
                BaeminOrder.ordered_at >= datetime.datetime.combine(week_start, datetime.time.min),
                BaeminOrder.cancelled == False,  # noqa: E712
            )
        ).first()
        order_count_7d = int(weekly[0] or 0) if weekly else 0
        total_7d = int(weekly[1] or 0) if weekly else 0
    return {
        "weekly_summary": {
            "from": week_start.isoformat(),
            "to": today.isoformat(),
            "order_count": order_count_7d,
            "total_sales": total_7d,
        },
    }


@router.get("/debug/probe")
def debug_probe(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """superadmin 쿠키 진단 — 쿠키 list + whoami raw."""
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명 미등록")
        cookies = []
        if cred.cookies_encrypted:
            try:
                cookies = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
            except Exception as e:  # noqa: BLE001
                return {"error": f"쿠키 복호화 실패: {e}"}
    names = [(c.get("name") or "") for c in cookies]
    client = BaeminClient(cookies)
    probe = {}
    try:
        probe["whoami"] = client.whoami()
    except Exception as e:  # noqa: BLE001
        probe["whoami_error"] = str(e)
    finally:
        client.close()
    return {
        "cookies_total": len(cookies),
        "cookie_names": names,
        "cookie_domains": list({(c.get("domain") or "-") for c in cookies}),
        "probe": probe,
    }


@router.get("/debug/raw-orders")
def debug_raw_orders(
    start: Optional[str] = None,
    end: Optional[str] = None,
    page_size: int = 10,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """superadmin — fetch_orders 응답 raw 노출. PII 포함 가능."""
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    try:
        start_d = datetime.date.fromisoformat(start) if start else yesterday
        end_d = datetime.date.fromisoformat(end) if end else yesterday
    except ValueError as e:
        raise HTTPException(400, f"날짜 형식 오류: {e}") from e
    client, cred = _make_client(bid)
    try:
        result = client.fetch_orders(
            store_id=cred.store_id,
            start=datetime.datetime.combine(start_d, datetime.time.min),
            end=datetime.datetime.combine(end_d, datetime.time.max),
            page_number=0, page_size=page_size,
        )
        return {
            "store_id": cred.store_id,
            "summary": {
                "total_sale_price": result.total_sale_price,
                "total_order_count": result.total_order_count,
                "fetched_orders_in_page": len(result.orders),
            },
            "first_order": result.orders[0] if result.orders else None,
            "raw_response": result.raw,
        }
    finally:
        client.close()
```

- [ ] **Step 2: 테스트 실행 — 기존 통과 + dashboard 추가 (optional)**

Run: `cd SodamApp/backend && pytest tests/baemin/test_router.py -v`
Expected: 5 passed (기존 그대로)

- [ ] **Step 3: 커밋**

```bash
git add SodamApp/backend/routers/baemin.py
git commit -m "feat(baemin): 대시보드 + superadmin 디버그 엔드포인트 (probe / raw-orders)"
```

---

## Task 8: SyncEvent normalizer

자동수집 파이프라인 (`auto_collection_sync`) 에 배민 normalizer 추가. BaeminOrder + BaeminSettlement 를 SyncEvent fan-out 으로 변환.

**Files:**
- Create: `SodamApp/backend/services/auto_collection_sync/normalizers/baemin.py`

- [ ] **Step 1: 쿠팡이츠 normalizer 패턴 그대로 배민용 작성**

```python
# SodamApp/backend/services/auto_collection_sync/normalizers/baemin.py
"""배민 → SyncEvent[].

매출은 일자별 1행, 수수료는 정산 항목별로 fan-out. 쿠팡이츠 normalizer 와 동일 패턴.
"""
import datetime
from sqlmodel import Session, select
from models import BaeminOrder, BaeminSettlement
from ..sync_event import SyncEvent


FEE_FIELDS = [
    ("fee_brokerage",      "baemin_fee_brokerage"),
    ("fee_payment",        "baemin_fee_payment"),
    ("fee_delivery",       "baemin_fee_delivery"),
    ("fee_advertising",    "baemin_fee_advertising"),
    ("fee_coupon_owner",   "baemin_fee_coupon_owner"),
]


def normalize_baemin(session: Session, business_id: int,
                     start: datetime.date, end: datetime.date):
    current = start
    while current <= end:
        # 1) 매출 (취소 제외)
        day_start = datetime.datetime.combine(current, datetime.time.min)
        day_end = datetime.datetime.combine(
            current + datetime.timedelta(days=1), datetime.time.min
        )
        orders = session.exec(
            select(BaeminOrder).where(
                BaeminOrder.business_id == business_id,
                BaeminOrder.ordered_at >= day_start,
                BaeminOrder.ordered_at < day_end,
                BaeminOrder.cancelled == False,  # noqa: E712
            )
        ).all()
        total_sale = sum(o.total_sale_price or 0 for o in orders)
        if total_sale > 0:
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="baemin",
                payment_method="Delivery", amount=int(total_sale),
                source="auto_baemin",
                source_ref=f"baemin_orders:{business_id}:{current.isoformat()}",
                raw_payload={"order_count": len(orders)},
            )

        # 2) 정산 수수료 분해
        settlements = session.exec(
            select(BaeminSettlement).where(
                BaeminSettlement.business_id == business_id,
                BaeminSettlement.settlement_date == current,
                BaeminSettlement.settlement_type == "SETTLEMENT",
            )
        ).all()
        for st in settlements:
            for field_name, vendor_key in FEE_FIELDS:
                fee = getattr(st, field_name, 0) or 0
                if fee <= 0:
                    continue
                yield SyncEvent(
                    business_id=business_id, date=current,
                    event_type="expense", vendor_lookup_key=vendor_key,
                    payment_method="Delivery", amount=-int(fee),
                    source="auto_baemin",
                    source_ref=f"baemin_settle:{st.id}:{field_name}",
                    raw_payload={"settlement_id": st.id},
                )
        current += datetime.timedelta(days=1)
```

- [ ] **Step 2: 커밋**

```bash
git add SodamApp/backend/services/auto_collection_sync/normalizers/baemin.py
git commit -m "feat(baemin): SyncEvent normalizer — 매출 일자별 + 수수료 항목별 fan-out"
```

---

## Task 9: Cron 등록 (auto_collection 라우터 + Orbitron.yaml)

기존 `auto_collection.py` 의 `/cron/coupang-eats` 패턴 미러링.

**Files:**
- Modify: `SodamApp/backend/routers/auto_collection.py:309-343` 다음 위치
- Modify: `Orbitron.yaml:209-233` cron list

- [ ] **Step 1: auto_collection 라우터에 `/cron/baemin` 추가**

`routers/auto_collection.py` 의 `cron_coupang` 함수 다음에 추가:

```python
@router.post("/cron/baemin")
def cron_baemin(_: None = Depends(_verify_cron_secret)):
    """04:30 — 배민 채널 수집."""
    import datetime as _dt
    from models import BaeminCredential
    from routers.baemin import _run_sync as _baemin_run_sync

    yesterday = _dt.date.today() - _dt.timedelta(days=1)
    with Session(engine) as s:
        bids = [r for r in s.exec(
            select(BaeminCredential.business_id).where(
                BaeminCredential.status.in_(["active"])
            )
        )]
    results = []
    for bid in bids:
        try:
            r = _baemin_run_sync(bid, yesterday, yesterday,
                                  sync_orders=True, sync_settlements=True,
                                  triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:  # noqa: BLE001
            _cron_log.error("baemin cron failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})
    return {
        "ok": True,
        "target_date": yesterday.isoformat(),
        "business_count": len(bids),
        "results": results,
    }
```

- [ ] **Step 2: 통합 라우터 dashboard 에도 baemin 추가**

`auto_collection.py` 의 dashboard endpoint (`@router.get("/dashboard")` 또는 비슷한 곳) 에서 마지막 sync log 조회 부분에 baemin 추가:

```python
from models import BaeminSyncLog  # 추가
# ... 기존 coupang_last 조회 다음에 ...
baemin_last = s.exec(
    select(BaeminSyncLog).where(BaeminSyncLog.business_id == bid)
    .order_by(BaeminSyncLog.started_at.desc()).limit(1)
).first()
# 응답 dict 에 추가
"baemin": _log_dto(baemin_last) if baemin_last else None,
```

(정확한 위치는 `auto_collection.py:75-131` 참고하여 같은 패턴으로 삽입)

- [ ] **Step 3: Orbitron.yaml 에 cron 추가**

`Orbitron.yaml:215` (`auto-collection-coupang` 항목) 다음에 추가:

```yaml
  - name: auto-collection-baemin
    schedule: "30 4 * * *"
    command: 'curl -fsS -X POST -H "X-Cron-Secret: $CRON_SHARED_SECRET" $BACKEND_URL/api/auto-collection/cron/baemin'
```

위치는 기존 cron list 안. coupang/bank-sync 와 일관된 순서.

- [ ] **Step 4: 로컬 cron endpoint 호출 테스트**

```bash
cd SodamApp/backend && uvicorn main:app --reload &
sleep 3
curl -X POST -H "X-Cron-Secret: $CRON_SHARED_SECRET" http://localhost:8000/api/auto-collection/cron/baemin
```

Expected: `{"ok": true, "target_date": "...", "business_count": 0, "results": []}` (BaeminCredential 등록 전이므로 0건)

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/auto_collection.py Orbitron.yaml
git commit -m "feat(baemin): cron 04:30 KST 등록 + auto_collection 통합 라우터 연동"
```

---

## Task 10: 프론트엔드 — BaeminModuleDetail 페이지

쿠팡이츠 `CoupangEatsModuleDetail.jsx` 를 복제해 배민용으로 수정. 자동 로그인 UI 제거 (수동 쿠키 only).

**Files:**
- Create: `SodamApp/frontend/src/pages/BaeminModuleDetail.jsx`

- [ ] **Step 1: 쿠팡 페이지 복제 후 수정**

```bash
cp SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx SodamApp/frontend/src/pages/BaeminModuleDetail.jsx
```

다음 항목을 일괄 치환:
- `coupang-eats` → `baemin`
- `CoupangEatsModuleDetail` → `BaeminModuleDetail`
- `쿠팡이츠` → `배민`
- `store.coupangeats.com` → `ceo.baemin.com`
- 자동 로그인 / Playwright / test-login 관련 UI 블록 **삭제** (수동 쿠키만 사용)
- 자격증명 폼: `password` 필드 삭제, `login_id` + `store_id` 만 유지
- `loginMethod` / `cookies_obtained_at` 표시 로직 단순화

- [ ] **Step 2: 핵심 UI 컴포넌트 검증**

브라우저에서 페이지 열어 확인:
- 자격증명 등록/수정/삭제
- 쿠키 입력 modal
- "지금 동기화" 버튼 (기간 지정)
- 동기화 이력 테이블
- 대시보드 위젯 (주간 합계)

- [ ] **Step 3: 빌드 오류 확인**

```bash
cd SodamApp/frontend && npm run build
```

Expected: build success

- [ ] **Step 4: 커밋**

```bash
git add SodamApp/frontend/src/pages/BaeminModuleDetail.jsx
git commit -m "feat(baemin): 외부연동 페이지 (쿠팡이츠 패턴 미러, 수동 쿠키 only)"
```

---

## Task 11: 프론트엔드 — App.jsx / ExternalIntegration / ModuleGrid

**Files:**
- Modify: `SodamApp/frontend/src/App.jsx`
- Modify: `SodamApp/frontend/src/pages/ExternalIntegration.jsx`
- Modify: `SodamApp/frontend/src/components/codef/ModuleGrid.jsx`

- [ ] **Step 1: 라우트 추가**

`App.jsx` 의 router config 에서 쿠팡이츠 라우트 다음에 추가:

```jsx
import BaeminModuleDetail from './pages/BaeminModuleDetail';
// ...
<Route path="/external-integration/baemin" element={<BaeminModuleDetail />} />
```

- [ ] **Step 2: ExternalIntegration 카드 stats fetch 추가**

`ExternalIntegration.jsx:18-77` 부근 패턴 — `coupangEatsStats` 와 같은 구조로 `baeminStats` 추가:

```jsx
const [baeminStats, setBaeminStats] = useState({ registered: false, cookiesPresent: false, lastVerifiedAt: null, status: null });

// fetchAll 의 Promise.all 안에 추가
api.get('/baemin/credential').catch(() => ({ data: { registered: false } })),

// 그리고 응답 처리
const bm = baeminRes.data || {};
setBaeminStats({
    registered: !!bm.registered,
    cookiesPresent: !!bm.cookies_present,
    lastVerifiedAt: bm.last_verified_at || null,
    status: bm.status || null,
    shopName: bm.shop_name || null,
});
```

ModuleGrid 에 prop 전달:
```jsx
<ModuleGrid ... baeminStats={baeminStats} />
```

- [ ] **Step 3: ModuleGrid 에 배민 카드 추가**

`ModuleGrid.jsx` 의 카드 list 에서 쿠팡이츠 카드 다음에 동일 패턴 배민 카드 추가:

```jsx
{
    key: 'baemin',
    title: '배민 자동수집',
    icon: <Bike size={28} />,
    href: '/external-integration/baemin',
    status: baeminStats.registered
        ? (baeminStats.cookiesPresent ? 'active' : 'cookie_missing')
        : 'not_registered',
    subtext: baeminStats.shopName || (baeminStats.registered ? '쿠키 입력 필요' : '미등록'),
    bg: 'from-orange-50 to-rose-100',
}
```

- [ ] **Step 4: 빌드 + 브라우저 확인**

```bash
cd SodamApp/frontend && npm run build && npm run dev
```

브라우저에서 `/external-integration` 에 배민 카드 보이는지 + 클릭 시 BaeminModuleDetail 으로 이동하는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/frontend/src/App.jsx SodamApp/frontend/src/pages/ExternalIntegration.jsx SodamApp/frontend/src/components/codef/ModuleGrid.jsx
git commit -m "feat(baemin): 외부연동 hub 카드 + 라우트 추가"
```

---

## Task 12: 1일치 prod 검증 + work-log + 메모리

**Files:**
- Modify: `SodamApp/backend/docs/work-log.md` (자동수집 파이프라인 진행 상황)
- Create: `C:/Users/choon/.claude/projects/c--WORK-SodamFN/memory/project_baemin_auto_collection.md`
- Modify: `C:/Users/choon/.claude/projects/c--WORK-SodamFN/memory/MEMORY.md`

- [ ] **Step 1: 사장님 prod 쿠키 입력 + 1일치 동기화**

화면 안내:

```
1. /external-integration/baemin 접속
2. "자격증명 등록" — login_id (배민 사장님 이메일) + store_id (HAR 노트 참고)
3. "쿠키 입력" — F12 → Application → Cookies → name/value 복사 후 입력
4. "지금 동기화" — 기본 (어제 하루) 로 실행
5. 결과 확인: orders_inserted / total_sales / 동기화 이력 status="success"
```

- [ ] **Step 2: prod DB 검증**

```bash
cd SodamApp/backend && PYTHONIOENCODING=utf-8 python -c "
from sqlmodel import Session, select
from database import engine
from models import BaeminOrder, BaeminSettlement, BaeminSyncLog, DeliveryRevenue
import datetime
s = Session(engine)
yesterday = datetime.date.today() - datetime.timedelta(days=1)
day_start = datetime.datetime.combine(yesterday, datetime.time.min)
day_end = datetime.datetime.combine(yesterday + datetime.timedelta(days=1), datetime.time.min)

orders = s.exec(select(BaeminOrder).where(
    BaeminOrder.ordered_at >= day_start, BaeminOrder.ordered_at < day_end
)).all()
print(f'어제 주문: {len(orders)}건, 매출합={sum(o.total_sale_price or 0 for o in orders):,}')

logs = s.exec(select(BaeminSyncLog).order_by(BaeminSyncLog.started_at.desc()).limit(3)).all()
for l in logs:
    print(f'  log {l.started_at} status={l.status} orders={l.orders_inserted}')

dr = s.exec(select(DeliveryRevenue).where(
    DeliveryRevenue.channel=='배달의민족',
    DeliveryRevenue.year==yesterday.year, DeliveryRevenue.month==yesterday.month,
)).first()
print(f'DeliveryRevenue 5월: total_sales={dr.total_sales if dr else 0:,}')
s.close()
"
```

- [ ] **Step 3: 1개월 백필 (5/14 ~ 4/14 또는 사장님 결정 범위)**

UI 에서 `/external-integration/baemin` → "지금 동기화" → 기간 선택 → 실행.

- [ ] **Step 4: 메모리 기록**

`C:/Users/choon/.claude/projects/c--WORK-SodamFN/memory/project_baemin_auto_collection.md`:

```markdown
---
name: 배민 배달앱 매출 자동수집 완성
description: 2026-05-XX 1개월 백필 N건/N만원 성공. 수동 쿠키 only. cron 04:30 KST.
type: project
---

# 배민(배달의민족) 매출/정산 자동수집

**완성일**: 2026-05-XX
**채널**: 배달의민족 (ceo.baemin.com)
**인증**: 수동 쿠키 only (쿠팡과 다름 — 자동 로그인 없음)
**Cron**: 04:30 KST 자동 / `auto-collection-baemin`
**스펙·플랜**: `docs/superpowers/specs/2026-05-14-baemin-auto-collection-design.md`, `docs/superpowers/plans/2026-05-14-baemin-auto-collection.md`

**핵심 함정/배운점** (HAR 분석 후 채움):
- (HAR 노트에서 발견한 인증/페이지네이션 함정)

**Why**: 손익 페이지의 배민 매출이 BankTransaction codef sync 만으론 정확도 낮음. 주문 raw + 수수료 분해 필요.
**How to apply**: 새 채널 자동수집 추가 시 이 패턴 (수동 쿠키 + curl_cffi) 재사용.
```

`MEMORY.md` 에 한 줄 추가:
```markdown
- [배민 배달앱 매출 자동수집 완성](project_baemin_auto_collection.md) — 2026-05-XX. 수동 쿠키 only, cron 04:30 KST. N건/N만원 백필 성공.
```

- [ ] **Step 5: work-log 업데이트**

`docs/work-log.md` 마지막 섹션에 추가:

```markdown
### 2026-05-XX 세션 — 배민 자동수집 완성

- 모델 4개 + 라우터 10개 + Service + Normalizer + 프론트엔드 카드
- HAR 캡처 → fetch_orders/settlements 응답 파싱
- 1일치 검증 + 1개월 백필 N건/N만원
- 메모리 등록 + work-log

**다음 작업**: 요기요 / 땡겨요 (같은 패턴, ~1일씩)
```

- [ ] **Step 6: 최종 커밋 + 푸시**

```bash
git add docs/work-log.md
git commit -m "docs(baemin): 자동수집 완성 보고 + 다음 작업 (요기요/땡겨요)"
git push
```

배포: Orbitron 이 자동 재배포. cron 은 다음 04:30 KST 부터 매일 실행.

---

## Self-Review 체크 결과

**1. Spec coverage**:
- 4개 모델 → Task 1 ✓
- BaeminClient + curl_cffi → Task 2, 5 ✓
- 10 라우터 엔드포인트 → Task 3, 7 ✓
- DeliveryRevenue 일자집계 → Task 6 ✓
- 프론트엔드 카드 → Task 10, 11 ✓
- Cron 04:30 KST → Task 9 ✓
- 쿠키 만료 처리 → Task 6 (CookieInvalidError 분기) ✓
- HAR 캡처 의존성 → Task 4 명시 ✓
- Normalizer (SyncEvent fan-out) → Task 8 ✓
- 백필 → Task 12 ✓

**2. Placeholder scan**: TODO 는 Task 5 / Task 6 의 HAR 의존 부분에 한정 — 모두 "HAR 후 채움" 으로 명시. 그 외 TBD 없음.

**3. Type consistency**:
- `store_id: str` (모델·라우터·DTO·서비스 일관)
- `seller_transfer_id: Optional[str]` 일관
- `_run_sync` 시그니처 (business_id, start_date, end_date, sync_orders, sync_settlements, triggered_by) 일관
