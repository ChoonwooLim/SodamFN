# 자동수집 → 손익반영 파이프라인 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EasyPOS + 쿠팡이츠 + 은행 자동수집 데이터를 분류 기반 fan-out 으로 `DailyExpense` 까지 자동 연결하고, 카드/배달 수수료 자동 추정과 입금 모니터링까지 한 파이프라인에 흡수한다.

**Architecture:** spec §3 — 옵션 3 (분류 기반 fan-out). 채널별 normalizer 가 raw → `SyncEvent` 표준 DTO 만 변환, `fan_out.py` 가 일괄 upsert 책임. 기존 `bank_sync._sync_classified_to_models` 패턴 확장.

**Tech Stack:** Python 3.11+, FastAPI, SQLModel, PostgreSQL, pytest (SQLite in-memory), React+Vite, Telegram Bot API (기존 인프라).

**Spec:** [docs/superpowers/specs/2026-05-13-auto-collection-pipeline-design.md](../specs/2026-05-13-auto-collection-pipeline-design.md)

---

## File Structure

### 신규 백엔드 (15 파일)

```
SodamApp/backend/
├── services/auto_collection_sync/                  [신규 디렉토리]
│   ├── __init__.py
│   ├── orchestrator.py                              # cron 진입점
│   ├── sync_event.py                                # SyncEvent 표준 DTO
│   ├── fan_out.py                                   # SyncEvent → DailyExpense fan-out
│   ├── vendor_resolver.py                           # vendor_lookup_key → Vendor.id
│   ├── fee_estimator.py                             # 카드/배달 수수료 자동 추정
│   ├── migration.py                                 # 마이그레이션 B 정책
│   ├── settlement_watch.py                          # 입금 모니터링 (카드/배달)
│   ├── calendar.py                                  # 한국 영업일 캘린더
│   └── normalizers/
│       ├── __init__.py
│       ├── easypos.py
│       ├── coupang_eats.py
│       └── bank.py
├── routers/
│   └── auto_collection.py                           # 8개 cron + 대시보드 + 마이그 endpoint
└── scripts/migrations/
    └── migrate_auto_collection_pipeline.py          # DB 마이그레이션 ad-hoc
```

### 기존 백엔드 변경 (7 파일)

- `models.py` — 신규 테이블 4개 + 기존 2개 컬럼 추가
- `routers/bank_sync.py` — `_sync_classified_to_models` 리팩토링 (SyncEvent emit)
- `services/easypos_service.py` — `upsert_revenue_aggregate` 유지 + normalizer 호출 추가
- `services/coupang_eats_service.py` — 정산 분해 저장 추가
- `services/profit_loss_service.py` — `expense_card_fee`/`expense_delivery_fee` 산출을 fee_estimator로 교체
- `routers/revenue.py` — source 필터/뱃지
- `routers/profitloss.py` — 신뢰도 뱃지 표시

### 신규 테스트 (10 파일)

```
SodamApp/backend/tests/auto_collection_sync/
├── __init__.py
├── conftest.py                                      # 픽스처 (raw 데이터 헬퍼)
├── test_sync_event.py
├── test_fan_out.py
├── test_vendor_resolver.py
├── test_normalizer_easypos.py
├── test_normalizer_coupang_eats.py
├── test_normalizer_bank.py
├── test_fee_estimator.py
├── test_migration.py
├── test_settlement_watch.py
├── test_calendar.py
└── test_orchestrator.py
```

### 신규 프론트엔드 (3 파일)

```
SodamApp/frontend/src/pages/
└── AutoCollection/
    ├── index.jsx                                    # 자동수집 대시보드
    ├── SettlementWatch.jsx                          # 입금 모니터 카드
    └── MigrationModal.jsx                           # 백필 실행 다이얼로그
```

### 인프라 (1 파일)

- `Orbitron.yaml` — 8개 cron 등록

---

## Task 1 — 데이터 모델 변경 + 마이그레이션 SQL

**Files:**
- Modify: `SodamApp/backend/models.py`
- Create: `SodamApp/backend/scripts/migrations/migrate_auto_collection_pipeline.py`
- Test: `SodamApp/backend/tests/auto_collection_sync/test_models.py`

### Step 1.1 — `DailyExpense` source 컬럼 + 신규 테이블 5개 모델 작성

- [ ] Edit `models.py` — `DailyExpense` 에 `source`, `source_meta` 추가:

```python
class DailyExpense(SQLModel, table=True):
    __table_args__ = (
        Index("ix_dailyexpense_business_date", "business_id", "date"),
        Index("ix_dailyexpense_business_vendor", "business_id", "vendor_id"),
        UniqueConstraint(
            "business_id", "date", "vendor_id", "payment_method", "source",
            name="uq_dailyexpense_natural",
        ),
    )
    # ... 기존 필드 ...
    source: str = Field(default="manual", index=True)
    source_meta: Optional[str] = None
```

- [ ] Add 신규 테이블 `CardFeeRateLearned`, `CardFeeMatchLog`, `DeliveryFeeRate`, `SettlementWatchAlert`, `CardCorpSettlementProfile` (spec § 4, § 6, § 8 의 클래스 정의 그대로):

```python
class CardFeeRateLearned(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", name="uq_cardfee_business_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    learned_rate: float
    sample_size: int
    sample_period_start: datetime.date
    sample_period_end: datetime.date
    confidence: float
    last_updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    notes: Optional[str] = None


class CardFeeMatchLog(SQLModel, table=True):
    __table_args__ = (
        Index("ix_cardfeematchlog_biz_corp", "business_id", "card_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    deposit_date: datetime.date
    approval_dates_start: datetime.date
    approval_dates_end: datetime.date
    sales_amount: int
    deposit_amount: int
    effective_fee: int
    effective_rate: float
    matched_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class DeliveryFeeRate(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint(
            "business_id", "channel", "effective_from",
            name="uq_deliveryfeerate_business_channel_from",
        ),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    channel: str = Field(index=True)
    rate: float
    effective_from: datetime.date
    effective_to: Optional[datetime.date] = None
    notes: Optional[str] = None
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class SettlementWatchAlert(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint(
            "business_id", "alert_type", "channel_or_corp", "expected_date",
            name="uq_settle_watch_natural",
        ),
        Index("ix_settle_watch_biz_status", "business_id", "status"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    alert_type: str = Field(index=True)
    channel_or_corp: str
    expected_date: datetime.date
    expected_amount: int
    deadline: datetime.date
    status: str = Field(default="open", index=True)
    notified_at: Optional[datetime.datetime] = None
    received_amount: Optional[int] = None
    received_date: Optional[datetime.date] = None
    acknowledged_at: Optional[datetime.datetime] = None
    acknowledged_by: Optional[int] = Field(default=None, foreign_key="user.id")
    notes: Optional[str] = None
    raw_ref: Optional[str] = None


class CardCorpSettlementProfile(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp",
                         name="uq_cardcorpsettle_business_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    settlement_days_learned: int = 3
    grace_days: int = 3
    sample_size: int = 0
    last_updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
```

- [ ] Add `CoupangEatsSettlement` 분해 컬럼 (`total_sales`, `fee_brokerage`, `fee_payment`, `fee_delivery`, `fee_advertising`, `fee_membership`, `fee_other`, `deduction_etc`).

- [ ] Add `SubscriptionPlan` 플래그 두 개:

```python
class SubscriptionPlan(SQLModel, table=True):
    # ... 기존 ...
    feature_auto_collection: bool = Field(default=False)
    feature_fee_auto_estimate: bool = Field(default=False)
```

### Step 1.2 — 테이블 생성 테스트 (TDD)

- [ ] Create `tests/auto_collection_sync/__init__.py` (빈 파일).
- [ ] Create `tests/auto_collection_sync/test_models.py`:

```python
def test_dailyexpense_has_source_column(session):
    from models import DailyExpense
    cols = DailyExpense.__table__.columns
    assert "source" in cols
    assert cols["source"].default.arg == "manual"

def test_dailyexpense_unique_constraint(session):
    from models import DailyExpense
    constraints = [c.name for c in DailyExpense.__table_args__ if hasattr(c, "name")]
    assert "uq_dailyexpense_natural" in constraints

def test_settlement_watch_alert_creatable(session):
    from models import SettlementWatchAlert
    import datetime
    a = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=1240000, deadline=datetime.date(2026, 5, 13),
    )
    session.add(a)
    session.commit()
    assert a.id is not None
    assert a.status == "open"
```

- [ ] Run `pytest tests/auto_collection_sync/test_models.py -v`. Expected: 3 PASS (in-memory SQLite 가 새 컬럼·테이블 자동 생성).

### Step 1.3 — Postgres 마이그레이션 스크립트

- [ ] Create `scripts/migrations/migrate_auto_collection_pipeline.py`:

```python
"""Auto-collection pipeline DB migration (idempotent ALTER/CREATE).

Run: python scripts/migrations/migrate_auto_collection_pipeline.py
"""
from sqlalchemy import text
from database import engine

DDL_STATEMENTS = [
    # 1) DailyExpense.source
    """ALTER TABLE dailyexpense
       ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'manual',
       ADD COLUMN IF NOT EXISTS source_meta TEXT""",
    "CREATE INDEX IF NOT EXISTS ix_dailyexpense_source ON dailyexpense (source)",
    """CREATE UNIQUE INDEX IF NOT EXISTS uq_dailyexpense_natural
       ON dailyexpense (business_id, date, vendor_id, payment_method, source)
       WHERE vendor_id IS NOT NULL""",

    # 2) CardFeeRateLearned
    """CREATE TABLE IF NOT EXISTS cardfeeratelearned (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        learned_rate FLOAT NOT NULL,
        sample_size INTEGER NOT NULL,
        sample_period_start DATE NOT NULL,
        sample_period_end DATE NOT NULL,
        confidence FLOAT NOT NULL,
        last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT,
        UNIQUE (business_id, card_corp)
    )""",

    # 3) CardFeeMatchLog
    """CREATE TABLE IF NOT EXISTS cardfeematchlog (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        deposit_date DATE NOT NULL,
        approval_dates_start DATE NOT NULL,
        approval_dates_end DATE NOT NULL,
        sales_amount BIGINT NOT NULL,
        deposit_amount BIGINT NOT NULL,
        effective_fee BIGINT NOT NULL,
        effective_rate FLOAT NOT NULL,
        matched_at TIMESTAMP NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_cardfeematchlog_biz_corp ON cardfeematchlog (business_id, card_corp)",

    # 4) CoupangEatsSettlement 분해 컬럼
    """ALTER TABLE coupangeatssettlement
       ADD COLUMN IF NOT EXISTS total_sales BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_brokerage BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_payment BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_delivery BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_advertising BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_membership BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS fee_other BIGINT NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS deduction_etc BIGINT NOT NULL DEFAULT 0""",

    # 5) SubscriptionPlan 플래그
    """ALTER TABLE subscriptionplan
       ADD COLUMN IF NOT EXISTS feature_auto_collection BOOLEAN NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS feature_fee_auto_estimate BOOLEAN NOT NULL DEFAULT FALSE""",

    # 6) DeliveryFeeRate
    """CREATE TABLE IF NOT EXISTS deliveryfeerate (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        channel VARCHAR(32) NOT NULL,
        rate FLOAT NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        notes TEXT,
        updated_by INTEGER REFERENCES "user"(id),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, channel, effective_from)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_deliveryfeerate_biz_channel ON deliveryfeerate (business_id, channel)",

    # 7) SettlementWatchAlert
    """CREATE TABLE IF NOT EXISTS settlementwatchalert (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        alert_type VARCHAR(32) NOT NULL,
        channel_or_corp VARCHAR(32) NOT NULL,
        expected_date DATE NOT NULL,
        expected_amount BIGINT NOT NULL,
        deadline DATE NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        notified_at TIMESTAMP,
        received_amount BIGINT,
        received_date DATE,
        acknowledged_at TIMESTAMP,
        acknowledged_by INTEGER REFERENCES "user"(id),
        notes TEXT,
        raw_ref TEXT,
        UNIQUE (business_id, alert_type, channel_or_corp, expected_date)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_settle_watch_biz_status ON settlementwatchalert (business_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_settle_watch_alert_type ON settlementwatchalert (alert_type)",

    # 8) CardCorpSettlementProfile
    """CREATE TABLE IF NOT EXISTS cardcorpsettlementprofile (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES business(id),
        card_corp VARCHAR(32) NOT NULL,
        settlement_days_learned INTEGER NOT NULL DEFAULT 3,
        grace_days INTEGER NOT NULL DEFAULT 3,
        sample_size INTEGER NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (business_id, card_corp)
    )""",
]


def run():
    with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            print(f"-- Executing: {stmt[:80]}...")
            conn.execute(text(stmt))
    print("✅ Auto-collection pipeline migration complete.")


if __name__ == "__main__":
    run()
```

- [ ] Run `python scripts/migrations/migrate_auto_collection_pipeline.py` (Orbitron 환경에서). 멱등 — 두 번 돌려도 안전.

### Step 1.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/models.py \
        SodamApp/backend/scripts/migrations/migrate_auto_collection_pipeline.py \
        SodamApp/backend/tests/auto_collection_sync/
git commit -m "feat(auto-collection): Task 1 - DB 모델 변경 + 마이그레이션 SQL

- DailyExpense.source/source_meta 컬럼 + uq_dailyexpense_natural
- 신규 테이블 5개: CardFeeRateLearned, CardFeeMatchLog, DeliveryFeeRate,
  SettlementWatchAlert, CardCorpSettlementProfile
- CoupangEatsSettlement 분해 컬럼 8개
- SubscriptionPlan 플래그 2개
- 멱등 마이그레이션 스크립트 (Postgres)"
```

---

## Task 2 — SyncEvent / fan_out / vendor_resolver 기반 인프라

**Files:**
- Create: `services/auto_collection_sync/__init__.py`, `sync_event.py`, `fan_out.py`, `vendor_resolver.py`
- Test: `tests/auto_collection_sync/test_sync_event.py`, `test_fan_out.py`, `test_vendor_resolver.py`

### Step 2.1 — `SyncEvent` DTO (TDD)

- [ ] Create `tests/auto_collection_sync/test_sync_event.py`:

```python
def test_sync_event_revenue_positive():
    from services.auto_collection_sync.sync_event import SyncEvent
    import datetime
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="easypos:1:2026-05-13",
        raw_payload={"receipt_count": 312},
    )
    assert ev.amount > 0
    assert ev.event_type == "revenue"

def test_sync_event_expense_negative():
    from services.auto_collection_sync.sync_event import SyncEvent
    import datetime
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="expense", vendor_lookup_key="coupang_eats_fee_brokerage",
        payment_method="Delivery", amount=-44_000,
        source="auto_coupang", source_ref="coupang_settle:99:fee_brokerage",
        raw_payload={"settlement_id": 99},
    )
    assert ev.amount < 0
```

- [ ] Run `pytest tests/auto_collection_sync/test_sync_event.py -v`. Expected: FAIL (module not found).

- [ ] Create `services/auto_collection_sync/__init__.py` (빈 파일).
- [ ] Create `services/auto_collection_sync/sync_event.py`:

```python
"""표준 SyncEvent DTO — 채널 normalizer 출력 형식.

자세한 의미는 spec § 5.2 참조.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Literal


EventType = Literal["revenue", "expense", "card_settlement", "delivery_settlement"]


@dataclass
class SyncEvent:
    business_id: int
    date: date
    event_type: EventType
    vendor_lookup_key: str
    payment_method: str
    amount: int                        # revenue +, expense -
    source: str                        # 'auto_easypos' | 'auto_coupang' | 'auto_bank' | ...
    source_ref: str
    raw_payload: dict = field(default_factory=dict)
```

- [ ] Re-run test. Expected: PASS.

### Step 2.2 — `vendor_resolver` (TDD)

- [ ] Create `tests/auto_collection_sync/test_vendor_resolver.py`:

```python
def test_get_or_create_store_vendor_attaches_business_name(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥 건대본점")
    session.add(biz); session.commit()
    v = get_or_create(session, business_id=1, lookup_key="store")
    assert v.name == "매장 (소담김밥 건대본점)"
    assert v.vendor_type == "revenue"
    assert v.category == "store"

def test_get_or_create_is_idempotent(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥 건대본점")
    session.add(biz); session.commit()
    v1 = get_or_create(session, business_id=1, lookup_key="store")
    v2 = get_or_create(session, business_id=1, lookup_key="store")
    assert v1.id == v2.id

def test_get_or_create_coupang_fee_vendors(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="X"); session.add(biz); session.commit()
    v = get_or_create(session, business_id=1, lookup_key="coupang_eats_fee_brokerage")
    assert v.name == "쿠팡이츠 중개수수료"
    assert v.vendor_type == "expense"
    assert v.category == "delivery_fee"
```

- [ ] Run. Expected: FAIL (module not found).

- [ ] Create `services/auto_collection_sync/vendor_resolver.py`:

```python
"""채널 vendor_lookup_key → Vendor.id 매핑 + 자동 생성.

신규 채널 추가 시 CHANNEL_VENDORS 에 row 추가만 하면 됨.
"""
from sqlmodel import Session, select
from models import Business, Vendor

# (vendor_name_template, category, vendor_type)
CHANNEL_VENDORS = {
    "store":                          ("매장 ({biz_name})", "store",        "revenue"),
    "coupang_eats":                   ("쿠팡이츠",          "delivery",     "revenue"),
    "coupang_eats_fee_brokerage":     ("쿠팡이츠 중개수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_payment":       ("쿠팡이츠 결제수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_delivery":      ("쿠팡이츠 배달비",     "delivery_fee", "expense"),
    "coupang_eats_fee_advertising":   ("쿠팡이츠 광고비",     "advertising",  "expense"),
    "coupang_eats_fee_membership":    ("쿠팡이츠 멤버십",     "delivery_fee", "expense"),
    "coupang_eats_fee_other":         ("쿠팡이츠 기타",      "delivery_fee",  "expense"),
    # 추후: baemin / yogiyo / ddangyo 동일 패턴
}


def get_or_create(session: Session, business_id: int, lookup_key: str) -> Vendor:
    if lookup_key not in CHANNEL_VENDORS:
        raise ValueError(f"unknown channel vendor lookup_key: {lookup_key}")

    name_tpl, category, vtype = CHANNEL_VENDORS[lookup_key]
    if "{biz_name}" in name_tpl:
        biz = session.get(Business, business_id)
        biz_name = biz.name if biz else f"#{business_id}"
        name = name_tpl.format(biz_name=biz_name)
    else:
        name = name_tpl

    vendor = session.exec(
        select(Vendor).where(
            Vendor.business_id == business_id,
            Vendor.name == name,
            Vendor.vendor_type == vtype,
        )
    ).first()
    if vendor:
        return vendor

    vendor = Vendor(
        business_id=business_id, name=name,
        category=category, vendor_type=vtype,
    )
    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return vendor


def list_auto_covered(session: Session, business_id: int) -> list[int]:
    """마이그레이션 B 정책에서 덮어쓰기 대상이 되는 vendor_id 리스트."""
    vendor_ids = []
    for key in CHANNEL_VENDORS.keys():
        v = get_or_create(session, business_id, key)
        vendor_ids.append(v.id)
    return vendor_ids
```

- [ ] Re-run test. Expected: PASS.

### Step 2.3 — `fan_out` (TDD)

- [ ] Create `tests/auto_collection_sync/test_fan_out.py`:

```python
import datetime
import pytest
from services.auto_collection_sync.sync_event import SyncEvent

def _make_biz(session):
    from models import Business
    biz = Business(id=1, name="X"); session.add(biz); session.commit(); return biz

def test_revenue_event_upserts_dailyexpense(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select

    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="easypos:1:2026-05-13",
    )
    report = apply(session, business_id=1, events=[ev])
    rows = session.exec(select(DailyExpense)).all()
    assert len(rows) == 1
    assert rows[0].amount == 2_100_000
    assert rows[0].source == "auto_easypos"
    assert report.counts["revenue:auto_easypos"] == 1

def test_duplicate_event_updates_in_place(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select

    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="r1",
    )
    apply(session, 1, [ev])
    ev2 = SyncEvent(**{**ev.__dict__, "amount": 2_500_000})
    apply(session, 1, [ev2])
    rows = session.exec(select(DailyExpense)).all()
    assert len(rows) == 1
    assert rows[0].amount == 2_500_000

def test_expense_event_creates_expense_row(session):
    _make_biz(session)
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="expense", vendor_lookup_key="coupang_eats_fee_brokerage",
        payment_method="Delivery", amount=-44_000,
        source="auto_coupang", source_ref="x",
    )
    apply(session, 1, [ev])
    rows = session.exec(select(DailyExpense)).all()
    assert rows[0].amount == -44_000
    assert rows[0].vendor_name == "쿠팡이츠 중개수수료"
```

- [ ] Run. Expected: FAIL (module not found).

- [ ] Create `services/auto_collection_sync/fan_out.py`:

```python
"""SyncEvent → DailyExpense / 채널별 보조 테이블 upsert.

자세한 정책은 spec § 5.6 참조.
"""
from collections import defaultdict
from dataclasses import dataclass, field
import json
from sqlmodel import Session, select
from models import DailyExpense
from .sync_event import SyncEvent
from . import vendor_resolver


@dataclass
class FanOutReport:
    counts: dict = field(default_factory=dict)
    total_events: int = 0


def apply(session: Session, business_id: int, events: list[SyncEvent]) -> FanOutReport:
    report = FanOutReport()
    counts = defaultdict(int)
    for ev in events:
        if ev.event_type in ("revenue", "expense"):
            _upsert_daily_expense(session, ev)
        # card_settlement / delivery_settlement 은 기존 흐름 유지 (Task 5에서 다룸)
        counts[f"{ev.event_type}:{ev.source}"] += 1
        report.total_events += 1
    session.commit()
    report.counts = dict(counts)
    return report


def _upsert_daily_expense(session: Session, ev: SyncEvent):
    vendor = vendor_resolver.get_or_create(session, ev.business_id, ev.vendor_lookup_key)
    existing = session.exec(
        select(DailyExpense).where(
            DailyExpense.business_id == ev.business_id,
            DailyExpense.date == ev.date,
            DailyExpense.vendor_id == vendor.id,
            DailyExpense.payment_method == ev.payment_method,
            DailyExpense.source == ev.source,
        )
    ).first()
    payload_json = json.dumps(ev.raw_payload, ensure_ascii=False) if ev.raw_payload else None
    if existing:
        existing.amount = ev.amount
        existing.source_meta = payload_json
        session.add(existing)
    else:
        session.add(DailyExpense(
            business_id=ev.business_id, date=ev.date,
            vendor_id=vendor.id, vendor_name=vendor.name,
            amount=ev.amount, category=vendor.category,
            payment_method=ev.payment_method,
            source=ev.source, source_meta=payload_json,
        ))
```

- [ ] Re-run. Expected: PASS (3 tests).

### Step 2.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/ \
        SodamApp/backend/tests/auto_collection_sync/test_sync_event.py \
        SodamApp/backend/tests/auto_collection_sync/test_vendor_resolver.py \
        SodamApp/backend/tests/auto_collection_sync/test_fan_out.py
git commit -m "feat(auto-collection): Task 2 - SyncEvent/fan_out/vendor_resolver 인프라"
```

---

## Task 3 — EasyPOS normalizer + 1개 사업장 검증

**Files:**
- Create: `services/auto_collection_sync/normalizers/__init__.py`, `easypos.py`
- Test: `tests/auto_collection_sync/test_normalizer_easypos.py`

### Step 3.1 — Test (TDD)

- [ ] Create `tests/auto_collection_sync/test_normalizer_easypos.py`:

```python
import datetime
from models import Business, EasyPosSaleReceipt

def _seed_receipt(session, business_id, sale_date, cash=0, card=0, point=0):
    r = EasyPosSaleReceipt(
        business_id=business_id, sale_date=sale_date,
        pos_no="1", receipt_no="R1",
        total_amount=cash+card+point, net_amount=cash+card+point,
        cash_amount=cash, card_amount=card, point_amount=point,
    )
    session.add(r); session.commit(); return r

def test_normalizer_splits_payment_methods(session):
    session.add(Business(id=1, name="X")); session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000, point=42_000)
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    by_pm = {e.payment_method: e for e in events}
    assert by_pm["Cash"].amount == 350_000
    assert by_pm["Card"].amount == 2_100_000
    assert by_pm["Point"].amount == 42_000
    assert all(e.event_type == "revenue" and e.source == "auto_easypos" for e in events)

def test_normalizer_skips_zero_methods(session):
    session.add(Business(id=1, name="X")); session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000)  # only cash
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    pms = {e.payment_method for e in events}
    assert pms == {"Cash"}
```

- [ ] Run. Expected: FAIL.

### Step 3.2 — Implementation

- [ ] Create `services/auto_collection_sync/normalizers/__init__.py` (빈 파일).
- [ ] Create `services/auto_collection_sync/normalizers/easypos.py`:

```python
"""EasyPosSaleReceipt → SyncEvent[] (결제수단별 분해).

자세한 매핑은 spec § 5.3 참조.
"""
import datetime
from sqlmodel import Session, select
from models import EasyPosSaleReceipt
from ..sync_event import SyncEvent


PAYMENT_METHOD_COLUMNS = {
    "Cash": "cash_amount",
    "Card": "card_amount",
    "Point": "point_amount",
    "Voucher": "voucher_amount",
    "Cashback": "cashback_amount",
    "Prepaid": "prepaid_card_amount",
    "Credit": "credit_amount",
    "Exchange": "exchange_voucher_amount",
    "EmployeeCard": "employee_card_amount",
    "EMoney": "e_money_amount",
}


def normalize_easypos(session: Session, business_id: int,
                      start: datetime.date, end: datetime.date):
    """기간 내 일자별로 결제수단별 합계 SyncEvent yield."""
    current = start
    while current <= end:
        receipts = session.exec(
            select(EasyPosSaleReceipt).where(
                EasyPosSaleReceipt.business_id == business_id,
                EasyPosSaleReceipt.sale_date == current,
            )
        ).all()
        for pm, col in PAYMENT_METHOD_COLUMNS.items():
            total = sum(getattr(r, col, 0) or 0 for r in receipts)
            if total <= 0:
                continue
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="store",
                payment_method=pm, amount=int(total),
                source="auto_easypos",
                source_ref=f"easypos:{business_id}:{current.isoformat()}:{pm}",
                raw_payload={"receipt_count": len(receipts), "payment_method": pm},
            )
        current += datetime.timedelta(days=1)
```

- [ ] Re-run test. Expected: PASS.

### Step 3.3 — 통합 smoke 테스트 (orchestrator skeleton)

- [ ] Add to `test_normalizer_easypos.py`:

```python
def test_easypos_to_dailyexpense_end_to_end(session):
    """normalize_easypos → fan_out.apply → DailyExpense 행 생성."""
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select
    session.add(Business(id=1, name="X")); session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000)
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    apply(session, 1, events)
    rows = session.exec(select(DailyExpense)).all()
    by_pm = {r.payment_method: r for r in rows}
    assert by_pm["Cash"].amount == 350_000
    assert by_pm["Card"].amount == 2_100_000
```

- [ ] Run. Expected: PASS.

### Step 3.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/normalizers/ \
        SodamApp/backend/tests/auto_collection_sync/test_normalizer_easypos.py
git commit -m "feat(auto-collection): Task 3 - EasyPOS normalizer (결제수단별 분해)"
```

---

## Task 4 — 쿠팡이츠 normalizer + 정산 분해 추출

**Files:**
- Modify: `services/coupang_eats_service.py` (정산 분해 컬럼 채우기)
- Create: `services/auto_collection_sync/normalizers/coupang_eats.py`
- Test: `tests/auto_collection_sync/test_normalizer_coupang_eats.py`

### Step 4.1 — 정산 분해 컬럼 채우기 (raw_json 파싱)

- [ ] In `services/coupang_eats_service.py`, find the function that upserts `CoupangEatsSettlement` (현재는 `amount` + `raw_json` 만 저장). Locate via:

```bash
grep -n "CoupangEatsSettlement" SodamApp/backend/services/coupang_eats_service.py
```

- [ ] Modify upsert 로직 — `raw_json` 의 항목별 필드를 추출해 분해 컬럼 채우기. raw 응답 키는 `_extract_settlement_breakdown` 헬퍼로 분리:

```python
def _extract_settlement_breakdown(raw: dict) -> dict:
    """쿠팡이츠 정산 응답의 항목별 분해 추출.

    실제 응답 key 이름은 API 변경에 대비해 fallback 다중 매핑.
    """
    def g(*keys, default=0):
        for k in keys:
            v = raw.get(k)
            if v is not None:
                try:
                    return int(v)
                except (TypeError, ValueError):
                    continue
        return default

    return dict(
        total_sales=g("totalSales", "totalSaleAmount", "grossSales"),
        fee_brokerage=g("brokerageFee", "feeBrokerage", "commissionFee"),
        fee_payment=g("paymentFee", "feePayment", "pgFee"),
        fee_delivery=g("deliveryFee", "feeDelivery"),
        fee_advertising=g("advertisingFee", "adFee", "feeAdvertising"),
        fee_membership=g("membershipFee", "wowFee"),
        fee_other=g("otherFee", "etcFee"),
        deduction_etc=g("deductionEtc", "adjustment"),
    )
```

- [ ] Modify the upsert (around line 800-849 in spec ref) to pass these into `CoupangEatsSettlement(**fields, **breakdown)`. 기존 `amount` 는 유지.

### Step 4.2 — Test (TDD)

- [ ] Create `tests/auto_collection_sync/test_normalizer_coupang_eats.py`:

```python
import datetime
from models import Business, CoupangEatsOrder, CoupangEatsSettlement

def test_normalizer_emits_revenue_and_fee_breakdown(session):
    session.add(Business(id=1, name="X")); session.commit()
    # 매출 raw
    o = CoupangEatsOrder(
        business_id=1, store_id=10, order_id="ORD1",
        ordered_at=datetime.datetime(2026, 5, 13, 12, 0),
        total_sale_price=245_000, cancelled=False,
    )
    session.add(o)
    # 정산 raw (분해)
    s = CoupangEatsSettlement(
        business_id=1, store_id=10,
        settlement_date=datetime.date(2026, 5, 13),
        settlement_type="SETTLEMENT", amount=180_000,
        total_sales=245_000,
        fee_brokerage=44_000, fee_payment=12_000,
        fee_delivery=8_000, fee_advertising=1_000,
        fee_membership=0, fee_other=0, deduction_etc=0,
    )
    session.add(s); session.commit()

    from services.auto_collection_sync.normalizers.coupang_eats import normalize_coupang_eats
    events = list(normalize_coupang_eats(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    # 1 revenue + 4 expense
    rev = [e for e in events if e.event_type == "revenue"]
    exp = [e for e in events if e.event_type == "expense"]
    assert len(rev) == 1 and rev[0].amount == 245_000
    fees = {e.vendor_lookup_key: e.amount for e in exp}
    assert fees["coupang_eats_fee_brokerage"] == -44_000
    assert fees["coupang_eats_fee_payment"] == -12_000
    assert fees["coupang_eats_fee_delivery"] == -8_000
    assert fees["coupang_eats_fee_advertising"] == -1_000
    # 0원 항목은 emit 안 됨 (membership/other/deduction)
```

- [ ] Run. Expected: FAIL.

### Step 4.3 — Implementation

- [ ] Create `services/auto_collection_sync/normalizers/coupang_eats.py`:

```python
"""쿠팡이츠 → SyncEvent[].

매출은 일자별 1행, 수수료는 정산 항목별로 fan-out. spec § 5.4 참조.
"""
import datetime
from sqlmodel import Session, select
from models import CoupangEatsOrder, CoupangEatsSettlement
from ..sync_event import SyncEvent


FEE_FIELDS = [
    ("fee_brokerage",   "coupang_eats_fee_brokerage"),
    ("fee_payment",     "coupang_eats_fee_payment"),
    ("fee_delivery",    "coupang_eats_fee_delivery"),
    ("fee_advertising", "coupang_eats_fee_advertising"),
    ("fee_membership",  "coupang_eats_fee_membership"),
    ("fee_other",       "coupang_eats_fee_other"),
]


def normalize_coupang_eats(session: Session, business_id: int,
                            start: datetime.date, end: datetime.date):
    current = start
    while current <= end:
        # 1) 매출
        orders = session.exec(
            select(CoupangEatsOrder).where(
                CoupangEatsOrder.business_id == business_id,
                CoupangEatsOrder.ordered_at >= datetime.datetime.combine(current, datetime.time.min),
                CoupangEatsOrder.ordered_at < datetime.datetime.combine(current + datetime.timedelta(days=1), datetime.time.min),
                CoupangEatsOrder.cancelled == False,  # noqa: E712
            )
        ).all()
        total_sale = sum(o.total_sale_price or 0 for o in orders)
        if total_sale > 0:
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="coupang_eats",
                payment_method="Delivery", amount=int(total_sale),
                source="auto_coupang",
                source_ref=f"coupang_orders:{business_id}:{current.isoformat()}",
                raw_payload={"order_count": len(orders)},
            )

        # 2) 정산 수수료 분해
        settlements = session.exec(
            select(CoupangEatsSettlement).where(
                CoupangEatsSettlement.business_id == business_id,
                CoupangEatsSettlement.settlement_date == current,
                CoupangEatsSettlement.settlement_type == "SETTLEMENT",
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
                    source="auto_coupang",
                    source_ref=f"coupang_settle:{st.id}:{field_name}",
                    raw_payload={"settlement_id": st.id},
                )
        current += datetime.timedelta(days=1)
```

- [ ] Re-run. Expected: PASS.

### Step 4.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/coupang_eats_service.py \
        SodamApp/backend/services/auto_collection_sync/normalizers/coupang_eats.py \
        SodamApp/backend/tests/auto_collection_sync/test_normalizer_coupang_eats.py
git commit -m "feat(auto-collection): Task 4 - 쿠팡이츠 normalizer + 정산 항목별 분해"
```

---

## Task 5 — 은행 normalizer (bank_sync 리팩토링)

**Files:**
- Modify: `routers/bank_sync.py` — `_sync_classified_to_models` 를 SyncEvent emit 로 리팩토링
- Create: `services/auto_collection_sync/normalizers/bank.py` (wrapper)
- Test: `tests/auto_collection_sync/test_normalizer_bank.py`

### Step 5.1 — 현재 동작 회귀 테스트 먼저 작성

은행 분류 로직은 이미 검증된 코드라 리팩토링 시 회귀 방지가 핵심.

- [ ] Create `tests/auto_collection_sync/test_normalizer_bank.py`:

```python
import datetime
from models import Business, BankTransaction, BankAccount

def _seed_bank_tx(session, business_id, account_id, trans_date, in_amount=0, out_amount=0,
                  classified_as=None, remark1="", tid=None):
    tx = BankTransaction(
        business_id=business_id, account_id=account_id,
        trans_date=trans_date, in_amount=in_amount, out_amount=out_amount,
        classified_as=classified_as, remark1=remark1,
        tid=tid or f"test:{trans_date}:{in_amount}:{out_amount}",
    )
    session.add(tx); session.commit(); return tx

def test_classified_revenue_emits_revenue_event(session):
    """은행에서 'revenue' 로 분류된 입금이 DailyExpense revenue 로 변환됨."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="110-***-1234")
    session.add(acc); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   in_amount=500_000, classified_as="revenue", remark1="개인")

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    rev_events = [e for e in events if e.event_type == "revenue"]
    assert len(rev_events) == 1
    assert rev_events[0].amount == 500_000
    assert rev_events[0].source == "auto_bank"
```

- [ ] Run. Expected: FAIL (module not found).

### Step 5.2 — `normalizers/bank.py` 작성 (기존 분류 로직 활용)

- [ ] Create `services/auto_collection_sync/normalizers/bank.py`:

```python
"""은행 거래내역 (classified) → SyncEvent[].

기존 routers/bank_sync._sync_classified_to_models 로직을 SyncEvent emit 형태로 재포장.
원본 함수는 호환을 위해 유지하되, 추후 이 normalizer 를 표준으로 사용.
"""
import datetime
from sqlmodel import Session, select
from models import BankTransaction
from ..sync_event import SyncEvent


def normalize_bank(session: Session, business_id: int,
                    start: datetime.date, end: datetime.date):
    """기간 내 classified_as 가 설정된 BankTransaction 을 SyncEvent 로 변환.

    - revenue / cash_revenue → revenue event
    - expense / purchase     → expense event
    - card / pay / delivery  → 별도 테이블이 처리하므로 emit 안 함 (Task 6 의 fee_estimator 가 처리)
    """
    rows = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= start,
            BankTransaction.trans_date <= end,
            BankTransaction.classified_as.isnot(None),
        )
    ).all()
    for tx in rows:
        cls = (tx.classified_as or "").lower()
        if cls in ("revenue", "cash_revenue"):
            yield SyncEvent(
                business_id=business_id, date=tx.trans_date,
                event_type="revenue",
                vendor_lookup_key="store",  # 일반 매출은 매장 vendor 로
                payment_method="Cash" if cls == "cash_revenue" else "Bank",
                amount=int(tx.in_amount or 0),
                source="auto_bank",
                source_ref=f"banktx:{tx.id}",
                raw_payload={"tid": tx.tid, "remark1": tx.remark1 or ""},
            )
        elif cls in ("expense", "purchase"):
            # 비용은 vendor_resolver 가 알 수 있는 lookup_key 가 없으므로
            # 기존 bank_sync 의 vendor 매칭 결과를 사용 (tx.vendor_id 가 채워져 있을 것)
            # 본 normalizer 는 emit 만 — fan_out 에서 vendor_id 가 None 이면 skip
            if not tx.vendor_id:
                continue
            yield SyncEvent(
                business_id=business_id, date=tx.trans_date,
                event_type="expense",
                vendor_lookup_key=f"_existing_vendor:{tx.vendor_id}",
                payment_method="Bank",
                amount=-int(tx.out_amount or 0),
                source="auto_bank",
                source_ref=f"banktx:{tx.id}",
                raw_payload={"tid": tx.tid, "remark1": tx.remark1 or ""},
            )
        # 'card', 'pay', 'delivery' 는 emit 안 함 — 각각 CardPayment/PayPayment/DeliveryRevenue
        # 별도 흐름 (기존 코드) 이 유지됨.
```

- [ ] Extend `vendor_resolver.get_or_create` to handle `_existing_vendor:N` lookup_keys:

```python
def get_or_create(session: Session, business_id: int, lookup_key: str) -> Vendor:
    if lookup_key.startswith("_existing_vendor:"):
        vid = int(lookup_key.split(":", 1)[1])
        v = session.get(Vendor, vid)
        if not v or v.business_id != business_id:
            raise ValueError(f"vendor {vid} not found for business {business_id}")
        return v
    # ... 기존 로직 ...
```

- [ ] Re-run test. Expected: PASS.

### Step 5.3 — 기존 `_sync_classified_to_models` 코드는 그대로 유지

리팩토링은 점진 — 기존 함수는 보존(다른 라우트에서 호출 중). 새 normalizer는 orchestrator(Task 8)에서만 사용. 1주 운영 후 기존 함수를 normalizer 호출로 교체하는 별도 PR로 정리.

- [ ] 추가 작업 없음. 다음 step.

### Step 5.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/normalizers/bank.py \
        SodamApp/backend/services/auto_collection_sync/vendor_resolver.py \
        SodamApp/backend/tests/auto_collection_sync/test_normalizer_bank.py
git commit -m "feat(auto-collection): Task 5 - 은행 normalizer (classified BankTransaction → SyncEvent)"
```

---

## Task 6 — 수수료 자동 추정 (3경로 + 학습)

**Files:**
- Create: `services/auto_collection_sync/fee_estimator.py`
- Test: `tests/auto_collection_sync/test_fee_estimator.py`

### Step 6.1 — `CardFeeEstimate` DTO + 1순위 (CODEF 명세서) 테스트

- [ ] Create `tests/auto_collection_sync/test_fee_estimator.py`:

```python
import datetime
from models import Business, CardPayment

def test_codef_settlement_takes_precedence(session):
    session.add(Business(id=1, name="X")); session.commit()
    session.add(CardPayment(
        business_id=1, payment_date=datetime.date(2026, 5, 10),
        card_corp="삼성", sales_amount=5_000_000,
        fees=158_000, net_deposit=4_842_000, source="codef",
    ))
    session.commit()
    from services.auto_collection_sync.fee_estimator import estimate_card_fee
    e = estimate_card_fee(session, business_id=1, card_corp="삼성", year=2026, month=5)
    assert e.amount == 158_000
    assert e.source == "codef_settlement"
    assert e.confidence == 1.0
```

- [ ] Run. Expected: FAIL.

### Step 6.2 — `fee_estimator.py` 1순위 구현

- [ ] Create `services/auto_collection_sync/fee_estimator.py`:

```python
"""카드/배달 수수료 자동 추정 — spec § 6 참조.

우선순위:
  1) CODEF 명세서 (CardPayment.source=='codef' + fees>0)
  2) 입금 ↔ 승인 매칭 실측 역산 (CardFeeMatchLog 참조)
  3) 학습된 카드사별 평균 수수료율 (CardFeeRateLearned)
  4) 산정 불가
"""
import calendar
import datetime
import math
from dataclasses import dataclass
from typing import Literal, Optional
from sqlmodel import Session, select
from models import (
    CardPayment, CardSalesApproval, CardFeeRateLearned, CardFeeMatchLog,
)


CardFeeSource = Literal[
    "codef_settlement", "deposit_match", "learned_rate", "unavailable"
]


@dataclass
class CardFeeEstimate:
    amount: int
    source: CardFeeSource
    confidence: float
    basis_count: int = 0


def _month_range(year: int, month: int) -> tuple[datetime.date, datetime.date]:
    start = datetime.date(year, month, 1)
    last = calendar.monthrange(year, month)[1]
    end = datetime.date(year, month, last)
    return start, end


def estimate_card_fee(session: Session, business_id: int, card_corp: str,
                      year: int, month: int) -> CardFeeEstimate:
    start, end = _month_range(year, month)

    # 1순위 — CODEF 명세서
    codef_payments = session.exec(
        select(CardPayment).where(
            CardPayment.business_id == business_id,
            CardPayment.card_corp == card_corp,
            CardPayment.payment_date >= start,
            CardPayment.payment_date <= end,
            CardPayment.source == "codef",
        )
    ).all()
    codef_with_fee = [p for p in codef_payments if (p.fees or 0) > 0]
    if codef_with_fee:
        return CardFeeEstimate(
            amount=sum(p.fees for p in codef_with_fee),
            source="codef_settlement", confidence=1.0,
            basis_count=len(codef_with_fee),
        )

    # 2순위 — 입금↔승인 매칭 (Task 6.3에서 채움)
    fee, samples = _match_deposits_to_approvals(session, business_id, card_corp, year, month)
    if fee is not None and samples >= 5:
        return CardFeeEstimate(
            amount=fee, source="deposit_match",
            confidence=min(0.95, samples / 30.0),
            basis_count=samples,
        )

    # 3순위 — 학습값
    rate_row = session.exec(
        select(CardFeeRateLearned).where(
            CardFeeRateLearned.business_id == business_id,
            CardFeeRateLearned.card_corp == card_corp,
        )
    ).first()
    if rate_row and rate_row.confidence >= 0.5:
        sales = sum(
            (a.amount or 0)
            for a in session.exec(
                select(CardSalesApproval).where(
                    CardSalesApproval.business_id == business_id,
                    CardSalesApproval.card_corp == card_corp,
                    CardSalesApproval.approval_date >= start,
                    CardSalesApproval.approval_date <= end,
                    CardSalesApproval.status == "승인",
                )
            ).all()
        )
        return CardFeeEstimate(
            amount=int(sales * rate_row.learned_rate),
            source="learned_rate",
            confidence=rate_row.confidence * 0.8,
            basis_count=rate_row.sample_size,
        )

    # 4순위 — 산정 불가
    return CardFeeEstimate(amount=0, source="unavailable", confidence=0.0)


def _match_deposits_to_approvals(session: Session, business_id: int, card_corp: str,
                                  year: int, month: int) -> tuple[Optional[int], int]:
    """이 달의 입금 ↔ 승인 묶음 매칭 실측 (Task 6.3에서 본격 구현).

    1차 stub: 같은 달 매칭 로그만 보고 합산.
    """
    start, end = _month_range(year, month)
    logs = session.exec(
        select(CardFeeMatchLog).where(
            CardFeeMatchLog.business_id == business_id,
            CardFeeMatchLog.card_corp == card_corp,
            CardFeeMatchLog.deposit_date >= start,
            CardFeeMatchLog.deposit_date <= end,
        )
    ).all()
    if not logs:
        return None, 0
    return sum(l.effective_fee for l in logs), len(logs)
```

- [ ] Re-run test. Expected: PASS.

### Step 6.3 — 입금↔승인 매칭 알고리즘 (2순위)

- [ ] Add test:

```python
def test_deposit_match_creates_card_fee_match_log(session):
    """배치 매칭 함수가 입금↔승인 묶음을 식별하고 로그를 남긴다."""
    import datetime
    from models import CardSalesApproval, BankTransaction, BankAccount
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    # 승인 5/6~5/8 합계 1,000,000
    for d, a in [(6, 300_000), (7, 400_000), (8, 300_000)]:
        session.add(CardSalesApproval(
            business_id=1, approval_date=datetime.date(2026, 5, d),
            card_corp="삼성", amount=a, status="승인", source="codef",
        ))
    # 입금 5/10 978,000 (수수료 2.2% 가정)
    session.add(BankTransaction(
        business_id=1, account_id=10,
        trans_date=datetime.date(2026, 5, 10),
        in_amount=978_000, remark1="삼성카드", tid="t1",
    ))
    session.commit()

    from services.auto_collection_sync.fee_estimator import run_deposit_match
    n = run_deposit_match(session, business_id=1)
    assert n >= 1
    logs = session.exec(select(CardFeeMatchLog)).all()
    assert len(logs) == 1
    assert logs[0].sales_amount == 1_000_000
    assert logs[0].deposit_amount == 978_000
    assert logs[0].effective_fee == 22_000
    assert 0.021 < logs[0].effective_rate < 0.023
```

- [ ] Run. Expected: FAIL.

- [ ] Add to `fee_estimator.py`:

```python
from models import BankTransaction, CardCorpSettlementProfile

CARD_CORP_KEYWORDS = {
    "삼성": ["삼성카드", "삼성"],
    "신한": ["신한카드", "신한"],
    "BC":   ["비씨카드", "BC카드", "bc"],
    "현대": ["현대카드", "현대"],
    "롯데": ["롯데카드", "롯데"],
    "KB":   ["KB국민", "국민카드", "KB"],
    "NH농협": ["농협카드", "NH"],
    "하나": ["하나카드", "하나"],
    "우리": ["우리카드", "우리"],
}

DEFAULT_FEE_RATE = 0.022   # 2.2% 가정 (학습 전)
TOLERANCE_LOWER = 0.005    # 매출 합이 입금/(1-r)*(1+0.5%) 보다 작아야
TOLERANCE_UPPER = 0.040    # 매출 합이 입금/(1-r)*(1+4%) 보다 작아야


def _detect_card_corp(remark1: str) -> Optional[str]:
    if not remark1:
        return None
    r = remark1.lower()
    for corp, keywords in CARD_CORP_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in r:
                return corp
    return None


def _find_approval_window(session: Session, business_id: int, card_corp: str,
                           deposit_date: datetime.date, deposit_amount: int,
                           lookback_days: int = 7) -> Optional[CardFeeMatchLog]:
    """deposit_date 이전 lookback_days 일자 묶음에서 입금과 매칭되는 승인 합 찾기."""
    candidates = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == business_id,
            CardSalesApproval.card_corp == card_corp,
            CardSalesApproval.approval_date >= deposit_date - datetime.timedelta(days=lookback_days),
            CardSalesApproval.approval_date < deposit_date,
            CardSalesApproval.status == "승인",
        ).order_by(CardSalesApproval.approval_date)
    ).all()
    if not candidates:
        return None

    # 연속 일자 누적합으로 매칭 시도
    daily_totals = {}
    for a in candidates:
        daily_totals[a.approval_date] = daily_totals.get(a.approval_date, 0) + (a.amount or 0)
    sorted_dates = sorted(daily_totals.keys())

    for start_idx in range(len(sorted_dates)):
        cumulative = 0
        for end_idx in range(start_idx, len(sorted_dates)):
            cumulative += daily_totals[sorted_dates[end_idx]]
            # 매칭 판정: deposit ≈ sales * (1 - r), 즉 sales ≈ deposit / (1 - r)
            expected_sales_low = deposit_amount / (1 - DEFAULT_FEE_RATE) * (1 + TOLERANCE_LOWER)
            expected_sales_high = deposit_amount / (1 - DEFAULT_FEE_RATE) * (1 + TOLERANCE_UPPER)
            if expected_sales_low <= cumulative <= expected_sales_high:
                return CardFeeMatchLog(
                    business_id=business_id, card_corp=card_corp,
                    deposit_date=deposit_date,
                    approval_dates_start=sorted_dates[start_idx],
                    approval_dates_end=sorted_dates[end_idx],
                    sales_amount=cumulative,
                    deposit_amount=deposit_amount,
                    effective_fee=cumulative - deposit_amount,
                    effective_rate=(cumulative - deposit_amount) / cumulative,
                )
    return None


def run_deposit_match(session: Session, business_id: int,
                       period_days: int = 90) -> int:
    """최근 period_days 일 은행 입금 중 미매칭 카드 입금을 식별 → CardFeeMatchLog 생성."""
    cutoff = datetime.date.today() - datetime.timedelta(days=period_days)
    txs = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= cutoff,
            BankTransaction.in_amount > 0,
        )
    ).all()

    created = 0
    for tx in txs:
        corp = _detect_card_corp(tx.remark1 or "")
        if not corp:
            continue
        # 이미 매칭 로그 있나?
        existing = session.exec(
            select(CardFeeMatchLog).where(
                CardFeeMatchLog.business_id == business_id,
                CardFeeMatchLog.card_corp == corp,
                CardFeeMatchLog.deposit_date == tx.trans_date,
                CardFeeMatchLog.deposit_amount == int(tx.in_amount),
            )
        ).first()
        if existing:
            continue
        match = _find_approval_window(session, business_id, corp,
                                       tx.trans_date, int(tx.in_amount))
        if match:
            session.add(match)
            created += 1
    session.commit()
    return created
```

- [ ] Re-run test. Expected: PASS.

### Step 6.4 — 학습 알고리즘 (3순위)

- [ ] Add test:

```python
def test_update_learned_rate_writes_with_confidence(session):
    """충분한 매칭 로그가 있으면 CardFeeRateLearned 가 갱신된다."""
    import datetime
    from models import CardFeeMatchLog
    session.add(Business(id=1, name="X")); session.commit()
    for i in range(15):
        session.add(CardFeeMatchLog(
            business_id=1, card_corp="삼성",
            deposit_date=datetime.date(2026, 4, 1) + datetime.timedelta(days=i),
            approval_dates_start=datetime.date(2026, 3, 25),
            approval_dates_end=datetime.date(2026, 3, 30),
            sales_amount=1_000_000, deposit_amount=978_000,
            effective_fee=22_000, effective_rate=0.022,
        ))
    session.commit()

    from services.auto_collection_sync.fee_estimator import update_learned_rate
    update_learned_rate(session, business_id=1, card_corp="삼성")
    from models import CardFeeRateLearned
    row = session.exec(select(CardFeeRateLearned)).first()
    assert row is not None
    assert 0.021 < row.learned_rate < 0.023
    assert row.sample_size == 15
    assert 0.3 < row.confidence < 1.0
```

- [ ] Run. Expected: FAIL.

- [ ] Add to `fee_estimator.py`:

```python
def update_learned_rate(session: Session, business_id: int, card_corp: str,
                         period_days: int = 90, min_samples: int = 10):
    """최근 period_days 매칭 표본으로 학습값 갱신."""
    cutoff = datetime.date.today() - datetime.timedelta(days=period_days)
    samples = session.exec(
        select(CardFeeMatchLog).where(
            CardFeeMatchLog.business_id == business_id,
            CardFeeMatchLog.card_corp == card_corp,
            CardFeeMatchLog.matched_at >= datetime.datetime.combine(cutoff, datetime.time.min),
        )
    ).all()
    if len(samples) < min_samples:
        return

    def weight(d: datetime.date) -> float:
        days_ago = (datetime.date.today() - d).days
        return 0.5 ** (max(days_ago, 0) / 30)

    sum_w = sum(weight(s.matched_at.date()) for s in samples)
    weighted_rate = sum(s.effective_rate * weight(s.matched_at.date()) for s in samples) / sum_w
    variance = sum((s.effective_rate - weighted_rate) ** 2 * weight(s.matched_at.date()) for s in samples) / sum_w
    std_dev = math.sqrt(variance)

    confidence = min(1.0,
        (min(len(samples), 30) / 30) * 0.5 +
        (1.0 - min(1.0, std_dev * 100)) * 0.5
    )

    existing = session.exec(
        select(CardFeeRateLearned).where(
            CardFeeRateLearned.business_id == business_id,
            CardFeeRateLearned.card_corp == card_corp,
        )
    ).first()
    period_start = min(s.matched_at.date() for s in samples)
    period_end = max(s.matched_at.date() for s in samples)
    if existing:
        existing.learned_rate = weighted_rate
        existing.sample_size = len(samples)
        existing.confidence = confidence
        existing.last_updated_at = datetime.datetime.now()
        existing.sample_period_start = period_start
        existing.sample_period_end = period_end
        session.add(existing)
    else:
        session.add(CardFeeRateLearned(
            business_id=business_id, card_corp=card_corp,
            learned_rate=weighted_rate, sample_size=len(samples),
            confidence=confidence, sample_period_start=period_start,
            sample_period_end=period_end,
        ))
    session.commit()
```

- [ ] Re-run. Expected: PASS.

### Step 6.5 — 배달 수수료 (쿠팡이츠 직접 + 배민/요기요 사장님 입력)

- [ ] Add to `fee_estimator.py`:

```python
from models import DeliveryFeeRate

@dataclass
class DeliveryFeeEstimate:
    amount: int
    source: Literal["coupang_direct", "owner_input_rate", "unavailable"]
    confidence: float


def estimate_delivery_fee(session: Session, business_id: int, channel: str,
                           settlement_date: datetime.date,
                           settlement_amount: int) -> DeliveryFeeEstimate:
    if channel == "쿠팡이츠":
        # 쿠팡이츠는 정산 raw 에서 직접 추출 — Task 4 의 분해 컬럼 사용
        # 이 함수는 외부 호출용; 쿠팡이츠는 normalize_coupang_eats 이 이미 처리하므로 0 반환
        return DeliveryFeeEstimate(amount=0, source="coupang_direct", confidence=1.0)

    rate_row = _active_delivery_rate(session, business_id, channel, settlement_date)
    if not rate_row:
        return DeliveryFeeEstimate(amount=0, source="unavailable", confidence=0.0)

    estimated_sales = int(settlement_amount / (1 - rate_row.rate))
    estimated_fee = estimated_sales - settlement_amount
    return DeliveryFeeEstimate(
        amount=estimated_fee, source="owner_input_rate", confidence=0.7,
    )


def _active_delivery_rate(session: Session, business_id: int, channel: str,
                           on_date: datetime.date) -> Optional[DeliveryFeeRate]:
    return session.exec(
        select(DeliveryFeeRate).where(
            DeliveryFeeRate.business_id == business_id,
            DeliveryFeeRate.channel == channel,
            DeliveryFeeRate.effective_from <= on_date,
        ).order_by(DeliveryFeeRate.effective_from.desc())
    ).first()
```

### Step 6.6 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/fee_estimator.py \
        SodamApp/backend/tests/auto_collection_sync/test_fee_estimator.py
git commit -m "feat(auto-collection): Task 6 - 수수료 자동 추정 (3경로 + 학습 + 배달)"
```

---

## Task 7 — 마이그레이션 B 정책 + 백업 UI

**Files:**
- Create: `services/auto_collection_sync/migration.py`
- Create: `routers/auto_collection.py` (부분 — 마이그 endpoint 만 이번 Task)
- Test: `tests/auto_collection_sync/test_migration.py`
- Modify: `frontend/src/pages/RevenueManagement/` (백업 토글, 복구 버튼)

### Step 7.1 — `migrate_business` 함수 + 회귀 테스트

- [ ] Create `tests/auto_collection_sync/test_migration.py`:

```python
import datetime
from sqlmodel import select
from models import Business, Vendor, DailyExpense, EasyPosSaleReceipt

def test_migration_marks_existing_manual_as_overwritten(session):
    # 기존 수동 DailyExpense
    session.add(Business(id=1, name="X")); session.commit()
    v = Vendor(business_id=1, name="매장 (X)", category="store", vendor_type="revenue")
    session.add(v); session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=v.id, vendor_name=v.name,
        amount=500_000, payment_method="Cash", source="manual",
    ))
    session.commit()

    from services.auto_collection_sync.migration import migrate_business
    report = migrate_business(session, business_id=1,
                              period_start=datetime.date(2026, 4, 1),
                              period_end=datetime.date(2026, 4, 30),
                              backfill_channels=False)
    # 기존 수동 행이 manual_overwritten 으로 마킹
    row = session.exec(
        select(DailyExpense).where(DailyExpense.date == datetime.date(2026, 4, 15))
    ).first()
    assert row.source == "manual_overwritten"
    assert report.overwritten_count == 1

def test_migration_protects_non_auto_vendors(session):
    """매입/원가/인건비 vendor 의 수동 행은 건드리지 않음."""
    session.add(Business(id=1, name="X")); session.commit()
    v = Vendor(business_id=1, name="농산물 매입", category="material",
               vendor_type="expense")
    session.add(v); session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=v.id, vendor_name=v.name,
        amount=-200_000, payment_method="Cash", source="manual",
    ))
    session.commit()

    from services.auto_collection_sync.migration import migrate_business
    migrate_business(session, business_id=1,
                     period_start=datetime.date(2026, 4, 1),
                     period_end=datetime.date(2026, 4, 30),
                     backfill_channels=False)
    row = session.exec(
        select(DailyExpense).where(DailyExpense.vendor_id == v.id)
    ).first()
    assert row.source == "manual"  # 그대로
```

- [ ] Run. Expected: FAIL.

### Step 7.2 — `migration.py` 구현

- [ ] Create `services/auto_collection_sync/migration.py`:

```python
"""마이그레이션 B 정책 — spec § 7.2 참조.

기존 수동 행을 'manual_overwritten' 으로 백업 → 자동수집으로 다시 가져옴.
"""
import datetime
import json
from dataclasses import dataclass, field
from sqlmodel import Session, select
from models import DailyExpense
from . import vendor_resolver
from .orchestrator import run_one_business


@dataclass
class MigrationReport:
    business_id: int
    period: tuple
    overwritten_count: int = 0
    new_auto_count: int = 0
    channels: dict = field(default_factory=dict)


def migrate_business(session: Session, business_id: int,
                     period_start: datetime.date, period_end: datetime.date,
                     backfill_channels: bool = True) -> MigrationReport:
    affected_vendor_ids = vendor_resolver.list_auto_covered(session, business_id)

    # 1) 기존 수동 행 backup
    overwritten = 0
    rows = session.exec(
        select(DailyExpense).where(
            DailyExpense.business_id == business_id,
            DailyExpense.date >= period_start,
            DailyExpense.date <= period_end,
            DailyExpense.vendor_id.in_(affected_vendor_ids),
            DailyExpense.source == "manual",
        )
    ).all()
    for row in rows:
        row.source = "manual_overwritten"
        row.source_meta = json.dumps({"migrated_at": datetime.datetime.now().isoformat()})
        session.add(row)
        overwritten += 1
    session.commit()

    report = MigrationReport(business_id=business_id,
                              period=(period_start, period_end),
                              overwritten_count=overwritten)

    # 2) 채널별 raw 백필 + fan-out (orchestrator 호출, Task 8 에서 구현)
    if backfill_channels:
        fan_out_report = run_one_business(session, business_id,
                                           period_start=period_start,
                                           period_end=period_end)
        report.new_auto_count = fan_out_report.total_events
        report.channels = fan_out_report.counts

    return report
```

- [ ] Create stub `services/auto_collection_sync/orchestrator.py` (실제 구현은 Task 8):

```python
"""Orchestrator stub — Task 8 에서 본격 구현."""
from dataclasses import dataclass, field
from sqlmodel import Session


@dataclass
class OrchestratorReport:
    business_id: int
    total_events: int = 0
    counts: dict = field(default_factory=dict)


def run_one_business(session: Session, business_id: int, **kwargs) -> OrchestratorReport:
    """기간 한 사업장 동기화. Task 8 에서 normalizer/fan_out 연결."""
    return OrchestratorReport(business_id=business_id, total_events=0)


def run_all_businesses(session: Session) -> list:
    return []
```

- [ ] Re-run test. Expected: PASS.

### Step 7.3 — 백업 보기 토글 + 복구 endpoint

- [ ] Create `routers/auto_collection.py` (라우터 stub + 마이그/복구 endpoint):

```python
"""자동수집 파이프라인 라우터.

cron + 대시보드 + 마이그레이션 + 백업 복구. 8개 cron 은 Task 10 에서 추가.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from database import engine
from models import User, DailyExpense
from routers.auth import get_admin_user, get_superadmin_user

router = APIRouter(prefix="/api/auto-collection", tags=["auto-collection"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    if admin.role == "superadmin" and x_view_as_business is not None:
        return x_view_as_business
    return admin.business_id


class MigrationRequest(BaseModel):
    period_start: date
    period_end: date


@router.post("/migrate")
def trigger_migration(
    req: MigrationRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """마이그레이션 B 실행."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from services.auto_collection_sync.migration import migrate_business
        report = migrate_business(s, bid, req.period_start, req.period_end)
        return {
            "overwritten_count": report.overwritten_count,
            "new_auto_count": report.new_auto_count,
            "channels": report.channels,
        }


@router.post("/dailyexpense/{row_id}/restore")
def restore_manual_row(
    row_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """백업된 manual_overwritten 행을 manual 로 복구.

    같은 위치의 auto_* 행은 disabled 표시 (현재는 단순 source 변경만).
    """
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.get(DailyExpense, row_id)
        if not row or row.business_id != bid:
            raise HTTPException(404, "행을 찾을 수 없습니다.")
        if row.source != "manual_overwritten":
            raise HTTPException(400, "이 행은 백업 행이 아닙니다.")
        row.source = "manual"
        s.add(row); s.commit()
        return {"ok": True, "id": row.id}
```

- [ ] Register in `main.py`:

```python
from routers.auto_collection import router as auto_collection_router
app.include_router(auto_collection_router)
```

### Step 7.4 — Frontend 백업 토글 (RevenueManagement)

- [ ] Modify `frontend/src/pages/RevenueManagement/index.jsx` (또는 메인 컴포넌트):

```jsx
const [showBackup, setShowBackup] = useState(false);

// 필터: source 가 'manual_overwritten' 인 행 표시 여부
const filteredRows = rows.filter(r =>
    r.source !== 'manual_overwritten' || showBackup
);

// 토글 UI
<label>
  <input type="checkbox" checked={showBackup}
         onChange={e => setShowBackup(e.target.checked)} />
  백업된 수동 입력도 표시 (감사용)
</label>

// 백업 행에는 [복구] 버튼
{r.source === 'manual_overwritten' && (
    <button onClick={() => restore(r.id)}>복구</button>
)}
```

- [ ] Add `restore` 호출 (axios POST `/api/auto-collection/dailyexpense/${id}/restore`).

### Step 7.5 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/migration.py \
        SodamApp/backend/services/auto_collection_sync/orchestrator.py \
        SodamApp/backend/routers/auto_collection.py \
        SodamApp/backend/main.py \
        SodamApp/backend/tests/auto_collection_sync/test_migration.py \
        SodamApp/frontend/src/pages/RevenueManagement/
git commit -m "feat(auto-collection): Task 7 - 마이그레이션 B 정책 + 백업 토글 UI"
```

---

## Task 8 — 자동수집 대시보드 + Orchestrator + 텔레그램 알림

**Files:**
- Modify: `services/auto_collection_sync/orchestrator.py` (stub → 본격 구현)
- Modify: `routers/auto_collection.py` (cron + 대시보드 endpoint 추가)
- Create: `frontend/src/pages/AutoCollection/index.jsx`
- Test: `tests/auto_collection_sync/test_orchestrator.py`

### Step 8.1 — Orchestrator 본격 구현 (TDD)

- [ ] Create `tests/auto_collection_sync/test_orchestrator.py`:

```python
import datetime
from sqlmodel import select
from models import Business, SubscriptionPlan, DailyExpense, EasyPosSaleReceipt

def test_run_one_business_skips_if_plan_disables_auto(session):
    plan = SubscriptionPlan(id=1, name="Basic", feature_auto_collection=False)
    session.add(plan); session.commit()
    session.add(Business(id=1, name="X", plan_id=1)); session.commit()
    from services.auto_collection_sync.orchestrator import run_one_business
    report = run_one_business(session, 1,
                              period_start=datetime.date(2026, 5, 13),
                              period_end=datetime.date(2026, 5, 13))
    assert report.total_events == 0
    assert report.skipped_reason == "plan_disabled"

def test_run_one_business_processes_easypos(session):
    plan = SubscriptionPlan(id=1, name="Premium", feature_auto_collection=True)
    session.add(plan); session.commit()
    session.add(Business(id=1, name="X", plan_id=1))
    session.commit()
    session.add(EasyPosSaleReceipt(
        business_id=1, sale_date=datetime.date(2026, 5, 13),
        pos_no="1", receipt_no="R1",
        total_amount=350_000, net_amount=350_000, cash_amount=350_000,
    ))
    session.commit()

    from services.auto_collection_sync.orchestrator import run_one_business
    report = run_one_business(session, 1,
                              period_start=datetime.date(2026, 5, 13),
                              period_end=datetime.date(2026, 5, 13))
    assert report.total_events >= 1
    rows = session.exec(select(DailyExpense)).all()
    assert any(r.source == "auto_easypos" for r in rows)
```

- [ ] Run. Expected: FAIL.

### Step 8.2 — Orchestrator 구현

- [ ] Replace `services/auto_collection_sync/orchestrator.py`:

```python
"""Auto-collection orchestrator — cron 진입점.

채널별 normalizer 호출 → SyncEvent → fan_out.apply.
등급 체크 단일 지점. spec § 7.1 참조.
"""
import datetime
import logging
from dataclasses import dataclass, field
from sqlmodel import Session, select
from models import Business, SubscriptionPlan
from .normalizers.easypos import normalize_easypos
from .normalizers.coupang_eats import normalize_coupang_eats
from .normalizers.bank import normalize_bank
from .fan_out import apply as fan_out_apply

log = logging.getLogger("auto_collection.orchestrator")


@dataclass
class OrchestratorReport:
    business_id: int
    total_events: int = 0
    counts: dict = field(default_factory=dict)
    skipped_reason: str = ""


def _plan_enables_auto(session: Session, business_id: int) -> bool:
    biz = session.get(Business, business_id)
    if not biz or not biz.plan_id:
        return False
    plan = session.get(SubscriptionPlan, biz.plan_id)
    return bool(plan and plan.feature_auto_collection)


def run_one_business(session: Session, business_id: int,
                     period_start: datetime.date = None,
                     period_end: datetime.date = None) -> OrchestratorReport:
    if period_start is None:
        period_start = datetime.date.today() - datetime.timedelta(days=1)
    if period_end is None:
        period_end = datetime.date.today() - datetime.timedelta(days=1)

    if not _plan_enables_auto(session, business_id):
        return OrchestratorReport(business_id=business_id,
                                   skipped_reason="plan_disabled")

    events = []
    events.extend(normalize_easypos(session, business_id, period_start, period_end))
    events.extend(normalize_coupang_eats(session, business_id, period_start, period_end))
    events.extend(normalize_bank(session, business_id, period_start, period_end))

    fan_out_report = fan_out_apply(session, business_id, events)

    return OrchestratorReport(
        business_id=business_id,
        total_events=fan_out_report.total_events,
        counts=fan_out_report.counts,
    )


def run_all_businesses(session: Session) -> list[OrchestratorReport]:
    bizs = session.exec(select(Business).where(Business.subscription_status == "active")).all()
    return [run_one_business(session, b.id) for b in bizs]
```

- [ ] Re-run test. Expected: PASS.

### Step 8.3 — 대시보드 endpoint + 텔레그램 알림 호출

- [ ] Add to `routers/auto_collection.py`:

```python
@router.get("/status")
def get_status(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """자동수집 대시보드용 상태 요약."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import (
            EasyPosSyncLog, CoupangEatsSyncLog, BankSyncLog,
            CardFeeRateLearned, SettlementWatchAlert,
        )
        easypos_last = s.exec(
            select(EasyPosSyncLog).where(EasyPosSyncLog.business_id == bid)
            .order_by(EasyPosSyncLog.started_at.desc()).limit(1)
        ).first()
        coupang_last = s.exec(
            select(CoupangEatsSyncLog).where(CoupangEatsSyncLog.business_id == bid)
            .order_by(CoupangEatsSyncLog.started_at.desc()).limit(1)
        ).first()
        learned = s.exec(
            select(CardFeeRateLearned).where(CardFeeRateLearned.business_id == bid)
        ).all()
        open_alerts = s.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == bid,
                SettlementWatchAlert.status == "open",
            )
        ).all()
        avg_conf = (
            sum(r.confidence for r in learned) / len(learned) if learned else 0.0
        )
        return {
            "channels": {
                "easypos": _log_dto(easypos_last),
                "coupang_eats": _log_dto(coupang_last),
            },
            "fee_estimator": {
                "card_corps_learned": len(learned),
                "avg_confidence": round(avg_conf, 2),
            },
            "settlement_watch": {
                "open_alert_count": len(open_alerts),
            },
        }


def _log_dto(log_row):
    if not log_row:
        return {"status": "no_data"}
    return {
        "started_at": log_row.started_at.isoformat() if log_row.started_at else None,
        "status": log_row.status,
        "inserted": getattr(log_row, "inserted_count", 0),
        "updated": getattr(log_row, "updated_count", 0),
    }
```

### Step 8.4 — Frontend 자동수집 대시보드

- [ ] Create `frontend/src/pages/AutoCollection/index.jsx`:

```jsx
import { useEffect, useState } from "react";
import api from "../../api";

export default function AutoCollection() {
    const [status, setStatus] = useState(null);
    useEffect(() => { api.get("/auto-collection/status").then(r => setStatus(r.data)); }, []);
    if (!status) return <div>로딩…</div>;
    return (
        <div className="auto-collection">
            <h2>자동수집 상태</h2>
            <section>
                <h3>매장 (EasyPOS)</h3>
                <ChannelStatus s={status.channels.easypos} />
            </section>
            <section>
                <h3>쿠팡이츠</h3>
                <ChannelStatus s={status.channels.coupang_eats} />
            </section>
            <section>
                <h3>수수료 자동 추정</h3>
                <p>학습 카드사: {status.fee_estimator.card_corps_learned}개</p>
                <p>평균 신뢰도: {status.fee_estimator.avg_confidence}</p>
            </section>
            <section>
                <h3>입금 모니터</h3>
                <p>미입금 의심 건: {status.settlement_watch.open_alert_count}건</p>
            </section>
        </div>
    );
}

function ChannelStatus({ s }) {
    if (s.status === "no_data") return <p>아직 동기화 안 됨</p>;
    return (
        <p>
            마지막 동기화: {s.started_at} —
            inserted {s.inserted} / updated {s.updated} ({s.status})
        </p>
    );
}
```

- [ ] Add route to `App.jsx` 또는 sidebar — `/auto-collection`.

### Step 8.5 — 텔레그램 알림 (기존 인프라 사용)

- [ ] Add to `services/auto_collection_sync/orchestrator.py`:

```python
def notify_summary(session: Session, reports: list[OrchestratorReport]):
    """일일 자동수집 알림 — 텔레그램. spec § 8.3 참조."""
    from services.telegram_service import send_message
    lines = ["[소담 자동수집]"]
    for r in reports:
        if r.skipped_reason:
            continue
        biz = session.get(Business, r.business_id)
        lines.append(f"- {biz.name if biz else r.business_id}: {r.total_events}건 처리")
    if len(lines) == 1:
        lines.append("이상 없음.")
    send_message("\n".join(lines))
```

(`telegram_service.send_message` 가 기존에 있으면 그대로 사용. 없으면 stub.)

### Step 8.6 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/orchestrator.py \
        SodamApp/backend/routers/auto_collection.py \
        SodamApp/backend/tests/auto_collection_sync/test_orchestrator.py \
        SodamApp/frontend/src/pages/AutoCollection/
git commit -m "feat(auto-collection): Task 8 - Orchestrator + 대시보드 + 텔레그램"
```

---

## Task 9 — 입금 모니터링 (Settlement Watch)

**Files:**
- Create: `services/auto_collection_sync/calendar.py`
- Create: `services/auto_collection_sync/settlement_watch.py`
- Modify: `routers/auto_collection.py` (alert CRUD endpoint 추가)
- Create: `frontend/src/pages/AutoCollection/SettlementWatch.jsx`
- Test: `tests/auto_collection_sync/test_calendar.py`, `test_settlement_watch.py`

### Step 9.1 — 영업일 캘린더 (TDD)

- [ ] Create `tests/auto_collection_sync/test_calendar.py`:

```python
import datetime

def test_add_business_days_skips_weekends():
    from services.auto_collection_sync.calendar import add_business_days
    # 2026-05-08 (금) + 2 영업일 = 2026-05-12 (화)
    assert add_business_days(datetime.date(2026, 5, 8), 2) == datetime.date(2026, 5, 12)

def test_add_business_days_skips_korean_holidays():
    from services.auto_collection_sync.calendar import add_business_days
    # 2026-01-01 (목, 신정) → 다음 영업일은 2026-01-02 (금)
    assert add_business_days(datetime.date(2025, 12, 31), 1) == datetime.date(2026, 1, 2)
```

- [ ] Run. Expected: FAIL.

- [ ] Create `services/auto_collection_sync/calendar.py`:

```python
"""한국 영업일 캘린더 — 주말 + 공휴일.

1차에서는 공휴일을 하드코딩 리스트로. 2차에서 holiday-kr 라이브러리 도입 검토.
"""
import datetime

# 2026년 공휴일 (대표적 한정 — 운영 시 매년 갱신)
KOREAN_HOLIDAYS_2026 = {
    datetime.date(2026, 1, 1),   # 신정
    datetime.date(2026, 2, 16),  # 설날 (음력 1/1)
    datetime.date(2026, 2, 17),
    datetime.date(2026, 2, 18),
    datetime.date(2026, 3, 1),   # 삼일절
    datetime.date(2026, 5, 5),   # 어린이날
    datetime.date(2026, 5, 24),  # 부처님오신날 (음력 4/8)
    datetime.date(2026, 6, 6),   # 현충일
    datetime.date(2026, 8, 15),  # 광복절
    datetime.date(2026, 9, 24),  # 추석 (음력 8/15)
    datetime.date(2026, 9, 25),
    datetime.date(2026, 9, 26),
    datetime.date(2026, 10, 3),  # 개천절
    datetime.date(2026, 10, 9),  # 한글날
    datetime.date(2026, 12, 25), # 성탄절
}


def is_business_day(d: datetime.date) -> bool:
    if d.weekday() >= 5:  # 토(5), 일(6)
        return False
    if d in KOREAN_HOLIDAYS_2026:
        return False
    return True


def add_business_days(start: datetime.date, n: int) -> datetime.date:
    """start 다음 n번째 영업일 반환. n=0 이면 start 가 영업일이 아닐 경우 다음 영업일."""
    d = start
    if n == 0:
        while not is_business_day(d):
            d += datetime.timedelta(days=1)
        return d
    remaining = n
    while remaining > 0:
        d += datetime.timedelta(days=1)
        if is_business_day(d):
            remaining -= 1
    return d
```

- [ ] Re-run. Expected: PASS.

### Step 9.2 — `settlement_watch.py` (TDD)

- [ ] Create `tests/auto_collection_sync/test_settlement_watch.py`:

```python
import datetime
from sqlmodel import select
from models import (
    Business, CardSalesApproval, BankTransaction, BankAccount,
    SettlementWatchAlert, CoupangEatsSettlement,
)

def test_card_overdue_creates_alert(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    # 5/6 매출, 5/13 현재 → 삼성 D+2 + grace 3 = 5/11 deadline 지남
    session.add(CardSalesApproval(
        business_id=1, approval_date=datetime.date(2026, 5, 6),
        card_corp="삼성", amount=540_000, status="승인", source="codef",
    ))
    session.commit()

    from services.auto_collection_sync import settlement_watch
    settlement_watch.run_for_business(session, business_id=1,
                                       today=datetime.date(2026, 5, 13))
    alerts = session.exec(select(SettlementWatchAlert)).all()
    assert any(a.alert_type == "card_overdue" and a.channel_or_corp == "삼성"
               for a in alerts)

def test_coupang_overdue_creates_alert(session):
    session.add(Business(id=1, name="X")); session.commit()
    session.add(CoupangEatsSettlement(
        business_id=1, store_id=10,
        settlement_date=datetime.date(2026, 5, 8),
        settlement_type="SETTLEMENT", amount=245_000,
    ))
    session.commit()
    from services.auto_collection_sync import settlement_watch
    settlement_watch.run_for_business(session, business_id=1,
                                       today=datetime.date(2026, 5, 13))
    alerts = session.exec(select(SettlementWatchAlert)).all()
    assert any(a.alert_type == "delivery_overdue" and a.channel_or_corp == "쿠팡이츠"
               for a in alerts)

def test_late_deposit_auto_closes_alert(session):
    """alert 가 open 상태일 때 늦은 입금이 들어오면 자동 received 로 close."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    a = SettlementWatchAlert(
        business_id=1, alert_type="card_overdue",
        channel_or_corp="삼성", expected_date=datetime.date(2026, 5, 10),
        expected_amount=540_000, deadline=datetime.date(2026, 5, 13),
        status="open", raw_ref="card_approval_group:test",
    )
    session.add(a); session.commit()
    # 늦게 입금
    session.add(BankTransaction(
        business_id=1, account_id=10,
        trans_date=datetime.date(2026, 5, 15),
        in_amount=540_000, remark1="삼성카드", tid="t-late",
    ))
    session.commit()

    from services.auto_collection_sync import settlement_watch
    settlement_watch.auto_close_received_alerts(session, business_id=1)
    refreshed = session.get(SettlementWatchAlert, a.id)
    assert refreshed.status == "received"
    assert refreshed.received_amount == 540_000
```

- [ ] Run. Expected: FAIL.

### Step 9.3 — `settlement_watch.py` 구현

- [ ] Create `services/auto_collection_sync/settlement_watch.py`:

```python
"""입금 모니터링 — spec § 8.8~8.15 참조.

카드: 카드사별 D+N 영업일 + grace_days 후에도 매칭 안 되면 alert.
배달 (쿠팡이츠): settlement_date + grace 후에도 입금 없으면 alert.
"""
import datetime
import logging
from typing import Optional
from sqlmodel import Session, select
from models import (
    CardSalesApproval, BankTransaction, CardCorpSettlementProfile,
    CoupangEatsSettlement, SettlementWatchAlert,
)
from .calendar import add_business_days
from .fee_estimator import DEFAULT_FEE_RATE, _detect_card_corp

log = logging.getLogger("auto_collection.settlement_watch")


CARD_CORP_SETTLEMENT_DAYS_DEFAULT = {
    "BC": 3, "삼성": 2, "신한": 2, "롯데": 3, "현대": 2,
    "하나": 3, "우리": 3, "KB": 2, "NH농협": 3, "기타": 4,
}


def _settlement_days_for(session, business_id, card_corp):
    p = session.exec(
        select(CardCorpSettlementProfile).where(
            CardCorpSettlementProfile.business_id == business_id,
            CardCorpSettlementProfile.card_corp == card_corp,
        )
    ).first()
    if p:
        return p.settlement_days_learned, p.grace_days
    return CARD_CORP_SETTLEMENT_DAYS_DEFAULT.get(card_corp, 4), 3


def _has_recent_matched_deposit(session, business_id, card_corp,
                                  approval_dates_start, approval_dates_end,
                                  expected_deposit_low) -> bool:
    """승인 구간에 대응하는 입금이 이미 들어왔나? (Fuzzy)"""
    txs = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= approval_dates_end,
            BankTransaction.trans_date <= approval_dates_end + datetime.timedelta(days=10),
            BankTransaction.in_amount >= expected_deposit_low * 0.95,
            BankTransaction.in_amount <= expected_deposit_low * 1.05,
        )
    ).all()
    for tx in txs:
        if _detect_card_corp(tx.remark1 or "") == card_corp:
            return True
    return False


def run_for_business(session: Session, business_id: int,
                      today: Optional[datetime.date] = None):
    """카드 + 쿠팡 미입금 alert 생성. 멱등."""
    if today is None:
        today = datetime.date.today()
    _watch_card(session, business_id, today)
    _watch_coupang(session, business_id, today)
    session.commit()


def _watch_card(session, business_id, today: datetime.date):
    # 최근 30일 승인 묶음 (carrier별 일자별 그룹)
    approvals = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == business_id,
            CardSalesApproval.approval_date >= today - datetime.timedelta(days=30),
            CardSalesApproval.status == "승인",
        )
    ).all()
    # group by (card_corp, approval_date)
    grouped = {}
    for a in approvals:
        key = (a.card_corp, a.approval_date)
        grouped.setdefault(key, []).append(a)

    for (corp, app_date), rows in grouped.items():
        sales = sum(r.amount or 0 for r in rows)
        if sales <= 0:
            continue
        n_days, grace = _settlement_days_for(session, business_id, corp)
        expected = add_business_days(app_date, n_days)
        deadline = expected + datetime.timedelta(days=grace)
        if today <= deadline:
            continue  # 아직 기다리는 중

        expected_amount = int(sales * (1 - DEFAULT_FEE_RATE))
        if _has_recent_matched_deposit(session, business_id, corp, app_date, app_date,
                                         expected_amount):
            continue

        # 멱등 — 같은 (alert_type, corp, expected_date) 면 skip (Unique)
        existing = session.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == business_id,
                SettlementWatchAlert.alert_type == "card_overdue",
                SettlementWatchAlert.channel_or_corp == corp,
                SettlementWatchAlert.expected_date == expected,
            )
        ).first()
        if existing:
            continue

        session.add(SettlementWatchAlert(
            business_id=business_id, alert_type="card_overdue",
            channel_or_corp=corp, expected_date=expected,
            expected_amount=expected_amount, deadline=deadline,
            status="open", raw_ref=f"card_approval_group:{corp}:{app_date.isoformat()}",
            notified_at=datetime.datetime.now(),
        ))


def _watch_coupang(session, business_id, today: datetime.date):
    settlements = session.exec(
        select(CoupangEatsSettlement).where(
            CoupangEatsSettlement.business_id == business_id,
            CoupangEatsSettlement.settlement_date >= today - datetime.timedelta(days=30),
            CoupangEatsSettlement.settlement_type == "SETTLEMENT",
        )
    ).all()
    for st in settlements:
        expected = st.settlement_date
        deadline = expected + datetime.timedelta(days=3)
        if today <= deadline:
            continue

        matched = session.exec(
            select(BankTransaction).where(
                BankTransaction.business_id == business_id,
                BankTransaction.trans_date >= expected - datetime.timedelta(days=1),
                BankTransaction.trans_date <= deadline,
                BankTransaction.in_amount == st.amount,
            )
        ).all()
        matched = [t for t in matched if "쿠팡" in (t.remark1 or "")]
        if matched:
            continue

        existing = session.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == business_id,
                SettlementWatchAlert.alert_type == "delivery_overdue",
                SettlementWatchAlert.channel_or_corp == "쿠팡이츠",
                SettlementWatchAlert.expected_date == expected,
            )
        ).first()
        if existing:
            continue

        session.add(SettlementWatchAlert(
            business_id=business_id, alert_type="delivery_overdue",
            channel_or_corp="쿠팡이츠", expected_date=expected,
            expected_amount=st.amount, deadline=deadline,
            status="open", raw_ref=f"coupang_settle:{st.id}",
            notified_at=datetime.datetime.now(),
        ))


def auto_close_received_alerts(session: Session, business_id: int):
    """늦게라도 매칭되는 입금이 들어오면 alert.status='received'."""
    open_alerts = session.exec(
        select(SettlementWatchAlert).where(
            SettlementWatchAlert.business_id == business_id,
            SettlementWatchAlert.status == "open",
        )
    ).all()
    for alert in open_alerts:
        match = None
        if alert.alert_type == "card_overdue":
            txs = session.exec(
                select(BankTransaction).where(
                    BankTransaction.business_id == business_id,
                    BankTransaction.trans_date >= alert.expected_date,
                    BankTransaction.in_amount >= alert.expected_amount * 0.95,
                    BankTransaction.in_amount <= alert.expected_amount * 1.05,
                )
            ).all()
            for tx in txs:
                if _detect_card_corp(tx.remark1 or "") == alert.channel_or_corp:
                    match = tx; break
        elif alert.alert_type == "delivery_overdue":
            txs = session.exec(
                select(BankTransaction).where(
                    BankTransaction.business_id == business_id,
                    BankTransaction.trans_date >= alert.expected_date,
                    BankTransaction.in_amount == alert.expected_amount,
                )
            ).all()
            for tx in txs:
                if "쿠팡" in (tx.remark1 or ""):
                    match = tx; break

        if match:
            alert.status = "received"
            alert.received_amount = int(match.in_amount)
            alert.received_date = match.trans_date
            session.add(alert)
    session.commit()
```

- [ ] Re-run test. Expected: PASS (3 tests).

### Step 9.4 — alert endpoint (acknowledge / false_positive)

- [ ] Add to `routers/auto_collection.py`:

```python
class AlertActionRequest(BaseModel):
    notes: Optional[str] = None


@router.get("/settlement-watch/alerts")
def list_alerts(
    status: str = "open",
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert
        rows = s.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == bid,
                SettlementWatchAlert.status == status,
            ).order_by(SettlementWatchAlert.deadline)
        ).all()
        return [_alert_dto(r) for r in rows]


@router.post("/settlement-watch/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int, body: AlertActionRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert
        a = s.get(SettlementWatchAlert, alert_id)
        if not a or a.business_id != bid:
            raise HTTPException(404, "alert not found")
        a.status = "acknowledged"
        a.acknowledged_at = datetime.datetime.now()
        a.acknowledged_by = admin.id
        a.notes = body.notes
        s.add(a); s.commit()
        return _alert_dto(a)


@router.post("/settlement-watch/alerts/{alert_id}/false-positive")
def mark_false_positive(
    alert_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert, CardCorpSettlementProfile
        a = s.get(SettlementWatchAlert, alert_id)
        if not a or a.business_id != bid:
            raise HTTPException(404, "alert not found")
        a.status = "false_positive"
        a.acknowledged_at = datetime.datetime.now()
        a.acknowledged_by = admin.id
        s.add(a)
        # 학습 — grace_days +1
        if a.alert_type == "card_overdue":
            profile = s.exec(
                select(CardCorpSettlementProfile).where(
                    CardCorpSettlementProfile.business_id == bid,
                    CardCorpSettlementProfile.card_corp == a.channel_or_corp,
                )
            ).first()
            if profile:
                profile.grace_days += 1
            else:
                profile = CardCorpSettlementProfile(
                    business_id=bid, card_corp=a.channel_or_corp,
                    grace_days=4,
                )
            s.add(profile)
        s.commit()
        return _alert_dto(a)


def _alert_dto(a):
    return {
        "id": a.id, "alert_type": a.alert_type,
        "channel_or_corp": a.channel_or_corp,
        "expected_date": a.expected_date.isoformat(),
        "expected_amount": a.expected_amount,
        "deadline": a.deadline.isoformat(),
        "status": a.status,
        "received_amount": a.received_amount,
        "received_date": a.received_date.isoformat() if a.received_date else None,
        "notes": a.notes,
    }
```

### Step 9.5 — Frontend SettlementWatch 카드

- [ ] Create `frontend/src/pages/AutoCollection/SettlementWatch.jsx`:

```jsx
import { useEffect, useState } from "react";
import api from "../../api";

export default function SettlementWatch() {
    const [alerts, setAlerts] = useState([]);
    const reload = () => api.get("/auto-collection/settlement-watch/alerts?status=open")
                            .then(r => setAlerts(r.data));
    useEffect(reload, []);

    const ack = (id) => api.post(`/auto-collection/settlement-watch/alerts/${id}/acknowledge`, {})
                            .then(reload);
    const fp = (id) => api.post(`/auto-collection/settlement-watch/alerts/${id}/false-positive`)
                            .then(reload);

    return (
        <div className="settlement-watch">
            <h3>입금 모니터</h3>
            {alerts.length === 0 && <p>✅ 미입금 의심 건 없음</p>}
            {alerts.map(a => (
                <div key={a.id} className="alert-card">
                    <p>
                        <b>{a.channel_or_corp}</b> {a.expected_date} 예상{" "}
                        {a.expected_amount.toLocaleString()}원 (deadline {a.deadline})
                    </p>
                    <button onClick={() => ack(a.id)}>확인함</button>
                    <button onClick={() => fp(a.id)}>입금 안된 것 아님</button>
                </div>
            ))}
        </div>
    );
}
```

- [ ] Mount in `pages/AutoCollection/index.jsx`:

```jsx
import SettlementWatch from "./SettlementWatch";
// ...
<SettlementWatch />
```

### Step 9.6 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/services/auto_collection_sync/calendar.py \
        SodamApp/backend/services/auto_collection_sync/settlement_watch.py \
        SodamApp/backend/routers/auto_collection.py \
        SodamApp/backend/tests/auto_collection_sync/test_calendar.py \
        SodamApp/backend/tests/auto_collection_sync/test_settlement_watch.py \
        SodamApp/frontend/src/pages/AutoCollection/SettlementWatch.jsx \
        SodamApp/frontend/src/pages/AutoCollection/index.jsx
git commit -m "feat(auto-collection): Task 9 - 입금 모니터링 + 학습형 false-positive"
```

---

## Task 10 — Cron 8개 등록 + Orbitron.yaml

**Files:**
- Modify: `routers/auto_collection.py` (cron endpoints 8개)
- Modify: `Orbitron.yaml` (cron 일정)

### Step 10.1 — Cron endpoints

- [ ] Add to `routers/auto_collection.py`:

```python
def _superadmin_only(admin: User):
    if admin.role != "superadmin":
        raise HTTPException(403, "superadmin only")


@router.post("/cron/easypos")
def cron_easypos(admin: User = Depends(get_superadmin_user)):
    """03:00 — EasyPOS 채널 수집 (전 사업장)."""
    from services.easypos_service import sync_all_businesses
    return sync_all_businesses()


@router.post("/cron/coupang-eats")
def cron_coupang(admin: User = Depends(get_superadmin_user)):
    """03:10 — 쿠팡이츠 채널 수집."""
    from services.coupang_eats_service import sync_all_businesses
    return sync_all_businesses()


@router.post("/cron/bank-sync")
def cron_bank(admin: User = Depends(get_superadmin_user)):
    """03:20 — 은행 거래 수집 (기존 인프라 위임)."""
    from routers.bank_sync import cron_pull_all
    return cron_pull_all()


@router.post("/cron/orchestrator")
def cron_orchestrator(admin: User = Depends(get_superadmin_user)):
    """03:30 — 분류·동기화 fan-out (모든 사업장)."""
    with Session(engine) as s:
        from services.auto_collection_sync.orchestrator import run_all_businesses
        reports = run_all_businesses(s)
        return {"business_count": len(reports),
                 "total_events": sum(r.total_events for r in reports)}


@router.post("/cron/profit-loss")
def cron_profit_loss(admin: User = Depends(get_superadmin_user)):
    """03:40 — 손익 재계산 (이번달 + 지난달)."""
    with Session(engine) as s:
        from services.profit_loss_service import recalc_all_businesses
        return recalc_all_businesses(s)


@router.post("/cron/notify")
def cron_notify(admin: User = Depends(get_superadmin_user)):
    """03:45 — 사장님 일일 알림."""
    with Session(engine) as s:
        from services.auto_collection_sync.orchestrator import notify_summary, run_all_businesses
        # 이미 03:30 에서 동기화 끝났으니, sync_log 들에서 요약 추출 후 알림만
        # 간단히는 빈 reports + 별도 summary 호출
        notify_summary(s, [])
        return {"sent": True}


@router.post("/cron/settlement-watch")
def cron_settlement_watch(admin: User = Depends(get_superadmin_user)):
    """04:00 — 입금 모니터링 + 자동 close + 알림."""
    with Session(engine) as s:
        from services.auto_collection_sync import settlement_watch
        from models import Business
        bizs = s.exec(select(Business).where(Business.subscription_status == "active")).all()
        for biz in bizs:
            settlement_watch.run_for_business(s, biz.id)
            settlement_watch.auto_close_received_alerts(s, biz.id)
        return {"business_count": len(bizs)}


@router.post("/cron/learn-fee-rates")
def cron_learn_fee_rates(admin: User = Depends(get_superadmin_user)):
    """일요일 04:30 — 카드사별 수수료율 학습 갱신."""
    with Session(engine) as s:
        from services.auto_collection_sync.fee_estimator import update_learned_rate
        from models import Business, CardSalesApproval
        bizs = s.exec(select(Business).where(Business.subscription_status == "active")).all()
        for biz in bizs:
            corps = s.exec(
                select(CardSalesApproval.card_corp).where(
                    CardSalesApproval.business_id == biz.id
                ).distinct()
            ).all()
            for corp in corps:
                update_learned_rate(s, biz.id, corp)
        return {"business_count": len(bizs)}
```

### Step 10.2 — Orbitron.yaml cron 등록

- [ ] Modify `Orbitron.yaml`. Add to backend service `crons` section:

```yaml
crons:
  - name: auto-collection-easypos
    schedule: "0 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/easypos
  - name: auto-collection-coupang
    schedule: "10 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/coupang-eats
  - name: auto-collection-bank
    schedule: "20 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/bank-sync
  - name: auto-collection-orchestrator
    schedule: "30 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/orchestrator
  - name: auto-collection-pl
    schedule: "40 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/profit-loss
  - name: auto-collection-notify
    schedule: "45 3 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/notify
  - name: auto-collection-settlement-watch
    schedule: "0 4 * * *"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/settlement-watch
  - name: auto-collection-learn-fee-rates
    schedule: "30 4 * * 0"
    command: curl -X POST -H "Authorization: Bearer $SUPERADMIN_TOKEN" $BACKEND_URL/api/auto-collection/cron/learn-fee-rates
```

`$SUPERADMIN_TOKEN` 과 `$BACKEND_URL` 은 Orbitron 환경변수에 사전 설정. (메모리 기록상 환경변수는 대시보드에서 직접 설정 필수.)

### Step 10.3 — Smoke 테스트

- [ ] Run backend locally: `cd SodamApp/backend && uvicorn main:app --reload`
- [ ] Trigger cron endpoint manually:

```bash
curl -X POST -H "Authorization: Bearer <SUPERADMIN_TOKEN>" \
     http://localhost:8000/api/auto-collection/cron/orchestrator
```

Expected: 200 OK with `{"business_count": N, "total_events": M}`.

### Step 10.4 — 커밋

- [ ] Commit:

```bash
git add SodamApp/backend/routers/auto_collection.py Orbitron.yaml
git commit -m "feat(auto-collection): Task 10 - cron 8개 endpoint + Orbitron.yaml 등록"
```

---

## Task 11 — 운영 검증 + 사장님 1주 사용

이 단계는 코드 변경이 아니라 **사장님 검증 워크플로우**.

### Step 11.1 — 1개 사업장 dry-run

- [ ] 사장님과 함께 1개 사업장(소담김밥 건대본점) 에 `feature_auto_collection=True` 활성.
- [ ] Superadmin 화면에서 [백필 실행] — 기간 2026-01-01 ~ 2026-05-13.
- [ ] 결과 확인:
  - `DailyExpense` 에 `source='auto_*'` 행이 생성됐는가?
  - `manual_overwritten` 행이 백업됐는가?
  - `CardFeeMatchLog` 가 채워졌는가?
  - `SettlementWatchAlert` 가 발생했는가? (없다면 정상)

### Step 11.2 — 매출/손익 화면 검증

- [ ] [매출관리] 열어 자동 데이터 표시 확인.
- [ ] [손익관리] 열어 수수료 신뢰도 뱃지 확인 (🟢/🟡/🟠).
- [ ] 사장님이 기존 손익 숫자와 비교 — 큰 괴리 없는지 검증.

### Step 11.3 — 텔레그램 알림 확인

- [ ] 다음날 03:45 텔레그램에 일일 알림 도착 확인.
- [ ] 04:00 입금 모니터링 알림 (있다면) 도착 확인.

### Step 11.4 — 1주 운영 후 회고

- [ ] 사장님이 false positive 알림 처리 — `[입금 안된 것 아님]` 클릭 → grace_days 학습 확인.
- [ ] 사장님이 [백업 토글] 켜고 manual_overwritten 행 확인 → 복구 가능성 확인.
- [ ] 1주 후 사장님 만족도 검토 → Task 5 의 `_sync_classified_to_models` 리팩토링을 정식 normalizer 호출로 교체할지 결정.

### Step 11.5 — 1단계 정리 커밋 (필요 시)

- [ ] 1주 운영 후 발견한 회귀나 버그 수정 → 별도 PR.
- [ ] 모든 검증 완료 후 spec 문서 상태를 "구현 완료, 운영 중" 으로 업데이트.

```bash
git commit -m "docs(auto-collection): Phase 1 운영 검증 완료 (사장님 1주 사용)"
```

---

## Self-Review

### Spec 커버리지 매핑

| Spec 섹션 | Plan Task |
|----------|-----------|
| 4.1~4.7 데이터 모델 | Task 1 |
| 5.1~5.8 분류·동기화 service | Task 2, 3, 4, 5 |
| 6.1~6.5 수수료 자동 추정 + DeliveryFeeRate | Task 6 |
| 7.1~7.4 마이그레이션 + 등급 토글 + 백업 UI | Task 7 |
| 8.1~8.7 운영/모니터링 (cron, 알림, 대시보드) | Task 8, 10 |
| 8.8~8.15 입금 모니터링 (Settlement Watch) | Task 9 |
| 10 DB SQL | Task 1 (마이그 스크립트) |
| 11 코드 변경 영향 | 각 Task 별로 분산 적용 |
| 12 위험 | Task 6 (학습 부족), Task 9 (false positive), Task 11 (운영 검증) |
| 13 성공 기준 | Task 11 (1주 운영 후 검증) |
| 14 다음 단계 (11단계) | Task 1~11 (정확히 1:1) |

### 잠재 모순 / 잔여 모호성

1. **`fee_estimator._detect_card_corp`** — Task 6 에서 정의됨. Task 9 의 `settlement_watch._has_recent_matched_deposit` 가 import 하므로 의존 OK.
2. **`telegram_service.send_message`** — Task 8 에서 호출하지만 stub 일 가능성. 메모리상 `telegram:configure` 인프라가 있으므로 실제 모듈 위치 확인 필요. 1차에는 print 로 시작해도 무방.
3. **`EasyPosSyncLog`, `CoupangEatsSyncLog`** — Task 8 의 `/status` endpoint 가 참조. 이 모델은 기존 EasyPOS/쿠팡이츠 service 에서 이미 생성하는 sync_log 모델. 존재 확인 후 그대로 사용.
4. **`profit_loss_service.recalc_all_businesses`** — Task 10 cron 에서 호출. 기존 함수 시그니처 확인 필요. 없으면 Task 6 에서 fee_estimator 적용한 시점에 추가.

### Type consistency 검증

- `SyncEvent.amount` — 모든 normalizer 에서 `int` 로 강제 (`int(...)`). ✓
- `OrchestratorReport.total_events` vs `FanOutReport.total_events` — 동일 키. ✓
- `CardFeeEstimate.source` Literal — Task 6 정의 후 Task 9 / 손익 화면이 동일 문자열 사용. ✓

---

## 실행 방식 선택

**Plan saved to `docs/superpowers/plans/2026-05-13-auto-collection-pipeline.md`. 두 가지 실행 옵션:**

**1. Subagent-Driven (권장)** — Task 마다 fresh subagent 디스패치, Task 사이 리뷰, 빠른 반복
**2. Inline Execution** — 본 세션에서 executing-plans 로 batch 실행, checkpoint 마다 리뷰

어느 방식으로 진행할까요?
