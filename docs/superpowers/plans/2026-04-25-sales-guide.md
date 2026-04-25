# 영업관리 (Sales Guide) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 사업을 시작하는 사장님이 영업 시작·운영에 필요한 모든 정보를 한 자리에서 파악할 수 있도록 새로운 최상위 사이드바 메뉴 "영업관리"를 추가한다. V1 은 휴게음식점(소담김밥) 콘텐츠 38 항목, L3 인터랙션 (체크리스트 + 핵심 날짜 기록).

**Architecture:** 정적 콘텐츠는 frontend `src/data/sales-guide/kimbap.js` 파일, 사업장별 진행 상태는 `SalesGuideProgress` DB 테이블 1 개. React 페이지 3 개 (Home/Category/Modal) + 컴포넌트 4 개. 백엔드 라우터 1 개에 4 엔드포인트. HR·세무 모듈과는 sync-status API 로 자동 카운트, 중복 구현 없음.

**Tech Stack:**
- Backend: FastAPI + SQLModel + PostgreSQL, pytest
- Frontend: React 19 + Vite + React Router + axios + Tailwind (Slate 팔레트) + lucide-react
- Tests: pytest (백엔드), 수동 매뉴얼 검증 (프론트엔드 — 현재 vitest 미설치)

**참조 문서:** `docs/superpowers/specs/2026-04-25-sales-guide-design.md`

---

## File Structure

### 신규 파일

| 경로 | 책임 |
|---|---|
| `backend/routers/sales_guide.py` | 4 API 엔드포인트 (progress / patch / stats / sync-status) |
| `backend/services/sales_guide.py` | 비즈니스 로직 (sync-status 카운트 계산, stats 계산, 만료 처리 규칙) |
| `backend/tests/sales_guide/test_models.py` | SalesGuideProgress 모델 CRUD 테스트 |
| `backend/tests/sales_guide/test_sync_status.py` | sync-status 5 개 카운트 계산 테스트 |
| `backend/tests/sales_guide/test_stats.py` | 카테고리 진행률·만료 처리 테스트 |
| `backend/tests/sales_guide/__init__.py` | empty |
| `backend/tests/sales_guide/conftest.py` | 픽스처 (Business + Staff 더미 데이터) |
| `frontend/src/data/sales-guide/index.js` | 업종 레지스트리 |
| `frontend/src/data/sales-guide/kimbap.js` | 휴게음식점 마스터 데이터 (38 항목) |
| `frontend/src/pages/sales-guide/SalesGuideHome.jsx` | 랜딩 페이지 |
| `frontend/src/pages/sales-guide/CategoryPage.jsx` | 카테고리별 페이지 (6 페이지가 단일 컴포넌트로 처리) |
| `frontend/src/pages/sales-guide/ItemDetailModal.jsx` | 항목 상세 모달 |
| `frontend/src/components/sales-guide/ProgressCard.jsx` | 카테고리 진행률 카드 |
| `frontend/src/components/sales-guide/ItemCard.jsx` | 항목 체크리스트 카드 |
| `frontend/src/components/sales-guide/DateInputDrawer.jsx` | 날짜 입력 폼 |
| `frontend/src/components/sales-guide/DeepLinkButton.jsx` | 외부/내부 링크 버튼 |
| `frontend/src/hooks/useSalesGuide.js` | 데이터 페치 훅 (progress + stats + sync 통합) |

### 수정 파일

| 경로 | 변경 |
|---|---|
| `backend/models.py` | `SalesGuideProgress` 모델 추가 |
| `backend/main.py` | sales_guide 라우터 등록 |
| `frontend/src/App.jsx` | `/sales-guide`, `/sales-guide/:category` 라우트 추가 + lazy import |
| `frontend/src/components/Sidebar.jsx` | 새 최상위 그룹 "영업관리" 추가, HR > 외국인고용 메뉴 제거 |
| `frontend/src/pages/ForeignWorkerGuide.jsx` | 폐지 후 `/sales-guide/hr` 로 redirect (또는 페이지 자체 삭제) |

### 삭제

- `frontend/src/pages/ForeignWorkerGuide.jsx` (콘텐츠는 kimbap.js 의 `hr.foreign_worker` 항목으로 이주)

---

## Stage 0: 사전 점검 (5 분)

### Task 0: pytest 환경 확인

**Files:**
- Read: `backend/pytest.ini` (존재 확인)
- Read: `backend/conftest.py` (인메모리 DB 픽스처 확인)

- [ ] **Step 1: pytest 환경 동작 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/yearend/test_models.py -v
```

Expected: 5 tests pass (yearend 모델 테스트가 통과해야 영업관리 테스트도 같은 인프라로 작동)

- [ ] **Step 2: tests/sales_guide 디렉토리 생성 + __init__.py**

Create empty file: `backend/tests/sales_guide/__init__.py`

```python
```

(파일은 비어있음 — pytest 가 디렉토리를 패키지로 인식하기 위함)

---

## Stage 1: 백엔드 모델 + 테스트 픽스처

### Task 1: SalesGuideProgress 모델 추가

**Files:**
- Modify: `backend/models.py`
- Create: `backend/tests/sales_guide/test_models.py`

- [ ] **Step 1: 모델 테스트 먼저 작성 (실패 확인)**

Create `backend/tests/sales_guide/test_models.py`:

```python
"""SalesGuideProgress 모델 CRUD 테스트."""
from datetime import date, datetime
import pytest
from sqlmodel import Session, select
from models import SalesGuideProgress, Business, User


def test_create_progress_minimal(session: Session, sample_business: Business):
    """진행상태 row 최소 필드로 생성"""
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.business_registration",
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)

    assert progress.id is not None
    assert progress.is_completed is False
    assert progress.completed_at is None
    assert progress.expires_at is None


def test_unique_constraint_business_item(session: Session, sample_business: Business):
    """같은 사업장 × 같은 item_key 중복 불가"""
    p1 = SalesGuideProgress(business_id=sample_business.id, item_key="permits.health_certificate")
    session.add(p1)
    session.commit()

    p2 = SalesGuideProgress(business_id=sample_business.id, item_key="permits.health_certificate")
    session.add(p2)
    with pytest.raises(Exception):  # IntegrityError
        session.commit()


def test_progress_with_dates(session: Session, sample_business: Business):
    """완료일·만료일·메모 저장"""
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.health_certificate",
        is_completed=True,
        completed_at=date(2026, 4, 1),
        expires_at=date(2027, 4, 1),
        notes="첫 발급",
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)

    assert progress.completed_at == date(2026, 4, 1)
    assert progress.expires_at == date(2027, 4, 1)
    assert progress.notes == "첫 발급"


def test_query_progress_for_business(session: Session, sample_business: Business):
    """사업장별 모든 진행 상태 조회"""
    keys = ["permits.business_registration", "permits.restaurant_report", "delivery.baemin"]
    for k in keys:
        session.add(SalesGuideProgress(business_id=sample_business.id, item_key=k))
    session.commit()

    results = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == sample_business.id)
    ).all()
    assert len(results) == 3
    assert {r.item_key for r in results} == set(keys)
```

- [ ] **Step 2: 픽스처 conftest 작성**

Create `backend/tests/sales_guide/conftest.py`:

```python
"""영업관리 테스트용 픽스처 — Business + Staff 더미 데이터."""
import pytest
from datetime import date
from sqlmodel import Session
from models import Business, Staff


@pytest.fixture
def sample_business(session: Session) -> Business:
    biz = Business(
        name="소담김밥 본점",
        business_number="123-45-67890",
    )
    session.add(biz)
    session.commit()
    session.refresh(biz)
    return biz


@pytest.fixture
def sample_business_no_tax_id(session: Session) -> Business:
    biz = Business(name="신규 매장", business_number=None)
    session.add(biz)
    session.commit()
    session.refresh(biz)
    return biz


@pytest.fixture
def sample_staff_with_health_cert(session: Session, sample_business: Business) -> list[Staff]:
    """5명 중 4명만 보건증 등록"""
    staff_list = []
    for i in range(5):
        s = Staff(
            business_id=sample_business.id,
            name=f"직원{i}",
            doc_health_cert=f"hc_{i}.pdf" if i < 4 else None,
            insurance_4major=(i < 3),  # 5명 중 3명만 4대보험
            is_active=True,
        )
        session.add(s)
        staff_list.append(s)
    session.commit()
    return staff_list
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_models.py -v
```

Expected: ImportError — `SalesGuideProgress` not in models

- [ ] **Step 4: models.py 에 SalesGuideProgress 추가**

Append to `backend/models.py` (다른 모델들 뒤에):

```python
class SalesGuideProgress(SQLModel, table=True):
    """영업관리 항목별 사업장 진행상태.

    1 사업장 × 1 항목 = 1 row.
    item_key 는 frontend 정적 콘텐츠 (sales-guide/kimbap.js) 의 항목 ID 와 일치.
    예: "permits.business_registration", "delivery.baemin"
    """
    __tablename__ = "sales_guide_progress"
    __table_args__ = (UniqueConstraint("business_id", "item_key"),)

    id: int | None = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    item_key: str = Field(index=True, max_length=100)

    is_completed: bool = Field(default=False)
    completed_at: date | None = None
    expires_at: date | None = None
    notes: str | None = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: int | None = Field(default=None, foreign_key="user.id")
```

models.py 상단 import 에 `UniqueConstraint`, `date` 누락 시 추가:

```python
from sqlalchemy import UniqueConstraint
from datetime import date, datetime
```

- [ ] **Step 5: 테스트 실행 → PASS 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_models.py -v
```

Expected: 4 PASSED

- [ ] **Step 6: 커밋**

```bash
git add backend/models.py backend/tests/sales_guide/
git commit -m "feat(sales-guide): SalesGuideProgress 모델 + 모델 테스트 4건"
```

---

## Stage 2: sync-status 비즈니스 로직 + 테스트

### Task 2: sync-status 5 개 카운트 계산 로직

**Files:**
- Create: `backend/services/sales_guide.py`
- Create: `backend/tests/sales_guide/test_sync_status.py`

- [ ] **Step 1: sync-status 테스트 먼저 작성**

Create `backend/tests/sales_guide/test_sync_status.py`:

```python
"""sync-status 5 개 자동 카운트 계산 테스트.

설계 문서 6.3 SYNC-LINK 자동 카운트 5 개:
- permits.health_certificate: Staff.doc_health_cert 카운트
- permits.hygiene_education: HR certificate.py (식품위생교육증)
- permits.business_registration: Business.business_number 존재 여부
- hr.labor_contract: ElectronicContract 발효 카운트
- hr.social_insurance_staff: Staff.insurance_4major 카운트
"""
from sqlmodel import Session
from models import Business
from services.sales_guide import compute_sync_status


def test_health_certificate_partial(
    session: Session, sample_business: Business, sample_staff_with_health_cert
):
    """5명 중 4명 보건증 등록 → 4/5"""
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.health_certificates"]["completed"] == 4
    assert result["hr.health_certificates"]["total"] == 5


def test_social_insurance_partial(
    session: Session, sample_business: Business, sample_staff_with_health_cert
):
    """5명 중 3명 4대보험 가입 → 3/5"""
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.insurance_4major"]["completed"] == 3
    assert result["hr.insurance_4major"]["total"] == 5


def test_business_registration_present(session: Session, sample_business: Business):
    """Business.business_number 존재 → 1/1"""
    result = compute_sync_status(session, sample_business.id)
    assert result["business.business_number"]["completed"] == 1
    assert result["business.business_number"]["total"] == 1


def test_business_registration_absent(
    session: Session, sample_business_no_tax_id: Business
):
    """Business.business_number 없음 → 0/1"""
    result = compute_sync_status(session, sample_business_no_tax_id.id)
    assert result["business.business_number"]["completed"] == 0
    assert result["business.business_number"]["total"] == 1


def test_no_staff(session: Session, sample_business: Business):
    """직원 0명 → total 0, completed 0 (분모 0 처리)"""
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.health_certificates"]["total"] == 0
    assert result["hr.health_certificates"]["completed"] == 0
    assert result["hr.insurance_4major"]["total"] == 0
```

(`hr.contracts` 와 `hr.hygiene_certificates` 는 ElectronicContract / Certificate 모델 fixture 가 복잡하므로 별도 task 에서 추가)

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_sync_status.py -v
```

Expected: ImportError on `services.sales_guide`

- [ ] **Step 3: services/sales_guide.py 생성 (5 개 카운트 중 3 개 우선 구현)**

Create `backend/services/sales_guide.py`:

```python
"""영업관리 비즈니스 로직 — sync-status, stats."""
from datetime import date
from sqlmodel import Session, select
from models import Business, Staff


def compute_sync_status(session: Session, business_id: int) -> dict[str, dict]:
    """5 개 핵심 sync 카운트 계산.

    응답 형태:
        { sync_key: { "completed": int, "total": int, "label": str, ... } }

    카운트 규칙:
    - hr.health_certificates: 활성 직원 중 doc_health_cert 등록자 수
    - hr.insurance_4major: 활성 직원 중 insurance_4major=True 수
    - business.business_number: Business.business_number 존재 여부 (0/1 또는 1/1)
    - hr.contracts: 활성 직원 중 발효 ElectronicContract 보유자 수 (Task 3 에서 추가)
    - hr.hygiene_certificates: 사업장 위생교육 이수증 (Task 3 에서 추가)
    """
    biz = session.get(Business, business_id)
    if not biz:
        return {}

    active_staff = session.exec(
        select(Staff).where(Staff.business_id == business_id, Staff.is_active == True)
    ).all()
    total_staff = len(active_staff)

    return {
        "hr.health_certificates": {
            "completed": sum(1 for s in active_staff if s.doc_health_cert),
            "total": total_staff,
            "label": "직원 보건증 등록",
        },
        "hr.insurance_4major": {
            "completed": sum(1 for s in active_staff if s.insurance_4major),
            "total": total_staff,
            "label": "직원 4대보험 가입",
        },
        "business.business_number": {
            "completed": 1 if biz.business_number else 0,
            "total": 1,
            "label": "사업자등록번호",
        },
    }
```

- [ ] **Step 4: 테스트 실행 → 5 PASS 확인**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_sync_status.py -v
```

Expected: 5 PASSED

- [ ] **Step 5: 커밋**

```bash
git add backend/services/sales_guide.py backend/tests/sales_guide/test_sync_status.py
git commit -m "feat(sales-guide): sync-status 3개 카운트 계산 (보건증/4대보험/사업자번호)"
```

### Task 3: sync-status 나머지 2 개 카운트 (계약·위생교육)

**Files:**
- Modify: `backend/services/sales_guide.py`
- Modify: `backend/tests/sales_guide/test_sync_status.py`
- Modify: `backend/tests/sales_guide/conftest.py`

- [ ] **Step 1: ElectronicContract 모델 확인**

Read `backend/models.py` 에서 `ElectronicContract` 정의 확인. 핵심 필드:
- `staff_id` (Staff FK)
- `status` (str, "active"/"draft"/"expired" 등)
- `business_id` (Business FK)

`hr.contracts` 카운트 = 활성 직원 중 status="active" 계약 보유 직원 수.

- [ ] **Step 2: HR Certificate 모델 확인**

Read `backend/models.py` 에서 `Certificate` 또는 `HygieneCertificate` 정의 확인. 사업장 단위 위생교육 이수증 (Business 별 1개).

만약 사업장 단위 모델이 없으면 — 이 sync 키는 V1.1 로 미루고 영업관리 항목 카드는 수동 체크리스트로 동작.

- [ ] **Step 3: conftest 픽스처 추가**

Append to `backend/tests/sales_guide/conftest.py`:

```python
from models import ElectronicContract  # 실제 모델 import

@pytest.fixture
def sample_contracts(session: Session, sample_staff_with_health_cert):
    """5명 중 3명만 active 계약"""
    contracts = []
    for i, staff in enumerate(sample_staff_with_health_cert):
        if i < 3:
            c = ElectronicContract(
                staff_id=staff.id,
                business_id=staff.business_id,
                status="active",
            )
            session.add(c)
            contracts.append(c)
    session.commit()
    return contracts
```

- [ ] **Step 4: 테스트 추가**

Append to `test_sync_status.py`:

```python
def test_contracts_partial(
    session: Session, sample_business: Business, sample_contracts
):
    """5명 중 3명만 active 계약 → 3/5"""
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.contracts"]["completed"] == 3
    assert result["hr.contracts"]["total"] == 5
```

- [ ] **Step 5: 테스트 실행 → 실패 확인**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_sync_status.py::test_contracts_partial -v
```

Expected: KeyError "hr.contracts"

- [ ] **Step 6: services/sales_guide.py 에 hr.contracts 추가**

Modify `compute_sync_status` 의 return dict 에 추가:

```python
from models import ElectronicContract

# ... 기존 active_staff 조회 후 ...

active_staff_ids = [s.id for s in active_staff]
active_contracts = (
    session.exec(
        select(ElectronicContract).where(
            ElectronicContract.staff_id.in_(active_staff_ids),
            ElectronicContract.status == "active",
        )
    ).all()
    if active_staff_ids
    else []
)
contracted_staff_ids = {c.staff_id for c in active_contracts}

return {
    # ... 기존 3개 ...
    "hr.contracts": {
        "completed": len(contracted_staff_ids),
        "total": total_staff,
        "label": "근로계약서 발효",
    },
}
```

- [ ] **Step 7: 테스트 실행 → PASS**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_sync_status.py -v
```

Expected: 6 PASSED

- [ ] **Step 8: hr.hygiene_certificates 처리 결정**

Step 2 에서 사업장 단위 위생교육 모델 확인 결과로 분기:

(a) 모델 존재 → 동일 패턴으로 카운트 추가 + 테스트 추가
(b) 모델 없음 → return dict 에 추가하지 않음. 데이터 파일 (`kimbap.js`) 의 `permits.hygiene_education` 항목에서 `syncWith` 필드 제거. 항목은 수동 체크리스트로만 동작. spec 12 장 위험 항목에 명시.

이 결정을 task 코멘트에 기록하고 진행.

- [ ] **Step 9: 커밋**

```bash
git add backend/services/sales_guide.py backend/tests/sales_guide/
git commit -m "feat(sales-guide): sync-status hr.contracts 카운트 추가"
```

---

## Stage 3: stats 계산 로직 + 테스트

### Task 4: 카테고리별 진행률 계산

**Files:**
- Modify: `backend/services/sales_guide.py`
- Create: `backend/tests/sales_guide/test_stats.py`

- [ ] **Step 1: stats 테스트 작성**

Create `backend/tests/sales_guide/test_stats.py`:

```python
"""카테고리별 진행률 계산 테스트.

규칙 (spec 7.5):
- 필수 항목만 진행률에 반영
- sync 100% → 자동 완료 판정
- 만료된 항목 → 미완료로 다운그레이드
- 갱신주기 항목은 expires_at 미입력 시 미완료
"""
from datetime import date, timedelta
from sqlmodel import Session
from models import Business, SalesGuideProgress
from services.sales_guide import compute_stats


# 테스트용 더미 카탈로그 (실제는 frontend 정적 파일이지만, 백엔드 stats 는 카탈로그 메타를 받아 계산하므로 인자로 주입)
SAMPLE_CATALOG = {
    "permits": {
        "label": "인허가",
        "items": [
            {"key": "permits.business_registration", "required": True, "renewalCycle": None,
             "syncWith": "business.business_number"},
            {"key": "permits.health_certificate", "required": True,
             "renewalCycle": {"months": 12}, "syncWith": "hr.health_certificates"},
            {"key": "permits.lpg_report", "required": False, "renewalCycle": None},
        ],
    },
}


def test_required_only_counted(session: Session, sample_business: Business):
    """선택 항목 (required=False) 은 진행률 계산에서 제외"""
    # 사업자번호 등록 → business.business_number sync 1/1 → 자동 완료
    # 보건증 미등록 (sync 0/0) → 미완료
    # LPG 는 선택이므로 무시

    sync = {"business.business_number": {"completed": 1, "total": 1},
            "hr.health_certificates": {"completed": 0, "total": 0}}

    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    assert stats["categories"][0]["required_total"] == 2  # 필수 2개만
    assert stats["categories"][0]["required_completed"] == 1  # 사업자번호만 완료
    assert stats["categories"][0]["percent"] == 50


def test_sync_100_percent_auto_complete(session: Session, sample_business: Business):
    """sync 100% 면 명시적 체크 없이도 완료 판정"""
    sync = {
        "business.business_number": {"completed": 1, "total": 1},
        "hr.health_certificates": {"completed": 5, "total": 5},
    }
    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    # 단, 보건증은 renewalCycle 있어서 expires_at 필요. sync 100% 만으로는 부족할 수도?
    # 설계 문서 6.4: "카운트가 total 100% → 자동 완료 판정"
    # 하지만 7.5: "renewalCycle != null 의 완료 처리: expires_at 입력 함께 있어야 완료"
    # 우선순위: sync 100% 가 명시적 완료보다 강력 (직원 모두 보건증 = 사업장 차원 완료)
    assert stats["categories"][0]["required_completed"] == 2


def test_expired_item_downgrade(session: Session, sample_business: Business):
    """만료된 항목은 명시적 is_completed=True 라도 미완료 처리"""
    yesterday = date.today() - timedelta(days=1)
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.health_certificate",
        is_completed=True,
        completed_at=yesterday - timedelta(days=365),
        expires_at=yesterday,  # 어제 만료
    )
    session.add(progress)
    session.commit()

    sync = {"business.business_number": {"completed": 0, "total": 1},
            "hr.health_certificates": {"completed": 0, "total": 0}}

    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    assert stats["categories"][0]["required_completed"] == 0


def test_expiring_soon_alert(session: Session, sample_business: Business):
    """만료 30일 이내 항목 alerts 에 노출"""
    in_15_days = date.today() + timedelta(days=15)
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.health_certificate",
        is_completed=True,
        expires_at=in_15_days,
    )
    session.add(progress)
    session.commit()

    sync = {"business.business_number": {"completed": 0, "total": 1},
            "hr.health_certificates": {"completed": 0, "total": 0}}

    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    alerts = stats["categories"][0]["alerts"]
    assert len(alerts) == 1
    assert alerts[0]["type"] == "expiring_soon"
    assert alerts[0]["days"] == 15
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_stats.py -v
```

Expected: ImportError on `compute_stats`

- [ ] **Step 3: services/sales_guide.py 에 compute_stats 추가**

Append to `backend/services/sales_guide.py`:

```python
from datetime import date

def compute_stats(
    session: Session,
    business_id: int,
    catalog: dict,
    sync: dict,
) -> dict:
    """카테고리별·전체 진행률 계산.

    catalog: {category_key: {label, items: [{key, required, renewalCycle, syncWith}]}}
    sync: compute_sync_status() 결과
    """
    progresses = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == business_id)
    ).all()
    progress_by_key = {p.item_key: p for p in progresses}

    today = date.today()
    categories_out = []
    overall_completed = 0
    overall_total = 0

    for cat_key, cat in catalog.items():
        required_items = [i for i in cat["items"] if i.get("required")]
        completed_count = 0
        alerts = []

        for item in required_items:
            is_complete, alert = _evaluate_item(item, progress_by_key.get(item["key"]), sync, today)
            if is_complete:
                completed_count += 1
            if alert:
                alerts.append(alert)

        total = len(required_items)
        percent = round(completed_count / total * 100) if total else 0
        categories_out.append({
            "key": cat_key,
            "required_total": total,
            "required_completed": completed_count,
            "percent": percent,
            "alerts": alerts,
        })
        overall_completed += completed_count
        overall_total += total

    overall_percent = round(overall_completed / overall_total * 100) if overall_total else 0

    return {
        "overall": {
            "completed": overall_completed,
            "total": overall_total,
            "percent": overall_percent,
        },
        "categories": categories_out,
    }


def _evaluate_item(item: dict, progress, sync: dict, today: date) -> tuple[bool, dict | None]:
    """단일 항목의 완료 여부 + alert 평가.

    우선순위:
    1. sync 100% → 자동 완료 (renewalCycle 무관)
    2. is_completed=True AND (renewalCycle 없거나 expires_at > today) → 완료
    3. expires_at 30 일 이내 → expiring_soon alert
    """
    sync_key = item.get("syncWith")
    if sync_key and sync_key in sync:
        s = sync[sync_key]
        if s["total"] > 0 and s["completed"] >= s["total"]:
            return True, None

    if not progress or not progress.is_completed:
        return False, None

    if item.get("renewalCycle"):
        if not progress.expires_at:
            return False, None  # 만료일 미입력 → 미완료
        if progress.expires_at < today:
            return False, None  # 만료
        days_to_expire = (progress.expires_at - today).days
        if days_to_expire <= 30:
            return True, {
                "item_key": item["key"],
                "type": "expiring_soon",
                "days": days_to_expire,
            }

    return True, None
```

- [ ] **Step 4: 테스트 실행 → PASS**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_stats.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: 전체 sales_guide 테스트 일괄 실행**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/ -v
```

Expected: 14 PASSED (모델 4 + sync 6 + stats 4)

- [ ] **Step 6: 커밋**

```bash
git add backend/services/sales_guide.py backend/tests/sales_guide/test_stats.py
git commit -m "feat(sales-guide): compute_stats — 카테고리 진행률 + 만료/sync 처리"
```

---

## Stage 4: 백엔드 라우터 (4 엔드포인트)

### Task 5: routers/sales_guide.py 생성 + 4 엔드포인트

**Files:**
- Create: `backend/routers/sales_guide.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 라우터 파일 생성 (4 엔드포인트)**

Create `backend/routers/sales_guide.py`:

```python
"""영업관리 (Sales Guide) API 엔드포인트.

설계 문서: docs/superpowers/specs/2026-04-25-sales-guide-design.md (8장)

주의: get_bid_from_token 은 반드시 Depends() 로 호출. 직접 호출 시
함수가 None 반환하여 모든 데이터가 0건으로 보임 (yearend 라우터 버그 재발 방지).
"""
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from auth import get_current_user, get_bid_from_token
from models import SalesGuideProgress, User
from services.sales_guide import compute_sync_status, compute_stats

router = APIRouter(prefix="/api/sales-guide", tags=["sales-guide"])


# ──────────────────── Pydantic 스키마 ────────────────────

class ProgressOut(BaseModel):
    item_key: str
    is_completed: bool
    completed_at: Optional[date] = None
    expires_at: Optional[date] = None
    notes: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[int] = None


class ProgressListResponse(BaseModel):
    business_id: int
    items: list[ProgressOut]


class ProgressPatchRequest(BaseModel):
    is_completed: Optional[bool] = None
    completed_at: Optional[date] = None
    expires_at: Optional[date] = None
    notes: Optional[str] = None


# ──────────────────── 카탈로그 메타 (백엔드용 sync 정의) ────────────────────
# Frontend kimbap.js 와 일치해야 함. 동기화 어려운 부분이지만 V1 에서는 필수 항목 키만
# 백엔드가 알면 충분 (stats 계산용). 항목 본문은 frontend 만 보유.
# V2 에서 카탈로그 단일 진실 원천 (SSOT) 정리 검토.

CATALOG_FOR_STATS: dict = {
    "permits": {
        "label": "인허가·신고",
        "items": [
            {"key": "permits.business_registration", "required": True, "renewalCycle": None,
             "syncWith": "business.business_number"},
            {"key": "permits.restaurant_report", "required": True, "renewalCycle": None},
            {"key": "permits.hygiene_education", "required": True,
             "renewalCycle": {"months": 12}, "syncWith": "hr.hygiene_certificates"},
            {"key": "permits.health_certificate", "required": True,
             "renewalCycle": {"months": 12}, "syncWith": "hr.health_certificates"},
            {"key": "permits.fire_insurance", "required": True, "renewalCycle": {"months": 12}},
            {"key": "permits.lpg_report", "required": False, "renewalCycle": None},
            {"key": "permits.waste_food_report", "required": True, "renewalCycle": None},
        ],
    },
    "delivery-apps": {
        "label": "배달·온라인 채널",
        "items": [
            {"key": "delivery.baemin", "required": False, "renewalCycle": None},
            {"key": "delivery.coupang_eats", "required": False, "renewalCycle": None},
            {"key": "delivery.yogiyo", "required": False, "renewalCycle": None},
            {"key": "delivery.naver_place", "required": True, "renewalCycle": None},
            {"key": "delivery.kakao_map", "required": True, "renewalCycle": None},
            {"key": "delivery.instagram", "required": False, "renewalCycle": None},
            {"key": "delivery.naver_booking", "required": False, "renewalCycle": None},
            {"key": "delivery.local_apps", "required": False, "renewalCycle": None},
        ],
    },
    "payment": {
        "label": "결제·POS",
        "items": [
            {"key": "payment.card_terminal", "required": True, "renewalCycle": None},
            {"key": "payment.cashbill_merchant", "required": True, "renewalCycle": None},
            {"key": "payment.pos_system", "required": False, "renewalCycle": None},
            {"key": "payment.simple_pay", "required": False, "renewalCycle": None},
            {"key": "payment.delivery_settlement", "required": True, "renewalCycle": None},
        ],
    },
    "tax": {
        "label": "세무·회계 일정",
        "items": [
            {"key": "tax.vat_filing", "required": True, "renewalCycle": {"months": 6}},
            {"key": "tax.income_tax", "required": True, "renewalCycle": {"months": 12}},
            {"key": "tax.withholding", "required": True, "renewalCycle": {"months": 1}},
            {"key": "tax.business_card", "required": False, "renewalCycle": None},
            {"key": "tax.social_insurance_org", "required": True, "renewalCycle": None},
            {"key": "tax.daily_worker_report", "required": False, "renewalCycle": {"months": 1}},
        ],
    },
    "hr": {
        "label": "인력·노무",
        "items": [
            {"key": "hr.labor_contract", "required": True, "renewalCycle": None,
             "syncWith": "hr.contracts"},
            {"key": "hr.social_insurance_staff", "required": True, "renewalCycle": None,
             "syncWith": "hr.insurance_4major"},
            {"key": "hr.minimum_wage", "required": True, "renewalCycle": None},
            {"key": "hr.foreign_worker", "required": False, "renewalCycle": None},
            {"key": "hr.severance_pay", "required": True, "renewalCycle": None},
        ],
    },
    "operations": {
        "label": "운영팁",
        # 운영팁은 모두 권장 (선택). 진행률 계산에서 제외됨.
        "items": [
            {"key": "ops.hygiene_check", "required": False, "renewalCycle": None},
            {"key": "ops.inventory", "required": False, "renewalCycle": None},
            {"key": "ops.daily_routine", "required": False, "renewalCycle": None},
            {"key": "ops.customer_service", "required": False, "renewalCycle": None},
            {"key": "ops.sns_marketing", "required": False, "renewalCycle": None},
            {"key": "ops.financial_analysis", "required": False, "renewalCycle": None},
            {"key": "ops.crisis_response", "required": False, "renewalCycle": None},
        ],
    },
}


# ──────────────────── 엔드포인트 ────────────────────

@router.get("/progress", response_model=ProgressListResponse)
def get_progress(
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """현재 사업장의 모든 영업관리 항목 진행상태."""
    progresses = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == bid)
    ).all()
    return ProgressListResponse(
        business_id=bid,
        items=[ProgressOut.model_validate(p, from_attributes=True) for p in progresses],
    )


@router.patch("/progress/{item_key}", response_model=ProgressOut)
def patch_progress(
    item_key: str,
    body: ProgressPatchRequest,
    bid: int = Depends(get_bid_from_token),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """항목 체크/날짜/메모 업데이트. Upsert 시멘틱."""
    progress = session.exec(
        select(SalesGuideProgress).where(
            SalesGuideProgress.business_id == bid,
            SalesGuideProgress.item_key == item_key,
        )
    ).first()

    if not progress:
        progress = SalesGuideProgress(business_id=bid, item_key=item_key)
        session.add(progress)

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(progress, k, v)

    progress.updated_at = datetime.utcnow()
    progress.updated_by = user.id

    session.commit()
    session.refresh(progress)
    return ProgressOut.model_validate(progress, from_attributes=True)


@router.get("/sync-status")
def get_sync_status(
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """외부 모듈(HR·세무) 자동 카운트 정보."""
    return compute_sync_status(session, bid)


@router.get("/stats")
def get_stats(
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """카테고리별·전체 진행률 (서버 계산, 만료·sync 처리 반영)."""
    sync = compute_sync_status(session, bid)
    return compute_stats(session, bid, CATALOG_FOR_STATS, sync)
```

- [ ] **Step 2: main.py 에 라우터 등록**

Modify `backend/main.py`. 다른 라우터 import 옆에:

```python
from routers import sales_guide
```

`app.include_router(...)` 모음에 추가:

```python
app.include_router(sales_guide.router)
```

(정확한 위치는 기존 라우터 등록 패턴 따라 — yearend.router 등 옆)

- [ ] **Step 3: 백엔드 부팅 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from main import app; routes = [r.path for r in app.routes if 'sales-guide' in r.path]; print(routes)"
```

Expected: 4 routes 출력
- /api/sales-guide/progress
- /api/sales-guide/progress/{item_key}
- /api/sales-guide/sync-status
- /api/sales-guide/stats

- [ ] **Step 4: 라우터 통합 테스트 작성 (간단)**

Create `backend/tests/sales_guide/test_routes.py`:

```python
"""sales_guide 라우터 통합 테스트 (FastAPI TestClient)."""
from fastapi.testclient import TestClient


def test_get_progress_empty(client: TestClient, sample_business, auth_token_factory):
    """진행상태 row 없는 사업장 → 빈 items"""
    headers = {"Authorization": f"Bearer {auth_token_factory(sample_business.id)}"}
    resp = client.get("/api/sales-guide/progress", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["business_id"] == sample_business.id
    assert data["items"] == []


def test_patch_progress_creates_row(client: TestClient, sample_business, auth_token_factory):
    """기존 row 없는 항목 patch → 새 row 생성"""
    headers = {"Authorization": f"Bearer {auth_token_factory(sample_business.id)}"}
    resp = client.patch(
        "/api/sales-guide/progress/permits.business_registration",
        json={"is_completed": True, "completed_at": "2026-04-12"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["item_key"] == "permits.business_registration"
    assert data["is_completed"] is True
    assert data["completed_at"] == "2026-04-12"


def test_stats_returns_structure(client: TestClient, sample_business, auth_token_factory):
    """stats 응답 구조 확인"""
    headers = {"Authorization": f"Bearer {auth_token_factory(sample_business.id)}"}
    resp = client.get("/api/sales-guide/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "overall" in data
    assert "categories" in data
    assert len(data["categories"]) == 6
```

(`client` 와 `auth_token_factory` 픽스처는 기존 yearend 테스트에서 사용된 패턴 그대로 — 없으면 기존 conftest 참조하여 재사용)

- [ ] **Step 5: 라우터 테스트 실행 → PASS**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/test_routes.py -v
```

Expected: 3 PASSED (픽스처 호환 안 되면 conftest 조정 — yearend 픽스처 참조)

- [ ] **Step 6: 커밋**

```bash
git add backend/routers/sales_guide.py backend/main.py backend/tests/sales_guide/test_routes.py
git commit -m "feat(sales-guide): 라우터 4 엔드포인트 + 통합 테스트 3건"
```

---

## Stage 5: 정적 콘텐츠 — 카테고리별 6 파일

### Task 6: 데이터 파일 골격 + 인허가 카테고리 (7 항목)

**Files:**
- Create: `frontend/src/data/sales-guide/index.js`
- Create: `frontend/src/data/sales-guide/kimbap.js`

- [ ] **Step 1: index.js 생성**

Create `frontend/src/data/sales-guide/index.js`:

```js
/**
 * 영업관리 업종 레지스트리.
 * V1: 휴게음식점(소담김밥) 1 종.
 * V2: cafe.js, chicken.js 등 추가.
 */
import kimbap from './kimbap';

export const SALES_GUIDE_INDUSTRIES = {
  kimbap,
};

export function getIndustryData(industryKey = 'kimbap') {
  return SALES_GUIDE_INDUSTRIES[industryKey] || SALES_GUIDE_INDUSTRIES.kimbap;
}

export function getAllItems(industryKey = 'kimbap') {
  const data = getIndustryData(industryKey);
  return data.categories.flatMap((cat) => cat.items.map((item) => ({ ...item, _category: cat.key })));
}

export function getCategoryByKey(categoryKey, industryKey = 'kimbap') {
  return getIndustryData(industryKey).categories.find((c) => c.key === categoryKey);
}

export function getItemByKey(itemKey, industryKey = 'kimbap') {
  return getAllItems(industryKey).find((i) => i.key === itemKey);
}
```

- [ ] **Step 2: kimbap.js 골격 + 인허가 7 항목 작성**

Create `frontend/src/data/sales-guide/kimbap.js`:

```js
/**
 * 휴게음식점 (소담김밥) 영업관리 마스터 데이터.
 *
 * 각 항목의 본문 (steps/documents/tips/deepLinks) 은 V1 출시 콘텐츠.
 * URL 은 정부 사이트 개편 시 깨질 수 있으므로 V2 에서 자동 점검 cron 검토.
 */
export default {
  industry: 'kimbap',
  industryLabel: '휴게음식점 (김밥)',
  categories: [
    // ─────────────────────────────────────
    // ① 인허가·신고 (7 항목)
    // ─────────────────────────────────────
    {
      key: 'permits',
      label: '인허가·신고',
      icon: 'FileCheck',
      color: 'blue',
      description: '영업 시작 전 반드시 갖춰야 할 신고·허가',
      order: 1,
      items: [
        {
          key: 'permits.business_registration',
          title: '사업자등록',
          required: true,
          renewalCycle: null,
          authority: '국세청 / 홈택스',
          processingDays: '1~3 영업일',
          legalBasis: '부가가치세법 제8조',
          description: '사업 개시 후 20일 이내 신청 필수. 휴게음식점은 업태=음식점업, 종목=한식 또는 분식.',
          steps: [
            '홈택스 (hometax.go.kr) 접속 → 공동인증서 로그인',
            '신청/제출 → 사업자등록 신청/정정 등 → 사업자등록 신청(개인)',
            '인적사항 입력 (성명, 주민등록번호, 주소)',
            '사업장 정보 입력 (상호, 사업장 주소, 업태/종목)',
            '서류 업로드 (임대차계약서, 신분증)',
            '제출 → 사업자등록증 즉시 출력 가능',
          ],
          documents: [
            '임대차계약서 사본 (자가 시 등기부등본)',
            '대표자 신분증 사본',
            '동업인 경우 동업계약서',
          ],
          tips: [
            '간이과세자(연 매출 1억 400만 원 미만 추정)와 일반과세자 선택 신중 — 한번 정하면 1년 유지',
            '음식점은 업태=음식점업, 종목=한식/분식/일반음식점업 등으로 정확히 기재',
            '사업장 면적 (제곱미터) 정확히 — 영업신고 시 일치해야 함',
          ],
          deepLinks: [
            { label: '홈택스 사업자등록 바로가기', url: 'https://hometax.go.kr/', external: true },
            { label: '국세청 사업자등록 안내', url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2272&cntntsId=7677', external: true },
          ],
          internalLinks: [
            { label: 'Settings > 회사정보 탭에서 사업자번호 등록', path: '/settings', external: false },
          ],
          syncWith: 'business.business_number',
          mergedDocs: ['biz_registration'],
          dateFields: [{ key: 'completed_at', label: '등록일' }],
        },
        {
          key: 'permits.restaurant_report',
          title: '휴게음식점 영업신고',
          required: true,
          renewalCycle: null,
          authority: '관할 시·군·구청 위생과',
          processingDays: '3~7 영업일',
          legalBasis: '식품위생법 제37조',
          description: '음식·음료 조리·판매 전 반드시 영업신고. 위생교육 이수증 첨부 필수.',
          steps: [
            '위생교육 이수 (permits.hygiene_education 먼저 완료)',
            '관할 구청 위생과 방문 또는 정부24 (gov.kr) 온라인 신청',
            '신청서 작성 (업소명, 영업장 주소, 면적, 시설 내역)',
            '구비서류 제출 (위생교육 이수증, 임대차계약서, 시설 평면도)',
            '현장 점검 (시·군·구마다 다름, 경우에 따라 면제)',
            '영업신고증 수령 → 매장 잘 보이는 곳에 게시 의무',
          ],
          documents: [
            '위생교육 이수증',
            '임대차계약서 또는 등기부등본',
            '시설 평면도 (조리실 분리·환기 시설 표시)',
            '대표자 신분증',
            '액화석유가스 사용시설 완성검사필증 (가스 사용 시)',
          ],
          tips: [
            '"휴게음식점" vs "일반음식점" 구분 중요 — 휴게음식점은 주류 판매 불가 (분식·김밥·커피 등)',
            '정부24 온라인 신청이 방문보다 빠른 경우 많음',
            '시설 기준 (조리실·객석 분리, 환기 시설 등) 사전 확인 필수',
          ],
          deepLinks: [
            { label: '정부24 영업신고 바로가기', url: 'https://www.gov.kr/portal/main', external: true },
            { label: '식약처 영업신고 안내', url: 'https://www.mfds.go.kr/brd/m_207/list.do', external: true },
          ],
          internalLinks: [],
          mergedDocs: ['biz_license'],
          dateFields: [{ key: 'completed_at', label: '신고일' }],
        },
        {
          key: 'permits.hygiene_education',
          title: '위생교육 이수',
          required: true,
          renewalCycle: { months: 12 },
          authority: '한국휴게음식업중앙회',
          processingDays: '교육 6시간 (당일)',
          legalBasis: '식품위생법 제41조',
          description: '영업신고 전 사전 교육 6시간, 매년 정기교육 3시간 이수. 미이수 시 과태료.',
          steps: [
            '한국휴게음식업중앙회 (www.efoodkorea.or.kr) 접속',
            '교육 신청 → 사전(신규) 또는 정기교육 선택',
            '온라인 또는 오프라인 교육 수강',
            '수료증 발급 → 영업신고 시 첨부',
          ],
          documents: [
            '주민등록번호',
            '교육비 (사전 28,000원, 정기 24,000원 — 변동 가능)',
          ],
          tips: [
            '신규 = 6시간, 정기 = 3시간. 매년 1회 이수',
            '온라인 교육 가능 (편리)',
            '정기교육 미이수 시 20만 원 이하 과태료',
          ],
          deepLinks: [
            { label: '한국휴게음식업중앙회', url: 'http://www.efoodkorea.or.kr', external: true },
            { label: '식약처 위생교육 안내', url: 'https://www.foodsafetykorea.go.kr', external: true },
          ],
          internalLinks: [],
          syncWith: 'hr.hygiene_certificates',  // Task 3 결과에 따라 제거 가능
          dateFields: [
            { key: 'completed_at', label: '이수일' },
            { key: 'expires_at', label: '다음 정기교육 만기' },
          ],
        },
        {
          key: 'permits.health_certificate',
          title: '보건증 (건강진단결과서)',
          required: true,
          renewalCycle: { months: 12 },
          authority: '보건소 또는 지정 의료기관',
          processingDays: '검사 후 5~7 영업일',
          legalBasis: '식품위생법 제40조',
          description: '식품 취급자 전원 매년 건강진단 받고 결과서 비치. 직원 채용 전 발급 필수.',
          steps: [
            '관할 보건소 또는 지정 병원 방문',
            '건강진단 수검 (장티푸스·결핵·전염성 피부질환)',
            '5~7일 후 결과서 발급',
            '직원별 보건증 매장 비치 또는 SodamFN HR > 인사기록에 업로드',
          ],
          documents: [
            '신분증',
            '검사비 (보건소 약 3,000원, 병원 약 15,000~30,000원)',
          ],
          tips: [
            '검사 항목 = 장티푸스, 폐결핵, 전염성 피부질환',
            '유효기간 1년 — 만료 전 갱신',
            '직원별 보건증 결정적 미비 시 영업정지·과태료',
            '보건소가 가장 저렴',
          ],
          deepLinks: [
            { label: '내 보건소 찾기', url: 'https://www.g-health.kr/portal/health/healthInfoSearch/find.do', external: true },
            { label: '식약처 건강진단 안내', url: 'https://www.foodsafetykorea.go.kr/portal/healthcheckup', external: true },
          ],
          internalLinks: [
            { label: 'HR > 인사기록 직원별 보건증 등록', path: '/employees', external: false },
          ],
          syncWith: 'hr.health_certificates',
          dateFields: [
            { key: 'completed_at', label: '발급일' },
            { key: 'expires_at', label: '만료일' },
          ],
        },
        {
          key: 'permits.fire_insurance',
          title: '화재배상책임보험',
          required: true,
          renewalCycle: { months: 12 },
          authority: '손해보험사 (다중이용업소 대상)',
          processingDays: '1~3 영업일',
          legalBasis: '다중이용업소의 안전관리에 관한 특별법 제13조의2',
          description: '다중이용업소(휴게음식점 100㎡ 이상 또는 지하층) 의무 가입. 미가입 시 영업신고 거부.',
          steps: [
            '휴게음식점이 다중이용업소 해당 여부 확인 (면적·지하층·노래연습장 인접 등)',
            '손해보험사 (KB손보, 삼성화재 등) 견적 요청',
            '계약 체결 → 보험증권 발급',
            '영업신고 시 보험증권 첨부 또는 사후 제출',
          ],
          documents: [
            '사업자등록증',
            '영업신고증 (사후 발급 가능)',
            '연 보험료 평균 10~30 만 원',
          ],
          tips: [
            '소규모 (100㎡ 미만 1층) 휴게음식점은 의무 아님 — 다만 임의 가입 권장',
            '매년 갱신 — 만료 시 영업정지 가능',
            '사업장 보험과 함께 묶으면 할인',
          ],
          deepLinks: [
            { label: '소방청 다중이용업소 안내', url: 'https://www.nfa.go.kr/nfa/safetyinformation/', external: true },
            { label: '손해보험협회', url: 'https://www.knia.or.kr', external: true },
          ],
          internalLinks: [],
          mergedDocs: ['insurance'],
          dateFields: [
            { key: 'completed_at', label: '가입일' },
            { key: 'expires_at', label: '만료일' },
          ],
        },
        {
          key: 'permits.lpg_report',
          title: 'LPG 사용신고',
          required: false,
          renewalCycle: null,
          authority: '관할 시·군·구청 가스과',
          processingDays: '7~14 영업일',
          legalBasis: '액화석유가스의 안전관리 및 사업법 제37조',
          description: '액화석유가스(LPG) 사용 시 사용시설 완성검사·사용신고. 도시가스 사용 시 불필요.',
          steps: [
            '가스 시공 업체에 시설공사 의뢰',
            '한국가스안전공사 (KGS) 완성검사 신청·수검',
            '완성검사필증 수령',
            '관할 구청 가스과 사용신고 (필증 제출)',
          ],
          documents: [
            '완성검사필증',
            '시공 도면',
            '안전관리자 자격 (소형 시설은 면제)',
          ],
          tips: [
            '도시가스 (LNG) 사용 시 본 항목 해당 없음',
            'LPG 시설 완성검사 비용 약 30~50 만 원',
            '영업신고 시 필증 필수',
          ],
          deepLinks: [
            { label: '한국가스안전공사', url: 'https://www.kgs.or.kr', external: true },
            { label: '정부24 가스사용신고', url: 'https://www.gov.kr/portal/main', external: true },
          ],
          internalLinks: [],
          dateFields: [{ key: 'completed_at', label: '신고일' }],
        },
        {
          key: 'permits.waste_food_report',
          title: '음식물쓰레기 종량제 배출자 신고',
          required: true,
          renewalCycle: null,
          authority: '관할 시·군·구청 청소과',
          processingDays: '1~3 영업일',
          legalBasis: '폐기물관리법 시행규칙 (지자체별 조례)',
          description: '음식점은 음식물쓰레기 다량배출자 — 종량제 봉투 또는 RFID 카드 등록.',
          steps: [
            '관할 구청 청소과 방문 또는 온라인 신청',
            '사업장 정보 등록 (예상 배출량, 영업 면적)',
            'RFID 카드 또는 종량제 봉투 수령',
            '주기적 배출 (수거 일정 확인)',
          ],
          documents: ['사업자등록증', '영업신고증'],
          tips: [
            '지역별 RFID 시스템 vs 봉투제 차이',
            '대형 매장은 직접 위탁 처리 옵션',
            '쓰레기 분리 (음식물·일반·재활용) 위반 시 과태료',
          ],
          deepLinks: [
            { label: '환경부 자원순환정보시스템', url: 'https://www.recycling-info.or.kr', external: true },
          ],
          internalLinks: [],
          dateFields: [{ key: 'completed_at', label: '신고일' }],
        },
      ],
    },

    // ─────────────────────────────────────
    // 다른 5 카테고리는 다음 task 에서 추가
    // ─────────────────────────────────────
  ],
};
```

- [ ] **Step 3: import 검증 (간단 syntax 확인)**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/frontend && node -e "const m = require('./src/data/sales-guide/kimbap.js'); console.log(Object.keys(m.default), m.default.categories[0].items.length)"
```

(ESM 형식이라 직접 실행 안 될 수 있음 — Vite dev 서버에서 import 검증으로 대체)

또는:
```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | head -20
```

Expected: 빌드 통과 (현재 페이지에서 import 안 했으니 트리 셰이킹으로 무시됨)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/data/sales-guide/
git commit -m "feat(sales-guide): 데이터 인덱스 + 휴게음식점 인허가 7 항목 콘텐츠"
```

### Task 7: 배달·온라인 채널 카테고리 (8 항목)

**Files:**
- Modify: `frontend/src/data/sales-guide/kimbap.js`

- [ ] **Step 1: 배달 카테고리 추가**

`kimbap.js` 의 `categories` 배열에 추가:

```js
{
  key: 'delivery-apps',
  label: '배달·온라인 채널',
  icon: 'Truck',
  color: 'orange',
  description: '주문·검색을 늘리는 외부 플랫폼 가입',
  order: 2,
  items: [
    {
      key: 'delivery.baemin',
      title: '배달의민족 사장님 가입',
      required: false,
      renewalCycle: null,
      authority: '우아한형제들 (배달의민족)',
      processingDays: '심사 3~7 영업일',
      legalBasis: null,
      description: '국내 최대 배달 플랫폼. 광고비·중개수수료 정책 자주 변경되므로 가입 전 비교 필수.',
      steps: [
        '배민셀프서비스 (ceo.baemin.com) 가입',
        '사업자등록증·영업신고증·통장 사본 업로드',
        '계약 정보 (정산계좌, 배달방식) 입력',
        '메뉴 등록 + 매장 사진 업로드',
        '심사 통과 후 주문 받기 시작',
      ],
      documents: [
        '사업자등록증',
        '영업신고증',
        '대표자 통장 사본',
        '대표자 신분증',
      ],
      tips: [
        '주문중개수수료 6.8% (변경 가능) + 결제수수료 별도',
        '울트라콜 (정액 광고) vs 오픈리스트 (수수료) 정책 비교',
        '배민라이더스 (자체배달) vs 가게배달 (직접 또는 부르릉) 선택',
        '리뷰 관리·답변 대응 중요',
      ],
      deepLinks: [
        { label: '배민셀프서비스 가입', url: 'https://ceo.baemin.com', external: true },
        { label: '사장님광장 (가이드)', url: 'https://ceo.baemin.com/guide', external: true },
      ],
      internalLinks: [
        { label: '손익관리 > 배달앱 매출 추적', path: '/finance/delivery', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '가입일' }],
    },
    {
      key: 'delivery.coupang_eats',
      title: '쿠팡이츠 사장님 가입',
      required: false,
      renewalCycle: null,
      authority: '쿠팡 (쿠팡이츠)',
      processingDays: '심사 3~7 영업일',
      legalBasis: null,
      description: '단건 배달 강점. 쿠팡 회원 노출 + 와우 멤버십 할인.',
      steps: [
        '쿠팡이츠 스토어 (store.coupangeats.com) 가입',
        '사업자등록증·영업신고증·통장 사본 업로드',
        '메뉴 등록 + 사진',
        '심사 통과 후 주문 시작',
      ],
      documents: ['사업자등록증', '영업신고증', '통장 사본', '신분증'],
      tips: [
        '주문중개수수료 9.8% (변경 가능)',
        '쿠팡이츠 라이더 단건 배달 — 빠른 배송',
        '쿠팡 회원·와우 회원 노출 강점',
      ],
      deepLinks: [
        { label: '쿠팡이츠 스토어 가입', url: 'https://store.coupangeats.com', external: true },
      ],
      internalLinks: [
        { label: '손익관리 > 배달앱 매출 추적', path: '/finance/delivery', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '가입일' }],
    },
    {
      key: 'delivery.yogiyo',
      title: '요기요 사장님 가입',
      required: false,
      renewalCycle: null,
      authority: '딜리버리히어로코리아 (요기요)',
      processingDays: '심사 3~7 영업일',
      legalBasis: null,
      description: '정액제 옵션 (요기요익스프레스) 있음. 수수료 부담 줄이려는 매장에 적합.',
      steps: [
        '요기요 사장님 (ceo.yogiyo.co.kr) 가입',
        '서류 업로드',
        '메뉴·사진 등록',
        '심사·승인',
      ],
      documents: ['사업자등록증', '영업신고증', '통장 사본', '신분증'],
      tips: [
        '주문중개수수료 12.5% (변경 가능)',
        '요기요익스프레스 = 월 정액제 광고',
        '주변 경쟁 매장 분석 후 선택',
      ],
      deepLinks: [
        { label: '요기요 사장님 가입', url: 'https://ceo.yogiyo.co.kr', external: true },
      ],
      internalLinks: [
        { label: '손익관리 > 배달앱 매출 추적', path: '/finance/delivery', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '가입일' }],
    },
    {
      key: 'delivery.naver_place',
      title: '네이버 스마트플레이스 등록',
      required: true,
      renewalCycle: null,
      authority: '네이버',
      processingDays: '심사 1~3 영업일',
      legalBasis: null,
      description: '네이버 검색·지도 노출 필수. 무료. 모든 매장 권장.',
      steps: [
        '네이버 스마트플레이스 (smartplace.naver.com) 가입',
        '사업자등록증 인증',
        '매장 정보 등록 (주소·전화·메뉴·사진)',
        '영업시간·휴무일 설정',
        '리뷰·예약 관리 시작',
      ],
      documents: ['사업자등록증'],
      tips: [
        '네이버 지도/검색 노출 = 매출에 직결',
        '매장 사진 5장 이상 등록 추천',
        '영업시간 정확히 — 변경 시 즉시 업데이트',
        '네이버 페이/예약 연동 가능',
      ],
      deepLinks: [
        { label: '네이버 스마트플레이스', url: 'https://smartplace.naver.com', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '등록일' }],
    },
    {
      key: 'delivery.kakao_map',
      title: '카카오맵 사장님 등록',
      required: true,
      renewalCycle: null,
      authority: '카카오',
      processingDays: '심사 1~3 영업일',
      legalBasis: null,
      description: '카카오맵·카카오톡 검색 노출. 무료. 네이버와 함께 필수.',
      steps: [
        '카카오 비즈니스 (business.kakao.com) 가입',
        '카카오맵 사장님 메뉴 → 매장 등록',
        '사업자등록증 인증',
        '매장 정보·사진 등록',
      ],
      documents: ['사업자등록증'],
      tips: [
        '카카오톡 채널과 연계해 단골 관리 가능',
        '카카오 알림톡 발송 시 카카오 비즈센터 가입 필요',
      ],
      deepLinks: [
        { label: '카카오 비즈니스', url: 'https://business.kakao.com', external: true },
        { label: '카카오맵 사장님', url: 'https://map.kakao.com', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '등록일' }],
    },
    {
      key: 'delivery.instagram',
      title: '인스타그램 비즈니스 계정',
      required: false,
      renewalCycle: null,
      authority: 'Meta (Instagram)',
      processingDays: '즉시',
      legalBasis: null,
      description: 'SNS 마케팅의 표준. 메뉴·이벤트·후기 노출에 효과적.',
      steps: [
        '개인 계정 생성 또는 기존 계정 사용',
        '설정 → 계정 → "프로페셔널 계정으로 전환" → "비즈니스"',
        '카테고리 = 음식점 / 김밥 등',
        '연락처·주소·영업시간 입력',
        '게시물·스토리 발행 시작',
      ],
      documents: ['이메일 또는 페이스북 계정'],
      tips: [
        '매장 사진·메뉴 사진은 자연광에서 촬영',
        '해시태그 #지역명김밥 #분식 등 활용',
        '스토리 + 릴스 활용 = 도달률 ↑',
        '주 2~3회 정기 게시 권장',
      ],
      deepLinks: [
        { label: 'Instagram 비즈니스 도구', url: 'https://business.instagram.com', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '전환일' }],
    },
    {
      key: 'delivery.naver_booking',
      title: '네이버 예약/주문',
      required: false,
      renewalCycle: null,
      authority: '네이버',
      processingDays: '심사 3~7 영업일',
      legalBasis: null,
      description: '네이버 검색에서 직접 예약·포장주문 받기. 수수료 낮음.',
      steps: [
        '네이버 스마트플레이스 → 예약/주문 메뉴 활성화',
        '예약 가능 시간 설정',
        '포장주문 메뉴 등록',
        '결제 수단 (네이버페이) 설정',
      ],
      documents: ['스마트플레이스 가입 완료'],
      tips: [
        '예약: 좌석 매장에 유용 (김밥 매장은 대부분 포장주문)',
        '포장주문 수수료 약 3% — 배달앱보다 저렴',
        '네이버페이 사용자 자동 노출',
      ],
      deepLinks: [
        { label: '네이버 스마트플레이스', url: 'https://smartplace.naver.com', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '활성화일' }],
    },
    {
      key: 'delivery.local_apps',
      title: '지역 배달앱 (위메프오, 배달특급 등)',
      required: false,
      renewalCycle: null,
      authority: '지역 운영사 (지자체 또는 민간)',
      processingDays: '심사 3~7 영업일',
      legalBasis: null,
      description: '지자체 운영 공공앱 (배달특급 등) 또는 위메프오 같은 민간. 수수료 0~5% 로 저렴.',
      steps: [
        '운영 지역 확인 (서울·경기 일부 한정)',
        '해당 앱 사장님 페이지에서 가입',
        '서류 업로드 + 메뉴 등록',
      ],
      documents: ['사업자등록증', '영업신고증'],
      tips: [
        '경기도 = 배달특급, 서울 = 우리동네앱 등 지역마다 다름',
        '수수료 저렴하지만 사용자 수 적음',
        '주력 채널 보조용으로 적합',
      ],
      deepLinks: [
        { label: '배달특급 (경기도)', url: 'https://www.specialdelivery.co.kr', external: true },
        { label: '위메프오', url: 'https://wmpo.kr', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '가입일' }],
    },
  ],
},
```

- [ ] **Step 2: 빌드 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | tail -10
```

Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/data/sales-guide/kimbap.js
git commit -m "feat(sales-guide): 배달·온라인 채널 8 항목 콘텐츠"
```

### Task 8: 결제·POS 카테고리 (5 항목)

**Files:**
- Modify: `frontend/src/data/sales-guide/kimbap.js`

- [ ] **Step 1: 결제 카테고리 추가**

`categories` 배열에 추가:

```js
{
  key: 'payment',
  label: '결제·POS',
  icon: 'CreditCard',
  color: 'green',
  description: '카드·현금·간편결제 인프라 셋업',
  order: 3,
  items: [
    {
      key: 'payment.card_terminal',
      title: '카드 단말기 신청',
      required: true,
      renewalCycle: null,
      authority: 'VAN 사 (KICC, NICE, 한국정보통신 등)',
      processingDays: '신청 후 3~7 영업일',
      legalBasis: '여신전문금융업법 (가맹점 신청 의무)',
      description: '신용카드 결제 받으려면 VAN 사를 통한 단말기·가맹점 신청 필수.',
      steps: [
        'VAN 사 비교 (KICC·NICE·한국정보통신 등)',
        '온라인 또는 영업사원 통해 가맹점 신청',
        '서류 제출 (사업자등록증·통장사본·신분증)',
        'VAN 사 심사 → 카드사별 가맹점 코드 발급',
        '단말기 설치 (방문 설치 또는 직접)',
        '시운전 → 정상 결제 확인',
      ],
      documents: [
        '사업자등록증',
        '대표자 통장 사본',
        '대표자 신분증',
        '영업신고증 (음식점)',
      ],
      tips: [
        '수수료율 = 카드사별 + VAN 사 수수료. 보통 매출 1~2% 사이',
        'POS 통합형 vs 독립형 단말기 선택 — 매출 보고 통합 시 POS형 편리',
        '월 단말기 임대료 vs 일시불 매입 비교',
        '제로페이·카카오페이·네이버페이 별도 가맹 필요',
      ],
      deepLinks: [
        { label: 'KICC 사장님 신청', url: 'https://www.kicc.co.kr', external: true },
        { label: '나이스정보통신', url: 'https://www.nicevan.co.kr', external: true },
        { label: '한국정보통신', url: 'https://www.kicc.co.kr', external: true },
      ],
      internalLinks: [
        { label: '손익관리 > 카드 매출 추적', path: '/finance/card-sales', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '설치일' }],
    },
    {
      key: 'payment.cashbill_merchant',
      title: '현금영수증 가맹점 등록',
      required: true,
      renewalCycle: null,
      authority: '국세청 / 홈택스',
      processingDays: '즉시',
      legalBasis: '소득세법 제162조의3 (현금영수증 의무발급 사업자)',
      description: '음식점은 매출 규모 무관 의무발급 업종. 미가입 시 매출 누락 의심·과태료.',
      steps: [
        '홈택스 로그인',
        '신청/제출 → 현금영수증 가맹점 신청',
        '발급 단말기 등록 (POS 또는 PC)',
        '발급 시작',
      ],
      documents: ['사업자등록증'],
      tips: [
        '음식점은 매출 규모 무관 의무발급 — 미발급 시 5% 가산세',
        '카드 단말기에서 자동 발급되도록 설정 가능',
        'SodamFN 의 현금영수증 기능 (cashbill 페이지) 으로 발급·이력 관리',
        '거부 시 신고 가능 (포상금 제도)',
      ],
      deepLinks: [
        { label: '홈택스 현금영수증 가맹점', url: 'https://hometax.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN 현금영수증 발급/이력', path: '/finance/cashbill', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '등록일' }],
    },
    {
      key: 'payment.pos_system',
      title: 'POS 시스템 도입',
      required: false,
      renewalCycle: null,
      authority: 'POS 업체 (오케이포스, 유라이즈 등)',
      processingDays: '계약 후 1~2주',
      legalBasis: null,
      description: '주문·계산·매출 통합 관리. 김밥 매장 규모 따라 매장형/태블릿형 선택.',
      steps: [
        'POS 업체 견적 비교',
        '하드웨어 (POS 단말·프린터·키친 모니터) 결정',
        '메뉴 입력 + 옵션 셋업',
        '카드 단말기 연동',
        '직원 사용법 교육',
      ],
      documents: ['사업자등록증', '카드가맹점 정보'],
      tips: [
        '월 임대료 vs 매입 비교 (매입 100~300만 원, 임대 월 5~10만 원)',
        '클라우드 POS (모바일 앱) = 저렴·이동성',
        '배달앱 통합 가능한 POS 선호',
        '매출 분석·재고 관리 기능 확인',
      ],
      deepLinks: [
        { label: '오케이포스', url: 'https://www.okpos.com', external: true },
        { label: '유라이즈', url: 'https://www.urise.co.kr', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '설치일' }],
    },
    {
      key: 'payment.simple_pay',
      title: '간편결제 (제로페이·페이코·카카오페이)',
      required: false,
      renewalCycle: null,
      authority: '각 결제사',
      processingDays: '신청 후 3~7 영업일',
      legalBasis: null,
      description: '카드보다 수수료 낮음. 제로페이는 0%, 페이코·카카오페이는 1~2%.',
      steps: [
        '제로페이: zeropay.or.kr 가맹점 신청',
        '카카오페이: kakaopayonline.com 또는 카카오 비즈니스',
        '페이코: nhnpayco.com',
        '서류 제출 (사업자등록증·통장 사본)',
        'QR 코드 또는 단말기 수령 후 게시',
      ],
      documents: ['사업자등록증', '통장 사본'],
      tips: [
        '제로페이 = 수수료 0%, 소상공인 지원',
        '카카오·네이버 사용자 다수 — 가입 가치 높음',
        '카드 단말기 + 간편결제 동시 사용 시 단말기에 통합',
      ],
      deepLinks: [
        { label: '제로페이 가맹점', url: 'https://zeropay.or.kr', external: true },
        { label: '카카오페이 매장', url: 'https://payment.kakao.com', external: true },
        { label: '페이코 가맹점', url: 'https://nhnpayco.com', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '시작일' }],
    },
    {
      key: 'payment.delivery_settlement',
      title: '배달앱 정산계좌 등록',
      required: true,
      renewalCycle: null,
      authority: '각 배달앱',
      processingDays: '즉시 (배달앱 가입 시)',
      legalBasis: null,
      description: '배달앱별 매출 정산받을 계좌 등록. 사업자 명의 통장 권장.',
      steps: [
        '사업자 명의 통장 준비 (개인 통장도 가능하지만 사업자 통장 권장)',
        '각 배달앱 사장님 페이지에서 정산계좌 등록',
        '본인 인증 및 통장 사본 업로드',
        '시범 정산으로 입금 확인',
      ],
      documents: [
        '사업자 또는 대표자 명의 통장 사본',
        '사업자등록증',
      ],
      tips: [
        '사업자 명의 통장 = 매입세액 공제 자동화 + 회계 분리',
        '배달앱별 정산 주기 다름 (배민 매주, 쿠팡이츠 매일)',
        'SodamFN 은행동기로 자동 입금 추적 가능',
      ],
      deepLinks: [],
      internalLinks: [
        { label: 'SodamFN 은행계좌 연동', path: '/finance/bank-sync', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '등록일' }],
    },
  ],
},
```

- [ ] **Step 2: 빌드 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/data/sales-guide/kimbap.js
git commit -m "feat(sales-guide): 결제·POS 5 항목 콘텐츠"
```

### Task 9: 세무·회계 카테고리 (6 항목)

**Files:**
- Modify: `frontend/src/data/sales-guide/kimbap.js`

- [ ] **Step 1: 세무 카테고리 추가**

`categories` 배열에 추가:

```js
{
  key: 'tax',
  label: '세무·회계 일정',
  icon: 'Receipt',
  color: 'purple',
  description: '연간 세무 신고 일정 + 사업장 세금 인프라',
  order: 4,
  items: [
    {
      key: 'tax.vat_filing',
      title: '부가가치세 신고',
      required: true,
      renewalCycle: { months: 6 },
      authority: '국세청 / 홈택스',
      processingDays: '신고 기간 25일 내',
      legalBasis: '부가가치세법 제48~49조',
      description: '일반과세자: 연 2회 (1월·7월). 간이과세자: 연 1회 (1월).',
      steps: [
        '신고 기간 (1/1~1/25 또는 7/1~7/25) 확인',
        '홈택스 로그인 → 신고/납부 → 부가가치세',
        '매출·매입 자료 자동 불러오기 (홈택스 수집)',
        '신고서 작성 → 제출',
        '납부 (가상계좌·계좌이체·신용카드)',
      ],
      documents: [
        '매출 (카드·현금영수증·세금계산서) — 자동 수집됨',
        '매입 (세금계산서·신용카드 매입) — 자동 수집됨',
        '인건비 영수증 (간이영수증 인정 한도)',
      ],
      tips: [
        '간이과세자 (연 매출 1억 400만 원 미만) = 부가율 적용 간소화',
        '일반과세자는 매입세액 공제 가능',
        '미신고 시 무신고 가산세 20% + 납부지연 가산세',
        'SodamFN 홈택스 수집으로 자료 자동화',
      ],
      deepLinks: [
        { label: '홈택스 부가세 신고', url: 'https://hometax.go.kr', external: true },
        { label: '국세청 부가세 안내', url: 'https://www.nts.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN 홈택스 수집', path: '/finance/hometax', external: false },
        { label: 'SodamFN 세금계산서', path: '/finance/tax-invoice', external: false },
      ],
      mergedDocs: ['vat_return'],
      dateFields: [
        { key: 'completed_at', label: '최근 신고일' },
        { key: 'expires_at', label: '다음 신고기한' },
      ],
    },
    {
      key: 'tax.income_tax',
      title: '종합소득세 신고',
      required: true,
      renewalCycle: { months: 12 },
      authority: '국세청 / 홈택스',
      processingDays: '신고기한 5/31',
      legalBasis: '소득세법 제70조',
      description: '개인사업자 모든 소득 합산 신고. 매년 5/1~5/31. 성실신고확인대상자는 6/30 까지.',
      steps: [
        '매년 5월 신고 기간',
        '홈택스 → 신고/납부 → 종합소득세',
        '단순경비율 (소규모) vs 복식부기 선택',
        '소득·경비 입력 → 신고서 제출',
        '세액 납부',
      ],
      documents: [
        '연간 매출·매입 자료',
        '인건비 (4대보험·원천세 신고 내역)',
        '임차료·관리비 영수증',
        '세무대리인 위임 시 세무사 정보',
      ],
      tips: [
        '연 매출 4,800 만 원 미만 = 단순경비율 적용 가능',
        '4,800 만 원 이상 = 기준경비율 또는 복식부기',
        '복식부기 의무자 (음식점 1.5억 이상) 미신고 시 가산세',
        '세무사 비용 vs DIY 비교 (간단하면 홈택스 직접)',
      ],
      deepLinks: [
        { label: '홈택스 종합소득세', url: 'https://hometax.go.kr', external: true },
        { label: '국세청 종소세 안내', url: 'https://www.nts.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN 손익계산서', path: '/finance/income-statement', external: false },
      ],
      dateFields: [
        { key: 'completed_at', label: '최근 신고일' },
        { key: 'expires_at', label: '다음 신고기한 (5/31)' },
      ],
    },
    {
      key: 'tax.withholding',
      title: '원천세 신고·납부',
      required: true,
      renewalCycle: { months: 1 },
      authority: '국세청 / 홈택스',
      processingDays: '월별 (다음달 10일까지)',
      legalBasis: '소득세법 제127조',
      description: '직원 급여·일용직 임금에서 원천징수한 세금 매월 신고·납부.',
      steps: [
        '직원 급여 지급 시 근로소득세 + 지방소득세 원천징수',
        '다음 달 10일까지 홈택스 신고 + 납부',
        '반기 신고 신청자 (직원 20인 미만) = 1월·7월 2회로 통합 가능',
        '연말정산 1월에 별도 진행',
      ],
      documents: [
        '월별 급여대장',
        '간이세액표 또는 SodamFN 자동 계산',
      ],
      tips: [
        '20인 미만 사업장 = 반기 납부 신청 가능 (편리)',
        '미신고 시 무신고 가산세 + 납부지연 가산세',
        '일용직은 매월 별도로 지급명세서 제출',
        'SodamFN 급여 시스템으로 원천세 자동 산출',
      ],
      deepLinks: [
        { label: '홈택스 원천세 신고', url: 'https://hometax.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN HR > 급여', path: '/employees', external: false },
      ],
      dateFields: [
        { key: 'completed_at', label: '최근 신고월' },
        { key: 'expires_at', label: '다음 신고기한' },
      ],
    },
    {
      key: 'tax.business_card',
      title: '사업자 신용카드 발급',
      required: false,
      renewalCycle: null,
      authority: '카드사 (신한·삼성·국민 등)',
      processingDays: '심사 7~14일',
      legalBasis: null,
      description: '사업자용 카드로 매입 시 자동 매입세액공제. 개인 카드와 분리 권장.',
      steps: [
        '사업자등록 후 카드사 사업자카드 신청',
        '서류 제출 (사업자등록증·재무자료)',
        '심사 통과 → 카드 수령',
        '홈택스에 카드 등록 (자동 매입 추적)',
      ],
      documents: [
        '사업자등록증',
        '재무자료 (간이장부 또는 매출 증빙)',
      ],
      tips: [
        '사업자카드 사용 시 매입세액공제 자동',
        '신용카드 매출전표 = 적격증빙',
        '한도·연회비 비교',
        '주유·통신 등 사업 관련 사용 시 100% 공제',
      ],
      deepLinks: [
        { label: '홈택스 사업용 카드 등록', url: 'https://hometax.go.kr', external: true },
      ],
      internalLinks: [],
      dateFields: [{ key: 'completed_at', label: '발급일' }],
    },
    {
      key: 'tax.social_insurance_org',
      title: '4대보험 사업장 가입 신고',
      required: true,
      renewalCycle: null,
      authority: '4대사회보험 정보연계센터',
      processingDays: '직원 채용 후 14일 이내',
      legalBasis: '국민연금법·국민건강보험법·고용보험법·산업재해보상보험법',
      description: '직원 1명 이상 채용 시 사업장 가입 의무. 한 번에 4대 보험 모두 신고.',
      steps: [
        '4대사회보험 정보연계센터 (4insure.or.kr) 가입',
        '사업장 정보 등록 (사업자번호·주소·업종·근로자 수)',
        '직원별 가입 신고 (성명·주민번호·입사일·임금)',
        '월별 보험료 자동 고지 (다음달 10일 납부)',
      ],
      documents: [
        '사업자등록증',
        '직원별 근로계약서',
        '주민등록번호',
      ],
      tips: [
        '직원 1명 이상 = 의무 가입 (사업주 본인은 별도)',
        '입사 후 14일 이내 신고 — 미신고 시 과태료',
        '4대보험 동시 신고 = 한 번에 처리',
        'SodamFN 직원 등록 시 자동 안내',
      ],
      deepLinks: [
        { label: '4대사회보험 정보연계센터', url: 'https://www.4insure.or.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN HR > 인사기록', path: '/employees', external: false },
      ],
      mergedDocs: ['insurance'],
      dateFields: [{ key: 'completed_at', label: '가입일' }],
    },
    {
      key: 'tax.daily_worker_report',
      title: '일용직 근로내용 확인 신고',
      required: false,
      renewalCycle: { months: 1 },
      authority: '근로복지공단',
      processingDays: '매월 (다음달 15일까지)',
      legalBasis: '고용보험법 시행령 제13조',
      description: '일용직 (1개월 미만 단기 근무자) 고용 시 매월 근로내용 확인 신고.',
      steps: [
        '일용직 근로자 채용 시 근로내용 기록 (근무일수·임금)',
        '다음 달 15일까지 근로복지공단 또는 4대보험 정보연계센터 신고',
        '미신고 시 고용보험 가입 못 함 → 과태료',
      ],
      documents: ['일용직 근로자 명단·근무일수·임금'],
      tips: [
        '일용직 = 동일 사업장 1개월 미만 근무자',
        '월 8일 미만 또는 60시간 미만 근무자는 4대보험 면제',
        'SodamFN 일용직 관리 페이지에서 자동화',
        '미신고 시 산재보험 미적용 → 사고 시 사업주 부담',
      ],
      deepLinks: [
        { label: '근로복지공단', url: 'https://www.comwel.or.kr', external: true },
        { label: '4대사회보험 정보연계센터', url: 'https://www.4insure.or.kr', external: true },
      ],
      internalLinks: [],
      dateFields: [
        { key: 'completed_at', label: '최근 신고월' },
        { key: 'expires_at', label: '다음 신고기한' },
      ],
    },
  ],
},
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/data/sales-guide/kimbap.js
git commit -m "feat(sales-guide): 세무·회계 6 항목 콘텐츠"
```

### Task 10: 인력·노무 카테고리 (5 항목, 외국인 고용 가이드 흡수)

**Files:**
- Modify: `frontend/src/data/sales-guide/kimbap.js`
- Read: `frontend/src/pages/ForeignWorkerGuide.jsx` (콘텐츠 발췌)

- [ ] **Step 1: ForeignWorkerGuide.jsx 콘텐츠 발췌**

```bash
cat c:/WORK/SodamFN/SodamApp/frontend/src/pages/ForeignWorkerGuide.jsx
```

→ 외국인 고용 절차·서류·팁 정보를 발췌해서 `hr.foreign_worker` 항목의 steps/documents/tips/deepLinks 에 통합.

- [ ] **Step 2: 인력·노무 카테고리 추가 (외국인 고용 흡수)**

`categories` 배열에 추가:

```js
{
  key: 'hr',
  label: '인력·노무',
  icon: 'Users',
  color: 'indigo',
  description: '직원 채용·계약·복리후생 절차',
  order: 5,
  items: [
    {
      key: 'hr.labor_contract',
      title: '근로계약서 작성',
      required: true,
      renewalCycle: null,
      authority: '고용노동부 (양식 표준)',
      processingDays: '직원 채용 시 즉시',
      legalBasis: '근로기준법 제17조',
      description: '직원 채용 즉시 서면 근로계약서 작성 의무. 미작성 시 과태료 500만 원.',
      steps: [
        '고용노동부 표준 근로계약서 양식 다운로드 (또는 SodamFN 전자계약 사용)',
        '필수 기재 사항 작성: 근로기간·임금·근로시간·휴일·휴가',
        '본인 자필 서명 또는 전자서명',
        '사용자 1부, 근로자 1부 보관',
      ],
      documents: ['표준 근로계약서 양식'],
      tips: [
        '미작성 = 과태료 500만 원 + 임금 분쟁 시 불리',
        '단시간·일용직도 서면 계약 의무',
        'SodamFN 전자계약서 시스템으로 페이퍼리스 가능',
        '근로조건 변경 시 변경 계약서 별도 작성',
      ],
      deepLinks: [
        { label: '고용노동부 표준 근로계약서', url: 'https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20180400025', external: true },
      ],
      internalLinks: [
        { label: 'HR > 인사기록 (전자계약서)', path: '/employees', external: false },
      ],
      syncWith: 'hr.contracts',
      dateFields: [{ key: 'completed_at', label: '최근 계약일' }],
    },
    {
      key: 'hr.social_insurance_staff',
      title: '4대보험 직원별 가입',
      required: true,
      renewalCycle: null,
      authority: '4대사회보험 정보연계센터',
      processingDays: '입사 후 14일 이내',
      legalBasis: '4대사회보험 관련법',
      description: '직원별 4대보험 가입 신고. 사업장 가입 (tax.social_insurance_org) 후 직원 추가.',
      steps: [
        '4대사회보험 정보연계센터에 직원 정보 입력',
        '4대보험 모두 동시 신고 (국민연금·건강·고용·산재)',
        '월별 보험료 자동 고지',
        'SodamFN 인사기록의 insurance_4major 체크',
      ],
      documents: ['직원 주민등록번호·입사일·월 급여'],
      tips: [
        '단시간 근로자 (월 60시간 미만) = 4대보험 면제 (산재만 의무)',
        '일용직 = 별도 신고 (tax.daily_worker_report)',
        '미신고 시 과태료 + 사고 발생 시 사업주 전액 부담',
      ],
      deepLinks: [
        { label: '4대사회보험 정보연계센터', url: 'https://www.4insure.or.kr', external: true },
      ],
      internalLinks: [
        { label: 'HR > 인사기록 직원별 4대보험', path: '/employees', external: false },
      ],
      syncWith: 'hr.insurance_4major',
      dateFields: [{ key: 'completed_at', label: '최근 가입일' }],
    },
    {
      key: 'hr.minimum_wage',
      title: '최저임금·법정수당 이해',
      required: true,
      renewalCycle: null,
      authority: '고용노동부',
      processingDays: '지속 준수',
      legalBasis: '최저임금법',
      description: '매년 최저임금 변경. 법정수당 (주휴·연장·야간·휴일) 정확한 계산 필수.',
      steps: [
        '매년 1월 1일 최저임금 적용 (전년 8월 고시)',
        '시급 계산 = 월 209시간 기준 환산',
        '주휴수당: 주 15시간 이상 + 개근 시 1일 수당',
        '연장근로 = 1.5배 / 야간(22~06) = 1.5배 / 휴일 = 1.5배',
        'SodamFN 급여 시스템으로 자동 계산',
      ],
      documents: ['근로계약서 (시급·근로시간 명시)'],
      tips: [
        '2026년 최저임금 = 시급 ___원 (매년 갱신)',
        '주 15시간 미만 근로자는 주휴수당 없음',
        '5인 미만 사업장은 연장·야간·휴일 가산수당 면제 (단, 일반 임금은 지급)',
        '미지급 시 근로감독관 진정 → 형사처벌',
      ],
      deepLinks: [
        { label: '최저임금위원회', url: 'https://www.minimumwage.go.kr', external: true },
        { label: '고용노동부 임금 안내', url: 'https://www.moel.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN 급여 산출', path: '/employees', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '확인일' }],
    },
    {
      key: 'hr.foreign_worker',
      title: '외국인 고용 절차',
      required: false,
      renewalCycle: null,
      authority: '고용노동부 / 출입국관리사무소',
      processingDays: '비자 종류별 상이 (1~3 개월)',
      legalBasis: '외국인근로자의 고용 등에 관한 법률',
      description: '외국인 채용 시 비자 종류 (E-9, H-2, F-4 등) 와 고용허가 절차 확인 필수.',
      steps: [
        '외국인 채용 사유 검토 — 내국인 우선 채용 원칙',
        '비자 종류 확인 (E-9 비전문취업, H-2 방문취업, F-4 재외동포 등)',
        'E-9: 고용센터 통해 고용허가 신청 → 대기',
        'H-2/F-4: 직접 채용 가능, 외국인 등록증 확인',
        '취업 가능 업종·체류기간 확인',
        '4대보험 가입 (외국인도 동일)',
      ],
      documents: [
        '외국인 등록증',
        '비자 (체류자격) 확인',
        '여권',
        '고용계약서 (한국어 + 모국어)',
      ],
      tips: [
        'E-9 (비전문취업) = 김밥 매장 채용 가능, 고용허가 필수',
        'H-2 (방문취업) = 음식점 취업 자유, 별도 허가 X',
        'F-4 (재외동포) = 자유 취업 (단순노무 일부 제한)',
        '불법체류 외국인 고용 시 사업주 형사처벌',
        '외국인 근로자 위한 노동법 보호 동일 적용',
      ],
      deepLinks: [
        { label: '고용허가제 (EPS)', url: 'https://www.eps.go.kr', external: true },
        { label: '하이코리아 (외국인 종합 안내)', url: 'https://www.hikorea.go.kr', external: true },
        { label: '고용노동부 외국인고용', url: 'https://www.moel.go.kr', external: true },
      ],
      internalLinks: [
        { label: 'HR > 인사기록 비자 정보 입력', path: '/employees', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '최근 채용일' }],
    },
    {
      key: 'hr.severance_pay',
      title: '퇴직금 적립 (퇴직연금/IRP)',
      required: true,
      renewalCycle: null,
      authority: '고용노동부 / 금융감독원',
      processingDays: '직원 채용 후 1년 이내',
      legalBasis: '근로자퇴직급여 보장법',
      description: '1년 이상 근속자에게 퇴직금 지급 의무. 퇴직연금(DB·DC) 가입 또는 IRP 적립.',
      steps: [
        '직원 입사 후 1년 미만 = 퇴직금 의무 없음',
        '1년 이상 근속 시 30일분 평균임금 × 근속연수 지급',
        '퇴직연금 (DC형 권장) 가입 시 매월 적립',
        '퇴직 시 IRP 계좌로 이체',
      ],
      documents: ['직원별 근속기간', '평균임금 산출 자료'],
      tips: [
        'DC형 = 매월 1/12 적립 (사업주 비용 분산)',
        'DB형 = 퇴직 시 일시 지급',
        '퇴직연금 미가입 시 사업주가 직접 적립 의무',
        'SodamFN 퇴직금 페이지에서 자동 계산',
      ],
      deepLinks: [
        { label: '고용노동부 퇴직급여', url: 'https://www.moel.go.kr', external: true },
        { label: '금융감독원 퇴직연금', url: 'https://pension.fss.or.kr', external: true },
      ],
      internalLinks: [
        { label: 'SodamFN 퇴직금 관리', path: '/hr/retirement', external: false },
      ],
      dateFields: [{ key: 'completed_at', label: '제도 도입일' }],
    },
  ],
},
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/data/sales-guide/kimbap.js
git commit -m "feat(sales-guide): 인력·노무 5 항목 콘텐츠 (외국인 고용 가이드 흡수)"
```

### Task 11: 운영팁 카테고리 (7 골격, 콘텐츠는 placeholder)

**Files:**
- Modify: `frontend/src/data/sales-guide/kimbap.js`

- [ ] **Step 1: 운영팁 카테고리 추가 (skeleton)**

`categories` 배열에 추가:

```js
{
  key: 'operations',
  label: '운영팁',
  icon: 'Lightbulb',
  color: 'amber',
  description: '매장 운영의 베스트 프랙티스 (콘텐츠 점진 업데이트)',
  order: 6,
  items: [
    {
      key: 'ops.hygiene_check',
      title: '위생관리 일일/주간 체크리스트',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '매일·매주 위생 점검 항목 정리 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: ['HACCP 인증 매장은 별도 체크리스트 적용'],
      deepLinks: [
        { label: '식약처 위생관리 가이드', url: 'https://www.foodsafetykorea.go.kr', external: true },
      ],
      internalLinks: [],
      dateFields: [],
    },
    {
      key: 'ops.inventory',
      title: '식자재·재고 관리',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '식자재 보관·유통기한 관리 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: ['선입선출 (FIFO) 원칙 준수'],
      deepLinks: [],
      internalLinks: [
        { label: 'SodamFN 매입 관리', path: '/finance/purchase', external: false },
      ],
      dateFields: [],
    },
    {
      key: 'ops.daily_routine',
      title: '오픈/마감 루틴',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '매장 오픈·마감 시 표준 작업 절차 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: [],
      deepLinks: [],
      internalLinks: [],
      dateFields: [],
    },
    {
      key: 'ops.customer_service',
      title: '고객응대·클레임 대응',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '클레임 응대 스크립트 + 위기 상황 대처 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: [],
      deepLinks: [],
      internalLinks: [],
      dateFields: [],
    },
    {
      key: 'ops.sns_marketing',
      title: 'SNS·리뷰 마케팅',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '인스타·블로그·리뷰 운영 가이드 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: [],
      deepLinks: [],
      internalLinks: [],
      dateFields: [],
    },
    {
      key: 'ops.financial_analysis',
      title: '매출/인건비 분석',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '월별 매출·인건비 비율 분석 가이드 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: [],
      deepLinks: [],
      internalLinks: [
        { label: 'SodamFN 손익계산서', path: '/finance/income-statement', external: false },
      ],
      dateFields: [],
    },
    {
      key: 'ops.crisis_response',
      title: '위기대응 (식중독·단전·민원)',
      required: false,
      renewalCycle: null,
      authority: null,
      processingDays: null,
      legalBasis: null,
      description: '식중독 의심·단전·고객 민원 등 위기 대응 매뉴얼 (콘텐츠 준비 중).',
      steps: ['콘텐츠 준비 중 — 곧 공개됩니다.'],
      documents: [],
      tips: [],
      deepLinks: [],
      internalLinks: [],
      dateFields: [],
    },
  ],
},
```

- [ ] **Step 2: 38 항목 카운트 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && node -e "
const data = require('./src/data/sales-guide/kimbap.js').default;
const total = data.categories.reduce((sum, c) => sum + c.items.length, 0);
console.log('총 카테고리:', data.categories.length);
console.log('총 항목:', total);
data.categories.forEach(c => console.log('-', c.label, c.items.length, '개'));
"
```

(ESM 호환성 문제로 실패 시 `npm run build` 후 페이지에서 검증)

Expected:
- 총 카테고리: 6
- 총 항목: 38 (인허가 7 + 배달 8 + 결제 5 + 세무 6 + 인력 5 + 운영팁 7)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/data/sales-guide/kimbap.js
git commit -m "feat(sales-guide): 운영팁 7 골격 추가 — 38 항목 카탈로그 완성"
```

---

## Stage 6: 데이터 페치 훅

### Task 12: useSalesGuide 훅

**Files:**
- Create: `frontend/src/hooks/useSalesGuide.js`

- [ ] **Step 1: 훅 작성**

Create `frontend/src/hooks/useSalesGuide.js`:

```js
import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { getIndustryData } from '../data/sales-guide';

/**
 * 영업관리 데이터 통합 훅.
 * 페이지 진입 시 progress + sync + stats 한 번에 페치.
 *
 * Returns:
 * - industry: 정적 카탈로그 (categories 포함)
 * - progress: { item_key: progress_row } map
 * - sync: { sync_key: { completed, total, label } }
 * - stats: { overall, categories: [...] }
 * - loading, error, refresh, patchItem
 */
export function useSalesGuide(industryKey = 'kimbap') {
  const [progress, setProgress] = useState({});
  const [sync, setSync] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const industry = getIndustryData(industryKey);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [progressRes, syncRes, statsRes] = await Promise.all([
        api.get('/sales-guide/progress'),
        api.get('/sales-guide/sync-status'),
        api.get('/sales-guide/stats'),
      ]);

      const progressMap = {};
      progressRes.data.items.forEach((p) => {
        progressMap[p.item_key] = p;
      });
      setProgress(progressMap);
      setSync(syncRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Sales guide fetch failed:', e);
      setError(e.message || '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const patchItem = useCallback(
    async (itemKey, updates) => {
      try {
        const res = await api.patch(`/sales-guide/progress/${itemKey}`, updates);
        setProgress((prev) => ({ ...prev, [itemKey]: res.data }));
        // stats 재계산을 위해 stats 만 다시 페치 (가벼운 쿼리)
        const statsRes = await api.get('/sales-guide/stats');
        setStats(statsRes.data);
        return res.data;
      } catch (e) {
        console.error('Patch failed:', e);
        throw e;
      }
    },
    []
  );

  return { industry, progress, sync, stats, loading, error, refresh: fetchAll, patchItem };
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/hooks/useSalesGuide.js
git commit -m "feat(sales-guide): useSalesGuide 데이터 페치 훅"
```

---

## Stage 7: 컴포넌트 (4 개)

### Task 13: ProgressCard, ItemCard, DeepLinkButton

**Files:**
- Create: `frontend/src/components/sales-guide/ProgressCard.jsx`
- Create: `frontend/src/components/sales-guide/ItemCard.jsx`
- Create: `frontend/src/components/sales-guide/DeepLinkButton.jsx`

- [ ] **Step 1: DeepLinkButton 작성**

Create `frontend/src/components/sales-guide/DeepLinkButton.jsx`:

```jsx
import { ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * 외부 정부 사이트 또는 내부 SodamFN 페이지 deep-link.
 *
 * Props:
 * - link: { label, url?, path?, external: boolean }
 */
export default function DeepLinkButton({ link, variant = 'primary' }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (link.external) {
      // 외부 링크는 새 창
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } else {
      e.preventDefault();
      navigate(link.path);
    }
  };

  const baseClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-800';

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition ${baseClass}`}
    >
      <span>{link.label}</span>
      {link.external ? <ExternalLink className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
```

- [ ] **Step 2: ProgressCard 작성**

Create `frontend/src/components/sales-guide/ProgressCard.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronRight, AlertTriangle } from 'lucide-react';

/**
 * 영업관리 랜딩의 카테고리 진행률 카드.
 *
 * Props:
 * - category: { key, label, icon, color, description }
 * - stats: { required_total, required_completed, percent, alerts }
 */
export default function ProgressCard({ category, stats }) {
  const navigate = useNavigate();
  const Icon = Icons[category.icon] || Icons.Folder;

  const percent = stats?.percent ?? 0;
  const alerts = stats?.alerts ?? [];
  const expiringCount = alerts.filter((a) => a.type === 'expiring_soon').length;

  // 시각적 상태
  let borderClass = 'border-slate-200';
  if (percent === 100) borderClass = 'border-green-400';
  else if (expiringCount > 0) borderClass = 'border-orange-400';
  else if (percent === 0) borderClass = 'border-dashed border-slate-300';

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <button
      onClick={() => navigate(`/sales-guide/${category.key}`)}
      className={`w-full text-left bg-white rounded-2xl p-5 border-2 ${borderClass} hover:shadow-lg transition-all duration-200 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[category.color] || colorClasses.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-1">{category.label}</h3>
      <p className="text-sm text-slate-500 mb-4 line-clamp-1">{category.description}</p>

      {/* 진행률 바 */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
          <span>진행률</span>
          <span className="font-semibold">{percent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        필수 {stats?.required_total ?? 0}개 중 {stats?.required_completed ?? 0}개 완료
      </p>

      {expiringCount > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{expiringCount}건 만료임박</span>
        </div>
      )}

      {percent === 0 && (
        <div className="mt-3 text-xs text-slate-500 font-medium">시작하기 →</div>
      )}
    </button>
  );
}
```

- [ ] **Step 3: ItemCard 작성**

Create `frontend/src/components/sales-guide/ItemCard.jsx`:

```jsx
import { Check, ChevronRight, AlertTriangle, Calendar } from 'lucide-react';

/**
 * 카테고리 페이지의 개별 항목 카드.
 *
 * Props:
 * - item: 카탈로그 항목
 * - progress: SalesGuideProgress row (또는 null)
 * - syncCount: { completed, total, label } (또는 null)
 * - onToggle: (itemKey, isCompleted) => void
 * - onOpen: (item) => void
 */
export default function ItemCard({ item, progress, syncCount, onToggle, onOpen }) {
  const isCompleted = progress?.is_completed || (syncCount && syncCount.total > 0 && syncCount.completed >= syncCount.total);

  // 만료 D-day
  const today = new Date();
  let dDay = null;
  let isExpired = false;
  let isExpiringSoon = false;
  if (progress?.expires_at) {
    const exp = new Date(progress.expires_at);
    dDay = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    isExpired = dDay < 0;
    isExpiringSoon = dDay >= 0 && dDay <= 30;
  }

  // sync partial
  const isSyncPartial = syncCount && syncCount.total > 0 && syncCount.completed < syncCount.total;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-4">
        {/* 체크박스 (44px+ 터치영역) */}
        <button
          onClick={() => onToggle(item.key, !isCompleted)}
          className={`flex-shrink-0 w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-slate-300 hover:border-blue-400'
          }`}
          aria-label={isCompleted ? '완료 해제' : '완료 표시'}
        >
          {isCompleted && <Check className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {item.required && !isCompleted && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="필수" />
            )}
            <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>

            {/* 배지들 */}
            {item.required && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">필수</span>
            )}
            {item.renewalCycle && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                매 {item.renewalCycle.months}개월
              </span>
            )}
            {dDay !== null && !isExpired && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isExpiringSoon ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                D-{dDay}
              </span>
            )}
            {isExpired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">만료</span>
            )}
            {isSyncPartial && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                {syncCount.completed}/{syncCount.total}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 line-clamp-2 mb-2">{item.description}</p>

          {progress?.completed_at && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {progress.completed_at}
              {progress.expires_at && ` · ${progress.expires_at} 만료`}
            </p>
          )}
        </div>

        <button
          onClick={() => onOpen(item)}
          className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
        >
          자세히
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | tail -5
```

Expected: 빌드 성공 (사용처 없으니 트리 셰이킹)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/sales-guide/
git commit -m "feat(sales-guide): ProgressCard / ItemCard / DeepLinkButton 컴포넌트"
```

### Task 14: ItemDetailModal + DateInputDrawer

**Files:**
- Create: `frontend/src/components/sales-guide/ItemDetailModal.jsx`
- Create: `frontend/src/components/sales-guide/DateInputDrawer.jsx`

- [ ] **Step 1: DateInputDrawer 작성**

Create `frontend/src/components/sales-guide/DateInputDrawer.jsx`:

```jsx
import { useState } from 'react';

/**
 * 항목별 날짜 입력 폼 (인라인).
 *
 * Props:
 * - dateFields: [{key, label}]
 * - values: { completed_at?, expires_at? }
 * - onChange: (newValues) => void
 */
export default function DateInputDrawer({ dateFields, values, onChange }) {
  const [local, setLocal] = useState(values || {});

  const handleChange = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  if (!dateFields || dateFields.length === 0) return null;

  return (
    <div className="space-y-3">
      {dateFields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
          <input
            type="date"
            value={local[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: ItemDetailModal 작성**

Create `frontend/src/components/sales-guide/ItemDetailModal.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { X, FileText, ListChecks, Lightbulb, Building2, Calendar, Upload } from 'lucide-react';
import api from '../../api';
import DateInputDrawer from './DateInputDrawer';
import DeepLinkButton from './DeepLinkButton';

/**
 * 항목 상세 모달 (gaongn.net ApplyGuideModal 풍).
 *
 * Props:
 * - item: 카탈로그 항목 (null 이면 닫힘)
 * - progress: SalesGuideProgress row (또는 null)
 * - syncCount: { completed, total, label } (또는 null)
 * - onClose: () => void
 * - onPatch: (itemKey, updates) => Promise
 */
export default function ItemDetailModal({ item, progress, syncCount, onClose, onPatch }) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [dates, setDates] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (item) {
      setIsCompleted(progress?.is_completed || false);
      setDates({
        completed_at: progress?.completed_at || '',
        expires_at: progress?.expires_at || '',
      });
      setNotes(progress?.notes || '');
    }
  }, [item, progress]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // renewalCycle 항목은 expires_at 필수
      if (isCompleted && item.renewalCycle && !dates.expires_at) {
        alert('갱신주기가 있는 항목은 만료일을 입력해야 완료로 처리됩니다.');
        setSaving(false);
        return;
      }
      await onPatch(item.key, {
        is_completed: isCompleted,
        completed_at: dates.completed_at || null,
        expires_at: dates.expires_at || null,
        notes: notes || null,
      });
      onClose();
    } catch (e) {
      alert('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);
      await api.post('/business-docs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // 업로드 후 명시적 의사결정 유도
      if (window.confirm('업로드 완료. 이 항목을 완료로 표시하시겠습니까?')) {
        setIsCompleted(true);
      }
    } catch (e) {
      alert('업로드 실패: ' + (e.message || ''));
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {item.required && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">필수</span>
              )}
              {item.renewalCycle && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  매 {item.renewalCycle.months}개월 갱신
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h2>
            <p className="text-sm text-slate-500">
              {item.authority} · {item.processingDays}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-6">
          {/* 1. 개요 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
              <FileText className="w-4 h-4" /> 개요
            </h3>
            <p className="text-base text-slate-800 leading-relaxed">{item.description}</p>
            {item.legalBasis && (
              <p className="mt-2 text-xs text-slate-500">법적 근거: {item.legalBasis}</p>
            )}
          </section>

          {/* 2. 신청 절차 */}
          {item.steps && item.steps.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <ListChecks className="w-4 h-4" /> 신청 절차
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-base text-slate-800 pl-1">
                {item.steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </section>
          )}

          {/* 3. 필요 서류 */}
          {item.documents && item.documents.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <Building2 className="w-4 h-4" /> 필요 서류
              </h3>
              <ul className="space-y-1.5">
                {item.documents.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-base text-slate-800">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4. 팁 */}
          {item.tips && item.tips.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <Lightbulb className="w-4 h-4" /> 팁·주의사항
              </h3>
              <ul className="space-y-1.5 bg-amber-50 border border-amber-100 rounded-lg p-4">
                {item.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                    <span className="text-amber-600 mt-1">💡</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 5. 내 진행 상황 */}
          <section className="bg-slate-50 rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              <Calendar className="w-4 h-4" /> 내 진행 상황
            </h3>

            {/* sync 카운트 표시 */}
            {syncCount && (
              <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{syncCount.label || '자동 카운트'}</span>
                  <span
                    className={`text-sm font-semibold ${
                      syncCount.total > 0 && syncCount.completed >= syncCount.total
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }`}
                  >
                    {syncCount.completed} / {syncCount.total}
                  </span>
                </div>
              </div>
            )}

            {/* 완료 토글 */}
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600"
              />
              <span className="text-base text-slate-800">완료로 표시</span>
            </label>

            {/* 날짜 입력 */}
            {item.dateFields && item.dateFields.length > 0 && (
              <div className="mb-4">
                <DateInputDrawer dateFields={item.dateFields} values={dates} onChange={setDates} />
              </div>
            )}

            {/* 메모 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">메모 (선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="사장님 메모 (예: 매년 5월 갱신, 김 부장 담당 등)"
              />
            </div>

            {/* 문서 업로드 (mergedDocs 정의된 항목만) */}
            {item.mergedDocs && item.mergedDocs.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  관련 문서 업로드
                </label>
                {item.mergedDocs.map((docType) => (
                  <label
                    key={docType}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer text-sm transition mr-2 mb-2"
                  >
                    <Upload className="w-4 h-4" />
                    {docType} {uploadingDoc && '업로드 중...'}
                    <input
                      type="file"
                      hidden
                      onChange={(e) => handleUpload(docType, e.target.files[0])}
                      disabled={uploadingDoc}
                    />
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </section>
        </div>

        {/* 푸터 — deep-links */}
        {(item.deepLinks?.length > 0 || item.internalLinks?.length > 0) && (
          <div className="border-t border-slate-200 p-5 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              바로가기
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.deepLinks?.map((link, i) => (
                <DeepLinkButton key={`ext-${i}`} link={{ ...link, external: true }} />
              ))}
              {item.internalLinks?.map((link, i) => (
                <DeepLinkButton
                  key={`int-${i}`}
                  link={{ ...link, external: false }}
                  variant="secondary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/sales-guide/
git commit -m "feat(sales-guide): ItemDetailModal + DateInputDrawer 컴포넌트"
```

---

## Stage 8: 페이지 + 라우팅

### Task 15: SalesGuideHome 페이지

**Files:**
- Create: `frontend/src/pages/sales-guide/SalesGuideHome.jsx`

- [ ] **Step 1: SalesGuideHome 작성**

Create `frontend/src/pages/sales-guide/SalesGuideHome.jsx`:

```jsx
import { Sparkles, AlertTriangle } from 'lucide-react';
import ProgressCard from '../../components/sales-guide/ProgressCard';
import { useSalesGuide } from '../../hooks/useSalesGuide';

export default function SalesGuideHome() {
  const { industry, stats, loading, error } = useSalesGuide();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-slate-500">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      </div>
    );
  }

  const overall = stats?.overall || { completed: 0, total: 0, percent: 0 };
  const isFirstTime = overall.completed === 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">영업관리</h1>
        </div>
        <p className="text-slate-600 text-sm sm:text-base">
          {industry.industryLabel} · 사업 시작·운영에 필요한 모든 정보
        </p>

        {/* 전체 진행률 */}
        <div className="mt-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">전체 진행률</span>
            <span className="text-2xl font-bold text-blue-600">{overall.percent}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${overall.percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            필수 {overall.total}개 중 {overall.completed}개 완료
          </p>
        </div>
      </header>

      {/* 1차 방문 안내 */}
      {isFirstTime && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-1">처음 사업 시작하시나요?</h3>
          <p className="text-sm text-blue-800">
            아래 6 카테고리에 영업 시작·운영에 필요한 모든 항목이 정리되어 있습니다.
            카드를 클릭해서 하나씩 진행 상황을 확인하세요.
          </p>
        </div>
      )}

      {/* 6 카테고리 카드 (2x3 grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {industry.categories.map((cat) => {
          const catStats = stats?.categories?.find((s) => s.key === cat.key);
          return <ProgressCard key={cat.key} category={cat} stats={catStats} />;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/pages/sales-guide/SalesGuideHome.jsx
git commit -m "feat(sales-guide): SalesGuideHome 랜딩 페이지"
```

### Task 16: CategoryPage 페이지

**Files:**
- Create: `frontend/src/pages/sales-guide/CategoryPage.jsx`

- [ ] **Step 1: CategoryPage 작성**

Create `frontend/src/pages/sales-guide/CategoryPage.jsx`:

```jsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react';
import ItemCard from '../../components/sales-guide/ItemCard';
import ItemDetailModal from '../../components/sales-guide/ItemDetailModal';
import { useSalesGuide } from '../../hooks/useSalesGuide';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'required', label: '필수' },
  { key: 'completed', label: '완료' },
  { key: 'incomplete', label: '미완료' },
  { key: 'expiring', label: '만료임박' },
];

export default function CategoryPage() {
  const { category: categoryKey } = useParams();
  const { industry, progress, sync, stats, loading, patchItem } = useSalesGuide();
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  if (loading) {
    return <div className="p-6"><p className="text-slate-500">불러오는 중...</p></div>;
  }

  const category = industry.categories.find((c) => c.key === categoryKey);
  if (!category) {
    return <div className="p-6"><p>카테고리를 찾을 수 없습니다.</p></div>;
  }

  const catStats = stats?.categories?.find((s) => s.key === categoryKey);
  const currentIndex = industry.categories.findIndex((c) => c.key === categoryKey);
  const prevCat = currentIndex > 0 ? industry.categories[currentIndex - 1] : null;
  const nextCat = currentIndex < industry.categories.length - 1 ? industry.categories[currentIndex + 1] : null;

  // 필터 적용
  const filteredItems = category.items.filter((item) => {
    const p = progress[item.key];
    const s = item.syncWith ? sync[item.syncWith] : null;
    const isCompleted = p?.is_completed || (s && s.total > 0 && s.completed >= s.total);

    if (filter === 'required') return item.required;
    if (filter === 'completed') return isCompleted;
    if (filter === 'incomplete') return !isCompleted;
    if (filter === 'expiring') {
      if (!p?.expires_at) return false;
      const days = Math.ceil((new Date(p.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    }
    return true;
  });

  const handleToggle = async (itemKey, isCompleted) => {
    try {
      await patchItem(itemKey, { is_completed: isCompleted });
    } catch (e) {
      alert('변경 실패: ' + e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 브레드크럼 */}
      <nav className="mb-4 text-sm text-slate-600">
        <Link to="/sales-guide" className="hover:text-blue-600 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 영업관리
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-medium">{category.label}</span>
      </nav>

      {/* 카테고리 헤더 */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{category.label}</h1>
        <p className="text-sm text-slate-600 mb-3">{category.description}</p>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-700">진행률</span>
            <span className="text-lg font-bold text-blue-600">{catStats?.percent ?? 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${catStats?.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            필수 {catStats?.required_total ?? 0}개 중 {catStats?.required_completed ?? 0}개 완료
            {category.items.filter((i) => !i.required).length > 0 && (
              <> · 선택 {category.items.filter((i) => !i.required).length}개 항목</>
            )}
          </p>
        </div>
      </header>

      {/* 필터 (sticky) */}
      <div className="sticky top-0 bg-slate-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 z-10 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 항목 리스트 */}
      <div className="space-y-3 mb-6">
        {filteredItems.length === 0 ? (
          <p className="text-center text-slate-500 py-8">조건에 맞는 항목이 없습니다.</p>
        ) : (
          filteredItems.map((item) => (
            <ItemCard
              key={item.key}
              item={item}
              progress={progress[item.key]}
              syncCount={item.syncWith ? sync[item.syncWith] : null}
              onToggle={handleToggle}
              onOpen={setSelectedItem}
            />
          ))
        )}
      </div>

      {/* 카테고리 네비 */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        {prevCat ? (
          <Link
            to={`/sales-guide/${prevCat.key}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            <ChevronLeft className="w-4 h-4" />
            이전: {prevCat.label}
          </Link>
        ) : (
          <span />
        )}
        {nextCat && (
          <Link
            to={`/sales-guide/${nextCat.key}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            다음: {nextCat.label}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* 모달 */}
      <ItemDetailModal
        item={selectedItem}
        progress={selectedItem ? progress[selectedItem.key] : null}
        syncCount={selectedItem?.syncWith ? sync[selectedItem.syncWith] : null}
        onClose={() => setSelectedItem(null)}
        onPatch={patchItem}
      />
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/pages/sales-guide/CategoryPage.jsx
git commit -m "feat(sales-guide): CategoryPage — 6 카테고리 단일 컴포넌트 + 필터 + 모달"
```

### Task 17: App.jsx 라우트 추가

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: lazy import + 라우트 추가**

Read `frontend/src/App.jsx` 의 lazy import 섹션과 Route 정의 섹션 위치 확인.

lazy import 모음에 추가:

```jsx
const SalesGuideHome = React.lazy(() => import('./pages/sales-guide/SalesGuideHome'));
const SalesGuideCategoryPage = React.lazy(() => import('./pages/sales-guide/CategoryPage'));
```

Route 정의 모음에 추가 (다른 ProtectedRoute 들과 동일 패턴):

```jsx
<Route path="/sales-guide" element={<ProtectedRoute><SalesGuideHome /></ProtectedRoute>} />
<Route path="/sales-guide/:category" element={<ProtectedRoute><SalesGuideCategoryPage /></ProtectedRoute>} />
```

- [ ] **Step 2: 외국인고용 가이드 redirect 추가**

기존 `/hr/foreign-worker-guide` route 를 다음과 같이 변경:

```jsx
<Route path="/hr/foreign-worker-guide" element={<Navigate to="/sales-guide/hr" replace />} />
```

(`Navigate` import 가 없으면 추가: `import { Navigate } from 'react-router-dom';`)

- [ ] **Step 3: dev 서버에서 라우트 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run dev
```

브라우저에서:
- http://localhost:5173/sales-guide → SalesGuideHome 로드
- http://localhost:5173/sales-guide/permits → CategoryPage 인허가 로드
- http://localhost:5173/hr/foreign-worker-guide → /sales-guide/hr 로 redirect

(서버 종료 후 다음 step)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/App.jsx
git commit -m "feat(sales-guide): App.jsx 라우트 추가 + 외국인고용 redirect"
```

---

## Stage 9: 사이드바 통합 + 외국인고용 메뉴 제거

### Task 18: Sidebar.jsx 영업관리 그룹 추가

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Sidebar 구조 파악**

Read `frontend/src/components/Sidebar.jsx` 100~200줄, 350~400줄 (renderSubmenu 호출부).

기존 패턴 확인:
- 상태 변수: `productOpen`, `setProductOpen` 등
- 경로 감지 useEffect
- 메뉴 아이템 배열: `productSubItems` 등
- `renderSubmenu(label, Icon, isOpen, setOpen, isActive, items, color)` 호출

- [ ] **Step 2: 영업관리 메뉴 데이터 추가**

`Sidebar.jsx` 의 import 에 lucide-react 아이콘 추가 (FileCheck, Truck, CreditCard, Receipt, Users, Lightbulb, Sparkles 등 누락 시):

```jsx
import { /* 기존 아이콘들 */, Sparkles, FileCheck, Truck, CreditCard, Receipt, Lightbulb } from 'lucide-react';
```

상태 변수 추가 (다른 Open 상태 옆):

```jsx
const [salesGuideOpen, setSalesGuideOpen] = useState(false);
```

경로 감지 useEffect 에 추가:

```jsx
useEffect(() => {
  if (location.pathname.startsWith('/sales-guide')) setSalesGuideOpen(true);
  // ... 기존 경로 감지들
}, [location.pathname]);
```

영업관리 sub items 배열 (다른 sub items 옆):

```jsx
const salesGuideSubItems = [
  { path: '/sales-guide', label: '랜딩 (전체)', Icon: Sparkles },
  { path: '/sales-guide/permits', label: '인허가·신고', Icon: FileCheck },
  { path: '/sales-guide/delivery-apps', label: '배달·온라인', Icon: Truck },
  { path: '/sales-guide/payment', label: '결제·POS', Icon: CreditCard },
  { path: '/sales-guide/tax', label: '세무·회계', Icon: Receipt },
  { path: '/sales-guide/hr', label: '인력·노무', Icon: Users },
  { path: '/sales-guide/operations', label: '운영팁', Icon: Lightbulb },
];
```

- [ ] **Step 3: 사이드바에 영업관리 그룹 렌더 추가**

`renderSubmenu` 호출부에 추가 — "메인" 다음, "상품관리" 위. 정확한 위치는 기존 코드 참조.

```jsx
{/* 영업관리 (새 최상위 그룹) */}
{renderSubmenu(
  '영업관리',
  Sparkles,
  salesGuideOpen,
  setSalesGuideOpen,
  location.pathname.startsWith('/sales-guide'),
  salesGuideSubItems,
  'blue'
)}
```

- [ ] **Step 4: HR > 외국인고용 메뉴 제거**

`hrSubItems` 배열에서 외국인고용 항목 (`{ path: '/hr/foreign-worker-guide', ... }`) 삭제.

- [ ] **Step 5: dev 서버에서 사이드바 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run dev
```

브라우저:
- 사이드바에 "영업관리" 새 메뉴 출현 확인
- 클릭 시 6 하위 메뉴 펼쳐짐 확인
- HR 메뉴에서 "외국인고용" 제거됨 확인
- `/sales-guide/hr` 페이지에서 외국인 고용 항목 정상 표시

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat(sales-guide): 사이드바 영업관리 새 그룹 + HR 외국인고용 메뉴 제거"
```

### Task 19: ForeignWorkerGuide.jsx 페이지 정리

**Files:**
- Delete: `frontend/src/pages/ForeignWorkerGuide.jsx`
- Modify: `frontend/src/App.jsx` (lazy import 제거)

- [ ] **Step 1: 외부 참조 검색**

```bash
cd c:/WORK/SodamFN && grep -r "ForeignWorkerGuide" frontend/src --include="*.jsx" --include="*.js"
```

App.jsx 의 lazy import 외 참조가 있는지 확인. 있으면 그곳도 정리.

- [ ] **Step 2: App.jsx 에서 lazy import 제거 (Navigate redirect 만 남김)**

```jsx
// Before:
const ForeignWorkerGuide = React.lazy(() => import('./pages/ForeignWorkerGuide'));

// After: 라인 자체 제거 (사용처 없음)
```

`/hr/foreign-worker-guide` 라우트는 Navigate 만 남김:
```jsx
<Route path="/hr/foreign-worker-guide" element={<Navigate to="/sales-guide/hr" replace />} />
```

- [ ] **Step 3: 페이지 파일 삭제**

```bash
rm c:/WORK/SodamFN/SodamApp/frontend/src/pages/ForeignWorkerGuide.jsx
```

- [ ] **Step 4: 빌드 검증**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run build 2>&1 | tail -10
```

Expected: 빌드 성공, 미참조 파일 경고 없음

- [ ] **Step 5: 커밋**

```bash
git add -u frontend/src/
git commit -m "refactor(sales-guide): 외국인고용 페이지 삭제 (영업관리로 콘텐츠 이주 완료)"
```

---

## Stage 10: 사이드바 배지 (미완료/만료임박 카운트)

### Task 20: 사이드바 영업관리 라벨에 빨간 배지

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: 사이드바에서 stats 페치**

Sidebar.jsx 상단에 axios 호출 추가 (Business 정보 페치하는 useEffect 근처):

```jsx
const [salesGuideAlerts, setSalesGuideAlerts] = useState(0);

useEffect(() => {
  // 영업관리 미완료/만료임박 카운트
  api.get('/sales-guide/stats').then((res) => {
    const overall = res.data.overall;
    const incomplete = overall.total - overall.completed;
    const expiring = res.data.categories.reduce(
      (sum, c) => sum + (c.alerts?.length ?? 0),
      0
    );
    setSalesGuideAlerts(incomplete + expiring);
  }).catch(() => setSalesGuideAlerts(0));
}, []);
```

- [ ] **Step 2: renderSubmenu 라벨에 배지 추가**

영업관리 renderSubmenu 호출 시 라벨을 JSX 로:

```jsx
{renderSubmenu(
  <span className="inline-flex items-center gap-2">
    영업관리
    {salesGuideAlerts > 0 && (
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold rounded-full bg-red-500 text-white">
        {salesGuideAlerts}
      </span>
    )}
  </span>,
  Sparkles,
  // ...
)}
```

(주의: `renderSubmenu` 함수 시그니처가 첫 인자를 string 으로만 받는다면, JSX 허용하도록 함수도 수정. 또는 호출부에서 `<>` Fragment 처리.)

- [ ] **Step 3: dev 검증**

브라우저: 영업관리 메뉴 라벨 옆에 빨간 배지로 미완료+만료임박 카운트 표시 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat(sales-guide): 사이드바 라벨에 미완료/만료임박 카운트 빨간 배지"
```

---

## Stage 11: 매뉴얼 검증 + 배포

### Task 21: 매뉴얼 검증 시나리오

**Files:** 코드 변경 없음

- [ ] **Step 1: 백엔드 통합 테스트 일괄 실행**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -m pytest tests/sales_guide/ -v
```

Expected: 모든 테스트 PASS

- [ ] **Step 2: 백엔드 + 프론트엔드 동시 실행**

Terminal 1:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && uvicorn main:app --reload --port 8000
```

Terminal 2:
```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run dev
```

- [ ] **Step 3: 시나리오 1 — 신규 사업장 첫 진입**

1. 어드민 로그인 (또는 SuperAdmin "View As" 로 사업장 전환)
2. 사이드바 "영업관리" 클릭 → 6 카테고리 카드 + "처음 사업 시작하시나요?" 배너 표시 확인
3. 전체 진행률 0% (또는 sync 자동완료 항목만 반영)
4. 인허가 카테고리 클릭 → 7 항목 표시 확인
5. "사업자등록" 카드 → "자세히" 클릭 → 모달 열림 → 5 섹션 모두 표시 확인 (개요·절차·서류·팁·내 진행상황·deepLinks)
6. 외부 deepLink 클릭 → 새 창에서 홈택스 열림 확인
7. 모달 닫기

- [ ] **Step 4: 시나리오 2 — 항목 완료 + 갱신주기**

1. 보건증 항목 모달 열기
2. "완료로 표시" 토글 ON
3. 발급일 입력 (예: 2026-04-01)
4. 만료일 입력 (예: 2027-04-01)
5. 메모 입력
6. 저장 → 모달 닫힘
7. 카테고리 페이지에서 보건증 카드 → 체크박스 초록 + D-day 표시 확인
8. 진행률 % 변동 확인
9. 사이드바 영업관리 라벨의 빨간 배지 카운트 감소 확인

- [ ] **Step 5: 시나리오 3 — 갱신주기 + 만료일 누락 검증**

1. 화재배상책임보험 항목 모달 열기
2. "완료" 토글 ON
3. 만료일 비워둔 채 저장 시도 → alert "갱신주기가 있는 항목은 만료일을 입력해야 완료로 처리됩니다" 확인

- [ ] **Step 6: 시나리오 4 — sync 자동 카운트**

1. HR > 인사기록에서 직원 추가 (보건증 등록 포함)
2. 영업관리 > 인허가 > 보건증 카드 → "직원 N/M" 카운트 표시 확인
3. 모든 직원 보건증 등록 시 자동 완료 판정 확인

- [ ] **Step 7: 시나리오 5 — MERGE-DOCS 문서 업로드**

1. 사업자등록 모달 열기
2. "관련 문서 업로드" → biz_registration 파일 선택 → 업로드
3. "이 항목을 완료로 표시?" 확인 모달 → 예
4. Settings > 회사정보 탭으로 이동 → 같은 파일 표시 확인 (양쪽 동기화)

- [ ] **Step 8: 시나리오 6 — 외국인고용 redirect**

1. 브라우저 주소창에 `/hr/foreign-worker-guide` 직접 입력
2. `/sales-guide/hr` 로 자동 redirect 확인
3. 인력·노무 카테고리에서 "외국인 고용 절차" 항목 표시 확인 (콘텐츠 흡수 검증)

- [ ] **Step 9: 시나리오 7 — 모바일 뷰**

1. 브라우저 개발자도구 → 모바일 뷰 (예: iPhone 14)
2. 영업관리 → 카테고리 카드 1열 표시 확인
3. 카테고리 페이지 → 항목 카드 풀폭
4. 항목 모달 → 풀스크린 시트로 전환 확인
5. 체크박스 터치 영역 충분 (44px+)

- [ ] **Step 10: 시나리오 검증 결과 정리**

각 시나리오 PASS/FAIL 기록. FAIL 시 해당 task 로 돌아가 수정.

- [ ] **Step 11: 커밋 (변경 없으면 skip)**

발견된 작은 수정 사항 있으면 커밋:
```bash
git add -A && git commit -m "fix(sales-guide): 매뉴얼 검증 중 발견된 이슈 수정"
```

### Task 22: Orbitron 배포 + 운영 환경 검증

**Files:** 변경 없음

- [ ] **Step 1: 모든 변경사항 푸시**

```bash
cd c:/WORK/SodamFN && git push origin main
```

- [ ] **Step 2: Orbitron 배포 트리거 안내**

사용자에게 알림: "Orbitron 대시보드에서 SodamFN 백엔드 + 프론트엔드 재배포 트리거 필요. PostgreSQL `init_db()` 가 자동으로 sales_guide_progress 테이블 생성합니다."

- [ ] **Step 3: 배포 후 운영 환경 검증**

배포 완료 후:
- https://sodamfn.twinverse.org/sales-guide 접속
- 시나리오 1·4 (신규 진입 + sync 자동 카운트) 운영 환경에서 재현
- 콘솔 에러·404 없는지 확인

- [ ] **Step 4: 문제 발생 시 핫픽스**

(없으면 skip)

---

## 완료 기준

- [ ] 14+ 백엔드 테스트 PASS (모델 4 + sync 6 + stats 4)
- [ ] 38 항목 카탈로그 빌드 성공
- [ ] 사이드바 "영업관리" 새 그룹 노출 + 6 하위 메뉴 동작
- [ ] HR > 외국인고용 메뉴 제거됨
- [ ] `/hr/foreign-worker-guide` redirect 동작
- [ ] 매뉴얼 검증 시나리오 7 종 PASS
- [ ] Orbitron 운영 배포 검증

---

## V2 차후 작업 (V1 범위 외)

- 자동 알림 cron (V2.1)
- 업종 확장: cafe.js, chicken.js (V2.2)
- 운영팁 콘텐츠 채우기 (V2.3)
- 사장님 프로필 기반 항목 자동 hide (V2.4)
- 협력업체 마켓플레이스 (V2.5)
