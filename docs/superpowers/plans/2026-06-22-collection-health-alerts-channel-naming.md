# 수집 건강도 알림 + Revenue 채널명 한글 통일 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동수집 채널이 멈추면 사장님(SMS)·개발자(텔레그램)에게 능동 푸시로 알리고, 일별 Revenue 채널명을 한글로 통일한다.

**Architecture:** 두 독립 파트. Part B(채널명)는 상수 도입 + 2개 서비스의 write/read 치환 + idempotent ORM 마이그레이션. Part A(알림)는 신규 `telegram_service`(no-op 기본) + `CollectionHealthAlert` 모델 + `collection_health` 판정 서비스 + `health-watch` cron 엔드포인트 + status API 확장.

**Tech Stack:** Python 3.12, FastAPI, SQLModel/SQLAlchemy, pytest, 팝빌 SDK(SMS), Telegram Bot API(requests).

## Global Constraints

- 마이그레이션은 **idempotent** — 2회 호출해도 에러 없어야 함. 패턴: `database.py`의 `_ensure_column`/`_run_*_migrations`.
- 마이그레이션 등록은 **두 곳**: `database.py:create_db_and_tables` + `init_db._run_migrations` (HEAD 규칙).
- 파일 업로드·외부호출 실패는 **422**(401 아님 — axios 인터셉터 자동 로그아웃 회피).
- 신규 env는 **4곳 동기화**: `backend/.env` + `.env.example` + `Orbitron.yaml` backend env + Orbitron secrets. 프론트 VITE 불요.
- DB 중립: 운영 Postgres / 테스트 sqlite 둘 다 통과해야 하므로 데이터 마이그레이션은 **ORM 레벨**(raw `UPDATE...FROM` 금지).
- 채널명 표준: `"매장"`, `"쿠팡이츠"` (DeliveryRevenue 한글 체계와 일치). 배민은 일별 Revenue 미사용 — 대상 아님.
- cron 인증: `X-Cron-Secret` 헤더 = `CRON_SHARED_SECRET`. 호스트 crontab은 KST 기준.

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `backend/constants.py` | Revenue 채널명 표준 상수 | 신규 |
| `backend/services/easypos_service.py` | EasyPOS Revenue upsert | 수정 (572,584) |
| `backend/services/coupang_eats_service.py` | 쿠팡 Revenue upsert | 수정 (1057,1069) |
| `backend/database.py` | 채널명 데이터 마이그레이션 | 수정 (+함수, create_db_and_tables) |
| `backend/init_db.py` | 운영 startup 마이그레이션 등록 | 수정 (_run_migrations) |
| `backend/services/telegram_service.py` | 텔레그램 발송 (no-op 기본) | 신규 |
| `backend/models.py` | `CollectionHealthAlert` 모델 | 수정 (+클래스) |
| `backend/services/collection_health.py` | 채널 건강 판정 + 알림 디스패치 | 신규 |
| `backend/routers/auto_collection.py` | `/cron/health-watch` 엔드포인트 | 수정 (+엔드포인트) |
| `backend/routers/external_integration_status.py` | EasyPOS·CODEF 채널 추가 | 수정 |
| `backend/.env(.example)`, `Orbitron.yaml` | 신규 env | 수정 |
| `backend/tests/...` | 각 단위 테스트 | 신규 |

---

# Part B — Revenue 채널명 한글 통일

## Task 1: 채널명 상수 도입 + write/read 치환

**Files:**
- Create: `SodamApp/backend/constants.py`
- Modify: `SodamApp/backend/services/easypos_service.py:572,584`
- Modify: `SodamApp/backend/services/coupang_eats_service.py:1057,1069`
- Test: `SodamApp/backend/tests/test_revenue_channels.py`

**Interfaces:**
- Produces: `constants.REVENUE_CHANNEL_STORE = "매장"`, `constants.REVENUE_CHANNEL_COUPANG = "쿠팡이츠"`

- [ ] **Step 1: 상수 파일 생성**

```python
# SodamApp/backend/constants.py
"""프로젝트 공용 상수. 매직스트링 단일 출처."""

# 일별 Revenue 테이블 채널명 표준 (한글 — DeliveryRevenue 체계와 일치)
REVENUE_CHANNEL_STORE = "매장"        # EasyPOS 매장 카드매출
REVENUE_CHANNEL_COUPANG = "쿠팡이츠"   # 쿠팡이츠 배달매출
```

- [ ] **Step 2: 실패 테스트 작성**

```python
# SodamApp/backend/tests/test_revenue_channels.py
from constants import REVENUE_CHANNEL_STORE, REVENUE_CHANNEL_COUPANG


def test_channel_constants_are_korean():
    assert REVENUE_CHANNEL_STORE == "매장"
    assert REVENUE_CHANNEL_COUPANG == "쿠팡이츠"


def test_easypos_service_uses_constant():
    import services.easypos_service as m
    import inspect
    src = inspect.getsource(m.upsert_revenue_aggregate)
    assert '"Store"' not in src and "'Store'" not in src, "하드코딩 'Store' 잔존"


def test_coupang_service_uses_constant():
    import services.coupang_eats_service as m
    import inspect
    src = inspect.getsource(m.upsert_revenue_from_orders)
    assert '"CoupangEats"' not in src and "'CoupangEats'" not in src, "하드코딩 'CoupangEats' 잔존"
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_revenue_channels.py -v`
Expected: `test_easypos_service_uses_constant`/`test_coupang_service_uses_constant` FAIL (하드코딩 잔존).

- [ ] **Step 4: easypos_service 치환**

`services/easypos_service.py` `upsert_revenue_aggregate` 내 import 추가 후 2곳 치환:
```python
    from models import EasyPosSaleReceipt, Revenue
    from constants import REVENUE_CHANNEL_STORE
```
- line 572: `Revenue.channel == "Store",` → `Revenue.channel == REVENUE_CHANNEL_STORE,`
- line 584: `channel="Store",` → `channel=REVENUE_CHANNEL_STORE,`
- 주석 547 `channel='Store'` → `channel='매장'` (문서 일관)

- [ ] **Step 5: coupang_eats_service 치환**

`services/coupang_eats_service.py` `upsert_revenue_from_orders` 내 import 추가 후 2곳 치환:
```python
    from models import CoupangEatsOrder, Revenue
    from constants import REVENUE_CHANNEL_COUPANG
```
- line 1057: `Revenue.channel == "CoupangEats",` → `Revenue.channel == REVENUE_CHANNEL_COUPANG,`
- line 1069: `channel="CoupangEats",` → `channel=REVENUE_CHANNEL_COUPANG,`
- 주석 1028 `channel='CoupangEats'` → `channel='쿠팡이츠'`

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_revenue_channels.py -v`
Expected: 3 PASS.

- [ ] **Step 7: 커밋**

```bash
git add SodamApp/backend/constants.py SodamApp/backend/services/easypos_service.py SodamApp/backend/services/coupang_eats_service.py SodamApp/backend/tests/test_revenue_channels.py
git commit -m "refactor(revenue): 채널명 상수 도입 + write/read 한글 치환 (Store→매장, CoupangEats→쿠팡이츠)"
```

---

## Task 2: Revenue 채널명 데이터 마이그레이션 (idempotent + 중복 병합)

**Files:**
- Modify: `SodamApp/backend/database.py` (+`_run_revenue_channel_migration`, `create_db_and_tables`에 호출)
- Modify: `SodamApp/backend/init_db.py:67` (`_run_migrations` 끝에 호출)
- Test: `SodamApp/backend/tests/test_revenue_channel_migration.py`

**Interfaces:**
- Produces: `database._run_revenue_channel_migration(engine_) -> None` — idempotent. `'Store'→'매장'`, `'CoupangEats'→'쿠팡이츠'`. 같은 (business_id, date)에 영문+한글 공존 시 한글 행에 amount 합산 후 영문 행 삭제.

- [ ] **Step 1: 실패 테스트 작성**

```python
# SodamApp/backend/tests/test_revenue_channel_migration.py
"""Revenue 채널명 마이그레이션 — idempotent + 중복 병합."""
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
    SQLModel.metadata.create_all(database.engine)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


def _add(db, channel, biz, d, amount):
    from models import Revenue
    with Session(db.engine) as s:
        s.add(Revenue(business_id=biz, date=d, channel=channel, amount=amount))
        s.commit()


def test_simple_rename_no_overlap(db):
    """겹치지 않는 영문 행은 한글로 rename."""
    from models import Revenue
    d = datetime.date(2026, 6, 20)
    _add(db, "Store", 1, d, 1000)
    _add(db, "CoupangEats", 1, d, 500)

    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        chans = {r.channel: r.amount for r in s.exec(select(Revenue)).all()}
    assert chans == {"매장": 1000, "쿠팡이츠": 500}


def test_merge_on_overlap(db):
    """같은 (biz,date)에 영문+한글 공존 → 한글에 합산, 영문 삭제."""
    from models import Revenue
    d = datetime.date(2026, 2, 28)
    _add(db, "매장", 1, d, 700)      # 구 레거시
    _add(db, "Store", 1, d, 300)     # 신규 영문

    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        rows = s.exec(select(Revenue).where(Revenue.channel == "매장")).all()
        eng = s.exec(select(Revenue).where(Revenue.channel == "Store")).all()
    assert len(rows) == 1 and rows[0].amount == 1000
    assert len(eng) == 0


def test_idempotent(db):
    """2회 호출해도 안전 (두 번째는 no-op)."""
    from models import Revenue
    d = datetime.date(2026, 6, 20)
    _add(db, "Store", 1, d, 1000)

    db._run_revenue_channel_migration(db.engine)
    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        rows = s.exec(select(Revenue).where(Revenue.channel == "매장")).all()
    assert len(rows) == 1 and rows[0].amount == 1000
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_revenue_channel_migration.py -v`
Expected: FAIL — `AttributeError: module 'database' has no attribute '_run_revenue_channel_migration'`.

- [ ] **Step 3: 마이그레이션 함수 구현 (database.py)**

`database.py`의 `_run_private_payment_migrations` 아래에 추가:
```python
def _run_revenue_channel_migration(engine_):
    """Revenue 채널명 한글 통일 — idempotent (ORM, DB 중립).

    'Store'→'매장', 'CoupangEats'→'쿠팡이츠'. 같은 (business_id, date)에
    영문+한글이 공존하면 한글 행에 amount 합산 후 영문 행 삭제.
    """
    from sqlmodel import Session, select
    from models import Revenue
    renames = {"Store": "매장", "CoupangEats": "쿠팡이츠"}
    with Session(engine_) as s:
        for eng_name, kor_name in renames.items():
            eng_rows = s.exec(select(Revenue).where(Revenue.channel == eng_name)).all()
            for er in eng_rows:
                dup = s.exec(select(Revenue).where(
                    Revenue.channel == kor_name,
                    Revenue.business_id == er.business_id,
                    Revenue.date == er.date,
                )).first()
                if dup:
                    dup.amount = (dup.amount or 0) + (er.amount or 0)
                    s.add(dup)
                    s.delete(er)
                else:
                    er.channel = kor_name
                    s.add(er)
        s.commit()
```

`create_db_and_tables`에 호출 추가 (line 52 아래):
```python
    _run_private_payment_migrations(engine)
    _run_revenue_channel_migration(engine)
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_revenue_channel_migration.py -v`
Expected: 3 PASS.

- [ ] **Step 5: init_db 운영 startup 등록**

`init_db.py` `_run_migrations()` 함수 끝에 추가 (정확한 위치는 함수 본문 끝 — `_column_exists` 류 호출들 뒤):
```python
    # Revenue 채널명 한글 통일 (spec 2026-06-22)
    from database import _run_revenue_channel_migration, engine as _eng
    _run_revenue_channel_migration(_eng)
```
> init_db가 자체 engine을 쓰면 그 engine을 전달. `_run_migrations` 본문을 읽어 기존 engine 변수명을 확인 후 맞춰 호출할 것.

- [ ] **Step 6: 운영 안전 점검 스크립트 (수동 실행용, 커밋 포함)**

```python
# SodamApp/backend/scripts/migrations/preview_revenue_channel_rename.py
"""운영 적용 전 채널별 스냅샷 + 겹침 행 미리보기 (읽기 전용)."""
import sys
sys.path.insert(0, ".")
from sqlmodel import Session, select, func
from database import engine
from models import Revenue

with Session(engine) as s:
    print("=== 채널별 현황 ===")
    for ch, cnt, mn, mx in s.exec(
        select(Revenue.channel, func.count(), func.min(Revenue.date), func.max(Revenue.date))
        .group_by(Revenue.channel)
    ):
        print(f"  {ch}: {cnt}건 {mn}~{mx}")
    print("=== 겹침(병합 대상) ===")
    for eng_name, kor in (("Store", "매장"), ("CoupangEats", "쿠팡이츠")):
        eng_rows = s.exec(select(Revenue).where(Revenue.channel == eng_name)).all()
        overlap = 0
        for er in eng_rows:
            if s.exec(select(Revenue).where(
                Revenue.channel == kor, Revenue.business_id == er.business_id,
                Revenue.date == er.date)).first():
                overlap += 1
        print(f"  {eng_name}→{kor}: 영문 {len(eng_rows)}건 중 겹침 {overlap}건")
```

- [ ] **Step 7: 커밋**

```bash
git add SodamApp/backend/database.py SodamApp/backend/init_db.py SodamApp/backend/tests/test_revenue_channel_migration.py SodamApp/backend/scripts/migrations/preview_revenue_channel_rename.py
git commit -m "feat(revenue): 채널명 한글 통일 idempotent 마이그레이션 + 병합 + 미리보기 스크립트"
```

---

# Part A — 수집 건강도 알림

## Task 3: telegram_service (no-op 기본)

**Files:**
- Create: `SodamApp/backend/services/telegram_service.py`
- Test: `SodamApp/backend/tests/test_telegram_service.py`

**Interfaces:**
- Produces: `telegram_service.send_message(text: str) -> bool` — env `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` 미설정 시 `False` 반환(no-op, 예외 없음). 설정 시 Bot API 호출 후 성공 여부.

- [ ] **Step 1: 실패 테스트 작성**

```python
# SodamApp/backend/tests/test_telegram_service.py
import importlib


def test_noop_when_unconfigured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    import services.telegram_service as t
    importlib.reload(t)
    assert t.send_message("hello") is False  # no-op, 예외 없음


def test_calls_api_when_configured(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "TOK")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "123")
    import services.telegram_service as t
    importlib.reload(t)
    calls = {}

    def fake_post(url, json, timeout):
        calls["url"] = url
        calls["json"] = json
        class R:
            status_code = 200
            def json(self_): return {"ok": True}
        return R()

    monkeypatch.setattr(t.requests, "post", fake_post)
    assert t.send_message("hello") is True
    assert "TOK" in calls["url"] and calls["json"]["chat_id"] == "123"
    assert calls["json"]["text"] == "hello"
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_telegram_service.py -v`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```python
# SodamApp/backend/services/telegram_service.py
"""텔레그램 봇 알림 — 개발자(Steven) 기술경보용.

env TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 no-op (False 반환).
1차 배포에서는 토큰 미설정 → 자동 비활성. 토큰 주입 시 즉시 동작.
"""
from __future__ import annotations
import os
import logging
import requests

log = logging.getLogger("telegram_service")


def send_message(text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        log.info("telegram no-op (unconfigured): %s", text[:80])
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        if resp.status_code == 200 and resp.json().get("ok"):
            return True
        log.warning("telegram send failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:  # noqa: BLE001
        log.warning("telegram send error: %s", e)
        return False
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_telegram_service.py -v`
Expected: 2 PASS.

- [ ] **Step 5: 기존 notify_summary 호환 확인**

`services/auto_collection_sync/orchestrator.py:84`는 이미 `from services.telegram_service import send_message`를 시도한다. 신규 모듈이 그 import를 만족하는지 확인:
Run: `cd SodamApp/backend && python -c "from services.telegram_service import send_message; print('ok')"`
Expected: `ok`

- [ ] **Step 6: 커밋**

```bash
git add SodamApp/backend/services/telegram_service.py SodamApp/backend/tests/test_telegram_service.py
git commit -m "feat(alert): telegram_service 신규 (no-op 기본, 토큰 주입 시 활성)"
```

---

## Task 4: CollectionHealthAlert 모델 + 마이그레이션

**Files:**
- Modify: `SodamApp/backend/models.py` (+클래스, SettlementWatchAlert 인근)
- Modify: `SodamApp/backend/database.py` (테이블 생성은 `create_all`이 처리 — 별도 마이그레이션 불요, 단 운영 기존 DB엔 `create_all`이 신규 테이블만 생성)
- Test: `SodamApp/backend/tests/test_collection_health_alert_model.py`

**Interfaces:**
- Produces: `models.CollectionHealthAlert` — 컬럼: `id, business_id, channel_key:str, status:str('open'|'resolved'), alert_type:str, opened_at, last_notified_at, resolved_at, detail:str`. unique (business_id, channel_key).

- [ ] **Step 1: 실패 테스트 작성**

```python
# SodamApp/backend/tests/test_collection_health_alert_model.py
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
    SQLModel.metadata.create_all(database.engine)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


def test_create_and_query(db):
    from models import CollectionHealthAlert
    with Session(db.engine) as s:
        s.add(CollectionHealthAlert(
            business_id=1, channel_key="coupang_eats",
            status="open", alert_type="failed",
            opened_at=datetime.datetime.utcnow(), detail="쿠키 만료",
        ))
        s.commit()
        row = s.exec(select(CollectionHealthAlert).where(
            CollectionHealthAlert.channel_key == "coupang_eats")).first()
    assert row.status == "open" and row.alert_type == "failed"
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health_alert_model.py -v`
Expected: FAIL — `ImportError: cannot import name 'CollectionHealthAlert'`.

- [ ] **Step 3: 모델 추가 (models.py, SettlementWatchAlert 아래)**

```python
class CollectionHealthAlert(SQLModel, table=True):
    """자동수집 채널 건강 경보 — 중복 발송 방지 + 복구 추적.

    (business_id, channel_key) 당 1행. open→resolved 상태전이.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "channel_key",
                         name="uq_collection_health_alert"),
        Index("ix_collection_health_biz_status", "business_id", "status"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    channel_key: str = Field(max_length=32, index=True,
                             description="easypos / coupang_eats / baemin / codef_card / codef_bank")
    status: str = Field(default="open", index=True, description="open / resolved")
    alert_type: str = Field(max_length=32, description="failed / stale / skipping / expiring_soon")
    opened_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    last_notified_at: Optional[datetime.datetime] = None
    resolved_at: Optional[datetime.datetime] = None
    detail: Optional[str] = Field(default=None, max_length=500)
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health_alert_model.py -v`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/models.py SodamApp/backend/tests/test_collection_health_alert_model.py
git commit -m "feat(alert): CollectionHealthAlert 모델 (중복방지+복구추적)"
```

---

## Task 5: 채널 건강 판정 로직

**Files:**
- Create: `SodamApp/backend/services/collection_health.py`
- Test: `SodamApp/backend/tests/test_collection_health.py`

**Interfaces:**
- Consumes: `external_integration_status._classify_status` (쿠키 기반 판정 재사용).
- Produces:
  - `collection_health.evaluate_channels(session, business_id, now) -> list[ChannelHealth]`
  - `ChannelHealth` = dataclass(`channel_key:str, label:str, status:str, detail:str, last_data_date:Optional[date]`)
  - `status` ∈ {`healthy`, `failed`, `stale`, `skipping`, `expiring_soon`}

- [ ] **Step 1: 실패 테스트 작성**

```python
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health.py -v`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```python
# SodamApp/backend/services/collection_health.py
"""자동수집 채널 건강 판정.

각 채널의 credential 상태 + raw 데이터 최신성으로 status 산출.
- easypos / coupang_eats / baemin: 쿠키·연속실패 + raw MAX(date)
- codef_card / codef_bank: CodefConnection.status + CodefCallLog 최신성
"""
from __future__ import annotations
import datetime
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select, func

STALE_DAYS = 2


@dataclass
class ChannelHealth:
    channel_key: str
    label: str
    status: str          # healthy / failed / stale / skipping / expiring_soon
    detail: str
    last_data_date: Optional[datetime.date] = None


def _max_date(session: Session, col) -> Optional[datetime.date]:
    v = session.exec(select(func.max(col))).first()
    if v is None:
        return None
    return v.date() if isinstance(v, datetime.datetime) else v


def _eval_cookie_channel(session, business_id, now, *, cred, label, key,
                          data_col) -> ChannelHealth:
    """쿠팡/배민 — 쿠키 기반."""
    if cred is None:
        return ChannelHealth(key, label, "skipping", "자격증명 미등록")
    if cred.status in ("failed", "cookie_invalid", "expired") or \
            (cred.consecutive_failures or 0) >= 3:
        return ChannelHealth(key, label, "failed",
                             f"인증 실패 ({cred.status}, 연속 {cred.consecutive_failures})")
    last = _max_date(session, data_col) if data_col is not None else None
    if last is None or (now.date() - last).days > STALE_DAYS:
        return ChannelHealth(key, label, "stale",
                             f"최근 {STALE_DAYS}일 데이터 없음 (최신 {last})", last)
    return ChannelHealth(key, label, "healthy", "정상", last)


def evaluate_channels(session: Session, business_id: int,
                      now: datetime.datetime) -> list[ChannelHealth]:
    from models import (
        EasyPosCredential, EasyPosSaleReceipt,
        CoupangEatsCredential, CoupangEatsOrder,
        BaeminCredential, BaeminOrder,
        CodefConnection, CodefCallLog,
    )
    out: list[ChannelHealth] = []

    # EasyPOS — active credential + raw 최신성
    ez = session.exec(select(EasyPosCredential).where(
        EasyPosCredential.business_id == business_id)).first()
    if ez is None:
        out.append(ChannelHealth("easypos", "EasyPOS", "skipping", "자격증명 미등록"))
    elif ez.status != "active":
        out.append(ChannelHealth("easypos", "EasyPOS", "failed", f"status={ez.status}"))
    else:
        last = _max_date(session, EasyPosSaleReceipt.sale_date)
        if last is None or (now.date() - last).days > STALE_DAYS:
            out.append(ChannelHealth("easypos", "EasyPOS", "stale",
                                     f"최근 {STALE_DAYS}일 데이터 없음 (최신 {last})", last))
        else:
            out.append(ChannelHealth("easypos", "EasyPOS", "healthy", "정상", last))

    # 쿠팡이츠
    ce = session.exec(select(CoupangEatsCredential).where(
        CoupangEatsCredential.business_id == business_id)).first()
    out.append(_eval_cookie_channel(session, business_id, now, cred=ce,
                                    label="쿠팡이츠", key="coupang_eats",
                                    data_col=CoupangEatsOrder.ordered_at))

    # 배민
    bm = session.exec(select(BaeminCredential).where(
        BaeminCredential.business_id == business_id)).first()
    out.append(_eval_cookie_channel(session, business_id, now, cred=bm,
                                    label="배민", key="baemin",
                                    data_col=BaeminOrder.ordered_at))

    # CODEF — 연결 status + 마지막 호출 최신성. 자동 cron 없어 stale 정상.
    conns = session.exec(select(CodefConnection).where(
        CodefConnection.business_id == business_id)).all()
    for conn_type, key, label in (("card_purchase", "codef_card", "CODEF 카드"),
                                  ("bank", "codef_bank", "CODEF 은행")):
        matching = [c for c in conns if c.connection_type == conn_type]
        if not matching:
            continue
        if any(c.status != "active" for c in matching):
            out.append(ChannelHealth(key, label, "failed", "연결 비활성"))
            continue
        last_call = session.exec(select(func.max(CodefCallLog.called_at))).first()
        last = last_call.date() if last_call else None
        if last is None or (now.date() - last).days > STALE_DAYS:
            out.append(ChannelHealth(key, label, "stale",
                                     f"수동 수집 필요 (최신 {last})", last))
        else:
            out.append(ChannelHealth(key, label, "healthy", "정상", last))

    return out
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health.py -v`
Expected: 3 PASS.

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/services/collection_health.py SodamApp/backend/tests/test_collection_health.py
git commit -m "feat(alert): 채널 건강 판정 로직 (credential + raw 최신성)"
```

---

## Task 6: 알림 디스패치 + 중복방지 + health-watch 엔드포인트

**Files:**
- Modify: `SodamApp/backend/services/collection_health.py` (+`dispatch_alerts`)
- Modify: `SodamApp/backend/routers/auto_collection.py` (+`/cron/health-watch`)
- Test: `SodamApp/backend/tests/test_collection_health_dispatch.py`

**Interfaces:**
- Consumes: `evaluate_channels`, `CollectionHealthAlert`, `NotificationService.send_sms`, `telegram_service.send_message`.
- Produces: `collection_health.dispatch_alerts(session, business_id, now, *, sms_send, tg_send) -> dict` — 이상 채널을 open 처리·발송, 해소 채널을 resolved 처리·발송. `sms_send(phone, text)`·`tg_send(text)`는 주입(테스트 가능). 반환 `{"opened": [...], "resolved": [...], "renotified": [...]}`.

- [ ] **Step 1: 실패 테스트 작성**

```python
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
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health_dispatch.py -v`
Expected: FAIL — `dispatch_alerts` 없음.

- [ ] **Step 3: dispatch_alerts 구현 (collection_health.py에 추가)**

```python
RENOTIFY_DAYS = 3
ALERTABLE = {"failed", "stale", "skipping", "expiring_soon"}


def dispatch_alerts(session, business_id, now, *, sms_send, tg_send,
                    owner_phone: str = "") -> dict:
    """채널 건강 평가 후 경보 open/resolve + 발송. 발송 함수는 주입."""
    from models import CollectionHealthAlert
    healths = evaluate_channels(session, business_id, now)
    opened, resolved, renotified = [], [], []

    for h in healths:
        alert = session.exec(select(CollectionHealthAlert).where(
            CollectionHealthAlert.business_id == business_id,
            CollectionHealthAlert.channel_key == h.channel_key)).first()
        is_bad = h.status in ALERTABLE

        if is_bad:
            if alert is None or alert.status == "resolved":
                # 신규 open
                if alert is None:
                    alert = CollectionHealthAlert(
                        business_id=business_id, channel_key=h.channel_key)
                alert.status = "open"
                alert.alert_type = h.status
                alert.opened_at = now
                alert.last_notified_at = now
                alert.resolved_at = None
                alert.detail = f"{h.label}: {h.detail}"
                session.add(alert)
                _send_owner_sms(sms_send, owner_phone, h)
                tg_send(f"{h.channel_key}: {h.status} — {h.detail}")
                opened.append(h.channel_key)
            else:
                # 이미 open — RENOTIFY_DAYS 경과 시만 리마인드
                if alert.last_notified_at and \
                        (now - alert.last_notified_at).days >= RENOTIFY_DAYS:
                    alert.last_notified_at = now
                    session.add(alert)
                    _send_owner_sms(sms_send, owner_phone, h)
                    tg_send(f"[리마인드] {h.channel_key}: {h.status} — {h.detail}")
                    renotified.append(h.channel_key)
        else:
            # healthy — open 이던 게 있으면 resolve
            if alert and alert.status == "open":
                alert.status = "resolved"
                alert.resolved_at = now
                session.add(alert)
                sms_send(owner_phone,
                         f"[소담] {h.label} 수집이 정상화되었습니다.")
                tg_send(f"{h.channel_key}: resolved (정상화)")
                resolved.append(h.channel_key)

    session.commit()
    return {"opened": opened, "resolved": resolved, "renotified": renotified}


def _send_owner_sms(sms_send, owner_phone, h):
    msg = {
        "coupang_eats": "쿠팡이츠 매출이 수집되지 않고 있어요. 어드민 → 외부연동에서 쿠키를 갱신해 주세요.",
        "baemin": "배민 매출이 수집되지 않고 있어요. 어드민 → 외부연동에서 쿠키를 갱신해 주세요.",
        "easypos": "매장(POS) 매출 수집이 멈췄어요. 확인이 필요합니다.",
        "codef_card": "카드 매입내역 수집이 밀렸어요. 어드민에서 동기화해 주세요.",
        "codef_bank": "은행 거래내역 수집이 밀렸어요. 어드민에서 동기화해 주세요.",
    }.get(h.channel_key, f"{h.label} 수집에 문제가 있어요.")
    sms_send(owner_phone, f"[소담] {msg}")
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_collection_health_dispatch.py -v`
Expected: 2 PASS.

- [ ] **Step 5: health-watch 엔드포인트 (auto_collection.py, cron_learn_fee_rates 아래)**

```python
@router.post("/cron/health-watch")
def cron_health_watch(_: None = Depends(_verify_cron_secret)):
    """09:00 KST — 자동수집 채널 건강 점검 + 이상 시 사장님 SMS / Steven 텔레그램."""
    import os, datetime as _dt
    from services import collection_health
    from services.telegram_service import send_message as _tg
    from services.notification_service import NotificationService
    from models import Business

    owner_phone = os.getenv("OWNER_ALERT_PHONE", "").strip()
    sender = os.getenv("POPBILL_SENDER_NUMBER", "").strip()
    svc = NotificationService()

    def _sms(phone, text):
        if not phone or not sender:
            return
        svc.send_sms(sender_number=sender, receiver=phone, content=text)

    now = _dt.datetime.utcnow()
    summary = []
    with Session(engine) as s:
        bizs = s.exec(select(Business).where(
            Business.subscription_status == "active")).all()
        for biz in bizs:
            r = collection_health.dispatch_alerts(
                s, biz.id, now, sms_send=_sms, tg_send=_tg, owner_phone=owner_phone)
            summary.append({"business_id": biz.id, **r})
    return {"ok": True, "business_count": len(summary), "results": summary}
```

> `NotificationService()` 생성자 인자는 `services/notification_service.py`를 확인해 맞출 것 (corp_num 등은 env 자동 로드일 가능성 — 기존 사용처 `routers/notifications.py` 패턴 참고).

- [ ] **Step 6: 엔드포인트 스모크 테스트**

Run: `cd SodamApp/backend && python -c "from routers.auto_collection import cron_health_watch; print('import ok')"`
Expected: `import ok`

- [ ] **Step 7: 커밋**

```bash
git add SodamApp/backend/services/collection_health.py SodamApp/backend/routers/auto_collection.py SodamApp/backend/tests/test_collection_health_dispatch.py
git commit -m "feat(alert): health-watch cron + 2채널 발송 + 중복방지/복구알림"
```

---

## Task 7: status API 확장 + env/배포

**Files:**
- Modify: `SodamApp/backend/routers/external_integration_status.py` (EasyPOS·CODEF 채널 추가)
- Modify: `SodamApp/backend/.env`, `.env.example`, `Orbitron.yaml`
- Test: `SodamApp/backend/tests/test_integration_status_channels.py`

**Interfaces:**
- Consumes: `collection_health.evaluate_channels`.
- Produces: `/api/external-integration/status` 응답 `channels[]`에 easypos·codef_card·codef_bank 포함 (총 5채널).

- [ ] **Step 1: 실패 테스트 작성**

```python
# SodamApp/backend/tests/test_integration_status_channels.py
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
    SQLModel.metadata.create_all(database.engine)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


def test_status_includes_easypos_and_codef(db):
    """build_all_channels 가 5개 채널 키를 모두 포함."""
    from routers import external_integration_status as m
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        channels = m.build_all_channels(s, 1, now)
    keys = {c["channel_key"] for c in channels}
    assert {"coupang_eats", "baemin", "easypos", "codef_card", "codef_bank"} <= keys
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_integration_status_channels.py -v`
Expected: FAIL — `build_all_channels` 없음.

- [ ] **Step 3: build_all_channels 추가 (external_integration_status.py)**

기존 `get_integration_status`의 채널 수집 부분을 함수로 추출 + collection_health 채널 병합:
```python
def build_all_channels(session, business_id, now) -> list[dict]:
    """쿠팡/배민(쿠키 상세) + easypos/codef(건강 판정) 통합 채널 목록."""
    from services import collection_health
    channels = [
        _build_coupang_eats_status(session, business_id, now),
        _build_baemin_status(session, business_id, now),
    ]
    have = {c["channel_key"] for c in channels}
    for h in collection_health.evaluate_channels(session, business_id, now):
        if h.channel_key in have:
            continue
        channels.append({
            "channel": h.label,
            "channel_key": h.channel_key,
            "configured": h.status != "skipping",
            "status": h.status,
            "last_data_date": h.last_data_date.isoformat() if h.last_data_date else None,
            "last_error_message": h.detail,
        })
    return channels
```
그리고 `get_integration_status` 본문의 채널 수집을 `channels = build_all_channels(s, bid, now)`로 교체. `ALERTABLE_STATUSES`에 `stale`, `skipping` 추가:
```python
ALERTABLE_STATUSES = {"expiring_soon", "expired", "failed", "stale", "skipping"}
```
`_order` 딕셔너리에 `"stale": 2, "skipping": 4` 보강 (정렬 유지).

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_integration_status_channels.py -v`
Expected: PASS.

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `cd SodamApp/backend && python -m pytest tests/test_revenue_channels.py tests/test_revenue_channel_migration.py tests/test_telegram_service.py tests/test_collection_health_alert_model.py tests/test_collection_health.py tests/test_collection_health_dispatch.py tests/test_integration_status_channels.py -v`
Expected: 전부 PASS.

- [ ] **Step 6: env 4곳 동기화**

`backend/.env` + `backend/.env.example`에 추가:
```
OWNER_ALERT_PHONE=82-10-4173-6570
# 텔레그램 1차 보류 — 토큰 주입 시 활성
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```
`Orbitron.yaml` backend env 블록에 `OWNER_ALERT_PHONE`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 추가 (값은 Orbitron 대시보드에서 설정 — 메모리 `feedback_orbitron_env`). `POPBILL_SENDER_NUMBER`가 이미 있는지 확인하고 없으면 추가.

- [ ] **Step 7: 커밋**

```bash
git add SodamApp/backend/routers/external_integration_status.py SodamApp/backend/tests/test_integration_status_channels.py SodamApp/backend/.env.example Orbitron.yaml
git commit -m "feat(alert): status API 5채널 확장 + 배포 env"
```

---

## 배포 후 사장님/Steven 액션 (구현과 별개)

1. **Orbitron 대시보드 env**: `OWNER_ALERT_PHONE=82-10-4173-6570` 설정 (텔레그램 토큰은 1차 비움).
2. **Orbitron 호스트 crontab 추가** (사장님 직접):
   ```
   0 9 * * * curl -fsS -X POST -H "X-Cron-Secret: <CRON_SHARED_SECRET>" https://sodamfn.twinverse.org/api/auto-collection/cron/health-watch >> /tmp/cron-health-watch.log 2>&1
   ```
3. **Revenue 마이그레이션 검증**: 배포 후 `preview_revenue_channel_rename.py` 실행해 영문 채널 0건 확인.
4. (후속) 텔레그램 봇 생성 → 토큰/chat_id env 주입 → 기술경보 활성.
