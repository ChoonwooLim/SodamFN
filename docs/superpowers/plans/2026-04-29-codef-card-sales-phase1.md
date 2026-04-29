# CODEF Phase 1 — 인프라 + 카드 사업자 매출 자동수집 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CODEF 마이데이터 API로 14개 카드사 사업자 매출을 자동 적재. 후속 Phase 2~5가 공유할 인프라(connectedId·OAuth2·RSA·디스패처·UI 라벨·호출 카운터)를 함께 구축.

**Architecture:** spec § 4 — `services/codef/` 4개 서비스 + `routers/codef/` 3개 라우터 + Orbitron cron 23:30 KST. CODEF 공식 SDK `easycodefpy` 사용. `CardSalesApproval`/`CardPayment` 기존 모델에 `source` 컬럼 추가 + 신규 테이블 4개.

**Tech Stack:** Python 3.11+, FastAPI, SQLModel, PostgreSQL, `easycodefpy==0.5.0`, React+Vite, axios, Pretendard

**Spec:** [docs/superpowers/specs/2026-04-29-codef-card-sales-phase1-design.md](../specs/2026-04-29-codef-card-sales-phase1-design.md)

---

## File Structure

### 신규 백엔드 (12 파일)

```
SodamApp/backend/
├── services/codef/                              [신규 디렉토리]
│   ├── __init__.py                              # public exports
│   ├── exceptions.py                            # 표준 예외 5개
│   ├── codef_client.py                          # SDK 래퍼: OAuth2/RSA/HTTP/result code
│   ├── organization_catalog.py                  # 카드사·은행·공공 코드↔라벨↔인증정책
│   ├── connection_service.py                    # connectedId 발급/저장/재인증
│   ├── quota_service.py                         # 카운터/한도/쿨다운/예산 알림
│   └── card_provider.py                         # approval/billing/member-store 어댑터
├── routers/codef/                               [신규]
│   ├── __init__.py
│   ├── connections.py                           # /api/codef/connections
│   ├── card_sync.py                             # /api/codef/sync-cards
│   └── budget.py                                # /api/codef/budget
└── tasks/                                        [신규]
    ├── __init__.py
    └── codef_card_sync_task.py                  # cron core logic
```

### 기존 백엔드 변경 (4 파일)

- `models.py` — 신규 테이블 4개 + 기존 2개에 컬럼 4개씩 추가
- `database.py` — `_run_codef_phase1_migrations()` 가드 함수 추가
- `main.py` — 신규 라우터 3개 등록
- `requirements.txt` — `easycodefpy==0.5.0` 추가

### 신규 테스트 (8 파일)

```
SodamApp/backend/tests/codef/
├── __init__.py
├── conftest.py                                  # 픽스처 (mock SDK, test DB)
├── test_codef_client.py                         # RSA·result code 매핑
├── test_organization_catalog.py                 # 정책 조회
├── test_connection_service.py                   # 등록/재인증/해제
├── test_quota_service.py                        # 카운터/쿨다운/예산
├── test_card_provider.py                        # 적재 + 중복 처리
└── test_card_sync_router.py                     # 라우터 통합 테스트
```

### 신규 프론트엔드 (12 파일)

```
SodamApp/frontend/src/
├── pages/
│   ├── ExternalIntegration.jsx                  [신규]
│   └── CardModuleDetail.jsx                     [신규]
├── components/external-integration/             [신규 디렉토리]
│   ├── BudgetSummaryCard.jsx
│   ├── ModuleGrid.jsx
│   ├── CardModule.jsx
│   ├── CardConnectionList.jsx
│   ├── CardConnectionRegisterModal.jsx
│   ├── AdditionalAuthStep.jsx
│   ├── BudgetSettingsModal.jsx
│   └── SyncHistoryDrawer.jsx
└── components/revenue/
    └── SourceBadge.jsx                          [신규]
```

### 기존 프론트엔드 변경 (3-4 파일)

- `App.jsx` — 라우팅 2개 추가
- 사이드바 컴포넌트 — "🔌 외부 연동" 메뉴 추가
- `pages/revenue/` 또는 `pages/sales/` 의 헤더/테이블 컴포넌트 — 출처 배지·필터·동기화 버튼 추가

---

## 환경변수 사전 작업

이미 추가된 5개 (commit `9aae78fa`):
- `CODEF_ENV`, `CODEF_API_HOST`, `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_PUBLIC_KEY`

Phase 1에서 추가할 4개:
- `CRON_SHARED_SECRET` (32자 random)
- `CODEF_PRICE_TABLE` (JSON, 기본 `{}`)
- `CODEF_DEMO_DAILY_LIMIT` (기본 `100`)
- `NOTIFICATION_TEMPLATE_CODEF_EXPIRED` (팝빌 템플릿 검수 후)

---

# Phase 1A — DB 모델 + 마이그레이션 (Task 1-4)

## Task 1: 신규 모델 4개 추가

**Files:**
- Modify: `SodamApp/backend/models.py` (파일 끝에 신규 클래스 4개 추가)

- [ ] **Step 1: 모델 정의 (테스트 먼저 작성)**

테스트 파일 신규 작성: `SodamApp/backend/tests/codef/__init__.py` (빈 파일) + `SodamApp/backend/tests/codef/test_models.py`

```python
# tests/codef/test_models.py
import datetime
import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from models import CodefConnection, CardMerchant, CodefCallLog, CodefBudgetSetting, Business


@pytest.fixture
def engine():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    return e


@pytest.fixture
def biz(engine):
    with Session(engine) as s:
        b = Business(name="테스트사업장", business_number="1234567890")
        s.add(b)
        s.commit()
        s.refresh(b)
        return b.id


def test_codef_connection_create(engine, biz):
    with Session(engine) as s:
        c = CodefConnection(
            business_id=biz,
            organization_type="card",
            organization_code="0306",
            organization_label="신한카드",
            connected_id="abc123",
            auth_method="simple_auth",
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        assert c.id is not None
        assert c.status == "active"
        assert c.created_at is not None


def test_codef_connection_unique_per_business_org(engine, biz):
    """같은 business + organization_code + type 으로 중복 등록 금지"""
    with Session(engine) as s:
        c1 = CodefConnection(business_id=biz, organization_type="card",
                             organization_code="0306", organization_label="신한카드",
                             connected_id="x", auth_method="simple_auth")
        s.add(c1); s.commit()

        c2 = CodefConnection(business_id=biz, organization_type="card",
                             organization_code="0306", organization_label="신한카드",
                             connected_id="y", auth_method="id_pw")
        s.add(c2)
        with pytest.raises(Exception):
            s.commit()


def test_card_merchant_fee_rate(engine, biz):
    with Session(engine) as s:
        m = CardMerchant(business_id=biz, card_corp="신한카드",
                         merchant_id="MID001", fee_rate=0.018)
        s.add(m); s.commit(); s.refresh(m)
        assert m.fee_rate == 0.018
        assert m.source == "codef"
        assert m.status == "active"


def test_codef_call_log_record(engine, biz):
    with Session(engine) as s:
        log = CodefCallLog(
            business_id=biz,
            api_path="/v1/kr/card/common/b/approval",
            organization_code="0306",
            status="success",
            rows_returned=42,
            triggered_by="cron",
        )
        s.add(log); s.commit(); s.refresh(log)
        assert log.called_date == datetime.date.today()
        assert log.estimated_cost_krw is None  # DEMO


def test_codef_budget_setting_unique_per_business(engine, biz):
    with Session(engine) as s:
        b1 = CodefBudgetSetting(business_id=biz, monthly_budget_krw=50000)
        s.add(b1); s.commit()

        b2 = CodefBudgetSetting(business_id=biz, monthly_budget_krw=70000)
        s.add(b2)
        with pytest.raises(Exception):
            s.commit()
```

- [ ] **Step 2: Run tests to verify all FAIL**

Run: `cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/codef/test_models.py -v`
Expected: 4건 모두 FAIL — `ImportError: cannot import name 'CodefConnection'`

- [ ] **Step 3: models.py에 신규 모델 4개 추가 (파일 끝)**

```python
# models.py 파일 끝에 추가

class CodefConnection(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_conn_business_org", "business_id", "organization_code"),
        UniqueConstraint("business_id", "organization_code", "organization_type"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    organization_type: str = Field(index=True)
    organization_code: str = Field(index=True)
    organization_label: str
    connected_id: str
    auth_method: str
    status: str = Field(default="active", index=True)
    last_verified_at: Optional[datetime.datetime] = None
    last_failed_at: Optional[datetime.datetime] = None
    last_error_code: Optional[str] = None
    last_error_message: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    deactivated_at: Optional[datetime.datetime] = None


class CardMerchant(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", "merchant_id"),
        Index("ix_card_merchant_business_corp", "business_id", "card_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    merchant_id: str
    merchant_name: Optional[str] = None
    fee_rate: Optional[float] = None
    fee_rate_updated_at: Optional[datetime.datetime] = None
    registered_at: Optional[datetime.date] = None
    status: str = Field(default="active")
    source: str = Field(default="codef")
    last_synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class CodefCallLog(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_log_business_date", "business_id", "called_date"),
        Index("ix_codef_log_path_date", "api_path", "called_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
    api_path: str = Field(index=True)
    organization_code: Optional[str] = None
    called_date: datetime.date = Field(index=True, default_factory=datetime.date.today)
    called_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    status: str
    result_code: Optional[str] = None
    rows_returned: Optional[int] = None
    estimated_cost_krw: Optional[int] = None
    triggered_by: str
    triggered_user_id: Optional[int] = None


class CodefBudgetSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)
    monthly_budget_krw: int = Field(default=0)
    warning_threshold_pct: int = Field(default=80)
    hard_limit_pct: int = Field(default=100)
    last_warning_sent_at: Optional[datetime.datetime] = None
    last_hardlimit_sent_at: Optional[datetime.datetime] = None
    current_month_first_day: Optional[datetime.date] = None
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

`UniqueConstraint`/`Index` 가 import 되어 있는지 확인 (파일 상단). 없으면 `from sqlalchemy import Index, UniqueConstraint` 추가.

- [ ] **Step 4: Run tests to verify all PASS**

Run: `python -m pytest tests/codef/test_models.py -v`
Expected: 4건 PASS

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/models.py SodamApp/backend/tests/codef/__init__.py SodamApp/backend/tests/codef/test_models.py
git commit -m "feat(codef): CODEF Phase 1 신규 모델 4개 추가

- CodefConnection: connectedId 라이프사이클 (Phase 2-5 공유)
- CardMerchant: 가맹점 정보 + 수수료율
- CodefCallLog: 호출 카운터 + 비용 집계
- CodefBudgetSetting: 월 예산 + 임계값"
```

---

## Task 2: 기존 모델 2개 컬럼 추가 (CardSalesApproval, CardPayment)

**Files:**
- Modify: `SodamApp/backend/models.py:239-268`
- Modify: `SodamApp/backend/tests/codef/test_models.py` (테스트 추가)

- [ ] **Step 1: 테스트 추가 — source 컬럼 + connection_id FK 검증**

`tests/codef/test_models.py` 파일 끝에 추가:

```python
def test_card_sales_approval_default_source(engine, biz):
    from models import CardSalesApproval
    with Session(engine) as s:
        row = CardSalesApproval(
            business_id=biz,
            approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드",
            amount=15000,
        )
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "excel"  # 기존 행과 호환
        assert row.connection_id is None
        assert row.synced_at is None


def test_card_sales_approval_codef_source(engine, biz):
    from models import CardSalesApproval, CodefConnection
    with Session(engine) as s:
        c = CodefConnection(business_id=biz, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="x", auth_method="simple_auth")
        s.add(c); s.commit(); s.refresh(c)

        row = CardSalesApproval(
            business_id=biz,
            approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드",
            amount=15000,
            source="codef",
            connection_id=c.id,
            synced_at=datetime.datetime.utcnow(),
        )
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "codef"
        assert row.connection_id == c.id


def test_card_payment_source_columns(engine, biz):
    from models import CardPayment
    with Session(engine) as s:
        row = CardPayment(business_id=biz, payment_date=datetime.date(2026, 4, 29),
                          card_corp="삼성카드", net_deposit=120000)
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "excel"
        assert row.connection_id is None
```

- [ ] **Step 2: Run tests — FAIL (컬럼 없음)**

Run: `python -m pytest tests/codef/test_models.py::test_card_sales_approval_default_source -v`
Expected: FAIL with `AttributeError: 'CardSalesApproval' object has no attribute 'source'`

- [ ] **Step 3: models.py:239-268 수정 — 두 클래스에 컬럼 4개씩 추가**

`CardSalesApproval` 클래스 끝(`shop_name` 다음 줄)에:

```python
    source: str = Field(default="excel", index=True)
    source_meta: Optional[str] = None
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
    synced_at: Optional[datetime.datetime] = None
```

`CardPayment` 클래스 끝(`bank` 다음 줄)에 동일 4개 컬럼 추가.

- [ ] **Step 4: Run tests — PASS**

Run: `python -m pytest tests/codef/test_models.py -v`
Expected: 7건 모두 PASS (이전 4건 + 신규 3건)

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/models.py SodamApp/backend/tests/codef/test_models.py
git commit -m "feat(codef): CardSalesApproval/CardPayment 출처 추적 컬럼 추가

- source 컬럼 (default 'excel' — 기존 행 호환)
- source_meta (CODEF 응답 원본 JSON)
- connection_id (CodefConnection FK)
- synced_at (CODEF 적재 시각)"
```

---

## Task 3: 마이그레이션 함수 (auto-migration 가드)

**Files:**
- Modify: `SodamApp/backend/database.py`
- Test: `tests/codef/test_migration.py` (신규)

- [ ] **Step 1: 테스트 작성 (마이그레이션 idempotent 검증)**

```python
# tests/codef/test_migration.py
import os
import tempfile
import pytest
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text


@pytest.fixture
def temp_db(monkeypatch):
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{f.name}")
    yield f.name
    os.unlink(f.name)


def test_migration_idempotent(temp_db):
    """동일 마이그레이션을 2회 호출해도 ALTER TABLE 에러 없음"""
    from database import engine, _run_codef_phase1_migrations
    SQLModel.metadata.create_all(engine)

    _run_codef_phase1_migrations(engine)
    _run_codef_phase1_migrations(engine)  # 2회 호출


def test_migration_backfills_excel_source(temp_db):
    """기존 NULL source 행을 'excel'로 백필"""
    from database import engine, _run_codef_phase1_migrations
    from models import CardSalesApproval, Business
    import datetime

    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        # source 가 NULL 인 row 직접 INSERT (default 우회)
        s.execute(text(
            "UPDATE cardsalesapproval SET source = NULL"
        ))
        row = CardSalesApproval(business_id=b.id,
                                approval_date=datetime.date.today(),
                                card_corp="신한", amount=1000)
        s.add(row); s.commit()
        s.execute(text("UPDATE cardsalesapproval SET source = NULL"))
        s.commit()

    _run_codef_phase1_migrations(engine)

    with Session(engine) as s:
        result = s.execute(text("SELECT source FROM cardsalesapproval")).fetchall()
        assert all(r[0] == "excel" for r in result)
```

- [ ] **Step 2: Run — FAIL (`_run_codef_phase1_migrations` 미정의)**

Run: `python -m pytest tests/codef/test_migration.py -v`

- [ ] **Step 3: database.py 에 가드 함수 + 마이그레이션 추가**

`database.py` 끝에 추가:

```python
from sqlalchemy import text, inspect


def _column_exists(engine, table: str, column: str) -> bool:
    inspector = inspect(engine)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def _ensure_column(engine, table: str, column: str, ddl: str):
    if _column_exists(engine, table, column):
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _run_codef_phase1_migrations(engine):
    """CODEF Phase 1 마이그레이션 — idempotent.

    - cardsalesapproval, cardpayment 에 source/source_meta/connection_id/synced_at 추가
    - source NULL 행을 'excel' 로 백필
    """
    for table in ("cardsalesapproval", "cardpayment"):
        _ensure_column(engine, table, "source", "VARCHAR DEFAULT 'excel'")
        _ensure_column(engine, table, "source_meta", "TEXT")
        _ensure_column(engine, table, "connection_id", "INTEGER")
        _ensure_column(engine, table, "synced_at", "TIMESTAMP")
        with engine.begin() as conn:
            conn.execute(text(f"UPDATE {table} SET source = 'excel' WHERE source IS NULL"))
```

기존 `create_db_and_tables` 함수에서 호출:

```python
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _run_codef_phase1_migrations(engine)
```

- [ ] **Step 4: Run — PASS**

Run: `python -m pytest tests/codef/test_migration.py -v`
Expected: 2건 PASS

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/database.py SodamApp/backend/tests/codef/test_migration.py
git commit -m "feat(codef): Phase 1 auto-migration 가드 함수

- _ensure_column: ALTER TABLE ADD COLUMN idempotent
- _run_codef_phase1_migrations: cardsalesapproval/cardpayment 4컬럼씩 + 백필
- create_db_and_tables 끝에서 자동 호출"
```

---

## Task 4: requirements.txt + .env / Orbitron.yaml 추가 변수

**Files:**
- Modify: `SodamApp/backend/requirements.txt`
- Modify: `SodamApp/backend/.env`
- Modify: `SodamApp/backend/.env.example`
- Modify: `Orbitron.yaml`

- [ ] **Step 1: requirements.txt 에 easycodefpy 추가**

```bash
echo "easycodefpy==0.5.0" >> SodamApp/backend/requirements.txt
```

(Read tool로 파일 끝 위치 확인 후 Edit tool로 추가하는 게 안전)

- [ ] **Step 2: 의존성 설치 검증**

```bash
cd SodamApp/backend && pip install easycodefpy==0.5.0
python -c "from easycodefpy import Codef, ServiceType; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: backend/.env 에 추가 4 변수 추가**

`.env` 끝(CODEF 섹션 다음)에 추가:

```env

# ─────────────────────────────────────────────
# CODEF Phase 1 — 운영 변수
# ─────────────────────────────────────────────
CRON_SHARED_SECRET=<32자 random — Python: secrets.token_urlsafe(32)>
CODEF_PRICE_TABLE={}
CODEF_DEMO_DAILY_LIMIT=100
NOTIFICATION_TEMPLATE_CODEF_EXPIRED=
```

`CRON_SHARED_SECRET` 값 생성:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
출력값을 `.env` 에 직접 붙여넣음.

- [ ] **Step 4: .env.example 동기화**

`.env.example` 끝(CODEF 섹션 다음)에 placeholder 추가:

```env
# ─────────────────────────────────────────────
# CODEF Phase 1 — 운영 변수
# ─────────────────────────────────────────────
# CRON_SHARED_SECRET=         # 32자 random — Orbitron secrets 로 관리
# CODEF_PRICE_TABLE={}         # API별 단가 JSON, DEMO=빈 객체
# CODEF_DEMO_DAILY_LIMIT=100   # DEMO 일별 한도
# NOTIFICATION_TEMPLATE_CODEF_EXPIRED=  # 팝빌 알림톡 templateCode (검수 후)
```

- [ ] **Step 5: Orbitron.yaml 에 4 변수 추가**

`Orbitron.yaml` 의 backend env 마지막(CODEF 섹션 다음)에 추가:

```yaml
      # ─────────────────────────────────────────────
      # CODEF Phase 1 — 운영
      # ─────────────────────────────────────────────
      - key: CRON_SHARED_SECRET
        value: ""  # ⚠️ Orbitron Secrets 에 32자 random 등록
      - key: CODEF_PRICE_TABLE
        value: "{}"
      - key: CODEF_DEMO_DAILY_LIMIT
        value: "100"
      - key: NOTIFICATION_TEMPLATE_CODEF_EXPIRED
        value: ""  # ⚠️ 팝빌 알림톡 검수 후 templateCode 등록
```

- [ ] **Step 6: Commit**

```bash
git add SodamApp/backend/requirements.txt SodamApp/backend/.env.example Orbitron.yaml
# .env 는 gitignore 됨 — 커밋 X, 사용자 Orbitron secrets 별도 등록
git commit -m "infra(codef): Phase 1 운영 환경변수 4개 + easycodefpy 의존성

- CRON_SHARED_SECRET (cron 인증)
- CODEF_PRICE_TABLE (단가표, DEMO=빈)
- CODEF_DEMO_DAILY_LIMIT (100)
- NOTIFICATION_TEMPLATE_CODEF_EXPIRED (검수 후 입력)
- requirements.txt: easycodefpy==0.5.0"
```

---

# Phase 1B — 백엔드 인프라 (Task 5-13)

## Task 5: services/codef 디렉토리 + 표준 예외 5개

**Files:**
- Create: `SodamApp/backend/services/codef/__init__.py`
- Create: `SodamApp/backend/services/codef/exceptions.py`
- Create: `tests/codef/test_exceptions.py`

- [ ] **Step 1: 테스트 작성**

```python
# tests/codef/test_exceptions.py
import pytest
from services.codef.exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefRateLimited,
    CodefAPIError, CodefQuotaExceeded
)


def test_codef_auth_expired_carries_code():
    e = CodefAuthExpired(code="CF-12100", message="비밀번호 오류")
    assert e.code == "CF-12100"
    assert "비밀번호" in str(e)


def test_codef_additional_auth_carries_extra_info():
    e = CodefAdditionalAuth(method="sms", extra_info={"continue_token": "abc"})
    assert e.method == "sms"
    assert e.extra_info["continue_token"] == "abc"


def test_codef_rate_limited_default():
    e = CodefRateLimited()
    assert isinstance(e, Exception)


def test_codef_quota_exceeded():
    e = CodefQuotaExceeded(scope="daily", current=100, limit=100)
    assert e.scope == "daily"
    assert e.current == 100
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: 신규 파일들 생성**

`services/codef/__init__.py`:
```python
from .exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefRateLimited,
    CodefAPIError, CodefQuotaExceeded,
)

__all__ = [
    "CodefAuthExpired", "CodefAdditionalAuth", "CodefRateLimited",
    "CodefAPIError", "CodefQuotaExceeded",
]
```

`services/codef/exceptions.py`:
```python
"""CODEF 통합 표준 예외.

result.code 매핑은 codef_client.py 가 담당.
이 모듈은 예외 형태(carry data)만 정의.
"""
from typing import Optional


class CodefAuthExpired(Exception):
    """비밀번호/인증서 만료 — 사장님 재인증 필요."""
    def __init__(self, code: str = "", message: str = ""):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}" if code else message)


class CodefAdditionalAuth(Exception):
    """추가 본인확인 요구 — SMS 코드/캡차 등 추가 입력 필요."""
    def __init__(self, method: str = "sms", extra_info: Optional[dict] = None):
        self.method = method  # 'sms' | 'captcha' | 'email' | ...
        self.extra_info = extra_info or {}
        super().__init__(f"추가 본인확인 필요: {method}")


class CodefRateLimited(Exception):
    """CODEF 측 한도 초과 (429)."""
    pass


class CodefAPIError(Exception):
    """기타 CODEF API 에러."""
    def __init__(self, code: str = "", message: str = ""):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


class CodefQuotaExceeded(Exception):
    """셈하나 측 한도/예산 초과."""
    def __init__(self, scope: str, current: int, limit: int):
        self.scope = scope  # 'daily' | 'monthly_budget'
        self.current = current
        self.limit = limit
        super().__init__(f"{scope} 한도 초과: {current}/{limit}")
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/services/codef/ SodamApp/backend/tests/codef/test_exceptions.py
git commit -m "feat(codef): 표준 예외 5개 + services/codef 패키지 골격"
```

---

## Task 6: organization_catalog.py — 카드사·은행·공공 코드 매핑

**Files:**
- Create: `SodamApp/backend/services/codef/organization_catalog.py`
- Create: `tests/codef/test_organization_catalog.py`

- [ ] **Step 1: 테스트 작성 — 카드사 14개 + 인증정책 매핑**

```python
# tests/codef/test_organization_catalog.py
import pytest
from services.codef.organization_catalog import (
    get_organizations, get_organization, list_card_corps,
    AuthPolicy
)


def test_list_14_card_corps():
    cards = list_card_corps()
    assert len(cards) == 14
    codes = {c.code for c in cards}
    # CODEF 표준 카드사 코드 일부 검증
    assert "0306" in codes  # 신한
    assert "0301" in codes  # KB국민
    assert "0364" in codes  # 삼성
    assert "0365" in codes  # 현대


def test_get_organization_returns_label_and_policy():
    org = get_organization("0306")
    assert org.label == "신한카드"
    assert org.type == "card"
    assert AuthPolicy.SIMPLE_AUTH in org.auth_methods
    assert AuthPolicy.ID_PW in org.auth_methods


def test_get_organization_unknown_returns_none():
    assert get_organization("9999") is None


def test_card_corp_id_pw_only():
    """BC 같은 일부 카드사는 ID/PW만 지원"""
    org = get_organization("0361")  # BC
    assert AuthPolicy.ID_PW in org.auth_methods
    # 간편인증 미지원 카드사도 명시적으로 정책 표현
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: organization_catalog.py 작성**

```python
# services/codef/organization_catalog.py
"""CODEF 표준 organization 코드 ↔ 라벨 ↔ 인증정책 매핑.

CODEF API 호출 시 organization 파라미터로 사용. 환경(SANDBOX/DEMO/PRODUCT)
무관 동일 코드. 카드사·은행·공공 모두 같은 모듈에서 관리 — Phase 2~5에서 확장.

레퍼런스:
- https://developer.codef.io/api-info/organization-codes
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AuthPolicy(str, Enum):
    SIMPLE_AUTH = "simple_auth"  # 카카오/네이버/PASS 등
    ID_PW = "id_pw"
    CERT = "cert"  # 공동인증서


@dataclass(frozen=True)
class Organization:
    code: str
    label: str
    type: str  # 'card' | 'bank' | 'public_*'
    auth_methods: tuple[AuthPolicy, ...] = field(default_factory=tuple)


# 14개 카드사 — CODEF 카탈로그 기준
_CARDS: list[Organization] = [
    Organization("0301", "KB국민카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0302", "NH농협카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0303", "롯데카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0304", "씨티카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0305", "하나카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0306", "신한카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0307", "현대카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0309", "우리카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0361", "BC카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0364", "삼성카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0365", "광주카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0366", "수협카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0367", "제주카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0368", "IBK기업카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
]

# 전체 organization 인덱스 (Phase 2-5 에서 은행·공공 추가)
_ALL: dict[str, Organization] = {o.code: o for o in _CARDS}


def get_organizations() -> dict[str, Organization]:
    return dict(_ALL)


def get_organization(code: str) -> Optional[Organization]:
    return _ALL.get(code)


def list_card_corps() -> list[Organization]:
    return [o for o in _ALL.values() if o.type == "card"]
```

**참고**: 위 카드사 코드는 spec/llm-wiki 추정치. PoC 첫 단계(Task 28)에서 SANDBOX 호출로 실제 코드 검증 — 다르면 본 파일 정정.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/services/codef/organization_catalog.py SodamApp/backend/tests/codef/test_organization_catalog.py
git commit -m "feat(codef): 14개 카드사 organization 카탈로그 + 인증정책 매핑

AuthPolicy enum (SIMPLE_AUTH/ID_PW/CERT) + Organization 데이터클래스.
get_organization/list_card_corps 조회 API.
Phase 2~5에서 은행·공공 organization 같은 모듈에서 확장."
```

---

## Task 7: codef_client.py — SDK 래퍼

**Files:**
- Create: `SodamApp/backend/services/codef/codef_client.py`
- Create: `tests/codef/test_codef_client.py`
- Create: `tests/codef/conftest.py` (mock 픽스처)

- [ ] **Step 1: conftest.py 픽스처 작성**

```python
# tests/codef/conftest.py
import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_codef_sdk(monkeypatch):
    """easycodefpy.Codef 인스턴스 mock.

    SDK 호출을 가로채서 가짜 응답 반환 가능.
    """
    sdk = MagicMock()
    sdk.set_client_info = MagicMock()
    sdk.create_account = MagicMock()
    sdk.request_product = MagicMock()

    monkeypatch.setattr("services.codef.codef_client.Codef", lambda: sdk)
    return sdk


@pytest.fixture
def codef_env(monkeypatch):
    monkeypatch.setenv("CODEF_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("CODEF_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("CODEF_PUBLIC_KEY", "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...")
    monkeypatch.setenv("CODEF_ENV", "demo")
```

- [ ] **Step 2: codef_client 테스트 작성**

```python
# tests/codef/test_codef_client.py
import pytest
import json
from unittest.mock import MagicMock
from services.codef.codef_client import CodefClient
from services.codef.exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefRateLimited, CodefAPIError
)


def test_client_init_reads_env(codef_env, mock_codef_sdk):
    c = CodefClient()
    assert c.client_id == "test-client-id"
    assert c.env == "demo"
    mock_codef_sdk.set_client_info.assert_called_once_with("test-client-id", "test-secret")


def test_encrypt_password_returns_base64(codef_env, mock_codef_sdk):
    c = CodefClient()
    encrypted = c.encrypt_password("mypass123")
    assert isinstance(encrypted, str)
    assert len(encrypted) > 0
    assert encrypted != "mypass123"  # 암호화됨


def test_create_account_success(codef_env, mock_codef_sdk):
    mock_codef_sdk.create_account.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"connectedId": "abc-123"}
    })
    c = CodefClient()
    result = c.create_account({"organization": "0306", "id": "user", "password": "encrypted"})
    assert result.connected_id == "abc-123"


def test_create_account_additional_auth(codef_env, mock_codef_sdk):
    mock_codef_sdk.create_account.return_value = json.dumps({
        "result": {"code": "CF-03002", "message": "추가본인확인",
                   "extraInfo": {"reqType": "1"}},
        "data": {}
    })
    c = CodefClient()
    with pytest.raises(CodefAdditionalAuth) as exc:
        c.create_account({"organization": "0306", "id": "u", "password": "e"})
    assert exc.value.method  # SMS/captcha 자동 매핑


def test_request_product_auth_expired(codef_env, mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-12100", "message": "비밀번호가 일치하지 않음"},
        "data": {}
    })
    c = CodefClient()
    with pytest.raises(CodefAuthExpired) as exc:
        c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})
    assert exc.value.code == "CF-12100"


def test_request_product_rate_limited(codef_env, mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-00100", "message": "호출 한도 초과"},
        "data": {}
    })
    c = CodefClient()
    with pytest.raises(CodefRateLimited):
        c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: codef_client.py 구현**

```python
# services/codef/codef_client.py
"""CODEF SDK 저수준 래퍼.

책임:
- easycodefpy.Codef 인스턴스 관리 (싱글톤)
- 환경변수 → ServiceType 매핑 (SANDBOX/DEMO/PRODUCT)
- RSA 비번 암호화 (CODEF 요구사항)
- result.code → 표준 예외 매핑
- create_account / request_product 메서드 노출

SDK 응답은 JSON 문자열. 본 모듈에서 파싱 + 예외 변환.
"""
import json
import os
import base64
from dataclasses import dataclass
from typing import Optional

from easycodefpy import Codef, ServiceType
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

from .exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefRateLimited, CodefAPIError
)


@dataclass
class CreateAccountResult:
    connected_id: str
    raw: dict  # CODEF 원본 응답


@dataclass
class RequestProductResult:
    rows: list  # data 배열 또는 단일 객체
    raw: dict
    result_code: str
    rows_count: int


# result.code → 예외 매핑
_AUTH_EXPIRED_CODES = {"CF-12100", "CF-12101", "CF-12102", "CF-12410"}
_ADDITIONAL_AUTH_CODES = {"CF-03002", "CF-03012", "CF-03013"}
_RATE_LIMITED_CODES = {"CF-00100", "CF-09001"}
_SUCCESS_CODES = {"CF-00000"}


class CodefClient:
    def __init__(self):
        self.client_id = os.getenv("CODEF_CLIENT_ID", "")
        self.client_secret = os.getenv("CODEF_CLIENT_SECRET", "")
        self.public_key_pem = os.getenv("CODEF_PUBLIC_KEY", "")
        self.env = os.getenv("CODEF_ENV", "demo")
        self._sdk = Codef()
        self._sdk.set_client_info(self.client_id, self.client_secret)

    @property
    def service_type(self) -> ServiceType:
        return {
            "sandbox": ServiceType.SANDBOX,
            "demo": ServiceType.DEMO,
            "production": ServiceType.PRODUCT,
        }[self.env]

    def encrypt_password(self, plain: str) -> str:
        """RSA 공개키로 암호화 → base64 문자열.

        CODEF는 발급한 RSA-2048 공개키로 비번을 암호화한 값을 요구.
        """
        # PEM 형식이 아닌 raw base64일 수 있음 — wrap
        pem = self.public_key_pem
        if not pem.startswith("-----BEGIN"):
            pem = f"-----BEGIN PUBLIC KEY-----\n{pem}\n-----END PUBLIC KEY-----"

        public_key = serialization.load_pem_public_key(pem.encode("utf-8"))
        encrypted = public_key.encrypt(
            plain.encode("utf-8"),
            padding.PKCS1v15(),
        )
        return base64.b64encode(encrypted).decode("utf-8")

    def create_account(self, account_payload: dict) -> CreateAccountResult:
        """connectedId 발급. 추가본인확인 시 CodefAdditionalAuth."""
        raw_response = self._sdk.create_account(self.service_type, account_payload)
        data = self._parse(raw_response)
        self._maybe_raise(data)
        connected_id = data.get("data", {}).get("connectedId", "")
        if not connected_id:
            raise CodefAPIError(code="missing-connected-id", message="connectedId 없음")
        return CreateAccountResult(connected_id=connected_id, raw=data)

    def request_product(self, url: str, params: dict) -> RequestProductResult:
        raw_response = self._sdk.request_product(url, self.service_type, params)
        data = self._parse(raw_response)
        self._maybe_raise(data)
        rows = data.get("data", [])
        if isinstance(rows, dict):
            rows = [rows]
        return RequestProductResult(
            rows=rows,
            raw=data,
            result_code=data.get("result", {}).get("code", ""),
            rows_count=len(rows),
        )

    @staticmethod
    def _parse(raw_response) -> dict:
        if isinstance(raw_response, str):
            return json.loads(raw_response)
        return raw_response or {}

    @staticmethod
    def _maybe_raise(data: dict) -> None:
        result = data.get("result", {})
        code = result.get("code", "")
        message = result.get("message", "")

        if code in _SUCCESS_CODES or code == "":
            return
        if code in _AUTH_EXPIRED_CODES:
            raise CodefAuthExpired(code=code, message=message)
        if code in _ADDITIONAL_AUTH_CODES:
            extra = result.get("extraInfo", {})
            method = "sms" if "sms" in str(extra).lower() else "captcha"
            raise CodefAdditionalAuth(method=method, extra_info=extra)
        if code in _RATE_LIMITED_CODES:
            raise CodefRateLimited(message)
        if not code.startswith("CF-000"):  # 0000-0099 = 성공/조건부 성공
            raise CodefAPIError(code=code, message=message)
```

`cryptography` 패키지 의존성 확인:
```bash
pip install cryptography
```
(이미 셈하나에 popbill SDK 의존성으로 들어있을 가능성 — `requirements.txt` 확인 후 없으면 추가)

- [ ] **Step 5: Run — PASS**

Run: `python -m pytest tests/codef/test_codef_client.py -v`
Expected: 6건 PASS

- [ ] **Step 6: Commit**

```bash
git add SodamApp/backend/services/codef/codef_client.py SodamApp/backend/tests/codef/test_codef_client.py SodamApp/backend/tests/codef/conftest.py
git commit -m "feat(codef): SDK 래퍼 — OAuth2/RSA/result code 매핑

CodefClient 클래스:
- ServiceType (SANDBOX/DEMO/PRODUCT) 환경 매핑
- encrypt_password (RSA-2048 PKCS1v15)
- create_account / request_product
- result.code 분류:
  - 인증만료 → CodefAuthExpired
  - 추가본인확인 → CodefAdditionalAuth
  - 한도초과 → CodefRateLimited
  - 기타 → CodefAPIError"
```

---

## Task 8: connection_service.py — connectedId 라이프사이클

**Files:**
- Create: `SodamApp/backend/services/codef/connection_service.py`
- Create: `tests/codef/test_connection_service.py`

- [ ] **Step 1: 테스트 작성 — 등록/재인증/해제 시나리오**

```python
# tests/codef/test_connection_service.py
import pytest
import datetime
from unittest.mock import patch, MagicMock
from sqlmodel import Session, SQLModel, create_engine

from services.codef.connection_service import CodefConnectionService
from services.codef.codef_client import CreateAccountResult
from services.codef.exceptions import CodefAuthExpired, CodefAdditionalAuth
from models import CodefConnection, Business


@pytest.fixture
def db():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    yield e


@pytest.fixture
def biz_id(db):
    with Session(db) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        return b.id


@pytest.fixture
def svc(db):
    return CodefConnectionService(engine=db)


def test_register_card_id_pw(svc, biz_id):
    fake_client = MagicMock()
    fake_client.encrypt_password.return_value = "encrypted-pw"
    fake_client.create_account.return_value = CreateAccountResult(
        connected_id="conn-001", raw={}
    )
    with patch.object(svc, "_client", fake_client):
        conn = svc.register_card(
            business_id=biz_id,
            card_corp_code="0306",  # 신한
            auth_payload={"id": "myuser", "password": "mypass"},
        )
    assert conn.connected_id == "conn-001"
    assert conn.organization_label == "신한카드"
    assert conn.auth_method == "id_pw"
    assert conn.status == "active"


def test_register_card_unknown_corp(svc, biz_id):
    with pytest.raises(ValueError, match="알 수 없는 카드사"):
        svc.register_card(business_id=biz_id, card_corp_code="9999", auth_payload={})


def test_register_card_additional_auth_propagates(svc, biz_id):
    fake_client = MagicMock()
    fake_client.encrypt_password.return_value = "x"
    fake_client.create_account.side_effect = CodefAdditionalAuth(
        method="sms", extra_info={"continue_token": "tok-1"}
    )
    with patch.object(svc, "_client", fake_client):
        with pytest.raises(CodefAdditionalAuth) as exc:
            svc.register_card(business_id=biz_id, card_corp_code="0306",
                              auth_payload={"id": "u", "password": "p"})
        assert exc.value.method == "sms"


def test_reverify_updates_existing(svc, biz_id, db):
    # 먼저 expired 상태로 생성
    with Session(db) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="old", auth_method="id_pw", status="expired")
        s.add(c); s.commit(); s.refresh(c)
        cid = c.id

    fake_client = MagicMock()
    fake_client.encrypt_password.return_value = "x"
    fake_client.create_account.return_value = CreateAccountResult(
        connected_id="new-conn", raw={}
    )
    with patch.object(svc, "_client", fake_client):
        updated = svc.reverify(connection_id=cid,
                                auth_payload={"id": "u", "password": "p"})
    assert updated.connected_id == "new-conn"
    assert updated.status == "active"
    assert updated.last_verified_at is not None


def test_deactivate(svc, biz_id, db):
    with Session(db) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="x", auth_method="id_pw")
        s.add(c); s.commit(); s.refresh(c)
        cid = c.id

    svc.deactivate(connection_id=cid)
    with Session(db) as s:
        c = s.get(CodefConnection, cid)
        assert c.status == "deactivated"
        assert c.deactivated_at is not None


def test_list_active_filters_by_type(svc, biz_id, db):
    with Session(db) as s:
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0306", organization_label="신한",
                              connected_id="a", auth_method="id_pw", status="active"))
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0307", organization_label="현대",
                              connected_id="b", auth_method="id_pw", status="expired"))
        s.add(CodefConnection(business_id=biz_id, organization_type="bank",
                              organization_code="0004", organization_label="국민",
                              connected_id="c", auth_method="cert", status="active"))
        s.commit()

    cards = svc.list_active(business_id=biz_id, organization_type="card")
    assert len(cards) == 1  # 'expired'는 제외
    assert cards[0].organization_code == "0306"
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: connection_service.py 작성**

```python
# services/codef/connection_service.py
"""connectedId 라이프사이클 관리.

등록 / 재인증 / 해제 / 조회 + DB 동기화.
인증 페이로드를 받아 RSA 암호화 → CodefClient.create_account → DB 저장.

추가본인확인 발생 시 CodefAdditionalAuth 예외를 그대로 라우터로 전파 →
라우터가 SMS 코드 입력 폼을 띄움.
"""
import datetime
from typing import Optional
from sqlmodel import Session, select

from models import CodefConnection
from .codef_client import CodefClient
from .organization_catalog import get_organization, AuthPolicy
from .exceptions import CodefAdditionalAuth, CodefAuthExpired, CodefAPIError


class CodefConnectionService:
    def __init__(self, engine):
        self.engine = engine
        self._client = CodefClient()

    # ─── 등록 ───────────────────────────────────────

    def register_card(self, business_id: int, card_corp_code: str,
                      auth_payload: dict) -> CodefConnection:
        """auth_payload 형식:
        - ID/PW:    {"id": "...", "password": "..."}
        - 간편인증: {"identity": "...", "loginType": "kakao", ...}
        """
        org = get_organization(card_corp_code)
        if not org or org.type != "card":
            raise ValueError(f"알 수 없는 카드사: {card_corp_code}")

        sdk_payload, auth_method = self._build_account_payload(org, auth_payload)
        result = self._client.create_account(sdk_payload)
        return self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
            auth_method=auth_method,
        )

    def reverify(self, connection_id: int, auth_payload: dict) -> CodefConnection:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            org = get_organization(conn.organization_code)

        sdk_payload, auth_method = self._build_account_payload(org, auth_payload)
        result = self._client.create_account(sdk_payload)

        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            conn.connected_id = result.connected_id
            conn.auth_method = auth_method
            conn.status = "active"
            conn.last_verified_at = datetime.datetime.utcnow()
            conn.last_failed_at = None
            conn.last_error_code = None
            conn.last_error_message = None
            s.add(conn); s.commit(); s.refresh(conn)
            return conn

    def deactivate(self, connection_id: int) -> None:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            conn.status = "deactivated"
            conn.deactivated_at = datetime.datetime.utcnow()
            s.add(conn); s.commit()

    # ─── 조회 ───────────────────────────────────────

    def list_active(self, business_id: int, organization_type: str) -> list[CodefConnection]:
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.organization_type == organization_type,
                CodefConnection.status == "active",
            )
            return list(s.exec(stmt))

    def list_all(self, business_id: int,
                 organization_type: Optional[str] = None) -> list[CodefConnection]:
        """status 무관 — UI 에서 expired/failed 표시용."""
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.status != "deactivated",
            )
            if organization_type:
                stmt = stmt.where(CodefConnection.organization_type == organization_type)
            return list(s.exec(stmt))

    def mark_failed(self, connection_id: int, status: str,
                    error_code: str = "", error_message: str = ""):
        """카드 동기화 실패 시 connection 상태 갱신."""
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                return
            conn.status = status  # 'expired' | 'failed_2fa' | 'paused'
            conn.last_failed_at = datetime.datetime.utcnow()
            conn.last_error_code = error_code
            conn.last_error_message = error_message
            s.add(conn); s.commit()

    # ─── 내부 헬퍼 ──────────────────────────────────

    def _build_account_payload(self, org, auth_payload: dict) -> tuple[dict, str]:
        """SDK create_account 페이로드 빌드 + auth_method 결정."""
        if "password" in auth_payload:
            # ID/PW
            encrypted = self._client.encrypt_password(auth_payload["password"])
            payload = {
                "accountList": [{
                    "countryCode": "KR",
                    "businessType": "CD",  # 카드
                    "clientType": "B",  # 기업
                    "organization": org.code,
                    "loginType": "1",  # ID/PW
                    "id": auth_payload["id"],
                    "password": encrypted,
                }]
            }
            return payload, "id_pw"
        elif "loginType" in auth_payload and auth_payload["loginType"] in {
            "kakao", "naver", "pass", "toss", "payco", "samsung"
        }:
            payload = {
                "accountList": [{
                    "countryCode": "KR",
                    "businessType": "CD",
                    "clientType": "B",
                    "organization": org.code,
                    "loginType": "5",  # 간편인증
                    "loginTypeLevel": "1",
                    **auth_payload,  # identity, birthDate, telecom 등
                }]
            }
            return payload, "simple_auth"
        else:
            raise ValueError("auth_payload 가 ID/PW 또는 간편인증 형식이 아님")

    def _upsert_connection(self, business_id, organization, connected_id,
                           auth_method) -> CodefConnection:
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.organization_code == organization.code,
                CodefConnection.organization_type == organization.type,
            )
            existing = s.exec(stmt).first()
            if existing:
                existing.connected_id = connected_id
                existing.auth_method = auth_method
                existing.status = "active"
                existing.last_verified_at = datetime.datetime.utcnow()
                existing.last_failed_at = None
                existing.deactivated_at = None
                s.add(existing); s.commit(); s.refresh(existing)
                return existing
            conn = CodefConnection(
                business_id=business_id,
                organization_type=organization.type,
                organization_code=organization.code,
                organization_label=organization.label,
                connected_id=connected_id,
                auth_method=auth_method,
                status="active",
                last_verified_at=datetime.datetime.utcnow(),
            )
            s.add(conn); s.commit(); s.refresh(conn)
            return conn
```

- [ ] **Step 4: Run — PASS**

Expected: 6건 PASS

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/services/codef/connection_service.py SodamApp/backend/tests/codef/test_connection_service.py
git commit -m "feat(codef): connectedId 라이프사이클 서비스

CodefConnectionService:
- register_card: ID/PW 또는 간편인증 페이로드로 연결 등록
- reverify: 만료 후 재인증 (기존 row 갱신)
- deactivate: 사장님이 해제
- list_active / list_all / mark_failed
- _build_account_payload: SDK 페이로드 빌드 + auth_method 결정"
```

---

## Task 9: quota_service.py — 카운터/한도/쿨다운/예산

**Files:**
- Create: `SodamApp/backend/services/codef/quota_service.py`
- Create: `tests/codef/test_quota_service.py`

- [ ] **Step 1: 테스트 작성**

```python
# tests/codef/test_quota_service.py
import pytest
import datetime
import json
from unittest.mock import patch
from sqlmodel import Session, SQLModel, create_engine

from services.codef.quota_service import CodefQuotaService
from services.codef.exceptions import CodefQuotaExceeded
from models import CodefCallLog, CodefBudgetSetting, Business


@pytest.fixture
def db():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    yield e


@pytest.fixture
def biz_id(db):
    with Session(db) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        return b.id


@pytest.fixture
def svc(db, monkeypatch):
    monkeypatch.setenv("CODEF_DEMO_DAILY_LIMIT", "100")
    monkeypatch.setenv("CODEF_PRICE_TABLE", json.dumps({
        "/v1/kr/card/common/b/approval": 50,
        "/v1/kr/card/common/b/billing": 100,
    }))
    monkeypatch.setenv("CODEF_ENV", "demo")
    return CodefQuotaService(engine=db)


def test_record_call_inserts_log(svc, biz_id):
    svc.record_call(business_id=biz_id, connection_id=None,
                    api_path="/v1/kr/card/common/b/approval",
                    organization_code="0306",
                    status="success", rows=10, result_code="CF-00000",
                    triggered_by="cron")
    with Session(svc.engine) as s:
        logs = s.exec(__import__("sqlmodel").select(CodefCallLog)).all()
        assert len(logs) == 1
        assert logs[0].rows_returned == 10
        # DEMO 환경 → cost = 0
        assert logs[0].estimated_cost_krw == 0


def test_record_call_production_uses_price(svc, biz_id, monkeypatch):
    monkeypatch.setenv("CODEF_ENV", "production")
    svc2 = type(svc)(engine=svc.engine)
    svc2.record_call(business_id=biz_id, connection_id=None,
                     api_path="/v1/kr/card/common/b/approval",
                     organization_code="0306",
                     status="success", rows=10, result_code="CF-00000",
                     triggered_by="cron")
    with Session(svc.engine) as s:
        log = s.exec(__import__("sqlmodel").select(CodefCallLog)).first()
        assert log.estimated_cost_krw == 50


def test_check_before_call_demo_exceeds(svc, biz_id):
    # 100 회 success 기록
    for _ in range(100):
        svc.record_call(business_id=biz_id, connection_id=None,
                        api_path="/v1/kr/card/common/b/approval",
                        organization_code="0306", status="success",
                        rows=1, result_code="CF-00000", triggered_by="cron")
    with pytest.raises(CodefQuotaExceeded) as exc:
        svc.check_before_call(business_id=biz_id,
                              api_path="/v1/kr/card/common/b/approval")
    assert exc.value.scope == "daily"


def test_check_cooldown_enforces_5min(svc, biz_id):
    svc.record_call(business_id=biz_id, connection_id=None,
                    api_path="/v1/kr/card/common/b/approval",
                    organization_code="0306", status="success",
                    rows=1, result_code="CF-00000", triggered_by="user_button")
    with pytest.raises(CodefQuotaExceeded) as exc:
        svc.check_cooldown(business_id=biz_id, organization_code="0306",
                           api_path="/v1/kr/card/common/b/approval")
    assert exc.value.scope == "cooldown"


def test_current_month_summary(svc, biz_id):
    for path in ["/v1/kr/card/common/b/approval", "/v1/kr/card/common/b/billing"]:
        svc.record_call(business_id=biz_id, connection_id=None, api_path=path,
                        organization_code="0306", status="success", rows=5,
                        result_code="CF-00000", triggered_by="cron")
    summary = svc.current_month_summary(business_id=biz_id)
    assert summary["total_calls"] == 2
    # DEMO 환경이면 0, production 이면 가산
    assert summary["total_cost_krw"] >= 0
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: quota_service.py 구현**

```python
# services/codef/quota_service.py
"""호출 카운터 / 일별 한도 / 쿨다운 / 비용 / 월 예산 알림.

DEMO: 일별 100회 한도 (CODEF_DEMO_DAILY_LIMIT env)
PRODUCT: 월 예산 (CodefBudgetSetting 테이블) + 단가표 (CODEF_PRICE_TABLE env)
사용자 버튼: 카드사+API path 별 5분 쿨다운
"""
import datetime
import json
import os
from typing import Optional
from sqlmodel import Session, select, func

from models import CodefCallLog, CodefBudgetSetting
from .exceptions import CodefQuotaExceeded


COOLDOWN_MINUTES = 5


class CodefQuotaService:
    def __init__(self, engine):
        self.engine = engine

    # ─── 환경 설정 ─────────────────────────────────

    @property
    def demo_daily_limit(self) -> int:
        return int(os.getenv("CODEF_DEMO_DAILY_LIMIT", "100"))

    @property
    def price_table(self) -> dict:
        try:
            return json.loads(os.getenv("CODEF_PRICE_TABLE", "{}"))
        except json.JSONDecodeError:
            return {}

    @property
    def env(self) -> str:
        return os.getenv("CODEF_ENV", "demo")

    # ─── 호출 전 가드 ──────────────────────────────

    def check_before_call(self, business_id: int, api_path: str) -> None:
        if self.env == "demo":
            today = datetime.date.today()
            count = self._count_today(business_id, today)
            if count >= self.demo_daily_limit:
                raise CodefQuotaExceeded(scope="daily", current=count,
                                          limit=self.demo_daily_limit)
        elif self.env == "production":
            self._check_monthly_budget(business_id)

    def check_cooldown(self, business_id: int, organization_code: str,
                       api_path: str) -> None:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=COOLDOWN_MINUTES)
        with Session(self.engine) as s:
            stmt = select(CodefCallLog).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.organization_code == organization_code,
                CodefCallLog.api_path == api_path,
                CodefCallLog.called_at >= cutoff,
            ).limit(1)
            recent = s.exec(stmt).first()
            if recent:
                raise CodefQuotaExceeded(scope="cooldown", current=1, limit=0)

    # ─── 호출 후 기록 ──────────────────────────────

    def record_call(self, business_id: int, connection_id: Optional[int],
                    api_path: str, organization_code: str, status: str,
                    rows: int, result_code: str, triggered_by: str,
                    triggered_user_id: Optional[int] = None) -> None:
        cost = self._compute_cost(api_path)
        log = CodefCallLog(
            business_id=business_id,
            connection_id=connection_id,
            api_path=api_path,
            organization_code=organization_code,
            status=status,
            rows_returned=rows,
            result_code=result_code,
            estimated_cost_krw=cost,
            triggered_by=triggered_by,
            triggered_user_id=triggered_user_id,
        )
        with Session(self.engine) as s:
            s.add(log); s.commit()

    def _compute_cost(self, api_path: str) -> int:
        if self.env != "production":
            return 0
        return self.price_table.get(api_path, 0)

    # ─── 월 예산 ───────────────────────────────────

    def _check_monthly_budget(self, business_id: int) -> None:
        with Session(self.engine) as s:
            setting = s.exec(
                select(CodefBudgetSetting).where(
                    CodefBudgetSetting.business_id == business_id
                )
            ).first()
            if not setting or setting.monthly_budget_krw == 0:
                return  # 예산 미설정 = 무제한
            current_cost = self._sum_month_cost(s, business_id)
            hard_limit = setting.monthly_budget_krw * setting.hard_limit_pct // 100
            if current_cost >= hard_limit:
                raise CodefQuotaExceeded(scope="monthly_budget",
                                          current=current_cost,
                                          limit=hard_limit)

    def _sum_month_cost(self, session: Session, business_id: int) -> int:
        first_of_month = datetime.date.today().replace(day=1)
        stmt = select(func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0)).where(
            CodefCallLog.business_id == business_id,
            CodefCallLog.called_date >= first_of_month,
        )
        return session.exec(stmt).first() or 0

    # ─── 카운터 ────────────────────────────────────

    def _count_today(self, business_id: int, today: datetime.date) -> int:
        with Session(self.engine) as s:
            stmt = select(func.count(CodefCallLog.id)).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.called_date == today,
            )
            return s.exec(stmt).first() or 0

    # ─── 예산 알림 트리거 ──────────────────────────

    def check_budget_alerts(self, business_id: int) -> Optional[str]:
        """월 예산 임계값 도달 검사. 알림 트리거가 필요한 단계 반환:
        - 'warning': 80% 도달 (1회만 발송)
        - 'hardlimit': 100% 도달 (1회만 발송)
        - None: 임계 미도달 또는 이미 발송함
        """
        if self.env != "production":
            return None
        with Session(self.engine) as s:
            setting = s.exec(
                select(CodefBudgetSetting).where(
                    CodefBudgetSetting.business_id == business_id
                )
            ).first()
            if not setting or setting.monthly_budget_krw == 0:
                return None

            now = datetime.datetime.utcnow()
            first_of_month = datetime.date.today().replace(day=1)

            # 월 바뀌면 알림 추적 초기화
            if setting.current_month_first_day != first_of_month:
                setting.current_month_first_day = first_of_month
                setting.last_warning_sent_at = None
                setting.last_hardlimit_sent_at = None
                s.add(setting); s.commit()

            current = self._sum_month_cost(s, business_id)
            warning = setting.monthly_budget_krw * setting.warning_threshold_pct // 100
            hardlimit = setting.monthly_budget_krw * setting.hard_limit_pct // 100

            if current >= hardlimit and not setting.last_hardlimit_sent_at:
                setting.last_hardlimit_sent_at = now
                s.add(setting); s.commit()
                return "hardlimit"
            if current >= warning and not setting.last_warning_sent_at:
                setting.last_warning_sent_at = now
                s.add(setting); s.commit()
                return "warning"
            return None

    # ─── 대시보드 ──────────────────────────────────

    def current_month_summary(self, business_id: int) -> dict:
        first_of_month = datetime.date.today().replace(day=1)
        with Session(self.engine) as s:
            stmt = select(
                func.count(CodefCallLog.id),
                func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0),
            ).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.called_date >= first_of_month,
            )
            total_calls, total_cost = s.exec(stmt).first()

            # 카드사별 breakdown
            org_stmt = select(
                CodefCallLog.organization_code,
                func.count(CodefCallLog.id),
                func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0),
            ).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.called_date >= first_of_month,
            ).group_by(CodefCallLog.organization_code)
            by_org = [
                {"organization_code": row[0], "calls": row[1], "cost_krw": row[2]}
                for row in s.exec(org_stmt).all()
            ]

        return {
            "total_calls": total_calls or 0,
            "total_cost_krw": total_cost or 0,
            "by_organization": by_org,
            "first_of_month": first_of_month.isoformat(),
            "env": self.env,
            "demo_daily_limit": self.demo_daily_limit if self.env == "demo" else None,
        }
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/services/codef/quota_service.py SodamApp/backend/tests/codef/test_quota_service.py
git commit -m "feat(codef): 호출 한도/쿨다운/비용/월 예산 서비스

CodefQuotaService:
- check_before_call: DEMO 일별 100/PRODUCT 월 예산 가드
- check_cooldown: 카드사+API 별 5분 쿨다운
- record_call: CodefCallLog 적재 + 비용 산출
- check_budget_alerts: 80%/100% 임계 검사 (월별 1회 알림)
- current_month_summary: 대시보드용 집계"
```

---

## Task 10: card_provider.py — approval/billing/member-store 어댑터

**Files:**
- Create: `SodamApp/backend/services/codef/card_provider.py`
- Create: `tests/codef/test_card_provider.py`

본 Task가 가장 크다 (3개 API + 중복 처리). 단계 세분화.

- [ ] **Step 1: 테스트 작성 — approval 적재 + 중복 처리**

```python
# tests/codef/test_card_provider.py
import pytest
import datetime
from unittest.mock import patch, MagicMock
from sqlmodel import Session, SQLModel, create_engine, select

from services.codef.card_provider import CodefCardProvider
from services.codef.codef_client import RequestProductResult
from models import (
    CodefConnection, CardSalesApproval, CardPayment, CardMerchant,
    Business
)


@pytest.fixture
def db():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    yield e


@pytest.fixture
def biz_id(db):
    with Session(db) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        return b.id


@pytest.fixture
def conn(db, biz_id):
    with Session(db) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="conn-x", auth_method="id_pw")
        s.add(c); s.commit(); s.refresh(c)
        return c


@pytest.fixture
def provider(db, monkeypatch):
    monkeypatch.setenv("CODEF_DEMO_DAILY_LIMIT", "100")
    monkeypatch.setenv("CODEF_ENV", "demo")
    return CodefCardProvider(engine=db)


def test_sync_approval_inserts_codef_rows(provider, conn, db):
    fake_client = MagicMock()
    fake_client.request_product.return_value = RequestProductResult(
        rows=[
            {"approvedDate": "20260429", "approvedTime": "120130",
             "cardNo": "1234-****-5678", "approvalNo": "AP001",
             "amount": "15000", "installment": "00",
             "merchantName": "소담김밥 강남점", "status": "1"},
            {"approvedDate": "20260429", "approvedTime": "180530",
             "cardNo": "1234-****-5678", "approvalNo": "AP002",
             "amount": "8000", "installment": "00",
             "merchantName": "소담김밥 강남점", "status": "1"},
        ],
        raw={}, result_code="CF-00000", rows_count=2,
    )
    with patch.object(provider, "_client", fake_client):
        result = provider._sync_approval(conn, triggered_by="cron")
    assert result == 2
    with Session(db) as s:
        rows = s.exec(select(CardSalesApproval)).all()
        assert len(rows) == 2
        assert rows[0].source == "codef"
        assert rows[0].connection_id == conn.id
        assert rows[0].amount == 15000


def test_sync_approval_skips_duplicates(provider, conn, db):
    """이미 동일 (date, approval_number, card_corp) 행이 있으면 skip."""
    with Session(db) as s:
        s.add(CardSalesApproval(
            business_id=conn.business_id, approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드", approval_number="AP001", amount=15000, source="codef",
        ))
        s.commit()

    fake_client = MagicMock()
    fake_client.request_product.return_value = RequestProductResult(
        rows=[{"approvedDate": "20260429", "approvedTime": "120130",
               "approvalNo": "AP001", "amount": "15000", "installment": "00",
               "cardNo": "x", "merchantName": "m", "status": "1"}],
        raw={}, result_code="CF-00000", rows_count=1,
    )
    with patch.object(provider, "_client", fake_client):
        result = provider._sync_approval(conn, triggered_by="cron")
    assert result == 0  # 신규 0
    with Session(db) as s:
        assert len(s.exec(select(CardSalesApproval)).all()) == 1


def test_sync_approval_marks_excel_overridden(provider, conn, db):
    """동일 amount의 excel row 발견 시 source='excel_overridden'."""
    with Session(db) as s:
        s.add(CardSalesApproval(
            business_id=conn.business_id, approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드", approval_number="AP001", amount=15000, source="excel",
        ))
        s.commit()

    fake_client = MagicMock()
    fake_client.request_product.return_value = RequestProductResult(
        rows=[{"approvedDate": "20260429", "approvedTime": "120130",
               "approvalNo": "AP001", "amount": "15000", "installment": "00",
               "cardNo": "x", "merchantName": "m", "status": "1"}],
        raw={}, result_code="CF-00000", rows_count=1,
    )
    with patch.object(provider, "_client", fake_client):
        provider._sync_approval(conn, triggered_by="cron")

    with Session(db) as s:
        rows = s.exec(select(CardSalesApproval).order_by(CardSalesApproval.id)).all()
        assert len(rows) == 2
        assert rows[0].source == "excel_overridden"  # 기존 excel
        assert rows[1].source == "codef"             # 신규 codef


def test_sync_billing_inserts_payments(provider, conn, db):
    fake_client = MagicMock()
    fake_client.request_product.return_value = RequestProductResult(
        rows=[{"paymentDate": "20260415", "salesAmount": "1500000",
               "fee": "27000", "vatOnFees": "0",
               "netDeposit": "1473000", "depositBank": "신한은행"}],
        raw={}, result_code="CF-00000", rows_count=1,
    )
    with patch.object(provider, "_client", fake_client):
        provider._sync_billing(conn, triggered_by="cron")
    with Session(db) as s:
        rows = s.exec(select(CardPayment)).all()
        assert len(rows) == 1
        assert rows[0].source == "codef"
        assert rows[0].net_deposit == 1473000


def test_sync_member_store_upserts(provider, conn, db):
    fake_client = MagicMock()
    fake_client.request_product.return_value = RequestProductResult(
        rows=[{"merchantNo": "M001", "merchantName": "소담김밥 강남점",
               "feeRate": "1.8", "registeredDate": "20240101", "status": "Y"}],
        raw={}, result_code="CF-00000", rows_count=1,
    )
    with patch.object(provider, "_client", fake_client):
        provider._sync_member_store(conn, triggered_by="cron")
    with Session(db) as s:
        rows = s.exec(select(CardMerchant)).all()
        assert len(rows) == 1
        assert rows[0].fee_rate == 0.018
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: card_provider.py 구현**

```python
# services/codef/card_provider.py
"""카드 매출 어댑터.

CODEF /v1/kr/card/common/b/{approval,billing,member-store} 응답을
셈하나 모델 (CardSalesApproval, CardPayment, CardMerchant) 로 매핑·적재.

중복 처리 정책 (spec § 4.2 ④):
- unique key = (business_id, approval_date, approval_number, card_corp)
- 동일 amount 의 excel 행 → source='excel_overridden' 마킹
- 다른 amount → 둘 다 보존 (UI 차이 경고)
"""
import datetime
import json
from dataclasses import dataclass, field
from typing import Optional
from sqlmodel import Session, select

from models import (
    CodefConnection, CardSalesApproval, CardPayment, CardMerchant,
)
from .codef_client import CodefClient
from .quota_service import CodefQuotaService
from .connection_service import CodefConnectionService
from .organization_catalog import get_organization
from .exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefRateLimited, CodefAPIError,
    CodefQuotaExceeded,
)


APPROVAL_URL = "/v1/kr/card/common/b/approval"
BILLING_URL = "/v1/kr/card/common/b/billing"
MEMBER_STORE_URL = "/v1/kr/card/common/b/member-store"

DEFAULT_SYNC_MODES = frozenset({"approval", "billing", "member_store"})


@dataclass
class SyncResult:
    organization_code: str
    organization_label: str
    new_approvals: int = 0
    new_payments: int = 0
    new_merchants: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None


class CodefCardProvider:
    def __init__(self, engine):
        self.engine = engine
        self._client = CodefClient()
        self._quota = CodefQuotaService(engine)
        self._connections = CodefConnectionService(engine)

    def sync_one_connection(self, connection: CodefConnection,
                            sync_modes: Optional[set[str]] = None,
                            triggered_by: str = "cron",
                            triggered_user_id: Optional[int] = None) -> SyncResult:
        """카드사 1개 connection 풀 동기화.

        - sync_modes default = {approval, billing, member_store}
        - member_store 는 월 1회만 (오늘이 1일이거나 이전 동기화 없을 때)
        """
        modes = sync_modes or set(DEFAULT_SYNC_MODES)
        result = SyncResult(
            organization_code=connection.organization_code,
            organization_label=connection.organization_label,
        )

        try:
            if "approval" in modes:
                result.new_approvals = self._sync_approval(
                    connection, triggered_by, triggered_user_id
                )
            if "billing" in modes:
                result.new_payments = self._sync_billing(
                    connection, triggered_by, triggered_user_id
                )
            if "member_store" in modes and self._needs_member_store_refresh(connection):
                result.new_merchants = self._sync_member_store(
                    connection, triggered_by, triggered_user_id
                )
        except CodefAuthExpired as e:
            self._connections.mark_failed(connection.id, "expired",
                                           e.code, e.message)
            result.error = str(e)
            result.error_code = e.code
        except CodefAdditionalAuth as e:
            self._connections.mark_failed(connection.id, "failed_2fa",
                                           "", str(e))
            result.error = str(e)
            result.error_code = "additional_auth"
        except CodefRateLimited as e:
            result.error = "CODEF rate limited"
            result.error_code = "rate_limited"
        except CodefAPIError as e:
            result.error = str(e)
            result.error_code = e.code
        except CodefQuotaExceeded as e:
            result.error = str(e)
            result.error_code = f"quota_{e.scope}"

        return result

    # ─── /b/approval ───────────────────────────────

    def _sync_approval(self, conn: CodefConnection, triggered_by: str,
                       triggered_user_id: Optional[int] = None) -> int:
        self._quota.check_before_call(conn.business_id, APPROVAL_URL)
        params = self._build_period_params(conn, days_back=7)
        response = self._client.request_product(APPROVAL_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=APPROVAL_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_approvals(conn, response.rows)

    def _upsert_approvals(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                approval_date = self._parse_date(row.get("approvedDate"))
                approval_number = row.get("approvalNo", "").strip()
                amount = int(row.get("amount", 0))
                if not approval_number:
                    continue

                # 중복 검사
                stmt = select(CardSalesApproval).where(
                    CardSalesApproval.business_id == conn.business_id,
                    CardSalesApproval.approval_date == approval_date,
                    CardSalesApproval.approval_number == approval_number,
                    CardSalesApproval.card_corp == conn.organization_label,
                )
                existing = s.exec(stmt).all()

                if any(e.source == "codef" for e in existing):
                    continue  # 이미 CODEF 적재

                # excel 행 발견 — 동일 amount 면 overridden
                for e in existing:
                    if e.source == "excel" and e.amount == amount:
                        e.source = "excel_overridden"
                        s.add(e)

                new_row = CardSalesApproval(
                    business_id=conn.business_id,
                    approval_date=approval_date,
                    approval_time=row.get("approvedTime"),
                    card_corp=conn.organization_label,
                    card_number=row.get("cardNo"),
                    approval_number=approval_number,
                    amount=amount,
                    installment=row.get("installment"),
                    status="승인" if row.get("status") == "1" else "취소",
                    shop_name=row.get("merchantName"),
                    source="codef",
                    source_meta=json.dumps(row, ensure_ascii=False)[:1000],
                    connection_id=conn.id,
                    synced_at=datetime.datetime.utcnow(),
                )
                s.add(new_row)
                new_count += 1
            s.commit()
        return new_count

    # ─── /b/billing ────────────────────────────────

    def _sync_billing(self, conn: CodefConnection, triggered_by: str,
                      triggered_user_id: Optional[int] = None) -> int:
        self._quota.check_before_call(conn.business_id, BILLING_URL)
        params = self._build_period_params(conn, days_back=60)
        response = self._client.request_product(BILLING_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=BILLING_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_payments(conn, response.rows)

    def _upsert_payments(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                payment_date = self._parse_date(row.get("paymentDate"))
                net_deposit = int(row.get("netDeposit", 0))

                stmt = select(CardPayment).where(
                    CardPayment.business_id == conn.business_id,
                    CardPayment.payment_date == payment_date,
                    CardPayment.card_corp == conn.organization_label,
                    CardPayment.net_deposit == net_deposit,
                )
                existing = s.exec(stmt).all()
                if any(e.source == "codef" for e in existing):
                    continue
                for e in existing:
                    if e.source == "excel":
                        e.source = "excel_overridden"
                        s.add(e)

                new_row = CardPayment(
                    business_id=conn.business_id,
                    payment_date=payment_date,
                    card_corp=conn.organization_label,
                    sales_amount=int(row.get("salesAmount", 0)),
                    fees=int(row.get("fee", 0)),
                    vat_on_fees=int(row.get("vatOnFees", 0)),
                    net_deposit=net_deposit,
                    bank=row.get("depositBank"),
                    source="codef",
                    source_meta=json.dumps(row, ensure_ascii=False)[:1000],
                    connection_id=conn.id,
                    synced_at=datetime.datetime.utcnow(),
                )
                s.add(new_row)
                new_count += 1
            s.commit()
        return new_count

    # ─── /b/member-store ───────────────────────────

    def _needs_member_store_refresh(self, conn: CodefConnection) -> bool:
        """월 1회 호출. 이번 달 호출 이력 없으면 True."""
        first_of_month = datetime.date.today().replace(day=1)
        with Session(self.engine) as s:
            stmt = select(CardMerchant).where(
                CardMerchant.business_id == conn.business_id,
                CardMerchant.card_corp == conn.organization_label,
                CardMerchant.last_synced_at >= first_of_month,
            ).limit(1)
            return s.exec(stmt).first() is None

    def _sync_member_store(self, conn: CodefConnection, triggered_by: str,
                           triggered_user_id: Optional[int] = None) -> int:
        self._quota.check_before_call(conn.business_id, MEMBER_STORE_URL)
        params = {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
        }
        response = self._client.request_product(MEMBER_STORE_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=MEMBER_STORE_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_merchants(conn, response.rows)

    def _upsert_merchants(self, conn: CodefConnection, rows: list[dict]) -> int:
        upserted = 0
        with Session(self.engine) as s:
            for row in rows:
                mid = row.get("merchantNo", "").strip()
                if not mid:
                    continue
                fee_rate = self._parse_fee_rate(row.get("feeRate"))
                stmt = select(CardMerchant).where(
                    CardMerchant.business_id == conn.business_id,
                    CardMerchant.card_corp == conn.organization_label,
                    CardMerchant.merchant_id == mid,
                )
                existing = s.exec(stmt).first()
                if existing:
                    existing.merchant_name = row.get("merchantName") or existing.merchant_name
                    existing.fee_rate = fee_rate
                    existing.fee_rate_updated_at = datetime.datetime.utcnow()
                    existing.status = "active" if row.get("status") == "Y" else "suspended"
                    existing.last_synced_at = datetime.datetime.utcnow()
                    s.add(existing)
                else:
                    s.add(CardMerchant(
                        business_id=conn.business_id,
                        card_corp=conn.organization_label,
                        merchant_id=mid,
                        merchant_name=row.get("merchantName"),
                        fee_rate=fee_rate,
                        fee_rate_updated_at=datetime.datetime.utcnow(),
                        registered_at=self._parse_date(row.get("registeredDate")),
                        status="active" if row.get("status") == "Y" else "suspended",
                    ))
                upserted += 1
            s.commit()
        return upserted

    # ─── 헬퍼 ──────────────────────────────────────

    def _build_period_params(self, conn: CodefConnection, days_back: int) -> dict:
        end = datetime.date.today()
        start = end - datetime.timedelta(days=days_back)
        return {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start.strftime("%Y%m%d"),
            "endDate": end.strftime("%Y%m%d"),
        }

    @staticmethod
    def _parse_date(s: Optional[str]) -> Optional[datetime.date]:
        if not s:
            return None
        s = s.replace("-", "").replace("/", "")
        try:
            return datetime.datetime.strptime(s, "%Y%m%d").date()
        except ValueError:
            return None

    @staticmethod
    def _parse_fee_rate(s: Optional[str]) -> Optional[float]:
        if not s:
            return None
        try:
            v = float(s)
            return v / 100 if v > 1 else v  # "1.8" → 0.018, "0.018" → 0.018
        except (ValueError, TypeError):
            return None
```

- [ ] **Step 4: Run — PASS**

Run: `python -m pytest tests/codef/test_card_provider.py -v`
Expected: 5건 PASS

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/services/codef/card_provider.py SodamApp/backend/tests/codef/test_card_provider.py
git commit -m "feat(codef): 카드 매출 어댑터 — approval/billing/member-store

CodefCardProvider:
- sync_one_connection: 카드사 1개 연결 풀 동기화
- _sync_approval: /b/approval → CardSalesApproval (중복+excel_overridden)
- _sync_billing: /b/billing → CardPayment
- _sync_member_store: /b/member-store → CardMerchant (월 1회)
- _needs_member_store_refresh: 이번 달 동기화 이력 없을 때만"
```

---

# Phase 1C — 라우터 + cron (Task 11-15)

## Task 11: routers/codef/connections.py — 연결 등록 라우터

**Files:**
- Create: `SodamApp/backend/routers/codef/__init__.py`
- Create: `SodamApp/backend/routers/codef/connections.py`
- Create: `tests/codef/test_connections_router.py`

- [ ] **Step 1: 테스트 작성 (FastAPI TestClient)**

```python
# tests/codef/test_connections_router.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

# (헬퍼: 테스트 앱 + 인증 모킹)
@pytest.fixture
def client():
    from main import app
    return TestClient(app)


@pytest.fixture
def owner_token():
    # 셈하나 표준 — 실제 토큰 발급 또는 의존성 override
    # 셈하나 다른 라우터 테스트 패턴 참조 (auth.py)
    return "Bearer test-owner-token"


def test_get_connections_empty(client, owner_token):
    res = client.get("/api/codef/connections",
                     headers={"Authorization": owner_token})
    assert res.status_code == 200
    assert res.json() == {"connections": []}


def test_get_organizations_catalog(client, owner_token):
    res = client.get("/api/codef/organizations/catalog?type=card",
                     headers={"Authorization": owner_token})
    assert res.status_code == 200
    cards = res.json()["organizations"]
    assert len(cards) == 14
    codes = {c["code"] for c in cards}
    assert "0306" in codes


def test_register_card_id_pw(client, owner_token):
    with patch("routers.codef.connections.CodefConnectionService") as MockSvc:
        instance = MockSvc.return_value
        instance.register_card.return_value = MagicMockConn()
        res = client.post(
            "/api/codef/connections/register",
            json={
                "organization_type": "card",
                "organization_code": "0306",
                "auth": {"id": "user", "password": "pass"},
            },
            headers={"Authorization": owner_token},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"


def test_register_additional_auth_returns_pending(client, owner_token):
    """추가 본인확인 발생 시 connection 행은 pending 상태로 생성되고 verify 토큰 반환"""
    # ...


def test_delete_connection(client, owner_token):
    # ...
```

(테스트 픽스처는 셈하나 기존 라우터 테스트 패턴을 따름 — `tests/sales_guide/` 참조)

- [ ] **Step 2: connections.py 구현**

```python
# routers/codef/connections.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from auth import get_current_user_owner_or_admin, get_current_user_owner_only
from database import engine, get_session
from models import User, CodefConnection
from services.codef.connection_service import CodefConnectionService
from services.codef.organization_catalog import (
    get_organizations, list_card_corps, AuthPolicy
)
from services.codef.exceptions import (
    CodefAuthExpired, CodefAdditionalAuth, CodefAPIError
)


router = APIRouter(prefix="/api/codef", tags=["codef"])


class AuthIdPw(BaseModel):
    id: str
    password: str


class AuthSimpleAuth(BaseModel):
    loginType: str  # 'kakao' | 'naver' | 'pass' | ...
    identity: str
    birthDate: str
    telecom: Optional[str] = None


class RegisterRequest(BaseModel):
    organization_type: str  # 'card' for now
    organization_code: str
    auth: dict  # AuthIdPw | AuthSimpleAuth shape


class VerifyRequest(BaseModel):
    sms_code: Optional[str] = None
    captcha: Optional[str] = None
    extra: Optional[dict] = None


class ConnectionDTO(BaseModel):
    id: int
    organization_type: str
    organization_code: str
    organization_label: str
    auth_method: str
    status: str
    last_verified_at: Optional[str] = None
    last_failed_at: Optional[str] = None
    last_error_message: Optional[str] = None

    @classmethod
    def from_model(cls, c: CodefConnection):
        return cls(
            id=c.id, organization_type=c.organization_type,
            organization_code=c.organization_code,
            organization_label=c.organization_label,
            auth_method=c.auth_method, status=c.status,
            last_verified_at=c.last_verified_at.isoformat() if c.last_verified_at else None,
            last_failed_at=c.last_failed_at.isoformat() if c.last_failed_at else None,
            last_error_message=c.last_error_message,
        )


# ─── 카탈로그 (드롭다운용) ────────────────────────

@router.get("/organizations/catalog")
def get_catalog(type: Optional[str] = None,
                user: User = Depends(get_current_user_owner_or_admin)):
    orgs = get_organizations() if not type else {
        c: o for c, o in get_organizations().items() if o.type == type
    }
    return {
        "organizations": [
            {
                "code": o.code,
                "label": o.label,
                "type": o.type,
                "auth_methods": [m.value for m in o.auth_methods],
            }
            for o in orgs.values()
        ]
    }


# ─── 연결 CRUD ────────────────────────────────────

@router.get("/connections")
def list_connections(type: Optional[str] = None,
                     user: User = Depends(get_current_user_owner_or_admin)):
    svc = CodefConnectionService(engine=engine)
    conns = svc.list_all(business_id=user.business_id, organization_type=type)
    return {"connections": [ConnectionDTO.from_model(c).model_dump() for c in conns]}


@router.post("/connections/register")
def register(body: RegisterRequest, user: User = Depends(get_current_user_owner_only)):
    if body.organization_type != "card":
        raise HTTPException(400, f"Phase 1 은 'card' 만 지원 (got {body.organization_type})")
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.register_card(
            business_id=user.business_id,
            card_corp_code=body.organization_code,
            auth_payload=body.auth,
        )
    except CodefAdditionalAuth as e:
        # 추가본인확인 필요 — pending 상태로 임시 connection 만들지 않고
        # 클라이언트가 verify_token 으로 sms 코드 다시 호출하게 안내
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except (CodefAuthExpired, CodefAPIError, ValueError) as e:
        raise HTTPException(400, str(e))

    return {"status": "active", "connection": ConnectionDTO.from_model(conn).model_dump()}


@router.post("/connections/{cid}/verify")
def verify(cid: int, body: VerifyRequest,
           user: User = Depends(get_current_user_owner_only)):
    """SMS 코드/캡차 등 추가본인확인 응답 처리.

    구현 디테일: connection_service 가 in-memory continue_token 보관 →
    verify 호출 시 token + sms_code 합쳐 SDK 재호출.
    """
    # NOTE: easycodefpy 의 추가본인확인 흐름은 SDK 응답 형식에 따라 달라짐.
    # PoC 첫 실호출 (Task 33) 에서 SDK 응답 패턴 확인 후 본 메서드 보강.
    svc = CodefConnectionService(engine=engine)
    raise HTTPException(501, "추가본인확인 verify는 PoC 검증 후 구현 (Task 33)")


@router.post("/connections/{cid}/reverify")
def reverify(cid: int, body: RegisterRequest,
             user: User = Depends(get_current_user_owner_only)):
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.reverify(connection_id=cid, auth_payload=body.auth)
    except (CodefAuthExpired, CodefAPIError, ValueError) as e:
        raise HTTPException(400, str(e))
    except CodefAdditionalAuth as e:
        return {"status": "additional_auth_required", "method": e.method,
                "extra_info": e.extra_info}
    return {"status": "active", "connection": ConnectionDTO.from_model(conn).model_dump()}


@router.delete("/connections/{cid}")
def deactivate(cid: int, user: User = Depends(get_current_user_owner_only)):
    svc = CodefConnectionService(engine=engine)
    try:
        svc.deactivate(connection_id=cid)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"status": "deactivated"}
```

`routers/codef/__init__.py`:
```python
from . import connections, card_sync, budget

__all__ = ["connections", "card_sync", "budget"]
```

**참고**: `auth.py`의 `get_current_user_owner_or_admin` / `get_current_user_owner_only` 함수가 셈하나에 이미 있는지 확인 — 다른 이름이면 셈하나 기존 라우터(`routers/payroll.py` 등) 패턴 맞춰 수정.

- [ ] **Step 3: Run tests — PASS** (mock 통해)

- [ ] **Step 4: Commit**

```bash
git add SodamApp/backend/routers/codef/connections.py SodamApp/backend/routers/codef/__init__.py SodamApp/backend/tests/codef/test_connections_router.py
git commit -m "feat(codef): 연결 CRUD 라우터 + 카탈로그

GET  /api/codef/connections
POST /api/codef/connections/register
POST /api/codef/connections/{id}/verify
POST /api/codef/connections/{id}/reverify
DEL  /api/codef/connections/{id}
GET  /api/codef/organizations/catalog?type=card

추가본인확인 verify는 PoC 검증 후 구현 (Task 33 보강)"
```

---

## Task 12: routers/codef/card_sync.py — 동기화 라우터 + cron 인증

**Files:**
- Create: `SodamApp/backend/routers/codef/card_sync.py`
- Create: `SodamApp/backend/tasks/__init__.py`
- Create: `SodamApp/backend/tasks/codef_card_sync_task.py`
- Create: `tests/codef/test_card_sync_router.py`

- [ ] **Step 1: tasks/codef_card_sync_task.py 작성**

```python
# tasks/codef_card_sync_task.py
"""CODEF 카드 매출 자동 동기화 — cron + 수동 모두 사용.

Orbitron cron 이 매일 23:30 KST 에 /api/codef/sync-cards/run 호출 →
이 모듈의 run_card_sync_for_all_businesses 실행.

수동 트리거(/api/codef/sync-cards/manual)는 단일 business_id 한정으로
sync_business_cards 호출.
"""
from dataclasses import dataclass, field
from typing import Optional
from sqlmodel import Session, select

from database import engine
from models import CodefConnection
from services.codef.card_provider import CodefCardProvider, SyncResult
from services.codef.connection_service import CodefConnectionService
from services.codef.quota_service import CodefQuotaService


@dataclass
class BusinessSyncReport:
    business_id: int
    results: list[SyncResult] = field(default_factory=list)
    failed_count: int = 0
    total_new_approvals: int = 0
    total_new_payments: int = 0


@dataclass
class CronSummary:
    business_count: int = 0
    connection_count: int = 0
    total_new_approvals: int = 0
    total_new_payments: int = 0
    failed_business_ids: list[int] = field(default_factory=list)


def sync_business_cards(business_id: int, sync_modes: Optional[set[str]] = None,
                         triggered_by: str = "cron",
                         triggered_user_id: Optional[int] = None) -> BusinessSyncReport:
    """단일 business 의 모든 활성 카드 connection 동기화."""
    provider = CodefCardProvider(engine=engine)
    connections_svc = CodefConnectionService(engine=engine)
    conns = connections_svc.list_active(business_id=business_id,
                                          organization_type="card")
    report = BusinessSyncReport(business_id=business_id)
    for conn in conns:
        result = provider.sync_one_connection(
            conn, sync_modes=sync_modes,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        report.results.append(result)
        report.total_new_approvals += result.new_approvals
        report.total_new_payments += result.new_payments
        if result.error:
            report.failed_count += 1
    return report


def run_card_sync_for_all_businesses() -> CronSummary:
    """cron 핸들러 — 전 사업장 활성 카드 connection 순회."""
    summary = CronSummary()
    with Session(engine) as s:
        stmt = select(CodefConnection.business_id).where(
            CodefConnection.organization_type == "card",
            CodefConnection.status == "active",
        ).distinct()
        biz_ids = list(s.exec(stmt))

    summary.business_count = len(biz_ids)

    for biz_id in biz_ids:
        report = sync_business_cards(biz_id, triggered_by="cron")
        summary.connection_count += len(report.results)
        summary.total_new_approvals += report.total_new_approvals
        summary.total_new_payments += report.total_new_payments
        if report.failed_count > 0:
            summary.failed_business_ids.append(biz_id)
            # 사장님별 실패 합산 → 알림톡 1건 (Task 14에서 NotificationService 통합)
            _trigger_failure_notification(biz_id, report)

        # 월 예산 임계 검사
        quota = CodefQuotaService(engine=engine)
        alert = quota.check_budget_alerts(biz_id)
        if alert in {"warning", "hardlimit"}:
            _trigger_budget_alert(biz_id, alert)

    return summary


def _trigger_failure_notification(business_id: int, report: BusinessSyncReport):
    """Task 14에서 알림톡 통합 후 실제 발송. 현재는 TODO 로그."""
    failed_orgs = [r.organization_label for r in report.results if r.error]
    print(f"[TODO Task 14] business {business_id} 실패 카드사: {failed_orgs}")


def _trigger_budget_alert(business_id: int, alert_kind: str):
    """Task 14에서 알림톡 통합 후 실제 발송."""
    print(f"[TODO Task 14] business {business_id} 예산 알림: {alert_kind}")
```

- [ ] **Step 2: card_sync.py 라우터 작성**

```python
# routers/codef/card_sync.py
import os
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select, desc

from auth import get_current_user_owner_or_admin, get_current_user_owner_only
from database import engine
from models import User, CodefCallLog
from tasks.codef_card_sync_task import (
    run_card_sync_for_all_businesses, sync_business_cards
)


router = APIRouter(prefix="/api/codef/sync-cards", tags=["codef"])


def _check_cron_secret(x_cron_secret: str = Header(...)):
    expected = os.getenv("CRON_SHARED_SECRET", "")
    if not expected or x_cron_secret != expected:
        raise HTTPException(403, "invalid cron secret")
    return True


@router.post("/run")
def cron_run(_: bool = Depends(_check_cron_secret)):
    summary = run_card_sync_for_all_businesses()
    return {
        "ok": True,
        "summary": {
            "businesses": summary.business_count,
            "connections": summary.connection_count,
            "new_approvals": summary.total_new_approvals,
            "new_payments": summary.total_new_payments,
            "failed_business_ids": summary.failed_business_ids,
        }
    }


@router.post("/manual")
def manual_run(user: User = Depends(get_current_user_owner_only)):
    report = sync_business_cards(
        business_id=user.business_id,
        triggered_by="user_button",
        triggered_user_id=user.id,
    )
    return {
        "ok": True,
        "report": {
            "connections": len(report.results),
            "new_approvals": report.total_new_approvals,
            "new_payments": report.total_new_payments,
            "failed_count": report.failed_count,
            "results": [
                {
                    "organization_label": r.organization_label,
                    "new_approvals": r.new_approvals,
                    "new_payments": r.new_payments,
                    "new_merchants": r.new_merchants,
                    "error": r.error,
                }
                for r in report.results
            ],
        }
    }


@router.get("/history")
def history(days: int = 30, user: User = Depends(get_current_user_owner_or_admin)):
    import datetime
    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    with Session(engine) as s:
        stmt = select(CodefCallLog).where(
            CodefCallLog.business_id == user.business_id,
            CodefCallLog.called_date >= cutoff,
        ).order_by(desc(CodefCallLog.called_at))
        logs = s.exec(stmt).all()
    return {
        "history": [
            {
                "id": log.id,
                "called_at": log.called_at.isoformat(),
                "api_path": log.api_path,
                "organization_code": log.organization_code,
                "status": log.status,
                "rows_returned": log.rows_returned,
                "result_code": log.result_code,
                "estimated_cost_krw": log.estimated_cost_krw,
                "triggered_by": log.triggered_by,
            }
            for log in logs
        ]
    }
```

- [ ] **Step 3: 테스트 — cron secret 검증**

```python
# tests/codef/test_card_sync_router.py
def test_cron_run_rejects_wrong_secret(client, monkeypatch):
    monkeypatch.setenv("CRON_SHARED_SECRET", "real-secret")
    res = client.post("/api/codef/sync-cards/run",
                      headers={"X-Cron-Secret": "wrong"})
    assert res.status_code == 403


def test_cron_run_accepts_correct_secret(client, monkeypatch):
    monkeypatch.setenv("CRON_SHARED_SECRET", "real-secret")
    with patch("routers.codef.card_sync.run_card_sync_for_all_businesses") as mock:
        mock.return_value = MagicMock(business_count=0, connection_count=0,
                                       total_new_approvals=0, total_new_payments=0,
                                       failed_business_ids=[])
        res = client.post("/api/codef/sync-cards/run",
                          headers={"X-Cron-Secret": "real-secret"})
    assert res.status_code == 200
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/routers/codef/card_sync.py SodamApp/backend/tasks/ SodamApp/backend/tests/codef/test_card_sync_router.py
git commit -m "feat(codef): 카드 동기화 라우터 + cron 핸들러

POST /api/codef/sync-cards/run     — Orbitron cron (X-Cron-Secret 인증)
POST /api/codef/sync-cards/manual  — 사용자 버튼
GET  /api/codef/sync-cards/history — 최근 30일 이력

tasks/codef_card_sync_task.py:
- sync_business_cards: 단일 business 동기화
- run_card_sync_for_all_businesses: 전 사업장 cron 핸들러
- 실패/예산 알림은 Task 14 에서 알림톡 통합"
```

---

## Task 13: routers/codef/budget.py — 예산 + 비용 대시보드

**Files:**
- Create: `SodamApp/backend/routers/codef/budget.py`
- Create: `tests/codef/test_budget_router.py`

- [ ] **Step 1: budget.py 작성**

```python
# routers/codef/budget.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from auth import get_current_user_owner_or_admin, get_current_user_owner_only
from database import engine
from models import User, CodefBudgetSetting
from services.codef.quota_service import CodefQuotaService


router = APIRouter(prefix="/api/codef/budget", tags=["codef"])


class BudgetSettings(BaseModel):
    monthly_budget_krw: int = Field(ge=0)
    warning_threshold_pct: int = Field(default=80, ge=1, le=100)
    hard_limit_pct: int = Field(default=100, ge=1, le=200)


@router.get("/current")
def current(user: User = Depends(get_current_user_owner_or_admin)):
    quota = CodefQuotaService(engine=engine)
    summary = quota.current_month_summary(business_id=user.business_id)

    # settings도 함께
    with Session(engine) as s:
        setting = s.exec(
            select(CodefBudgetSetting).where(
                CodefBudgetSetting.business_id == user.business_id
            )
        ).first()

    return {
        **summary,
        "settings": {
            "monthly_budget_krw": setting.monthly_budget_krw if setting else 0,
            "warning_threshold_pct": setting.warning_threshold_pct if setting else 80,
            "hard_limit_pct": setting.hard_limit_pct if setting else 100,
        }
    }


@router.put("/settings")
def update_settings(body: BudgetSettings,
                     user: User = Depends(get_current_user_owner_only)):
    with Session(engine) as s:
        setting = s.exec(
            select(CodefBudgetSetting).where(
                CodefBudgetSetting.business_id == user.business_id
            )
        ).first()
        if not setting:
            setting = CodefBudgetSetting(business_id=user.business_id)
        setting.monthly_budget_krw = body.monthly_budget_krw
        setting.warning_threshold_pct = body.warning_threshold_pct
        setting.hard_limit_pct = body.hard_limit_pct
        import datetime
        setting.updated_at = datetime.datetime.utcnow()
        s.add(setting); s.commit(); s.refresh(setting)
    return {"ok": True}
```

- [ ] **Step 2: 테스트 (간단 — settings 저장/조회)**

```python
def test_get_current_returns_summary(client, owner_token):
    res = client.get("/api/codef/budget/current",
                     headers={"Authorization": owner_token})
    assert res.status_code == 200
    assert "total_calls" in res.json()


def test_update_settings(client, owner_token):
    res = client.put("/api/codef/budget/settings",
                     json={"monthly_budget_krw": 50000,
                           "warning_threshold_pct": 80,
                           "hard_limit_pct": 100},
                     headers={"Authorization": owner_token})
    assert res.status_code == 200
```

- [ ] **Step 3: Run — PASS**

- [ ] **Step 4: Commit**

```bash
git add SodamApp/backend/routers/codef/budget.py SodamApp/backend/tests/codef/test_budget_router.py
git commit -m "feat(codef): 예산 + 비용 대시보드 라우터

GET /api/codef/budget/current   — 이달 호출/비용 + settings
PUT /api/codef/budget/settings  — 월 예산/임계값 (owner only)"
```

---

## Task 14: main.py 라우터 등록 + 알림톡 통합

**Files:**
- Modify: `SodamApp/backend/main.py`
- Modify: `SodamApp/backend/tasks/codef_card_sync_task.py` (TODO 풀어 NotificationService 호출)

- [ ] **Step 1: main.py 에 라우터 3개 등록**

`main.py` 의 다른 라우터 등록 부분(보통 `from routers import ...` 다음에) 추가:

```python
from routers.codef import connections as codef_connections
from routers.codef import card_sync as codef_card_sync
from routers.codef import budget as codef_budget

app.include_router(codef_connections.router)
app.include_router(codef_card_sync.router)
app.include_router(codef_budget.router)
```

- [ ] **Step 2: tasks 에서 NotificationService 호출**

`tasks/codef_card_sync_task.py` 의 `_trigger_failure_notification`, `_trigger_budget_alert` 채우기:

```python
import os
import datetime
from services.notification_service import NotificationService


def _trigger_failure_notification(business_id: int, report: BusinessSyncReport):
    template_code = os.getenv("NOTIFICATION_TEMPLATE_CODEF_EXPIRED", "")
    if not template_code:
        # 템플릿 미검수 — graceful degradation, 화면 배지만 동작
        return

    failed = [r for r in report.results if r.error]
    if not failed:
        return

    # 한 사장님에게 한 번만 — 첫 실패 카드사로 메시지 구성
    primary = failed[0]
    notif = NotificationService()
    notif.send_alimtalk(
        business_id=business_id,
        template_code=template_code,
        variables={
            "card_corp": primary.organization_label,
            "reason": primary.error or "인증 만료",
            "occurred_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        },
    )


def _trigger_budget_alert(business_id: int, alert_kind: str):
    # PRODUCT 환경에서만 의미 — DEMO 단계에선 호출 안 됨
    template_code = os.getenv("NOTIFICATION_TEMPLATE_BUDGET_ALERT", "")
    if not template_code:
        return
    # 별도 템플릿 (codef_budget_warning / codef_budget_hardlimit)
    # Phase 1 PoC 에선 미사용 — DEMO 단계라 budget alert 발생 X
    pass
```

**중요**: `NotificationService.send_alimtalk` 의 실제 시그니처는 [services/notification_service.py](../../SodamApp/backend/services/notification_service.py) 확인 후 정합. 다르면 메서드명/파라미터 수정.

- [ ] **Step 3: 알림 발송 단위 테스트**

```python
# tests/codef/test_failure_notification.py
def test_failure_notif_skipped_when_template_missing(monkeypatch):
    monkeypatch.delenv("NOTIFICATION_TEMPLATE_CODEF_EXPIRED", raising=False)
    from tasks.codef_card_sync_task import _trigger_failure_notification, BusinessSyncReport
    from services.codef.card_provider import SyncResult
    report = BusinessSyncReport(business_id=1, results=[
        SyncResult(organization_code="0306", organization_label="신한카드",
                   error="비번 만료")
    ])
    # 예외 없이 silently skip
    _trigger_failure_notification(1, report)


def test_failure_notif_sends_alimtalk(monkeypatch):
    monkeypatch.setenv("NOTIFICATION_TEMPLATE_CODEF_EXPIRED", "TPL-001")
    with patch("tasks.codef_card_sync_task.NotificationService") as MockNotif:
        from tasks.codef_card_sync_task import _trigger_failure_notification, BusinessSyncReport
        from services.codef.card_provider import SyncResult
        report = BusinessSyncReport(business_id=1, results=[
            SyncResult(organization_code="0306", organization_label="신한카드",
                       error="비번 만료")
        ])
        _trigger_failure_notification(1, report)
        MockNotif.return_value.send_alimtalk.assert_called_once()
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/main.py SodamApp/backend/tasks/codef_card_sync_task.py SodamApp/backend/tests/codef/test_failure_notification.py
git commit -m "feat(codef): 라우터 3개 등록 + 알림톡 통합

main.py: connections/card_sync/budget 라우터 include
tasks: _trigger_failure_notification — NotificationService.send_alimtalk
graceful degradation: 템플릿 미검수 시 silently skip (화면 배지만 동작)"
```

---

## Task 15: 통합 검증 — 백엔드 부트 + 라우터 노출 확인

**Files:** (코드 변경 없음, 검증만)

- [ ] **Step 1: 백엔드 시작**

```bash
cd c:/WORK/SodamFN/SodamApp/backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Expected: 시작 로그에 라우터 등록 메시지

- [ ] **Step 2: OpenAPI 문서 확인**

브라우저: `http://localhost:8000/docs`
체크: `codef` 태그 아래 6개 엔드포인트 노출
- GET  /api/codef/connections
- POST /api/codef/connections/register
- POST /api/codef/connections/{cid}/verify
- POST /api/codef/connections/{cid}/reverify
- DELETE /api/codef/connections/{cid}
- GET  /api/codef/organizations/catalog
- POST /api/codef/sync-cards/run
- POST /api/codef/sync-cards/manual
- GET  /api/codef/sync-cards/history
- GET  /api/codef/budget/current
- PUT  /api/codef/budget/settings

- [ ] **Step 3: 카탈로그 호출**

```bash
curl http://localhost:8000/api/codef/organizations/catalog?type=card -H "Authorization: Bearer <admin token>"
```
Expected: `{"organizations": [...14개...]}`

- [ ] **Step 4: 마이그레이션 적용 확인**

```bash
psql $DATABASE_URL -c "\d cardsalesapproval" | grep -E "source|connection_id|synced_at"
```
Expected: 4개 컬럼 노출

- [ ] **Step 5: Commit (백엔드 통합 마커)**

```bash
git add -A  # 변경 파일 없으면 commit 생략
# 변경이 없으면 빈 commit 만들지 않고 다음 task로 진행
```

---

# Phase 1D — 알림톡 템플릿 등록 (사용자 액션 + Orbitron cron)

## Task 16: 카카오 알림톡 템플릿 등록 (사용자 액션)

코드 작업 아님 — 사용자가 진행. 본 task는 체크리스트 + 가이드.

- [ ] **Step 1: 팝빌 콘솔 접속**

URL: https://www.popbill.com → 로그인 → 알림톡 → 템플릿 관리

- [ ] **Step 2: 신규 템플릿 등록**

- 템플릿명: `codef_connection_expired`
- 카테고리: 정보성
- 본문:
```
[셈하나]
#{card_corp} 자동 매출 수집이 중단되었습니다.

▸ 사유: #{reason}
▸ 발생 시각: #{occurred_at}

매출 누락을 막기 위해 셈하나에 접속해서 재인증해 주세요.
https://sodamfn.twinverse.org/external-integration
```

- [ ] **Step 3: 카카오 검수 신청 → 영업일 2-3일 대기**

- [ ] **Step 4: 검수 통과 후 templateCode 환경변수 등록**

`.env`:
```
NOTIFICATION_TEMPLATE_CODEF_EXPIRED=<발급된 templateCode>
```

Orbitron secrets:
```
NOTIFICATION_TEMPLATE_CODEF_EXPIRED=<동일 값>
```

- [ ] **Step 5: 환경변수 반영 후 백엔드 재시작 → 발송 테스트**

```bash
# 의도적 실패 카드 등록 (잘못된 비번) → cron 트리거 → 알림톡 발송 확인
curl -X POST http://localhost:8000/api/codef/sync-cards/manual \
  -H "Authorization: Bearer <owner token>"
# 사장님 휴대폰에 알림톡 도착 확인
```

---

## Task 17: Orbitron cron 등록 (사용자 액션)

- [ ] **Step 1: Orbitron 대시보드 접속 → Cron Jobs → New Job**

- [ ] **Step 2: 설정 입력**

```
Name:     codef-card-sync-daily
Schedule: 30 23 * * *      (매일 23:30 KST)
Command:  curl -X POST https://sodamfn.twinverse.org/api/codef/sync-cards/run \
          -H "X-Cron-Secret: $CRON_SHARED_SECRET" \
          --max-time 600 \
          -f -s
Timeout:  10 min
Retry:    1회 (5분 후)
```

- [ ] **Step 3: `CRON_SHARED_SECRET` 등록**

Orbitron secrets 에 `python -c "import secrets; print(secrets.token_urlsafe(32))"` 로 생성한 값 등록.

- [ ] **Step 4: 첫 실행 검증**

내일 00:00 이후 Orbitron 대시보드 → Cron Jobs → codef-card-sync-daily → 실행 로그 확인.
Expected: HTTP 200 + summary JSON.

---

# Phase 1E — 프론트엔드 (Task 18-27)

## Task 18: SourceBadge 컴포넌트 (재사용)

**Files:**
- Create: `SodamApp/frontend/src/components/revenue/SourceBadge.jsx`

- [ ] **Step 1: 컴포넌트 작성 (단순 — 테스트 생략 가능)**

```jsx
// components/revenue/SourceBadge.jsx
import React from 'react';

const STYLES = {
  codef: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'CODEF',
    title: 'CODEF 자동 수집',
  },
  excel: {
    bg: 'bg-slate-200',
    text: 'text-slate-700',
    label: 'Excel',
    title: '엑셀 업로드',
  },
  manual: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    label: '수동',
    title: '직접 입력',
  },
  excel_overridden: {
    bg: 'bg-slate-100',
    text: 'text-slate-400 line-through',
    label: 'Excel',
    title: 'CODEF 자동 수집으로 대체됨',
  },
  popbill: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    label: '팝빌',
    title: '팝빌 발급',
  },
};

export default function SourceBadge({ source }) {
  const style = STYLES[source] || STYLES.manual;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
      title={style.title}
    >
      {style.label}
    </span>
  );
}
```

- [ ] **Step 2: Storybook 또는 페이지에서 시각 검증** (셈하나에 storybook 없으면 다음 task에서 실제 사용으로 검증)

- [ ] **Step 3: Commit**

```bash
git add SodamApp/frontend/src/components/revenue/SourceBadge.jsx
git commit -m "feat(codef): SourceBadge 컴포넌트 — 5개 출처 (codef/excel/manual/excel_overridden/popbill)"
```

---

## Task 19-26: 외부연동 hub 페이지 + 카드사 모듈 + 매출관리 변경

> 큰 프론트엔드 묶음 — 각 컴포넌트별 5단계 TDD 가 부담이라 핵심 코드만 명시. 셈하나 기존 React 패턴(useState + axios)을 따라간다는 가정.

### Task 19: 외부연동 Hub 페이지 셸 + 사이드바 메뉴

**Files:**
- Create: `pages/ExternalIntegration.jsx`
- Modify: `App.jsx` (라우팅)
- Modify: 사이드바 컴포넌트 ("🔌 외부 연동" 메뉴)

- [ ] hub 페이지: `BudgetSummaryCard` + `ModuleGrid` 레이아웃 (4섹션 5/5 와이어 따름)
- [ ] `App.jsx` 에 `<Route path="/external-integration" element={<ExternalIntegration />} />` 추가
- [ ] 사이드바 컴포넌트 (보통 `Layout.jsx` 또는 `Sidebar.jsx`)에 새 메뉴 추가
- [ ] `useState` + `axios.get('/api/codef/budget/current')` 로 BudgetSummary 데이터 fetch
- [ ] Commit

### Task 20: BudgetSummaryCard

**Files:** `components/external-integration/BudgetSummaryCard.jsx`

- [ ] 진행 바 2개 (호출 수, 비용) — `<progress>` 또는 div + width%
- [ ] DEMO 환경이면 비용 카드에 "DEMO 환경 (비용 0원)" 안내
- [ ] [예산 설정] 버튼 → BudgetSettingsModal 오픈
- [ ] Commit

### Task 21: ModuleGrid + 5개 모듈 placeholder

**Files:** `components/external-integration/ModuleGrid.jsx`, `CardModule.jsx`

- [ ] 5개 모듈 카드 그리드 (카드 / 계좌 / 4대보험 / 전자세금계산서 / 신분증)
- [ ] Phase 1 만 활성: `CardModule` — 활성 카드사 수 + 만료 알림 + [관리] CTA
- [ ] Phase 2~5 placeholder: 회색 카드 + "준비 중" + 클릭 시 모달
- [ ] Commit

### Task 22: 카드 매출 모듈 디테일 페이지

**Files:** `pages/CardModuleDetail.jsx`, `components/external-integration/CardConnectionList.jsx`

- [ ] `axios.get('/api/codef/connections?type=card')` 로 데이터 fetch (30초 폴링)
- [ ] 등록된 카드사 리스트: status 배지 + 마지막 수집 시각 + [재인증] [해제] 버튼
- [ ] [+ 카드사 등록] 버튼 → CardConnectionRegisterModal 오픈
- [ ] [최근 동기화 이력 보기] → SyncHistoryDrawer 오픈
- [ ] App.jsx 에 `<Route path="/external-integration/cards" element={<CardModuleDetail />} />`
- [ ] Commit

### Task 23: 카드사 등록 모달 (3단계 자동분기)

**Files:** `components/external-integration/CardConnectionRegisterModal.jsx`

- [ ] 1단계: 카드사 선택 드롭다운 (`axios.get('/api/codef/organizations/catalog?type=card')`)
- [ ] 카드사 선택 시 `auth_methods` 검사:
  - `simple_auth` 있으면 간편인증 버튼 4개 노출 (카카오/네이버/PASS/ID·PW)
  - `id_pw` only 면 ID/PW 폼만
- [ ] 2단계 — 간편인증: EasyCodef Connect 위젯 또는 `/api/codef/connections/register` POST 후 status 별 분기
- [ ] 2단계 — ID/PW: `<input type='text'>` + `<input type='password'>` + 안내 ("비번 RSA 즉시 폐기")
- [ ] POST 응답이 `additional_auth_required` 이면 `AdditionalAuthStep` 렌더
- [ ] Commit

### Task 24: AdditionalAuthStep — SMS/캡차 입력

**Files:** `components/external-integration/AdditionalAuthStep.jsx`

- [ ] SMS 코드 6자리 입력 폼 (또는 캡차 이미지 표시 + 입력)
- [ ] [확인] 버튼 → `/api/codef/connections/{id}/verify` POST
- [ ] 라우터 verify 가 PoC 검증 후 구현 예정 (Task 33) — 현재는 501 응답이라 임시 안내 메시지
- [ ] Commit

### Task 25: BudgetSettingsModal

**Files:** `components/external-integration/BudgetSettingsModal.jsx`

- [ ] 월 예산 입력 (숫자) + 80%/100% 임계값 슬라이더 또는 입력
- [ ] [저장] 버튼 → `PUT /api/codef/budget/settings`
- [ ] DEMO 환경 안내: "DEMO 단계에서는 예산이 적용되지 않으며 PRODUCT 전환 후 작동합니다"
- [ ] Commit

### Task 26: SyncHistoryDrawer

**Files:** `components/external-integration/SyncHistoryDrawer.jsx`

- [ ] 우측 drawer (`<aside>`), `axios.get('/api/codef/sync-cards/history?days=30')`
- [ ] 최근 30일 이력 — 카드사·시각·rows·status·triggered_by
- [ ] 색상: success 녹색 / failed 빨강 / rate_limited 주황
- [ ] Commit

### Task 27: 매출관리 페이지 변경

**Files:** `pages/revenue/...` (셈하나 기존 매출 페이지) + `components/revenue/SalesPageHeader.jsx`, `SalesTableRow.jsx`

- [ ] 페이지 헤더: "마지막 동기화: 3시간 전" + [지금 동기화] 버튼 → `POST /api/codef/sync-cards/manual` → toast + 테이블 refetch
- [ ] 출처 필터: 4개 토글 버튼 — state `[allOf 'codef','excel','manual']` 으로 row 필터
- [ ] SalesTableRow: `<SourceBadge source={row.source}>` + 차이 발견 시 ⚠️ 마커 (excel과 codef amount 다른 경우)
- [ ] 차이 클릭 시 툴팁 + "어느 것을 신뢰?" → API 호출로 source 변경 (별도 endpoint, Task 28에서 추가)
- [ ] Commit

---

# Phase 1F — 운영 검증 + 마무리 (Task 28-32)

## Task 28: source 신뢰 변경 API + UI

**Files:**
- Modify: `routers/finance.py` 또는 신규 `routers/codef/conflict.py`
- Modify: `components/revenue/SalesTableRow.jsx`

- [ ] 차이 발견 시 사장님이 한 쪽 신뢰 선택 endpoint
- [ ] `POST /api/codef/conflict/resolve {row_id, kept_source}` → 다른 source 행 비활성화
- [ ] 감사 로그 (별도 테이블 or DevWorkLog 활용)
- [ ] Commit

---

## Task 29: SANDBOX 환경 코드 검증

- [ ] **Step 1: `.env` 에 `CODEF_ENV=sandbox` 임시 전환**
- [ ] **Step 2: 단위 + 통합 테스트 모두 실행**
  ```bash
  cd SodamApp/backend && python -m pytest tests/codef/ -v
  ```
  Expected: 모든 테스트 PASS
- [ ] **Step 3: SANDBOX 가짜 응답으로 카드 등록 → 동기화 → 적재 풀 흐름 검증**
- [ ] **Step 4: `.env` 다시 `CODEF_ENV=demo` 로 복귀**

---

## Task 30: DEMO 1개 카드사 PoC (1주 운영)

- [ ] **Step 1: 소담김밥 신한카드 등록** (사장님이 외부연동 hub 에서)
- [ ] **Step 2: 즉시 [지금 동기화] 클릭 → 적재 결과 확인**
- [ ] **Step 3: 23:30 cron 자동 실행 검증** (다음날 아침)
- [ ] **Step 4: 7일 동안 매일 데이터 품질 비교** (Excel vs CODEF)
- [ ] **Step 5: 발견 이슈 → 별도 fix PR**

---

## Task 31: DEMO 4개 카드사 확장 (2주 운영)

- [ ] **Step 1: 신한 + 삼성 + 현대 + KB 등록**
- [ ] **Step 2: 다중 카드사 동시 운영, 다운/만료 감지·복구 흐름 검증**
- [ ] **Step 3: 알림톡 템플릿 검수 통과 후 실제 발송 테스트** (의도적 비번 오류 등록)
- [ ] **Step 4: 호출 카운터 / DEMO 한도 100 안에서 안전한지 검증**

---

## Task 32: 14개 전체 등록 + 운영 안정화

- [ ] **Step 1: 14개 카드사 모두 등록**
- [ ] **Step 2: 1개월 운영 후 PRODUCT 전환 결정**
  - 영업 견적 받음 → `CODEF_PRICE_TABLE` 업데이트
  - 사장님 월 예산 설정
  - `CODEF_ENV=production` 전환

---

## Self-Review

- [x] **Spec coverage**:
  - § 4 아키텍처 → Tasks 5-15
  - § 5 데이터 모델 → Tasks 1-3
  - § 6 백엔드 컴포넌트 → Tasks 5-15
  - § 7 프론트엔드 → Tasks 18-27
  - § 8 운영 (env/cron/템플릿/보안/한도/롤아웃) → Tasks 4, 16-17, 28-32
  - § 9 리스크 → Tasks 29-32 (PoC 단계로 검증)
- [x] **Placeholders**: 본 plan 의 "TODO Task 14" 는 실제 내부 단계 마커, 외부 placeholder 아님. § Task 14 에서 채움.
- [x] **Type consistency**: `SyncResult`, `BusinessSyncReport`, `CronSummary` 일관 사용. `CodefConnection.organization_label` 일관. `auth_method` 'simple_auth' / 'id_pw' / 'cert' 일관.
- [x] **알림톡 템플릿명**: `codef_connection_expired` 일관 (spec 6.8 + Task 14 + Task 16).
- [x] **라우터 경로**: 모든 task 일관 (`/api/codef/connections`, `/api/codef/sync-cards`, `/api/codef/budget`).

---

## Task 33 (보강): 추가본인확인 verify 흐름 PoC 검증 후 구현

Task 11에서 501로 남겨둔 `POST /api/codef/connections/{id}/verify` 는 실제 SDK 응답 패턴 확인 후 구현. PoC Task 30 단계에서 신한카드 등 실제 카드사가 SMS 코드 요구하는지 관찰 후, 그때 다음을 구현:

- [ ] easycodefpy 의 추가본인확인 응답 형식 분석
- [ ] connectedId 발급 흐름의 continue_token 또는 secondAccount 패턴 적용
- [ ] verify 라우터 채워넣고 단위테스트 추가
- [ ] AdditionalAuthStep 프론트엔드 호출 안내 메시지 정상화

---

## 예상 기간 종합

| Phase | Tasks | 기간 |
|---|---|---|
| 1A. DB 모델 + 마이그레이션 | 1-4 | 1.5일 |
| 1B. 백엔드 인프라 (client/connection/quota/provider) | 5-10 | 4-5일 |
| 1C. 라우터 + cron + 알림 | 11-15 | 2일 |
| 1D. 알림톡 템플릿 등록 | 16-17 | 사용자 액션 (영업일 2-3일 대기) |
| 1E. 프론트엔드 | 18-27 | 4-5일 |
| 1F. 운영 검증 (SANDBOX → DEMO 1 → 4 → 14) | 28-32 | 1+1+2주 |
| 1G. 추가본인확인 verify 보강 | 33 | PoC 결과 보고 (1-2일) |

**코드 작업**: ~12-13일
**PoC 운영**: 4주
**총**: 약 6주 (Phase 1 완료까지)

이후 Phase 2 (계좌 거래내역) brainstorm 시작.
