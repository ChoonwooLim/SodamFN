# 쿠팡이츠 쿠키 재입력 UX 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 쿠팡이츠 수동 쿠키 등록을 "붙여넣기 → 자동검증 → 자동백필" 루틴으로 만든다 — 등록 시 즉시 라이브 검증, cURL 붙여넣기 지원, 매장 자동 감지, 수집 공백 원클릭 백필.

**Architecture:** 백엔드는 `POST /coupang-eats/manual-cookies`가 저장 전 `whoami()`로 쿠키를 실검증하고 `list_stores()`로 매장을 자동 감지하며, 응답에 마지막 성공 수집일을 실어 프론트가 백필 공백을 계산한다. 프론트는 쿠키 입력 모달의 파서에 cURL 형식을 추가하고, 등록 결과 배너에서 다중 매장 선택과 공백 백필을 처리한다.

**Tech Stack:** FastAPI + SQLModel(백엔드), React + Vite(프론트), pytest(테스트). 쿠팡 호출은 기존 `CoupangEatsClient`(curl_cffi) 재사용.

**Spec:** `docs/superpowers/specs/2026-07-04-coupang-cookie-ux-design.md`

## Global Constraints

- 배민은 스코프 밖 — `routers/baemin.py`, `services/baemin_service.py` 건드리지 않는다.
- 텔레그램 알림, cron 로직, Playwright 로그인 변경 없음.
- 저장 로직은 반드시 기존 `_save_cookies` 헬퍼 경유 (Fernet 암호화 + 메타데이터 SSOT).
- 검증 실패 유형 구분: `CookieInvalidError`(인증거부) → 422 + 미저장 / `CoupangEatsError`(통신실패) → 저장 + `verified: false`. `CookieInvalidError`는 `CoupangEatsError`의 서브클래스이므로 **catch 순서 주의**.
- 커밋 메시지는 프로젝트 규칙(feat:/fix: + 한국어) 준수, 각 태스크 종료 시 커밋.
- 백엔드 테스트는 기존 `tests/test_coupang_eats_cookie_refresh.py` 패턴(sqlite in-memory + monkeypatch engine/CoupangEatsClient + 엔드포인트 함수 직접 호출)을 따른다. TestClient/FastAPI DI 사용하지 않음.
- 프론트 검증: `npm run build`로 문법/번들 확인 (프론트 테스트 러너 없음).
- 작업 디렉토리: `C:\WORK\SodamFN\.claude\worktrees\adoring-wilson-6422b6` (이하 상대경로).

---

### Task 1: 백엔드 헬퍼 — `_normalize_stores` + `_last_success_sync_date`

**Files:**
- Modify: `SodamApp/backend/routers/coupang_eats.py` (헬퍼 섹션, `_record_failure` 뒤 ~155행 부근)
- Test: `SodamApp/backend/tests/test_coupang_eats_manual_cookies.py` (신규)

**Interfaces:**
- Consumes: `CoupangEatsSyncLog` 모델 (models.py:1898 — `business_id`, `status`, `target_end: Optional[date]`)
- Produces:
  - `_normalize_stores(stores: list[dict]) -> list[dict]` — `[{"store_id": int, "store_name": Optional[str]}]` 반환. 키 변형(storeId/id/store_id, shopName/name/storeName) 흡수, store_id 정수 변환 불가 항목은 제외.
  - `_last_success_sync_date(session: Session, business_id: int) -> Optional[datetime.date]` — status=="success" 이고 target_end 있는 최신 로그의 `target_end`.

- [ ] **Step 1: 실패하는 테스트 작성**

`SodamApp/backend/tests/test_coupang_eats_manual_cookies.py` 생성:

```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_coupang_eats_manual_cookies.py -v`
Expected: FAIL — `ImportError: cannot import name '_normalize_stores'`

- [ ] **Step 3: 헬퍼 구현**

`SodamApp/backend/routers/coupang_eats.py`의 `_record_failure` 함수 뒤에 추가.
`CoupangEatsSyncLog`는 이미 import 되어 있음(31행).

```python
def _normalize_stores(stores: list[dict]) -> list[dict]:
    """list_stores 응답 → [{store_id, store_name}] 정규화.

    쿠팡 응답 키 변형(storeId/id/store_id, shopName/name/storeName)을 흡수.
    store_id 를 int 변환할 수 없는 항목은 제외.
    """
    out: list[dict] = []
    for st in stores or []:
        sid = st.get("storeId") or st.get("id") or st.get("store_id")
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            continue
        name = st.get("shopName") or st.get("name") or st.get("storeName")
        out.append({"store_id": sid, "store_name": name})
    return out


def _last_success_sync_date(session: Session,
                            business_id: int) -> Optional[datetime.date]:
    """마지막 성공 동기화의 target_end — 쿠키 재등록 후 백필 시작점 계산용."""
    row = session.exec(
        select(CoupangEatsSyncLog)
        .where(
            CoupangEatsSyncLog.business_id == business_id,
            CoupangEatsSyncLog.status == "success",
            CoupangEatsSyncLog.target_end != None,  # noqa: E711
        )
        .order_by(CoupangEatsSyncLog.target_end.desc())  # type: ignore[union-attr]
        .limit(1)
    ).first()
    return row.target_end if row else None
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_coupang_eats_manual_cookies.py -v`
Expected: 3 PASS

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/coupang_eats.py SodamApp/backend/tests/test_coupang_eats_manual_cookies.py
git commit -m "feat(coupang): 매장 정규화 + 마지막 성공 수집일 헬퍼"
```

---

### Task 2: 백엔드 — `manual-cookies` 즉시 라이브 검증

**Files:**
- Modify: `SodamApp/backend/routers/coupang_eats.py` — `ManualCookiesIn`(~315행), `submit_manual_cookies`(~416행)
- Test: `SodamApp/backend/tests/test_coupang_eats_manual_cookies.py` (Task 1 파일에 추가)

**Interfaces:**
- Consumes: Task 1의 `_normalize_stores`, `_last_success_sync_date`. 기존 `CoupangEatsClient`(`.whoami()`, `.list_stores()`, `.get_cookies()`, `.close()`), `CookieInvalidError`, `CoupangEatsError`, `_save_cookies`, `_cred_dto`, `_resolve_bid`.
- Produces: `POST /coupang-eats/manual-cookies` 응답 계약 (Task 4·5 프론트가 소비):
  - `ok: true`, `verified: bool`, `verify_warning: Optional[str]`,
    `stores: [{store_id, store_name}]`, `last_success_sync_date: Optional["YYYY-MM-DD"]`, + `_cred_dto` 전 필드
  - 인증 거부 시: HTTP 422, detail `"이 쿠키는 이미 무효입니다 — 쿠팡이츠가 인증을 거부했습니다: ..."`, **DB 미저장**
  - body에 `skip_verify: bool = False` 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_coupang_eats_manual_cookies.py`에 추가:

```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_coupang_eats_manual_cookies.py -v`
Expected: Task 1 테스트 3개 PASS, 신규 7개 FAIL (`skip_verify` 필드 없음 / `verified` 키 없음 등)

- [ ] **Step 3: 구현**

(a) `ManualCookiesIn`(~315행)에 필드 추가:

```python
class ManualCookiesIn(BaseModel):
    cookies: list[dict] = Field(..., description="브라우저에서 추출한 쿠키 list (name/value/domain/path/expires)")
    store_id: Optional[int] = None
    shop_name: Optional[str] = None
    skip_verify: bool = Field(False, description="쿠팡 API 장애 시 검증 생략 저장 (비상용)")
```

(b) `submit_manual_cookies`(~416행) 본문을 다음으로 교체 (docstring·bid 결정·빈 쿠키 체크·has_auth sanity check은 기존 유지):

```python
@router.post("/manual-cookies")
def submit_manual_cookies(
    body: ManualCookiesIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """사장님/개발자가 브라우저 F12 로 추출한 쿠키를 직접 입력.

    Akamai 가 Playwright 헤드리스를 차단하는 경우의 비상용. ID/PW 가 등록
    안 되어 있어도 동작.

    저장 전 whoami 로 즉시 라이브 검증:
      - 인증 거부(CookieInvalidError) → 422 + 미저장 (거짓 성공 방지)
      - 통신 실패(CoupangEatsError)   → 저장 진행 + verified=false 경고
      - 검증 성공 → list_stores 로 매장 자동 감지 (1개일 때)
    skip_verify=true 면 검증 생략(쿠팡 API 장애 시 비상용).
    """
    bid = _resolve_bid(admin, x_view_as_business)
    if not body.cookies:
        raise HTTPException(400, "쿠키 list 가 비어있습니다.")

    # 인증 쿠키 sanity check — 신/구버전 모두 허용
    # 구버전: EATS_AT / EATS_RT
    # 신버전(2026~): unify-token + account-id (통합 인증)
    cookie_names_upper = {(c.get("name") or "").upper() for c in body.cookies}
    cookie_names_lower = {(c.get("name") or "").lower() for c in body.cookies}
    has_auth = (
        any(n in cookie_names_upper for n in ("EATS_AT", "EATS_RT", "AUTH-TOKEN"))
        or "unify-token" in cookie_names_lower
        or "account-id" in cookie_names_lower
    )
    if not has_auth:
        log.warning("manual cookies missing common auth names, names=%s", cookie_names_upper)

    # ── 저장 전 라이브 검증 ──────────────────────────────
    verified = False
    verify_warning: Optional[str] = None
    stores_out: list[dict] = []
    save_store_id = body.store_id
    save_shop_name = body.shop_name
    cookies_to_save = body.cookies

    if not body.skip_verify:
        client = None
        try:
            client = CoupangEatsClient(body.cookies)
            client.whoami()
            verified = True
            try:
                stores_out = _normalize_stores(client.list_stores())
            except CoupangEatsError as e:
                verify_warning = f"인증은 성공했지만 매장 목록 조회 실패: {e}"
            if not save_store_id and len(stores_out) == 1:
                save_store_id = stores_out[0]["store_id"]
                save_shop_name = save_shop_name or stores_out[0]["store_name"]
            # whoami 중 서버가 회전시킨 쿠키가 있으면 최신본 저장
            rotated = client.get_cookies()
            if rotated:
                cookies_to_save = rotated
        except CookieInvalidError as e:
            # CoupangEatsError 의 서브클래스 — 반드시 먼저 catch
            raise HTTPException(
                422,
                f"이 쿠키는 이미 무효입니다 — 쿠팡이츠가 인증을 거부했습니다: {e}",
            ) from e
        except CoupangEatsError as e:
            verify_warning = f"쿠팡이츠 통신 실패로 검증하지 못했습니다 (저장은 진행): {e}"
        finally:
            if client is not None:
                client.close()

    with Session(engine) as s:
        row = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not row:
            row = CoupangEatsCredential(
                business_id=bid,
                login_method="manual",
                status="active",
            )
            s.add(row)
            s.commit()
            s.refresh(row)

        _save_cookies(s, row, cookies_to_save,
                      login_method="manual",
                      store_id=save_store_id or row.store_id,
                      shop_name=save_shop_name or row.shop_name)
        s.refresh(row)
        last_success = _last_success_sync_date(s, bid)
        return {
            "ok": True,
            "verified": verified,
            "verify_warning": verify_warning,
            "stores": stores_out,
            "last_success_sync_date":
                last_success.isoformat() if last_success else None,
            **_cred_dto(row),
        }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_coupang_eats_manual_cookies.py tests/test_coupang_eats_cookie_refresh.py -v`
Expected: 전체 PASS (기존 회귀 포함)

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/coupang_eats.py SodamApp/backend/tests/test_coupang_eats_manual_cookies.py
git commit -m "feat(coupang): 수동 쿠키 등록 시 즉시 라이브 검증 + 매장 자동감지

- 저장 전 whoami 실검증: 무효 쿠키 422 거부 (거짓 '등록 성공' 제거)
- 통신 실패는 저장 진행 + verified=false 경고
- list_stores 매장 1개 자동 감지, 응답에 stores 목록
- 응답에 last_success_sync_date (백필 공백 계산용)
- skip_verify 비상 탈출구"
```

---

### Task 3: 프론트 — cURL 붙여넣기 파서

**Files:**
- Modify: `SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx` — `CookieInputModal`의 `tryParse`(~1011행) + 안내문(~1106행)

**Interfaces:**
- Consumes: 기존 cookie 헤더 파서 로직 (tryParse 내부)
- Produces: `extractCookieFromCurl(text: string) -> string | null` — cURL 텍스트에서 cookie 헤더 값 추출. `tryParse`가 `curl`로 시작하는 입력을 자동 처리.

- [ ] **Step 1: 구현**

(a) `CookieInputModal` 함수 위(모듈 레벨, ~1001행 주석 아래)에 추출 함수 추가:

```jsx
/** Chrome "Copy as cURL" (bash/cmd) 텍스트에서 cookie 헤더 값 추출. */
function extractCookieFromCurl(text) {
    // cmd 형식: ^" ^% 등 캐럿 이스케이프 + ^ 줄연속 제거
    const cleaned = text.replace(/\^(\r?\n)/g, ' ').replace(/\^(.)/g, '$1');
    // -H 'cookie: ...' / -H "cookie: ..." / --header 'cookie: ...'
    const hMatch = cleaned.match(/(?:-H|--header)\s+(['"])cookie:\s*([\s\S]*?)\1/i);
    if (hMatch) return hMatch[2].trim();
    // -b '...' / --cookie '...'
    const bMatch = cleaned.match(/(?:-b|--cookie)\s+(['"])([\s\S]*?)\1/i);
    if (bMatch) return bMatch[2].trim();
    return null;
}
```

(b) `tryParse` 시작부(`if (!trimmed) return;` 직후)에 cURL 분기 추가하고, 이후 로직이 `trimmed` 대신 `effective`를 쓰도록 변경:

```jsx
    function tryParse(text) {
        setParseErr('');
        setParsed(null);
        const trimmed = (text || '').trim();
        if (!trimmed) return;
        // 0) cURL 텍스트 (Chrome "Copy as cURL" bash/cmd)
        let effective = trimmed;
        if (/^curl[\s^]/i.test(trimmed)) {
            const cookieStr = extractCookieFromCurl(trimmed);
            if (!cookieStr) {
                setParseErr("cURL 텍스트에서 cookie 헤더를 찾지 못했습니다 — 로그인 후의 요청에서 Copy as cURL 했는지 확인하세요.");
                return;
            }
            effective = cookieStr;
        }
        // 1) JSON array
        try {
            const arr = JSON.parse(effective);
            ...
```

이후 기존 헤더 파서 블록의 `trimmed`도 모두 `effective`로 치환:

```jsx
        // 2) Cookie header format "name1=value1; name2=value2"
        try {
            const cookies = effective
                .replace(/\r?\n/g, ';')
                ...
```

(c) 안내문(~1107행 `📋 쿠키 추출 방법` `<ol>`)의 4·5단계를 cURL 우선 경로로 교체:

```jsx
                        <li>요청 <strong>우클릭</strong> → <strong>Copy</strong> → <strong>Copy as cURL</strong> (bash 또는 cmd)</li>
                        <li>아래 텍스트박스에 통째로 붙여넣기 → "쿠키 N개 인식" 표시 (15~30개 정상)</li>
                    </ol>
                    <p className="mt-1 text-amber-800">
                        또는 Headers 탭에서 <code>cookie:</code> 줄의 값만 드래그 복사해도 됩니다.
                    </p>
```

- [ ] **Step 2: 빌드 확인**

Run: `cd SodamApp/frontend && npm run build`
Expected: 빌드 성공 (문법 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx
git commit -m "feat(coupang): 쿠키 모달 cURL 붙여넣기 지원 — Copy as cURL 통째로 인식"
```

---

### Task 4: 프론트 — 등록 결과 배너 (검증 표시 + 다중 매장 선택)

**Files:**
- Modify: `SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx` — 상태(~40행), `handleSubmitCookies`(~150행), 렌더(모달 블록 앞), `CookieInputModal`의 매장 ID 라벨(~1141행), 새 컴포넌트 `CookieResultBanner`(파일 하단)

**Interfaces:**
- Consumes: Task 2 응답 계약 (`verified`, `verify_warning`, `stores`, `last_success_sync_date`, `shop_name`, `store_id`)
- Produces:
  - state `cookieResult` — 등록 응답 + `rawCookies`(재제출용 parsed 쿠키)
  - `CookieResultBanner({ result, onSelectStore, onBackfill, backfilling, onDismiss })` 컴포넌트 — Task 5의 `onBackfill`/`backfilling`을 이 태스크에서 미리 배선 (Task 5 전까지 `backfilling=false`, `handleBackfillGap`은 Task 5에서 정의하므로 이 태스크에서는 자리만든 빈 함수로 두지 말고 **Task 5에서 배선** — 이 태스크에서는 `onBackfill={null}` 전달, 배너는 `onBackfill` 없으면 백필 버튼 숨김)

- [ ] **Step 1: 상태 + 핸들러 변경**

(a) 상태 추가 (`const [err, setErr] = useState('');` 아래):

```jsx
    const [cookieResult, setCookieResult] = useState(null);  // manual-cookies 응답 + rawCookies
```

(b) `handleSubmitCookies` 교체:

```jsx
    // ─── 수동 쿠키 입력 ───
    async function handleSubmitCookies(cookies, storeId, shopName) {
        try {
            const res = await api.post('/coupang-eats/manual-cookies', {
                cookies,
                store_id: storeId || undefined,
                shop_name: shopName || undefined,
            });
            const d = res.data;
            setCred({ registered: true, ...d });
            setCookieModalOpen(false);
            setCookieResult({ ...d, rawCookies: cookies });
            if (d.verified) {
                showMsg(`✓ 쿠키 인증 확인 — ${cookies.length}개 등록${d.shop_name ? `, 매장: ${d.shop_name}` : ''}`);
            } else {
                showMsg(`쿠키 ${cookies.length}개 등록 (검증 보류 — 아래 경고 확인)`);
            }
        } catch (e) {
            showErr('쿠키 등록 실패: ' + (e.response?.data?.detail || e.message));
        }
    }
```

- [ ] **Step 2: 배너 컴포넌트 추가**

파일 하단 (`CookieInputModal` 뒤)에 추가:

```jsx
// ─── 쿠키 등록 결과 배너 ─────────────────────────────────

function CookieResultBanner({ result, onSelectStore, onBackfill, backfilling, onDismiss }) {
    const needStoreChoice = !result.store_id && (result.stores?.length || 0) > 1;

    // 수집 공백: 마지막 성공일 다음날 ~ 어제
    let gapStart = null;
    let gapEnd = null;
    if (result.last_success_sync_date) {
        const s = new Date(result.last_success_sync_date + 'T00:00:00');
        s.setDate(s.getDate() + 1);
        const e = new Date();
        e.setDate(e.getDate() - 1);
        e.setHours(0, 0, 0, 0);
        if (s <= e) { gapStart = s; gapEnd = e; }
    }
    const fmtD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

    return (
        <div className={`rounded-xl border p-4 mb-4 ${result.verified
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                    {result.verified
                        ? <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> 쿠키 인증 확인됨</>
                        : <><AlertCircle className="w-5 h-5 text-amber-600" /> 쿠키 등록됨 (검증 보류)</>}
                </div>
                <button type="button" onClick={onDismiss}
                        className="p-1 hover:bg-black/5 rounded-md">
                    <XIcon className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {result.verify_warning && (
                <p className="mt-2 text-sm text-amber-800">⚠ {result.verify_warning}</p>
            )}

            {needStoreChoice && (
                <div className="mt-3">
                    <p className="text-sm text-slate-700 mb-2">
                        매장이 여러 개입니다 — 수집할 매장을 선택하세요:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {result.stores.map((s) => (
                            <button key={s.store_id} type="button"
                                    onClick={() => onSelectStore(s)}
                                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
                                {s.store_name || `매장 ${s.store_id}`} <span className="text-slate-400 font-mono">#{s.store_id}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {result.verified && !needStoreChoice && gapStart && onBackfill && (
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-slate-700">
                        📅 <strong>{fmtD(gapStart)} ~ {fmtD(gapEnd)}</strong> 수집 공백 감지
                    </span>
                    <button type="button" onClick={onBackfill} disabled={backfilling}
                            className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5">
                        {backfilling
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> 백필 중...</>
                            : <><Download className="w-4 h-4" /> 지금 백필</>}
                    </button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: 렌더 배선 + 매장 ID 라벨 변경**

(a) 메인 렌더의 `{cookieModalOpen && (` 블록 **앞**에 배너 추가:

```jsx
            {cookieResult && (
                <CookieResultBanner
                    result={cookieResult}
                    onSelectStore={(s) => handleSubmitCookies(
                        cookieResult.rawCookies, s.store_id, s.store_name)}
                    onBackfill={null}
                    backfilling={false}
                    onDismiss={() => setCookieResult(null)}
                />
            )}
```

주의: 배너는 상태 카드 근처가 이상적이지만, 모달 블록 앞(컨테이너 최하단)이 아니라
**페이지 상단 메시지 영역 바로 아래**에 넣는다 — 기존 `{msg && ...}` / `{err && ...}`
표시 블록을 찾아 그 아래 배치. (msg/err 블록이 return 최상단부에 있음.)

(b) `CookieInputModal`의 매장 ID 입력(~1141행) 라벨/placeholder 변경:

```jsx
                    <label className="block">
                        <span className="text-sm text-slate-700">매장 ID (선택)</span>
                        <input
                            type="text"
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value.replace(/\D/g, ''))}
                            placeholder="비워두면 자동 감지"
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                        />
                    </label>
```

- [ ] **Step 4: 빌드 확인**

Run: `cd SodamApp/frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx
git commit -m "feat(coupang): 쿠키 등록 결과 배너 — 검증 상태 표시 + 다중 매장 선택 + 매장ID 자동감지"
```

---

### Task 5: 프론트 — 수집 공백 원클릭 백필

**Files:**
- Modify: `SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx` — 상태 + `handleBackfillGap` 추가, Task 4 배너 배선의 `onBackfill={null}` 교체

**Interfaces:**
- Consumes: Task 4의 `cookieResult.last_success_sync_date`, `CookieResultBanner`의 `onBackfill`/`backfilling` props, 기존 `POST /coupang-eats/sync/manual` (91일 제한: `(end-start).days > 90` 이면 400)
- Produces: `handleBackfillGap()` — 공백을 91일 단위로 분할해 순차 sync 호출

- [ ] **Step 1: 구현**

(a) 상태 + 로컬 날짜 포맷터 추가 (`cookieResult` 상태 아래):

```jsx
    const [backfilling, setBackfilling] = useState(false);
```

기존 `ymd`(29행)는 `toISOString()` 기반이라 **UTC 변환으로 KST 자정~오전9시에 하루 밀린다**.
백필 날짜는 정확해야 하므로 로컬 포맷터를 컴포넌트 상단(`ymd` 정의 아래)에 추가:

```jsx
    const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

(b) `handleManualSync` 아래에 핸들러 추가:

```jsx
    // ─── 쿠키 재등록 후 공백 백필 ───
    async function handleBackfillGap() {
        if (!cookieResult?.last_success_sync_date) return;
        const start = new Date(cookieResult.last_success_sync_date + 'T00:00:00');
        start.setDate(start.getDate() + 1);
        const end = new Date();
        end.setDate(end.getDate() - 1);
        end.setHours(0, 0, 0, 0);
        if (start > end) return;

        setBackfilling(true);
        setErr('');
        try {
            let totalOrders = 0;
            let totalSales = 0;
            let chunkStart = new Date(start);
            while (chunkStart <= end) {
                // sync/manual 은 최대 91일(inclusive) — 90일 더한 날짜까지 한 청크
                const chunkEnd = new Date(Math.min(
                    end.getTime(),
                    chunkStart.getTime() + 90 * 24 * 3600 * 1000,
                ));
                const res = await api.post('/coupang-eats/sync/manual', {
                    start_date: ymdLocal(chunkStart),
                    end_date: ymdLocal(chunkEnd),
                    sync_orders: true,
                    sync_settlements: true,
                });
                totalOrders += res.data.orders?.fetched || 0;
                totalSales += res.data.total_sales || 0;
                chunkStart = new Date(chunkEnd.getTime() + 24 * 3600 * 1000);
            }
            showMsg(`백필 완료 — 주문 ${totalOrders}건, 매출 합계 ${fmtWon(totalSales)}원`);
            setCookieResult(null);
            await fetchAll();
            await fetchDashboard();
        } catch (e) {
            showErr('백필 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setBackfilling(false);
        }
    }
```

(c) Task 4에서 넣은 배너 배선 교체:

```jsx
                    onBackfill={handleBackfillGap}
                    backfilling={backfilling}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd SodamApp/frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add SodamApp/frontend/src/pages/CoupangEatsModuleDetail.jsx
git commit -m "feat(coupang): 쿠키 재등록 후 수집 공백 원클릭 백필 (91일 분할)"
```

---

### Task 6: 최종 검증 + 회귀 확인

**Files:**
- 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~5 전체

- [ ] **Step 1: 백엔드 관련 테스트 전체 실행**

Run: `cd SodamApp/backend && python -m pytest tests/test_coupang_eats_manual_cookies.py tests/test_coupang_eats_cookie_refresh.py tests/auto_collection_sync/test_normalizer_coupang_eats.py -v`
Expected: 전체 PASS

- [ ] **Step 2: 프론트 빌드 최종 확인**

Run: `cd SodamApp/frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: cURL 파서 수동 검증**

로컬 dev 서버(백엔드 8000 + 프론트 5173) 기동 후 쿠키 모달에서:
- bash 샘플: `curl 'https://store.coupangeats.com/api/v1/merchant/whoami' -H 'accept: application/json' -H 'cookie: unify-token=abc; bm_sz=def; _abck=ghi'` → "쿠키 3개 인식"
- cmd 샘플: `curl ^"https://store.coupangeats.com/api/v1/merchant/whoami^" -H ^"cookie: unify-token=abc; bm_sz=def^"` → "쿠키 2개 인식"
- cookie 헤더 없는 curl → "cookie 헤더를 찾지 못했습니다" 에러 표시

(등록 버튼까지는 누르지 않아도 됨 — 파서 동작만 확인. 실제 쿠팡 검증은 운영에서 실쿠키로 확인.)

- [ ] **Step 4: 커밋 여부 확인 후 마무리**

```bash
git status --short   # 잔여 변경 없어야 함
git log --oneline -6 # Task 1~5 커밋 확인
```
