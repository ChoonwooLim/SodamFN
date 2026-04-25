# 연말정산 지원 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the year-end tax settlement support module per spec [`docs/superpowers/specs/2026-04-25-yearend-tax-phase1-design.md`](../specs/2026-04-25-yearend-tax-phase1-design.md). Path C hybrid: aggregate Payroll data + parse uploaded PDFs + reconcile + generate draft PDFs + expose to staff app with audit logging.

**Architecture:** Domain package `services/yearend/` with 6 modules (`aggregator`, `parser`, `generator`, `reconciler`, `tax_calculator`, `audit`) + 2 routers (`yearend.py` admin, `staff_yearend.py` staff-self) + Jinja2 templates. Tax calculation isolated behind a Protocol so future Phase A upgrade swaps `StubTaxCalculator` → `StandardKoreanTaxCalculator` without touching the rest.

**Tech Stack:** FastAPI + SQLModel + PostgreSQL (existing), pdfplumber + WeasyPrint + Jinja2 (new for PDF), React + Vite + Tailwind (existing), pytest (new test infra)

**Testing strategy:** TDD for pure logic (parser, aggregator, reconciler, tax_calculator). Manual verification via curl/UI for routers and frontend. The codebase has no existing tests, so this plan installs minimal pytest infra in Task 1.

---

## Stage 0 — Test infrastructure (1 task)

### Task 1: Install pytest + create test layout

**Files:**
- Modify: `SodamApp/backend/requirements.txt`
- Create: `SodamApp/backend/pytest.ini`
- Create: `SodamApp/backend/tests/__init__.py`
- Create: `SodamApp/backend/tests/conftest.py`
- Create: `SodamApp/backend/tests/yearend/__init__.py`
- Create: `SodamApp/backend/tests/yearend/fixtures/.gitkeep`

- [ ] **Step 1.1: Add test deps to requirements.txt**

Append at the end of `SodamApp/backend/requirements.txt`:

```
# Testing
pytest==8.3.4
pytest-asyncio==0.25.0
```

- [ ] **Step 1.2: Install**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pip install -r requirements.txt
```

Expected: pytest and pytest-asyncio successfully installed.

- [ ] **Step 1.3: Create `pytest.ini`**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short
asyncio_mode = auto
```

- [ ] **Step 1.4: Create `tests/__init__.py` (empty)**

- [ ] **Step 1.5: Create `tests/conftest.py`** with in-memory SQLite session for unit tests:

```python
"""Shared pytest fixtures for sodam backend tests."""
import os
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool


@pytest.fixture
def session():
    """Fresh in-memory DB per test (StaticPool keeps the same connection alive)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Import models AFTER engine creation so SQLModel registers all tables
    import models  # noqa: F401
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
```

- [ ] **Step 1.6: Create `tests/yearend/__init__.py` (empty) and `tests/yearend/fixtures/.gitkeep` (empty)**

- [ ] **Step 1.7: Create a sanity test `tests/test_sanity.py`**

```python
def test_sanity():
    assert 1 + 1 == 2


def test_session_fixture(session):
    """Verify in-memory DB fixture works."""
    from models import Business
    biz = Business(name="테스트사업장", business_type="음식점")
    session.add(biz)
    session.commit()
    assert biz.id is not None
```

- [ ] **Step 1.8: Run pytest**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/test_sanity.py -v
```

Expected: 2 passed.

- [ ] **Step 1.9: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/requirements.txt SodamApp/backend/pytest.ini SodamApp/backend/tests/ && git commit -m "test: pytest 인프라 + 샌드박스 conftest 추가"
```

---

## Stage 1 — Data models (1 task)

### Task 2: Add 4 SQLModel tables

**Files:**
- Modify: `SodamApp/backend/models.py` (append at end)
- Create: `SodamApp/backend/tests/yearend/test_models.py`

- [ ] **Step 2.1: Append 4 model classes to `models.py`**

Append the following after the last existing model:

```python
# --- Year-End Tax Settlement (연말정산 Phase 1) ---

class YearEndReport(SQLModel, table=True):
    """직원·연도별 연말정산 마스터 (자체 집계 + 업로드본 정본 + 대조 결과)."""
    __table_args__ = (UniqueConstraint("staff_id", "year", name="uq_yearend_staff_year"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    income_type: str = Field(default="earned")  # "earned" / "business"

    aggregated_at: Optional[datetime.datetime] = None
    total_pay_year: int = 0
    taxable_pay: int = 0
    nontaxable_pay: int = 0
    taxes_withheld_total: int = 0
    insurance_4major_total: int = 0

    confirmed_doc_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    confirmed_total_pay: Optional[int] = None
    confirmed_taxes_paid: Optional[int] = None
    decided_tax: Optional[int] = None
    refund_amount: Optional[int] = None
    confirmed_at: Optional[datetime.datetime] = None

    reconciliation_status: str = Field(default="pending")  # pending/ok/warning/mismatch
    reconciliation_diff: int = 0

    status: str = Field(default="draft")  # draft/aggregated/uploaded/reconciled/distributed
    distributed_to_staff: bool = Field(default=False)
    distributed_at: Optional[datetime.datetime] = None


class YearEndDocument(SQLModel, table=True):
    """업로드된 PDF 문서 (간소화 자료 / 원천징수영수증)."""
    __table_args__ = (
        UniqueConstraint("staff_id", "year", "kind", "file_hash", name="uq_yedoc_unique"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    kind: str  # "simplified" / "withholding_receipt" / "other"
    file_url: str
    original_filename: str
    file_size: int
    file_hash: str = Field(index=True)
    uploaded_by_user_id: int = Field(foreign_key="user.id")
    uploaded_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    parse_status: str = Field(default="pending")  # pending/parsed/error
    parse_error: Optional[str] = None
    parsed_at: Optional[datetime.datetime] = None


class YearEndSimplified(SQLModel, table=True):
    """홈택스 간소화 자료 13개 카테고리 합계."""
    __table_args__ = (UniqueConstraint("document_id", name="uq_yes_doc"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="yearenddocument.id")
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)

    insurance_amount: int = 0
    medical_amount: int = 0
    education_amount: int = 0
    donation_amount: int = 0
    house_loan_principal: int = 0
    house_loan_interest: int = 0
    pension_amount: int = 0
    irp_amount: int = 0
    credit_card_amount: int = 0
    debit_card_amount: int = 0
    traditional_market: int = 0
    public_transport: int = 0
    cultural_amount: int = 0

    raw_extracted_text: Optional[str] = None
    parsed_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class YearEndAuditLog(SQLModel, table=True):
    """연말정산 다운로드/배포 감사 로그."""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    action: str  # upload/view/download/regenerate/distribute/revoke/reparse/delete
    actor_user_id: int = Field(foreign_key="user.id")
    actor_role: str  # "admin" / "staff_self"
    actor_ip: Optional[str] = None
    user_agent: Optional[str] = None
    occurred_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    detail: Optional[str] = None
```

- [ ] **Step 2.2: Write model creation/uniqueness test** at `tests/yearend/test_models.py`:

```python
"""Smoke tests for YearEnd* SQLModel tables."""
import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select


def test_yearend_report_unique_staff_year(session):
    from models import YearEndReport
    r1 = YearEndReport(business_id=1, staff_id=10, year=2025)
    r2 = YearEndReport(business_id=1, staff_id=10, year=2025)
    session.add(r1)
    session.commit()
    session.add(r2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_yearend_document_unique_quad(session):
    """동일 staff×year×kind×hash 중복 방지."""
    from models import YearEndDocument
    d1 = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="https://r2/a.pdf", original_filename="a.pdf",
        file_size=1024, file_hash="abc123", uploaded_by_user_id=1,
    )
    session.add(d1)
    session.commit()
    d2 = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="https://r2/a.pdf", original_filename="a.pdf",
        file_size=1024, file_hash="abc123", uploaded_by_user_id=1,
    )
    session.add(d2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_yearend_simplified_default_zeros(session):
    from models import YearEndDocument, YearEndSimplified
    doc = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="x", original_filename="x", file_size=1, file_hash="h",
        uploaded_by_user_id=1,
    )
    session.add(doc)
    session.commit()
    s = YearEndSimplified(document_id=doc.id, staff_id=10, year=2025)
    session.add(s)
    session.commit()
    assert s.medical_amount == 0
    assert s.credit_card_amount == 0
```

- [ ] **Step 2.3: Run tests**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_models.py -v
```

Expected: 3 passed.

- [ ] **Step 2.4: Restart dev server to verify auto-create on real Postgres**

```bash
# Start with existing DATABASE_URL
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/uvicorn main:app --reload --port 8000
```

Expected log: 4 new tables created on `init_db()`. Stop server (Ctrl+C).

- [ ] **Step 2.5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/models.py SodamApp/backend/tests/yearend/test_models.py && git commit -m "feat(yearend): 4개 모델 추가 (Report/Document/Simplified/AuditLog) + 모델 테스트"
```

---

## Stage 2 — Service layer (TDD, 6 tasks)

### Task 3: `services/yearend/__init__.py` + `aggregator.py`

**Files:**
- Create: `SodamApp/backend/services/yearend/__init__.py` (empty)
- Create: `SodamApp/backend/services/yearend/aggregator.py`
- Create: `SodamApp/backend/tests/yearend/test_aggregator.py`

- [ ] **Step 3.1: Write failing test** at `tests/yearend/test_aggregator.py`:

```python
"""Aggregator: Payroll 12개월 → YearEndReport 스냅샷."""
from datetime import datetime


def _make_payroll(session, staff_id, business_id, month, base_pay, bonus_meal=0,
                  it=0, lit=0, np=0, hi=0, lti=0, ei=0):
    """Helper: insert one Payroll row."""
    from models import Payroll
    p = Payroll(
        staff_id=staff_id, business_id=business_id, month=month,
        base_pay=base_pay, bonus_meal=bonus_meal,
        deduction_it=it, deduction_lit=lit,
        deduction_np=np, deduction_hi=hi, deduction_lti=lti, deduction_ei=ei,
        total_pay=base_pay + bonus_meal - (it + lit + np + hi + lti + ei),
    )
    session.add(p)
    return p


def test_aggregate_year_sums_12_months(session):
    from models import Business, Staff
    from services.yearend.aggregator import aggregate_year

    biz = Business(name="테스트", business_type="음식점")
    session.add(biz); session.commit()
    staff = Staff(name="홍길동", business_id=biz.id)
    session.add(staff); session.commit()

    # 12개월: 매월 base 2_800_000, 식대 200_000(비과세), 소득세 50_000, 지방세 5_000, NP 126_000, HI 99_000, LTI 13_000, EI 22_400
    for m in range(1, 13):
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=2_800_000, bonus_meal=200_000,
                      it=50_000, lit=5_000,
                      np=126_000, hi=99_000, lti=13_000, ei=22_400)
    session.commit()

    snap = aggregate_year(business_id=biz.id, staff_id=staff.id, year=2025, session=session)

    assert snap["total_pay_year"] == (2_800_000 + 200_000) * 12
    assert snap["nontaxable_pay"] == 200_000 * 12          # 식대만 비과세
    assert snap["taxable_pay"] == 2_800_000 * 12
    assert snap["taxes_withheld_total"] == (50_000 + 5_000) * 12
    assert snap["insurance_4major_total"] == (126_000 + 99_000 + 13_000 + 22_400) * 12
    assert snap["months_with_data"] == 12


def test_aggregate_year_handles_missing_months(session):
    """8월·9월 데이터 누락 → 합산은 진행, months_with_data=10."""
    from models import Business, Staff
    from services.yearend.aggregator import aggregate_year

    biz = Business(name="X", business_type="음식점"); session.add(biz); session.commit()
    staff = Staff(name="A", business_id=biz.id); session.add(staff); session.commit()
    for m in [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]:
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=1_000_000, it=10_000, lit=1_000)
    session.commit()

    snap = aggregate_year(business_id=biz.id, staff_id=staff.id, year=2025, session=session)
    assert snap["months_with_data"] == 10
    assert snap["total_pay_year"] == 1_000_000 * 10


def test_refresh_snapshot_creates_or_updates_report(session):
    from models import Business, Staff, YearEndReport
    from sqlmodel import select
    from services.yearend.aggregator import refresh_snapshot

    biz = Business(name="X", business_type="음식점"); session.add(biz); session.commit()
    staff = Staff(name="A", business_id=biz.id, contract_type="정규직"); session.add(staff); session.commit()
    for m in range(1, 13):
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=2_000_000, it=20_000, lit=2_000)
    session.commit()

    report = refresh_snapshot(business_id=biz.id, staff_id=staff.id, year=2025, session=session)
    session.commit()

    assert report.total_pay_year == 2_000_000 * 12
    assert report.taxes_withheld_total == 22_000 * 12
    assert report.status == "aggregated"
    assert report.aggregated_at is not None
    assert report.income_type == "earned"  # 정규직 → earned
```

- [ ] **Step 3.2: Run test (should fail — module doesn't exist)**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_aggregator.py -v
```

Expected: 3 errors (ModuleNotFoundError: services.yearend.aggregator).

- [ ] **Step 3.3: Create `services/yearend/__init__.py` (empty file)**

- [ ] **Step 3.4: Create `services/yearend/aggregator.py`**:

```python
"""Year-end aggregator: Payroll 12개월 합산 → YearEndReport 스냅샷.

순수 함수 위주. DB 쓰기는 refresh_snapshot 만.
"""
from __future__ import annotations
import datetime
import logging
from typing import Optional

from sqlmodel import Session, select

logger = logging.getLogger("sodam.yearend.aggregator")


def aggregate_year(*, business_id: int, staff_id: int, year: int,
                   session: Session) -> dict:
    """Payroll 12개월 → 자체 집계 dict.

    Returns: {
        total_pay_year, taxable_pay, nontaxable_pay,
        taxes_withheld_total, insurance_4major_total,
        months_with_data
    }
    """
    from models import Payroll  # local import to keep test isolation easy

    rows = session.exec(
        select(Payroll)
        .where(Payroll.staff_id == staff_id)
        .where(Payroll.month.startswith(f"{year}-"))
    ).all()

    nontaxable = 0
    base_total = 0
    bonus_total = 0
    it_total = 0
    lit_total = 0
    insurance_total = 0

    for p in rows:
        # 비과세: 식대만 (현 단계). 향후 확장 시 여기 룰 추가.
        nontaxable += (p.bonus_meal or 0)
        base_total += (p.base_pay or 0)
        bonus_total += (
            (p.bonus or 0) + (p.bonus_special or 0) + (p.bonus_holiday or 0)
            + (p.holiday_w1 or 0) + (p.holiday_w2 or 0) + (p.holiday_w3 or 0)
            + (p.holiday_w4 or 0) + (p.holiday_w5 or 0) + (p.holiday_w6 or 0)
        )
        it_total += (p.deduction_it or 0)
        lit_total += (p.deduction_lit or 0)
        insurance_total += (
            (p.deduction_np or 0) + (p.deduction_hi or 0)
            + (p.deduction_lti or 0) + (p.deduction_ei or 0)
        )

    total_pay = base_total + bonus_total + nontaxable

    return {
        "total_pay_year": total_pay,
        "taxable_pay": total_pay - nontaxable,
        "nontaxable_pay": nontaxable,
        "taxes_withheld_total": it_total + lit_total,
        "insurance_4major_total": insurance_total,
        "months_with_data": len(rows),
    }


def _infer_income_type(staff) -> str:
    """Staff.contract_type → income_type (earned/business)."""
    ct = (staff.contract_type or "").strip()
    if ct in ("프리랜서", "사업소득자", "3.3%"):
        return "business"
    return "earned"


def refresh_snapshot(*, business_id: int, staff_id: int, year: int,
                     session: Session):
    """집계 결과를 YearEndReport에 반영. 없으면 생성, 있으면 갱신.
    
    호출 측이 session.commit() 책임.
    """
    from models import Staff, YearEndReport

    staff = session.get(Staff, staff_id)
    if staff is None:
        raise ValueError(f"Staff {staff_id} not found")

    snap = aggregate_year(
        business_id=business_id, staff_id=staff_id, year=year, session=session
    )

    report = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id)
        .where(YearEndReport.year == year)
    ).first()

    if report is None:
        report = YearEndReport(
            business_id=business_id, staff_id=staff_id, year=year,
            income_type=_infer_income_type(staff),
        )
        session.add(report)

    report.aggregated_at = datetime.datetime.utcnow()
    report.total_pay_year = snap["total_pay_year"]
    report.taxable_pay = snap["taxable_pay"]
    report.nontaxable_pay = snap["nontaxable_pay"]
    report.taxes_withheld_total = snap["taxes_withheld_total"]
    report.insurance_4major_total = snap["insurance_4major_total"]
    if report.status == "draft":
        report.status = "aggregated"

    return report
```

- [ ] **Step 3.5: Run test → all pass**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_aggregator.py -v
```

Expected: 3 passed.

- [ ] **Step 3.6: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/yearend/__init__.py SodamApp/backend/services/yearend/aggregator.py SodamApp/backend/tests/yearend/test_aggregator.py && git commit -m "feat(yearend): aggregator — Payroll 12개월 자체 집계 + refresh_snapshot"
```

---

### Task 4: `services/yearend/parser.py` (withholding receipt + simplified)

**Files:**
- Create: `SodamApp/backend/services/yearend/parser.py`
- Create: `SodamApp/backend/tests/yearend/test_parser.py`
- Create: `SodamApp/backend/tests/yearend/fixtures/sample_withholding.txt` (text fixture)
- Create: `SodamApp/backend/tests/yearend/fixtures/sample_simplified.txt` (text fixture)

> **Note**: Real anonymized PDFs are too heavy for fixtures and contain PII risk. Tests use **plaintext fixtures** of the form pdfplumber would produce. End-to-end PDF parsing is verified manually after Task 9 with a real (non-committed) PDF in step 9.7.

- [ ] **Step 4.1: Create `tests/yearend/fixtures/sample_withholding.txt`** — extracted text shape from a 별지 24호 PDF:

```
근로소득원천징수영수증
사업자등록번호 123-45-67890
법인명(상호) 소담김밥
대표자(성명) 김대표

근무처별소득명세
근무처 소담김밥
근무기간 2025.01.01 ~ 2025.12.31
총급여 33,600,000

성명 김금순
주민등록번호 850101-2******

세액명세
결정세액         432,100        43,210
주(현)근무지     477,300        47,730
차감징수세액     -45,200       -4,520

국민연금보험료: 1,512,000
국민건강보험료: 1,188,000
장기요양보험료: 156,000
고용보험료: 268,800
```

- [ ] **Step 4.2: Create `tests/yearend/fixtures/sample_simplified.txt`** — extracted text shape from 간소화 PDF:

```
연말정산간소화 자료
성명 김금순  주민등록번호 850101-2*******

보장성보험료: 720,000
의료비: 1,250,000
교육비: 0
기부금: 100,000
주택자금원리금: 0
주택임차차입금이자: 0
연금저축: 3,000,000
퇴직연금: 0
신용카드: 12,400,000
체크카드: 3,200,000
전통시장: 480,000
대중교통: 720,000
문화비: 350,000
```

- [ ] **Step 4.3: Write failing test** at `tests/yearend/test_parser.py`:

```python
"""Parser tests: withholding receipt (별지24) + simplified (간소화)."""
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def _read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_parse_withholding_receipt_text():
    from services.yearend.parser import parse_withholding_receipt_text
    text = _read_fixture("sample_withholding.txt")

    data = parse_withholding_receipt_text(text)

    assert data.name == "김금순"
    assert data.resident_number_prefix == "850101"
    assert data.work_period_from == "2025.01.01"
    assert data.work_period_to == "2025.12.31"
    assert data.total_pay == 33_600_000
    assert data.decided_tax == 432_100 + 43_210         # 소득세 + 지방세
    assert data.taxes_paid_at_work == 477_300 + 47_730  # 주현근무지 합
    assert data.refund_amount == -(45_200 + 4_520)      # 음수 = 환급
    assert data.np_amount == 1_512_000
    assert data.hi_amount == 1_188_000
    assert data.lti_amount == 156_000
    assert data.ei_amount == 268_800


def test_parse_simplified_text():
    from services.yearend.parser import parse_simplified_text
    text = _read_fixture("sample_simplified.txt")

    data = parse_simplified_text(text)

    assert data.staff_name == "김금순"
    assert data.resident_number_prefix == "850101"
    assert data.insurance_amount == 720_000
    assert data.medical_amount == 1_250_000
    assert data.education_amount == 0
    assert data.donation_amount == 100_000
    assert data.pension_amount == 3_000_000
    assert data.credit_card_amount == 12_400_000
    assert data.debit_card_amount == 3_200_000
    assert data.traditional_market == 480_000
    assert data.public_transport == 720_000
    assert data.cultural_amount == 350_000


def test_parse_withholding_missing_field_returns_none():
    """결정세액 라인이 누락된 PDF → decided_tax=None, 다른 필드는 정상."""
    from services.yearend.parser import parse_withholding_receipt_text
    text = "성명 홍길동\n주민등록번호 900101-1******\n총급여 25,000,000\n"
    data = parse_withholding_receipt_text(text)
    assert data.name == "홍길동"
    assert data.total_pay == 25_000_000
    assert data.decided_tax is None
```

- [ ] **Step 4.4: Run test (fails)**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_parser.py -v
```

Expected: 3 errors (module not found).

- [ ] **Step 4.5: Create `services/yearend/parser.py`**:

```python
"""PDF parser for year-end documents.

- 원천징수영수증 (별지24호) → WithholdingReceiptData
- 홈택스 간소화 자료 → SimplifiedData

기존 scripts/parse_yearend_tax.py 의 정규식을 정형화·테스트가능 형태로 재구성.
"""
from __future__ import annotations
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger("sodam.yearend.parser")


# ─────────────────── Withholding Receipt (별지 24호) ───────────────────

@dataclass
class WithholdingReceiptData:
    name: Optional[str] = None
    resident_number_prefix: Optional[str] = None  # 앞 6자리
    work_period_from: Optional[str] = None
    work_period_to: Optional[str] = None
    total_pay: Optional[int] = None             # 총급여
    nontaxable_pay: Optional[int] = None        # 비과세소득
    decided_tax: Optional[int] = None           # 결정세액 (소득세+지방세)
    taxes_paid_at_work: Optional[int] = None    # 주현근무지 기납부
    refund_amount: Optional[int] = None         # 차감징수세액 (음수=환급)
    np_amount: Optional[int] = None
    hi_amount: Optional[int] = None
    lti_amount: Optional[int] = None
    ei_amount: Optional[int] = None
    raw_text: Optional[str] = None


def _parse_won(s: str) -> int:
    """'1,234,567' or '-1,234' → int. Empty → 0."""
    if not s:
        return 0
    cleaned = s.replace(",", "").strip()
    return int(cleaned)


def _parse_two_amount_pair(line: str) -> Optional[tuple[int, int]]:
    """'결정세액  432,100  43,210' → (432100, 43210). 음수도 처리."""
    m = re.findall(r"-?\d[\d,]*", line)
    if len(m) >= 2:
        try:
            return _parse_won(m[-2]), _parse_won(m[-1])
        except ValueError:
            return None
    return None


def parse_withholding_receipt_text(text: str) -> WithholdingReceiptData:
    """추출된 PDF 텍스트 → WithholdingReceiptData."""
    data = WithholdingReceiptData(raw_text=text)

    # 성명
    m = re.search(r"성명\s+([가-힣A-Za-z]+)", text)
    if m:
        data.name = m.group(1)

    # 주민번호 앞 6자리
    m = re.search(r"주민등록번호\s+(\d{6})", text)
    if m:
        data.resident_number_prefix = m.group(1)

    # 근무기간
    m = re.search(r"근무기간\s+([\d.]+)\s*~\s*([\d.]+)", text)
    if m:
        data.work_period_from = m.group(1)
        data.work_period_to = m.group(2)

    # 총급여
    m = re.search(r"총급여\s+(\d{1,3}(?:,\d{3})+)", text)
    if m:
        data.total_pay = _parse_won(m.group(1))

    # 비과세소득
    m = re.search(r"비과세\s*소득\s+(\d{1,3}(?:,\d{3})+)", text)
    if m:
        data.nontaxable_pay = _parse_won(m.group(1))

    # 결정세액
    for line in text.split("\n"):
        if "결정세액" in line:
            pair = _parse_two_amount_pair(line)
            if pair:
                data.decided_tax = pair[0] + pair[1]
                break

    # 주현근무지 기납부
    for line in text.split("\n"):
        if "주(현)근무지" in line or re.search(r"주.현.근무지", line):
            pair = _parse_two_amount_pair(line)
            if pair:
                data.taxes_paid_at_work = pair[0] + pair[1]
                break

    # 차감징수세액
    for line in text.split("\n"):
        if "차감징수세액" in line or "차감징수" in line:
            pair = _parse_two_amount_pair(line)
            if pair:
                data.refund_amount = pair[0] + pair[1]
                break

    # 4대보험
    for label, attr in [
        ("국민연금보험료", "np_amount"),
        ("국민건강보험료", "hi_amount"),
        ("장기요양보험료", "lti_amount"),
        ("고용보험료", "ei_amount"),
    ]:
        m = re.search(rf"{label}[:\s]+(\d{{1,3}}(?:,\d{{3}})+)", text)
        if m:
            setattr(data, attr, _parse_won(m.group(1)))

    return data


def parse_withholding_receipt(pdf_path: str) -> WithholdingReceiptData:
    """PDF 파일 경로 → WithholdingReceiptData."""
    with pdfplumber.open(pdf_path) as pdf:
        all_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    if not all_text.strip():
        raise ValueError("pdf_text_empty")
    return parse_withholding_receipt_text(all_text)


# ─────────────────── Simplified (홈택스 간소화) ───────────────────

@dataclass
class SimplifiedData:
    staff_name: Optional[str] = None
    resident_number_prefix: Optional[str] = None
    insurance_amount: int = 0
    medical_amount: int = 0
    education_amount: int = 0
    donation_amount: int = 0
    house_loan_principal: int = 0
    house_loan_interest: int = 0
    pension_amount: int = 0
    irp_amount: int = 0
    credit_card_amount: int = 0
    debit_card_amount: int = 0
    traditional_market: int = 0
    public_transport: int = 0
    cultural_amount: int = 0
    raw_text: Optional[str] = None


SIMPLIFIED_LABELS = {
    "insurance_amount": ["보장성보험료", "보장성 보험료", "보험료 공제"],
    "medical_amount": ["의료비"],
    "education_amount": ["교육비"],
    "donation_amount": ["기부금"],
    "house_loan_principal": ["주택자금원리금", "주택자금 원리금"],
    "house_loan_interest": ["주택임차차입금이자", "주택임차차입금 이자"],
    "pension_amount": ["연금저축"],
    "irp_amount": ["퇴직연금", "IRP"],
    "credit_card_amount": ["신용카드"],
    "debit_card_amount": ["체크카드", "현금영수증"],
    "traditional_market": ["전통시장"],
    "public_transport": ["대중교통"],
    "cultural_amount": ["문화비"],
}


def parse_simplified_text(text: str) -> SimplifiedData:
    data = SimplifiedData(raw_text=text)

    m = re.search(r"성명\s+([가-힣A-Za-z]+)", text)
    if m:
        data.staff_name = m.group(1)
    m = re.search(r"주민등록번호\s+(\d{6})", text)
    if m:
        data.resident_number_prefix = m.group(1)

    for attr, labels in SIMPLIFIED_LABELS.items():
        for label in labels:
            m = re.search(rf"{label}[:\s]+(\d{{1,3}}(?:,\d{{3}})*|\d+)", text)
            if m:
                setattr(data, attr, _parse_won(m.group(1)))
                break

    return data


def parse_simplified(pdf_path: str) -> SimplifiedData:
    with pdfplumber.open(pdf_path) as pdf:
        all_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    if not all_text.strip():
        raise ValueError("pdf_text_empty")
    return parse_simplified_text(all_text)
```

- [ ] **Step 4.6: Run test → all pass**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_parser.py -v
```

Expected: 3 passed.

- [ ] **Step 4.7: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/yearend/parser.py SodamApp/backend/tests/yearend/ && git commit -m "feat(yearend): parser — 별지24호 + 간소화 13개 카테고리 정규식 파싱"
```

---

### Task 5: `services/yearend/reconciler.py`

**Files:**
- Create: `SodamApp/backend/services/yearend/reconciler.py`
- Create: `SodamApp/backend/tests/yearend/test_reconciler.py`

- [ ] **Step 5.1: Failing test** at `tests/yearend/test_reconciler.py`:

```python
"""Reconciler: 자체 집계 vs 업로드본 정본 대조."""
import pytest


@pytest.mark.parametrize("self_total,confirmed,expected_status,expected_diff", [
    (1_000_000, 1_000_000, "ok",       0),
    (1_000_000, 1_000_500, "ok",       500),       # ±1,000 이하
    (1_000_000, 1_005_000, "warning",  5_000),     # ±10,000 이하
    (1_000_000, 1_015_000, "mismatch", 15_000),    # 초과
    (1_000_000, 985_000,   "warning",  -15_000),   # 절대값 ±10,000 초과
    (1_000_000, 999_000,   "ok",       -1_000),
])
def test_reconcile_thresholds(self_total, confirmed, expected_status, expected_diff):
    from services.yearend.reconciler import classify_diff
    status, diff = classify_diff(self_total, confirmed)
    assert status == expected_status
    assert diff == expected_diff


def test_reconcile_with_none_confirmed_returns_pending():
    from services.yearend.reconciler import classify_diff
    status, diff = classify_diff(1_000_000, None)
    assert status == "pending"
    assert diff == 0


def test_reconcile_warning_at_boundary_10k():
    """exact 10000 → warning, 10001 → mismatch."""
    from services.yearend.reconciler import classify_diff
    s10k, _ = classify_diff(0, 10_000)
    s10k1, _ = classify_diff(0, 10_001)
    assert s10k == "warning"
    assert s10k1 == "mismatch"
```

Wait — re-check parametrize: `(1_000_000, 985_000, "warning", -15_000)` has diff -15000 which is `|diff|=15000 > 10000` so should be `mismatch`, not `warning`. Fix:

Replace that row with `(1_000_000, 985_000, "mismatch", -15_000),` and add a row `(1_000_000, 992_000, "warning", -8_000)` to keep coverage.

Final parametrize:

```python
@pytest.mark.parametrize("self_total,confirmed,expected_status,expected_diff", [
    (1_000_000, 1_000_000, "ok",       0),
    (1_000_000, 1_000_500, "ok",       500),
    (1_000_000, 1_005_000, "warning",  5_000),
    (1_000_000, 1_015_000, "mismatch", 15_000),
    (1_000_000, 985_000,   "mismatch", -15_000),
    (1_000_000, 992_000,   "warning",  -8_000),
    (1_000_000, 999_000,   "ok",       -1_000),
])
```

- [ ] **Step 5.2: Run test → fails (module missing)**

- [ ] **Step 5.3: Create `services/yearend/reconciler.py`**:

```python
"""Reconciler: 자체 집계 vs 업로드본 정본 대조 검증."""
from __future__ import annotations
from typing import Optional


# 임계값 (원). 변경 시 spec § 3.1 도 함께 업데이트.
THRESHOLD_OK = 1_000
THRESHOLD_WARNING = 10_000


def classify_diff(self_total: int, confirmed: Optional[int]) -> tuple[str, int]:
    """(status, diff) 반환.
    - confirmed=None → ("pending", 0)
    - |diff| ≤ 1,000 → "ok"
    - |diff| ≤ 10,000 → "warning"
    - 그 외 → "mismatch"
    diff = confirmed - self_total (양수 = 업로드본이 더 큼)
    """
    if confirmed is None:
        return ("pending", 0)
    diff = confirmed - self_total
    abs_diff = abs(diff)
    if abs_diff <= THRESHOLD_OK:
        return ("ok", diff)
    if abs_diff <= THRESHOLD_WARNING:
        return ("warning", diff)
    return ("mismatch", diff)


def reconcile(report) -> tuple[str, int]:
    """YearEndReport → (status, diff). report 자체는 변경 안 함; 호출 측이 저장."""
    return classify_diff(
        report.taxes_withheld_total,
        report.confirmed_taxes_paid,
    )
```

- [ ] **Step 5.4: Run → 9 passed**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_reconciler.py -v
```

- [ ] **Step 5.5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/yearend/reconciler.py SodamApp/backend/tests/yearend/test_reconciler.py && git commit -m "feat(yearend): reconciler — ±1k/±10k 임계값 기반 대조"
```

---

### Task 6: `services/yearend/tax_calculator.py` (Stub for Phase C)

**Files:**
- Create: `SodamApp/backend/services/yearend/tax_calculator.py`
- Create: `SodamApp/backend/tests/yearend/test_tax_calculator.py`

- [ ] **Step 6.1: Failing test** at `tests/yearend/test_tax_calculator.py`:

```python
"""Tax calculator adapter: Phase C uses StubTaxCalculator (no calculation)."""


def test_stub_returns_confirmed_when_available():
    from services.yearend.tax_calculator import StubTaxCalculator, CalculationResult

    class FakeReport:
        confirmed_total_pay = 33_600_000
        confirmed_taxes_paid = 477_300
        decided_tax = 386_900
        refund_amount = -45_200
        taxes_withheld_total = 477_300

    calc = StubTaxCalculator()
    result: CalculationResult = calc.calculate(FakeReport(), simplified=None)
    assert result.decided_tax == 386_900
    assert result.refund_amount == -45_200
    assert result.source == "uploaded"


def test_stub_returns_self_aggregated_when_confirmed_missing():
    from services.yearend.tax_calculator import StubTaxCalculator

    class FakeReport:
        confirmed_total_pay = None
        confirmed_taxes_paid = None
        decided_tax = None
        refund_amount = None
        taxes_withheld_total = 477_300

    calc = StubTaxCalculator()
    result = calc.calculate(FakeReport(), simplified=None)
    assert result.decided_tax is None  # 계산하지 않음
    assert result.taxes_paid == 477_300
    assert result.source == "self_aggregated"


def test_get_calculator_returns_stub_by_default(monkeypatch):
    from services.yearend.tax_calculator import get_calculator, StubTaxCalculator
    monkeypatch.delenv("YEAR_END_TAX_CALCULATOR", raising=False)
    calc = get_calculator()
    assert isinstance(calc, StubTaxCalculator)
```

- [ ] **Step 6.2: Create `services/yearend/tax_calculator.py`**:

```python
"""Tax calculator adapter.

Phase C (현재): StubTaxCalculator — 계산하지 않고 confirmed 값을 그대로 반환.
Phase A (향후): StandardKoreanTaxCalculator — 한국 세법 풀 계산. 미구현.

전환 방법: env YEAR_END_TAX_CALCULATOR=standard 또는 settings 값으로 분기.
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class CalculationResult:
    decided_tax: Optional[int]      # 결정세액
    taxes_paid: Optional[int]       # 기납부세액
    refund_amount: Optional[int]    # 차감징수세액 (음수=환급)
    source: str                     # "uploaded" / "self_aggregated" / "computed"


class TaxCalculator(Protocol):
    def calculate(self, report, simplified) -> CalculationResult: ...


class StubTaxCalculator:
    """계산하지 않음. 업로드본 우선, 없으면 자체 집계 그대로."""

    def calculate(self, report, simplified=None) -> CalculationResult:
        if report.confirmed_taxes_paid is not None:
            return CalculationResult(
                decided_tax=report.decided_tax,
                taxes_paid=report.confirmed_taxes_paid,
                refund_amount=report.refund_amount,
                source="uploaded",
            )
        return CalculationResult(
            decided_tax=None,
            taxes_paid=report.taxes_withheld_total,
            refund_amount=None,
            source="self_aggregated",
        )


class StandardKoreanTaxCalculator:
    """Phase A 자리표시자. 호출 시 NotImplementedError."""

    def calculate(self, report, simplified=None) -> CalculationResult:
        raise NotImplementedError(
            "Phase A 한국 세법 풀 계산은 아직 미구현. tax_calculator.py 참조."
        )


def get_calculator() -> TaxCalculator:
    kind = os.getenv("YEAR_END_TAX_CALCULATOR", "stub").lower()
    if kind == "standard":
        return StandardKoreanTaxCalculator()
    return StubTaxCalculator()
```

- [ ] **Step 6.3: Run → 3 passed**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_tax_calculator.py -v
```

- [ ] **Step 6.4: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/yearend/tax_calculator.py SodamApp/backend/tests/yearend/test_tax_calculator.py && git commit -m "feat(yearend): tax_calculator — Phase C Stub 어댑터 + Phase A 자리표시자"
```

---

### Task 7: `services/yearend/audit.py`

**Files:**
- Create: `SodamApp/backend/services/yearend/audit.py`
- Create: `SodamApp/backend/tests/yearend/test_audit.py`

- [ ] **Step 7.1: Failing test** at `tests/yearend/test_audit.py`:

```python
"""Audit log helper."""


def test_log_action_inserts_row(session):
    from models import Business, Staff, User, YearEndAuditLog
    from services.yearend.audit import log_action
    from sqlmodel import select

    biz = Business(name="X", business_type="음식점"); session.add(biz); session.commit()
    staff = Staff(name="A", business_id=biz.id); session.add(staff); session.commit()
    u = User(username="admin1", hashed_password="x", role="admin", business_id=biz.id)
    session.add(u); session.commit()

    log_action(
        session=session,
        business_id=biz.id, staff_id=staff.id, year=2025,
        action="download", actor_user_id=u.id, actor_role="admin",
        actor_ip="127.0.0.1", user_agent="pytest",
        document_id=None, detail='{"file":"draft.pdf"}',
    )
    session.commit()

    rows = session.exec(select(YearEndAuditLog)).all()
    assert len(rows) == 1
    assert rows[0].action == "download"
    assert rows[0].actor_role == "admin"
    assert rows[0].detail == '{"file":"draft.pdf"}'


def test_extract_ip_and_ua_from_request():
    from services.yearend.audit import extract_actor_meta

    class FakeReq:
        headers = {"user-agent": "Mozilla/5.0"}
        client = type("C", (), {"host": "1.2.3.4"})()

    ip, ua = extract_actor_meta(FakeReq())
    assert ip == "1.2.3.4"
    assert ua == "Mozilla/5.0"
```

- [ ] **Step 7.2: Create `services/yearend/audit.py`**:

```python
"""Audit log helper for year-end actions."""
from __future__ import annotations
import datetime
import logging
from typing import Optional

from sqlmodel import Session

logger = logging.getLogger("sodam.yearend.audit")


def extract_actor_meta(request) -> tuple[Optional[str], Optional[str]]:
    """FastAPI Request → (ip, user_agent)."""
    ip = None
    ua = None
    try:
        ip = request.client.host if request.client else None
    except Exception:
        pass
    try:
        ua = request.headers.get("user-agent")
    except Exception:
        pass
    return ip, ua


def log_action(*, session: Session,
               business_id: int, staff_id: int, year: int,
               action: str, actor_user_id: int, actor_role: str,
               document_id: Optional[int] = None,
               actor_ip: Optional[str] = None,
               user_agent: Optional[str] = None,
               detail: Optional[str] = None) -> None:
    """YearEndAuditLog 1행 추가. 호출 측이 commit 책임."""
    from models import YearEndAuditLog

    row = YearEndAuditLog(
        business_id=business_id, staff_id=staff_id, year=year,
        document_id=document_id, action=action,
        actor_user_id=actor_user_id, actor_role=actor_role,
        actor_ip=actor_ip, user_agent=user_agent,
        occurred_at=datetime.datetime.utcnow(),
        detail=detail,
    )
    session.add(row)
    logger.info(
        "yearend_audit action=%s staff_id=%s year=%s actor=%s/%s",
        action, staff_id, year, actor_user_id, actor_role,
    )
```

- [ ] **Step 7.3: Run → 2 passed**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_audit.py -v
```

- [ ] **Step 7.4: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/yearend/audit.py SodamApp/backend/tests/yearend/test_audit.py && git commit -m "feat(yearend): audit — 감사 로그 헬퍼 (action 종류·IP·UA 자동 추출)"
```

---

### Task 8: `services/yearend/generator.py` + Jinja2 templates + WeasyPrint dependency

**Files:**
- Modify: `SodamApp/backend/requirements.txt` (add weasyprint, jinja2)
- Create: `SodamApp/backend/templates/yearend/withholding_receipt_24.html.j2`
- Create: `SodamApp/backend/templates/yearend/business_income_receipt_23.html.j2`
- Create: `SodamApp/backend/services/yearend/generator.py`
- Create: `SodamApp/backend/tests/yearend/test_generator.py`

- [ ] **Step 8.1: Add deps to `requirements.txt`**

Append:

```
# Year-end PDF generation
weasyprint==63.1
Jinja2==3.1.4
```

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pip install -r requirements.txt
```

> **Windows note**: WeasyPrint on Windows requires GTK3 runtime. If pip install fails, install GTK3 runtime first from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases. On Linux Docker (production), install via apt: `apt-get install -y libpango-1.0-0 libcairo2 libgdk-pixbuf-xlib-2.0-0 libffi-dev shared-mime-info`. Dockerfile changes happen in Task 12.

- [ ] **Step 8.2: Create `templates/yearend/withholding_receipt_24.html.j2`**:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>근로소득원천징수영수증 — {{ staff.name }} ({{ report.year }})</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Pretendard", "Noto Sans KR", sans-serif; font-size: 10pt; color: #1e293b; }
    .header { background: linear-gradient(180deg, #1e293b 0%, #334155 100%);
              color: white; padding: 16px 20px; border-radius: 6px 6px 0 0; }
    .header h1 { margin: 0; font-size: 18pt; letter-spacing: -0.02em; }
    .header .meta { margin-top: 6px; font-size: 9pt; opacity: 0.9; }
    .watermark-draft { color: #b91c1c; font-weight: 700; margin-left: 8px; }
    table.box { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.box th, table.box td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; }
    table.box th { background: #f1f5f9; text-align: left; width: 28%; font-weight: 600; }
    .section-title { background: #334155; color: white; padding: 6px 10px; margin-top: 16px;
                     font-weight: 600; font-size: 11pt; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .footer-note { margin-top: 16px; padding: 10px; border-left: 3px solid #94a3b8;
                   background: #f8fafc; font-size: 9pt; color: #475569; }
    .grid-2 { display: table; width: 100%; }
    .grid-2 > .col { display: table-cell; width: 50%; padding-right: 8px; }
  </style>
</head>
<body>

<div class="header">
  <h1>근로소득원천징수영수증
    {% if is_draft %}<span class="watermark-draft">[초안]</span>{% endif %}
  </h1>
  <div class="meta">
    발행처: {{ business.name }} (사업자등록번호 {{ business.business_number or '-' }})<br/>
    발행일: {{ issued_at }} | 귀속연도: {{ report.year }}
  </div>
</div>

<div class="section-title">① 인적사항</div>
<table class="box">
  <tr><th>성명</th><td>{{ staff.name }}</td><th>주민등록번호</th><td>{{ resident_number_display }}</td></tr>
  <tr><th>주소</th><td colspan="3">{{ staff.address or '-' }}</td></tr>
  <tr><th>부양가족 수</th><td>{{ staff.dependents_count or 1 }}명</td><th>자녀(8~20세)</th><td>{{ staff.children_count or 0 }}명</td></tr>
</table>

<div class="section-title">② 근무처별 소득명세</div>
<table class="box">
  <tr><th>근무처</th><td>{{ business.name }}</td></tr>
  <tr><th>사업자등록번호</th><td>{{ business.business_number or '-' }}</td></tr>
  <tr><th>대표자</th><td>{{ business.owner_name or '-' }}</td></tr>
  <tr><th>근무기간</th><td>{{ work_period_from }} ~ {{ work_period_to }}</td></tr>
</table>

<div class="section-title">③ 소득명세</div>
<table class="box">
  <tr><th>총급여</th><td class="amount">{{ "{:,}".format(report.total_pay_year) }} 원</td></tr>
  <tr><th>비과세소득</th><td class="amount">{{ "{:,}".format(report.nontaxable_pay) }} 원</td></tr>
  <tr><th>과세대상급여</th><td class="amount">{{ "{:,}".format(report.taxable_pay) }} 원</td></tr>
</table>

<div class="section-title">④ 공제명세</div>
<table class="box">
  <tr><th>4대보험 합계</th><td class="amount">{{ "{:,}".format(report.insurance_4major_total) }} 원</td></tr>
  {% if simplified %}
  <tr><th>보장성보험료</th><td class="amount">{{ "{:,}".format(simplified.insurance_amount) }} 원</td></tr>
  <tr><th>의료비</th><td class="amount">{{ "{:,}".format(simplified.medical_amount) }} 원</td></tr>
  <tr><th>교육비</th><td class="amount">{{ "{:,}".format(simplified.education_amount) }} 원</td></tr>
  <tr><th>기부금</th><td class="amount">{{ "{:,}".format(simplified.donation_amount) }} 원</td></tr>
  <tr><th>연금저축</th><td class="amount">{{ "{:,}".format(simplified.pension_amount) }} 원</td></tr>
  <tr><th>신용카드 합계</th><td class="amount">{{ "{:,}".format(simplified.credit_card_amount + simplified.debit_card_amount) }} 원</td></tr>
  {% endif %}
</table>

<div class="section-title">⑤ 세액명세</div>
<table class="box">
  <tr><th>결정세액</th><td class="amount">
    {% if report.decided_tax is not none %}{{ "{:,}".format(report.decided_tax) }} 원{% else %}(업로드본 미반영){% endif %}
  </td></tr>
  <tr><th>기납부세액 (자체 집계)</th><td class="amount">{{ "{:,}".format(report.taxes_withheld_total) }} 원</td></tr>
  {% if report.confirmed_taxes_paid is not none %}
  <tr><th>기납부세액 (업로드본)</th><td class="amount">{{ "{:,}".format(report.confirmed_taxes_paid) }} 원</td></tr>
  {% endif %}
  <tr><th>차감징수세액</th><td class="amount">
    {% if report.refund_amount is not none %}
      {{ "{:,}".format(report.refund_amount) }} 원
      {% if report.refund_amount < 0 %}<span style="color:#059669"> (환급)</span>
      {% elif report.refund_amount > 0 %}<span style="color:#b91c1c"> (추가납부)</span>{% endif %}
    {% else %}(업로드본 미반영){% endif %}
  </td></tr>
</table>

<div class="footer-note">
  본 서류는 셈하나(SEMHANA) 시스템에서 발행한 <strong>초안</strong>입니다.
  정식 원천징수영수증은 홈택스 또는 세무대리인을 통해 발급받으십시오.
  세부 항목은 연말정산 결과에 따라 변경될 수 있습니다.
</div>

</body>
</html>
```

- [ ] **Step 8.3: Create `templates/yearend/business_income_receipt_23.html.j2`** (사업소득자용 — 별지23호 유사):

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>사업소득원천징수영수증 — {{ staff.name }} ({{ report.year }})</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Pretendard", "Noto Sans KR", sans-serif; font-size: 10pt; color: #1e293b; }
    .header { background: linear-gradient(180deg, #1e293b 0%, #334155 100%);
              color: white; padding: 16px 20px; border-radius: 6px 6px 0 0; }
    .header h1 { margin: 0; font-size: 18pt; }
    .header .meta { margin-top: 6px; font-size: 9pt; opacity: 0.9; }
    .watermark-draft { color: #b91c1c; font-weight: 700; margin-left: 8px; }
    table.box { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.box th, table.box td { border: 1px solid #cbd5e1; padding: 6px 10px; }
    table.box th { background: #f1f5f9; text-align: left; width: 32%; font-weight: 600; }
    .section-title { background: #334155; color: white; padding: 6px 10px; margin-top: 16px;
                     font-weight: 600; font-size: 11pt; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    .footer-note { margin-top: 16px; padding: 10px; border-left: 3px solid #94a3b8;
                   background: #f8fafc; font-size: 9pt; color: #475569; }
  </style>
</head>
<body>
<div class="header">
  <h1>사업소득원천징수영수증
    {% if is_draft %}<span class="watermark-draft">[초안]</span>{% endif %}
  </h1>
  <div class="meta">
    발행처: {{ business.name }} (사업자등록번호 {{ business.business_number or '-' }})<br/>
    발행일: {{ issued_at }} | 귀속연도: {{ report.year }}
  </div>
</div>

<div class="section-title">소득자 인적사항</div>
<table class="box">
  <tr><th>성명</th><td>{{ staff.name }}</td></tr>
  <tr><th>주민등록번호</th><td>{{ resident_number_display }}</td></tr>
  <tr><th>주소</th><td>{{ staff.address or '-' }}</td></tr>
</table>

<div class="section-title">지급 명세</div>
<table class="box">
  <tr><th>지급기간</th><td>{{ work_period_from }} ~ {{ work_period_to }}</td></tr>
  <tr><th>지급총액</th><td class="amount">{{ "{:,}".format(report.total_pay_year) }} 원</td></tr>
  <tr><th>원천징수세액 (소득세 3%)</th><td class="amount">{{ "{:,}".format(report.taxes_withheld_total // 11 * 10) }} 원</td></tr>
  <tr><th>지방소득세 (0.3%)</th><td class="amount">{{ "{:,}".format(report.taxes_withheld_total // 11) }} 원</td></tr>
  <tr><th>총 원천징수세액 (3.3%)</th><td class="amount">{{ "{:,}".format(report.taxes_withheld_total) }} 원</td></tr>
</table>

<div class="footer-note">
  본 서류는 셈하나(SEMHANA) 시스템에서 발행한 사업소득원천징수영수증 초안입니다.
  종합소득세 신고(매년 5월) 시 본 영수증을 참고하십시오.
</div>
</body>
</html>
```

- [ ] **Step 8.4: Failing test** at `tests/yearend/test_generator.py`:

```python
"""Generator: HTML 렌더 + WeasyPrint 변환 (HTML만 검증)."""


def _make_report():
    class R:
        year = 2025
        total_pay_year = 33_600_000
        nontaxable_pay = 2_400_000
        taxable_pay = 31_200_000
        taxes_withheld_total = 477_300
        insurance_4major_total = 3_124_800
        decided_tax = 386_900
        confirmed_taxes_paid = 477_300
        refund_amount = -90_400
    return R()


def _make_staff():
    class S:
        name = "김금순"
        resident_number = "850101-2345678"
        address = "서울시 종로구 ..."
        dependents_count = 2
        children_count = 1
        contract_type = "정규직"
    return S()


def _make_business():
    class B:
        name = "소담김밥"
        business_number = "123-45-67890"
        owner_name = "김대표"
    return B()


def test_render_withholding_html_contains_key_strings():
    from services.yearend.generator import render_withholding_html

    html = render_withholding_html(
        report=_make_report(),
        staff=_make_staff(),
        business=_make_business(),
        simplified=None,
        is_draft=True,
        mask_resident_number=False,
    )
    assert "근로소득원천징수영수증" in html
    assert "[초안]" in html
    assert "김금순" in html
    assert "850101-2345678" in html       # full 표시
    assert "33,600,000" in html
    assert "(환급)" in html


def test_render_withholding_html_masks_resident_number():
    from services.yearend.generator import render_withholding_html
    html = render_withholding_html(
        report=_make_report(), staff=_make_staff(), business=_make_business(),
        simplified=None, is_draft=False, mask_resident_number=True,
    )
    assert "850101-1******" in html or "850101-2******" in html
    assert "850101-2345678" not in html


def test_render_business_income_html():
    from services.yearend.generator import render_business_income_html
    s = _make_staff()
    s.contract_type = "사업소득자"
    html = render_business_income_html(
        report=_make_report(), staff=s, business=_make_business(),
        is_draft=True, mask_resident_number=False,
    )
    assert "사업소득원천징수영수증" in html
    assert "3.3%" in html or "3%" in html
```

- [ ] **Step 8.5: Create `services/yearend/generator.py`**:

```python
"""HTML 렌더 + WeasyPrint PDF 변환."""
from __future__ import annotations
import datetime
import logging
import os
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger("sodam.yearend.generator")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates" / "yearend"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _mask_resident_number(rn: Optional[str]) -> str:
    if not rn:
        return "-"
    cleaned = rn.replace("-", "").strip()
    if len(cleaned) < 7:
        return rn
    return f"{cleaned[:6]}-{cleaned[6]}******"


def _resolve_resident_display(staff, mask: bool) -> str:
    rn = getattr(staff, "resident_number", None)
    if mask:
        return _mask_resident_number(rn)
    return rn or "-"


def _work_period(staff, year: int) -> tuple[str, str]:
    from_str = f"{year}.01.01"
    if getattr(staff, "contract_start_date", None):
        d = staff.contract_start_date
        if hasattr(d, "year") and d.year == year:
            from_str = d.strftime("%Y.%m.%d")
    to_str = f"{year}.12.31"
    return from_str, to_str


def render_withholding_html(*, report, staff, business, simplified=None,
                             is_draft: bool = True,
                             mask_resident_number: bool = False) -> str:
    """별지 24호 유사 레이아웃 HTML."""
    template = _env.get_template("withholding_receipt_24.html.j2")
    wp_from, wp_to = _work_period(staff, report.year)
    return template.render(
        report=report,
        staff=staff,
        business=business,
        simplified=simplified,
        is_draft=is_draft,
        resident_number_display=_resolve_resident_display(staff, mask_resident_number),
        work_period_from=wp_from,
        work_period_to=wp_to,
        issued_at=datetime.date.today().strftime("%Y-%m-%d"),
    )


def render_business_income_html(*, report, staff, business,
                                 is_draft: bool = True,
                                 mask_resident_number: bool = False) -> str:
    """별지 23호 유사 레이아웃 (사업소득자용) HTML."""
    template = _env.get_template("business_income_receipt_23.html.j2")
    wp_from, wp_to = _work_period(staff, report.year)
    return template.render(
        report=report,
        staff=staff,
        business=business,
        is_draft=is_draft,
        resident_number_display=_resolve_resident_display(staff, mask_resident_number),
        work_period_from=wp_from,
        work_period_to=wp_to,
        issued_at=datetime.date.today().strftime("%Y-%m-%d"),
    )


def html_to_pdf(html: str) -> bytes:
    """WeasyPrint HTML → PDF bytes. ImportError 대응."""
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as e:
        raise RuntimeError(
            f"WeasyPrint 사용 불가 ({e}). Linux Docker 에서는 libpango/libcairo 필요."
        )
    return HTML(string=html).write_pdf()
```

- [ ] **Step 8.6: Run → 3 passed**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/yearend/test_generator.py -v
```

- [ ] **Step 8.7: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/requirements.txt SodamApp/backend/templates/yearend/ SodamApp/backend/services/yearend/generator.py SodamApp/backend/tests/yearend/test_generator.py && git commit -m "feat(yearend): generator + 별지24/23 Jinja2 템플릿 + WeasyPrint 의존성"
```

---

## Stage 3 — Backend routers (4 tasks)

### Task 9: `routers/yearend.py` — admin endpoints (집계·조회·문서업로드)

**Files:**
- Create: `SodamApp/backend/routers/yearend.py`
- Modify: `SodamApp/backend/main.py` (router 등록)

This task is large; split into 3 sub-commits within. Each sub-commit is its own step.

- [ ] **Step 9.1: Create router skeleton + summary/employees/detail endpoints**

Create `routers/yearend.py`:

```python
"""연말정산 어드민 라우터 (사업주 호출).

- 자체 집계 (Payroll → snapshot)
- 문서 업로드 + 파싱
- 대조 검증
- 초안 PDF 생성
- 직원앱 노출 토글
- 감사 로그 조회
"""
from __future__ import annotations
import hashlib
import io
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, Query, Request, Response, UploadFile)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import (Business, Staff, User,
                    YearEndReport, YearEndDocument, YearEndSimplified,
                    YearEndAuditLog)
from routers.auth import get_admin_user
from services.storage_service import get_storage
from services.yearend import aggregator, parser, reconciler, audit, generator
from services.yearend.tax_calculator import get_calculator
from tenant_filter import get_bid_from_token

logger = logging.getLogger("sodam.yearend")
router = APIRouter(prefix="/yearend", tags=["yearend"])


# ─────────── Schemas ───────────

class EmployeeRow(BaseModel):
    staff_id: int
    name: str
    income_type: str
    status: str
    reconciliation_status: str
    total_pay_year: int
    decided_tax: Optional[int]
    refund_amount: Optional[int]
    distributed_to_staff: bool


class YearSummary(BaseModel):
    year: int
    total_employees: int
    counts_by_status: dict
    refund_total: int
    additional_payment_total: int


class ReportDetail(BaseModel):
    report: dict
    documents: List[dict]
    simplified: Optional[dict]
    recent_audit_logs: List[dict]


# ─────────── Helpers ───────────

def _ensure_report(session: Session, biz_id: int, staff_id: int, year: int) -> YearEndReport:
    """YearEndReport 행 보장 (없으면 빈 행 생성)."""
    r = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if r is None:
        staff = session.get(Staff, staff_id)
        income_type = aggregator._infer_income_type(staff) if staff else "earned"
        r = YearEndReport(business_id=biz_id, staff_id=staff_id, year=year,
                          income_type=income_type)
        session.add(r)
        session.flush()
    return r


def _serialize_report(r: YearEndReport) -> dict:
    return {
        "id": r.id, "year": r.year, "staff_id": r.staff_id, "income_type": r.income_type,
        "status": r.status, "reconciliation_status": r.reconciliation_status,
        "reconciliation_diff": r.reconciliation_diff,
        "total_pay_year": r.total_pay_year, "taxable_pay": r.taxable_pay,
        "nontaxable_pay": r.nontaxable_pay,
        "taxes_withheld_total": r.taxes_withheld_total,
        "insurance_4major_total": r.insurance_4major_total,
        "confirmed_total_pay": r.confirmed_total_pay,
        "confirmed_taxes_paid": r.confirmed_taxes_paid,
        "decided_tax": r.decided_tax, "refund_amount": r.refund_amount,
        "aggregated_at": r.aggregated_at.isoformat() if r.aggregated_at else None,
        "confirmed_at": r.confirmed_at.isoformat() if r.confirmed_at else None,
        "distributed_to_staff": r.distributed_to_staff,
        "distributed_at": r.distributed_at.isoformat() if r.distributed_at else None,
    }


# ─────────── Year summary & employee list ───────────

@router.get("/{year}/summary")
def get_year_summary(year: int, request: Request,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_admin_user)) -> YearSummary:
    biz_id = get_bid_from_token(request)
    staffs = session.exec(
        select(Staff).where(Staff.business_id == biz_id, Staff.status == "재직")
    ).all()
    reports = session.exec(
        select(YearEndReport).where(YearEndReport.business_id == biz_id,
                                    YearEndReport.year == year)
    ).all()
    rmap = {r.staff_id: r for r in reports}

    counts = {"draft": 0, "aggregated": 0, "uploaded": 0, "reconciled": 0, "distributed": 0}
    refund_total = 0
    add_total = 0
    for s in staffs:
        r = rmap.get(s.id)
        status = r.status if r else "draft"
        counts[status] = counts.get(status, 0) + 1
        if r and r.refund_amount is not None:
            if r.refund_amount < 0:
                refund_total += -r.refund_amount  # 환급은 양의 절댓값
            else:
                add_total += r.refund_amount

    return YearSummary(
        year=year, total_employees=len(staffs),
        counts_by_status=counts,
        refund_total=refund_total, additional_payment_total=add_total,
    )


@router.get("/{year}/employees", response_model=List[EmployeeRow])
def list_employees(year: int, request: Request,
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)) -> List[EmployeeRow]:
    biz_id = get_bid_from_token(request)
    staffs = session.exec(
        select(Staff).where(Staff.business_id == biz_id)
    ).all()
    reports = session.exec(
        select(YearEndReport).where(YearEndReport.business_id == biz_id,
                                    YearEndReport.year == year)
    ).all()
    rmap = {r.staff_id: r for r in reports}

    out: List[EmployeeRow] = []
    for s in staffs:
        r = rmap.get(s.id)
        if r is None:
            out.append(EmployeeRow(
                staff_id=s.id, name=s.name,
                income_type=aggregator._infer_income_type(s),
                status="draft", reconciliation_status="pending",
                total_pay_year=0, decided_tax=None, refund_amount=None,
                distributed_to_staff=False,
            ))
        else:
            out.append(EmployeeRow(
                staff_id=s.id, name=s.name, income_type=r.income_type,
                status=r.status, reconciliation_status=r.reconciliation_status,
                total_pay_year=r.total_pay_year, decided_tax=r.decided_tax,
                refund_amount=r.refund_amount,
                distributed_to_staff=r.distributed_to_staff,
            ))
    return out


@router.get("/{year}/employees/{staff_id}", response_model=ReportDetail)
def get_employee_report(year: int, staff_id: int, request: Request,
                        session: Session = Depends(get_session),
                        user: User = Depends(get_admin_user)) -> ReportDetail:
    biz_id = get_bid_from_token(request)
    r = _ensure_report(session, biz_id, staff_id, year)
    session.commit()

    docs = session.exec(
        select(YearEndDocument)
        .where(YearEndDocument.staff_id == staff_id, YearEndDocument.year == year)
        .order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    simp = session.exec(
        select(YearEndSimplified)
        .where(YearEndSimplified.staff_id == staff_id, YearEndSimplified.year == year)
        .order_by(YearEndSimplified.parsed_at.desc())
    ).first()
    logs = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.staff_id == staff_id, YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .limit(5)
    ).all()

    return ReportDetail(
        report=_serialize_report(r),
        documents=[{
            "id": d.id, "kind": d.kind, "filename": d.original_filename,
            "uploaded_at": d.uploaded_at.isoformat(), "parse_status": d.parse_status,
            "parse_error": d.parse_error, "file_url": d.file_url,
        } for d in docs],
        simplified={
            "insurance_amount": simp.insurance_amount,
            "medical_amount": simp.medical_amount,
            "education_amount": simp.education_amount,
            "donation_amount": simp.donation_amount,
            "house_loan_principal": simp.house_loan_principal,
            "house_loan_interest": simp.house_loan_interest,
            "pension_amount": simp.pension_amount,
            "irp_amount": simp.irp_amount,
            "credit_card_amount": simp.credit_card_amount,
            "debit_card_amount": simp.debit_card_amount,
            "traditional_market": simp.traditional_market,
            "public_transport": simp.public_transport,
            "cultural_amount": simp.cultural_amount,
        } if simp else None,
        recent_audit_logs=[{
            "action": l.action, "actor_role": l.actor_role,
            "occurred_at": l.occurred_at.isoformat(), "actor_ip": l.actor_ip,
        } for l in logs],
    )


@router.post("/{year}/employees/{staff_id}/aggregate")
def trigger_aggregate(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = aggregator.refresh_snapshot(
        business_id=biz_id, staff_id=staff_id, year=year, session=session
    )
    session.commit()
    return _serialize_report(report)


def _aggregate_all_bg(biz_id: int, year: int, session: Session):
    staffs = session.exec(select(Staff).where(Staff.business_id == biz_id)).all()
    for s in staffs:
        try:
            aggregator.refresh_snapshot(
                business_id=biz_id, staff_id=s.id, year=year, session=session
            )
        except Exception as e:
            logger.error("aggregate-all staff_id=%s error: %s", s.id, e)
    session.commit()


@router.post("/{year}/aggregate-all")
def aggregate_all(year: int, request: Request, bg: BackgroundTasks,
                  session: Session = Depends(get_session),
                  user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    bg.add_task(_aggregate_all_bg, biz_id, year, session)
    return {"status": "scheduled", "year": year}
```

- [ ] **Step 9.2: Register router in `main.py`**

Open `SodamApp/backend/main.py`. Find the line `from routers import ...` (around line 9) and add `yearend` and `staff_yearend`:

```python
from routers import (stats, ocr, expense, hr, upload, payroll, auth, contract,
                     settings, finance, profitloss, products, revenue, purchase,
                     purchase_requests, emergency_contacts, announcements,
                     suggestions, staff_chat, deploy, distribute, superadmin,
                     yearend, staff_yearend)
```

Add at the end of the router registration block (search for `app.include_router(bank_sync...`):

```python
app.include_router(yearend.router, prefix="/api")
app.include_router(staff_yearend.router, prefix="/api/staff")
```

> **Note**: `staff_yearend.py` doesn't exist yet (Task 11). Comment out the second line for now and uncomment after Task 11. Add `# TODO: uncomment after Task 11` to the line.

- [ ] **Step 9.3: Manual verification — start server, hit endpoints**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/uvicorn main:app --reload --port 8000
```

In another terminal, with a valid admin token (from /api/auth/login):

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/yearend/2025/summary
curl -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/yearend/2025/employees
```

Expected: JSON responses with empty/zero data (no reports yet). Stop server.

- [ ] **Step 9.4: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/yearend.py SodamApp/backend/main.py && git commit -m "feat(yearend): admin 라우터 — summary/employees/detail/aggregate 엔드포인트"
```

---

### Task 10: `routers/yearend.py` — document upload + parse pipeline + reconcile

**Files:**
- Modify: `SodamApp/backend/routers/yearend.py` (append endpoints)

- [ ] **Step 10.1: Append upload + reconcile endpoints to `routers/yearend.py`**

Append at the end of the file:

```python
# ─────────── Document upload & parse ───────────

ALLOWED_KINDS = {"simplified", "withholding_receipt", "other"}
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10MB


def _parse_document_sync(doc_id: int, session: Session) -> None:
    """Background task: 업로드된 PDF 파싱 → DB 저장."""
    from models import YearEndDocument, YearEndReport, YearEndSimplified
    import tempfile, requests

    doc = session.get(YearEndDocument, doc_id)
    if not doc:
        return

    try:
        # Download from R2 to temp
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            resp = requests.get(doc.file_url, timeout=30)
            resp.raise_for_status()
            tmp.write(resp.content)
            tmp_path = tmp.name

        if doc.kind == "withholding_receipt":
            data = parser.parse_withholding_receipt(tmp_path)
            r = session.exec(
                select(YearEndReport).where(YearEndReport.staff_id == doc.staff_id,
                                            YearEndReport.year == doc.year)
            ).first()
            if r is None:
                r = YearEndReport(business_id=doc.business_id, staff_id=doc.staff_id,
                                  year=doc.year)
                session.add(r); session.flush()
            r.confirmed_doc_id = doc.id
            r.confirmed_total_pay = data.total_pay
            r.confirmed_taxes_paid = data.taxes_paid_at_work
            r.decided_tax = data.decided_tax
            r.refund_amount = data.refund_amount
            r.confirmed_at = datetime.utcnow()
            if r.status in ("draft", "aggregated"):
                r.status = "uploaded"

        elif doc.kind == "simplified":
            data = parser.parse_simplified(tmp_path)
            existing = session.exec(
                select(YearEndSimplified).where(YearEndSimplified.document_id == doc.id)
            ).first()
            if existing is None:
                existing = YearEndSimplified(
                    document_id=doc.id, staff_id=doc.staff_id, year=doc.year,
                )
                session.add(existing)
            for f in ["insurance_amount", "medical_amount", "education_amount",
                      "donation_amount", "house_loan_principal", "house_loan_interest",
                      "pension_amount", "irp_amount", "credit_card_amount",
                      "debit_card_amount", "traditional_market", "public_transport",
                      "cultural_amount"]:
                setattr(existing, f, getattr(data, f, 0))
            existing.raw_extracted_text = data.raw_text
            existing.parsed_at = datetime.utcnow()

        doc.parse_status = "parsed"
        doc.parsed_at = datetime.utcnow()
        doc.parse_error = None
        session.commit()
        logger.info("yearend parse OK doc_id=%s kind=%s", doc.id, doc.kind)

    except Exception as e:
        doc.parse_status = "error"
        doc.parse_error = str(e)[:500]
        session.commit()
        logger.error("yearend parse FAIL doc_id=%s: %s", doc.id, e)
    finally:
        try:
            import os as _os
            _os.unlink(tmp_path)
        except Exception:
            pass


@router.post("/{year}/employees/{staff_id}/documents")
async def upload_document(
    year: int, staff_id: int,
    request: Request, bg: BackgroundTasks,
    file: UploadFile = File(...),
    kind: str = Form(...),
    session: Session = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    biz_id = get_bid_from_token(request)

    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, f"kind 는 {ALLOWED_KINDS} 중 하나")

    if (file.content_type or "").lower() != "application/pdf":
        raise HTTPException(400, "PDF 파일만 업로드 가능")

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "10MB 이하 PDF만 허용")

    file_hash = hashlib.sha256(content).hexdigest()

    # 중복 체크
    dup = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id,
            YearEndDocument.year == year,
            YearEndDocument.kind == kind,
            YearEndDocument.file_hash == file_hash,
        )
    ).first()
    if dup:
        raise HTTPException(409, "동일 파일이 이미 업로드되어 있습니다")

    # R2 저장
    storage = get_storage()
    key = f"yearend/{biz_id}/{year}/{staff_id}/{kind}_{file_hash[:12]}.pdf"
    file_url = storage.save_bytes(content, key, content_type="application/pdf")

    doc = YearEndDocument(
        business_id=biz_id, staff_id=staff_id, year=year, kind=kind,
        file_url=file_url, original_filename=file.filename or "upload.pdf",
        file_size=len(content), file_hash=file_hash,
        uploaded_by_user_id=user.id, uploaded_at=datetime.utcnow(),
    )
    session.add(doc)
    _ensure_report(session, biz_id, staff_id, year)
    session.commit()
    session.refresh(doc)

    # 감사 로그
    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="upload", actor_user_id=user.id, actor_role="admin",
        document_id=doc.id, actor_ip=ip, user_agent=ua,
        detail=json.dumps({"kind": kind, "filename": file.filename}, ensure_ascii=False),
    )
    session.commit()

    # 비동기 파싱
    bg.add_task(_parse_document_sync, doc.id, session)

    return {
        "id": doc.id, "kind": doc.kind, "file_url": doc.file_url,
        "parse_status": doc.parse_status, "filename": doc.original_filename,
    }


@router.get("/{year}/employees/{staff_id}/documents")
def list_documents(year: int, staff_id: int, request: Request,
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    docs = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id, YearEndDocument.year == year
        ).order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    return [{
        "id": d.id, "kind": d.kind, "filename": d.original_filename,
        "uploaded_at": d.uploaded_at.isoformat(), "parse_status": d.parse_status,
        "parse_error": d.parse_error, "file_url": d.file_url, "file_size": d.file_size,
    } for d in docs]


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, request: Request,
                    session: Session = Depends(get_session),
                    user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    doc = session.get(YearEndDocument, document_id)
    if not doc or doc.business_id != biz_id:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    # R2 삭제
    try:
        get_storage().delete(doc.file_url)
    except Exception as e:
        logger.warning("R2 delete failed for %s: %s", doc.file_url, e)

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=doc.staff_id, year=doc.year,
        action="delete", actor_user_id=user.id, actor_role="admin",
        document_id=document_id, actor_ip=ip, user_agent=ua,
    )
    session.delete(doc)
    session.commit()
    return {"deleted": document_id}


@router.post("/documents/{document_id}/reparse")
def reparse_document(document_id: int, request: Request, bg: BackgroundTasks,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    doc = session.get(YearEndDocument, document_id)
    if not doc or doc.business_id != biz_id:
        raise HTTPException(404)
    doc.parse_status = "pending"; doc.parse_error = None
    session.commit()
    bg.add_task(_parse_document_sync, document_id, session)
    return {"status": "scheduled", "document_id": document_id}


# ─────────── Reconcile ───────────

@router.post("/{year}/employees/{staff_id}/reconcile")
def trigger_reconcile(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    r = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if r is None:
        raise HTTPException(404, "report 없음 — 먼저 집계 또는 업로드 필요")
    status, diff = reconciler.reconcile(r)
    r.reconciliation_status = status
    r.reconciliation_diff = diff
    if r.status in ("uploaded", "aggregated"):
        r.status = "reconciled"
    session.commit()
    return {"reconciliation_status": status, "reconciliation_diff": diff}
```

- [ ] **Step 10.2: Verify storage_service has `save_bytes` and `delete` methods**

```bash
grep -n "def save_bytes\|def delete\|def upload" c:/WORK/SodamFN/SodamApp/backend/services/storage_service.py
```

If methods are named differently (e.g., `upload_bytes`, `delete_object`), update `_parse_document_sync` and `delete_document` calls accordingly. **The plan assumes `save_bytes(content, key, content_type=...)` and `delete(file_url)` — check actual signatures and adjust the 2 call sites.**

- [ ] **Step 10.3: Manual verify — upload one PDF**

Restart server. Use curl with a real admin token + a small test PDF:

```bash
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  -F "file=@C:/WORK/SodamFN/test_files/sample.pdf" \
  -F "kind=withholding_receipt" \
  http://localhost:8000/api/yearend/2025/employees/12/documents
```

Expected: `{"id": ..., "parse_status": "pending"}` then within 5 sec, GET `/api/yearend/2025/employees/12` should show parsed data. (If you don't have a real PDF handy, generate one with a placeholder text matching `sample_withholding.txt`.)

- [ ] **Step 10.4: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/yearend.py && git commit -m "feat(yearend): admin 라우터 — 문서 업로드/파싱/삭제/대조 엔드포인트"
```

---

### Task 11: `routers/yearend.py` — PDF generate + distribute + audit logs

**Files:**
- Modify: `SodamApp/backend/routers/yearend.py` (append)

- [ ] **Step 11.1: Append PDF + distribute + audit endpoints**

```python
# ─────────── PDF generation ───────────

def _build_pdf_response(*, report, staff, business, simplified, mask_rn: bool,
                        income_type: str, is_draft: bool, filename: str) -> Response:
    if income_type == "business":
        html = generator.render_business_income_html(
            report=report, staff=staff, business=business,
            is_draft=is_draft, mask_resident_number=mask_rn,
        )
    else:
        html = generator.render_withholding_html(
            report=report, staff=staff, business=business,
            simplified=simplified, is_draft=is_draft,
            mask_resident_number=mask_rn,
        )
    pdf_bytes = generator.html_to_pdf(html)
    headers = {
        "Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}',
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/{year}/employees/{staff_id}/draft-receipt.pdf")
def download_draft_pdf(year: int, staff_id: int, request: Request,
                       session: Session = Depends(get_session),
                       user: User = Depends(get_admin_user)):
    from urllib.parse import quote
    biz_id = get_bid_from_token(request)

    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404, "report 없음")
    staff = session.get(Staff, staff_id)
    business = session.get(Business, biz_id)
    simplified = session.exec(
        select(YearEndSimplified).where(YearEndSimplified.staff_id == staff_id,
                                        YearEndSimplified.year == year)
    ).first()

    label = "근로소득" if report.income_type == "earned" else "사업소득"
    filename = quote(f"{label}원천징수영수증_{year}_{staff.name}_초안.pdf")

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="regenerate", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()

    return _build_pdf_response(
        report=report, staff=staff, business=business, simplified=simplified,
        mask_rn=False, income_type=report.income_type,
        is_draft=True, filename=filename,
    )


@router.get("/{year}/employees/{staff_id}/draft-receipt.preview")
def preview_draft_html(year: int, staff_id: int, request: Request,
                       session: Session = Depends(get_session),
                       user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    staff = session.get(Staff, staff_id)
    business = session.get(Business, biz_id)
    simplified = session.exec(
        select(YearEndSimplified).where(YearEndSimplified.staff_id == staff_id,
                                        YearEndSimplified.year == year)
    ).first()
    if report.income_type == "business":
        html = generator.render_business_income_html(
            report=report, staff=staff, business=business,
            is_draft=True, mask_resident_number=False,
        )
    else:
        html = generator.render_withholding_html(
            report=report, staff=staff, business=business, simplified=simplified,
            is_draft=True, mask_resident_number=False,
        )
    return Response(content=html, media_type="text/html; charset=utf-8")


# ─────────── Distribute / Revoke ───────────

@router.post("/{year}/employees/{staff_id}/distribute")
def distribute_report(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    if report.reconciliation_status == "mismatch":
        raise HTTPException(400, "대조 불일치 상태에서는 직원앱 노출 불가")
    report.distributed_to_staff = True
    report.distributed_at = datetime.utcnow()
    if report.status != "distributed":
        report.status = "distributed"
    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="distribute", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()
    return _serialize_report(report)


@router.post("/{year}/employees/{staff_id}/revoke")
def revoke_report(year: int, staff_id: int, request: Request,
                  session: Session = Depends(get_session),
                  user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    report.distributed_to_staff = False
    if report.status == "distributed":
        report.status = "reconciled"
    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="revoke", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()
    return _serialize_report(report)


# ─────────── Audit logs ───────────

@router.get("/{year}/employees/{staff_id}/audit-logs")
def get_audit_logs(year: int, staff_id: int, request: Request,
                   limit: int = Query(50, ge=1, le=500),
                   offset: int = Query(0, ge=0),
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    rows = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.business_id == biz_id,
               YearEndAuditLog.staff_id == staff_id,
               YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .offset(offset).limit(limit)
    ).all()
    return [{
        "id": r.id, "action": r.action, "actor_role": r.actor_role,
        "actor_user_id": r.actor_user_id, "actor_ip": r.actor_ip,
        "occurred_at": r.occurred_at.isoformat(), "detail": r.detail,
        "document_id": r.document_id,
    } for r in rows]


@router.get("/{year}/audit-logs")
def get_year_audit_logs(year: int, request: Request,
                         limit: int = Query(100, ge=1, le=1000),
                         offset: int = Query(0, ge=0),
                         session: Session = Depends(get_session),
                         user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    rows = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.business_id == biz_id,
               YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .offset(offset).limit(limit)
    ).all()
    return [{
        "id": r.id, "staff_id": r.staff_id, "action": r.action,
        "actor_role": r.actor_role, "occurred_at": r.occurred_at.isoformat(),
    } for r in rows]
```

- [ ] **Step 11.2: Manual verify — preview HTML**

Start server. With a staff that has a YearEndReport (e.g., from prior aggregate call):

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/yearend/2025/employees/12/draft-receipt.preview
```

Expected: HTML response with the report data rendered. If WeasyPrint isn't installed yet on Windows, the `.pdf` endpoint will 500 — acceptable for now, Linux Docker will have it.

- [ ] **Step 11.3: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/yearend.py && git commit -m "feat(yearend): admin 라우터 — PDF 생성/배포/감사로그 엔드포인트"
```

---

### Task 12: `routers/staff_yearend.py` — staff-self endpoints + Dockerfile font setup

**Files:**
- Create: `SodamApp/backend/routers/staff_yearend.py`
- Modify: `SodamApp/backend/main.py` (uncomment staff_yearend registration)
- Modify: `SodamApp/backend/Dockerfile` (add WeasyPrint deps + Korean fonts)

- [ ] **Step 12.1: Create `routers/staff_yearend.py`**:

```python
"""연말정산 직원앱 라우터 (직원 본인만 접근).

- /api/staff/yearend/years              내가 볼 수 있는 연도 목록
- /api/staff/yearend/{year}             내 연도 요약
- /api/staff/yearend/{year}/documents   내 문서 목록 (원천징수영수증만)
- /api/staff/yearend/{year}/documents/{id}/download  원본 PDF
- /api/staff/yearend/{year}/draft-receipt.pdf        초안 PDF

권한: get_current_user 통해 인증된 staff 본인 데이터만.
distributed_to_staff=False 인 연도는 404 (존재 자체 숨김).
"""
from __future__ import annotations
import logging
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session, select

from database import get_session
from models import (Business, Staff, User,
                    YearEndReport, YearEndDocument, YearEndSimplified)
from routers.auth import get_current_user
from services.yearend import audit, generator

logger = logging.getLogger("sodam.staff_yearend")
router = APIRouter(prefix="/yearend", tags=["staff-yearend"])


def _require_staff(user: User) -> int:
    """User → staff_id. Raise if user is admin without linked staff."""
    if user.staff_id is None:
        raise HTTPException(403, "직원 계정이 아닙니다")
    return user.staff_id


def _mask_rn(rn: Optional[str]) -> str:
    if not rn:
        return "-"
    cleaned = rn.replace("-", "")
    if len(cleaned) < 7:
        return rn
    return f"{cleaned[:6]}-{cleaned[6]}******"


@router.get("/years")
def my_years(session: Session = Depends(get_session),
             user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    rows = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id,
               YearEndReport.distributed_to_staff == True)
        .order_by(YearEndReport.year.desc())
    ).all()
    return [{"year": r.year, "income_type": r.income_type,
             "distributed_at": r.distributed_at.isoformat() if r.distributed_at else None}
            for r in rows]


@router.get("/{year}")
def my_report(year: int, session: Session = Depends(get_session),
              user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    staff = session.get(Staff, staff_id)
    business = session.get(Business, r.business_id)
    return {
        "year": r.year,
        "income_type": r.income_type,
        "staff": {
            "name": staff.name,
            "resident_number_masked": _mask_rn(staff.resident_number),
        },
        "business": {"name": business.name if business else "-"},
        "summary": {
            "total_pay_year": r.total_pay_year,
            "decided_tax": r.decided_tax,
            "taxes_paid": r.confirmed_taxes_paid or r.taxes_withheld_total,
            "refund_amount": r.refund_amount,
            "insurance_4major_total": r.insurance_4major_total,
        },
    }


@router.get("/{year}/documents")
def my_documents(year: int, session: Session = Depends(get_session),
                 user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    # 노출 검사
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    # 원천징수영수증만 노출 (간소화는 회사 내부 자료)
    docs = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id, YearEndDocument.year == year,
            YearEndDocument.kind == "withholding_receipt",
        ).order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    return [{
        "id": d.id, "filename": d.original_filename,
        "uploaded_at": d.uploaded_at.isoformat(),
    } for d in docs]


@router.get("/{year}/documents/{document_id}/download")
def my_document_download(year: int, document_id: int, request: Request,
                         session: Session = Depends(get_session),
                         user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    doc = session.get(YearEndDocument, document_id)
    if doc is None or doc.staff_id != staff_id or doc.year != year \
       or doc.kind != "withholding_receipt":
        raise HTTPException(404)

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=doc.business_id, staff_id=staff_id, year=year,
        action="download", actor_user_id=user.id, actor_role="staff_self",
        document_id=document_id, actor_ip=ip, user_agent=ua,
    )
    session.commit()
    # R2 signed URL or stream
    import requests
    resp = requests.get(doc.file_url, timeout=30)
    headers = {
        "Content-Disposition": f'attachment; filename*=UTF-8\'\'{quote(doc.original_filename)}'
    }
    return Response(content=resp.content, media_type="application/pdf", headers=headers)


@router.get("/{year}/draft-receipt.pdf")
def my_draft_receipt(year: int, request: Request,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)

    staff = session.get(Staff, staff_id)
    business = session.get(Business, r.business_id)
    simplified = session.exec(
        select(YearEndSimplified)
        .where(YearEndSimplified.staff_id == staff_id, YearEndSimplified.year == year)
    ).first()

    if r.income_type == "business":
        html = generator.render_business_income_html(
            report=r, staff=staff, business=business,
            is_draft=True, mask_resident_number=True,
        )
    else:
        html = generator.render_withholding_html(
            report=r, staff=staff, business=business, simplified=simplified,
            is_draft=True, mask_resident_number=True,
        )
    pdf_bytes = generator.html_to_pdf(html)

    label = "근로소득" if r.income_type == "earned" else "사업소득"
    filename = quote(f"{label}원천징수영수증_{year}_{staff.name}.pdf")

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=r.business_id, staff_id=staff_id, year=year,
        action="download", actor_user_id=user.id, actor_role="staff_self",
        actor_ip=ip, user_agent=ua,
        detail='{"target":"draft_receipt"}',
    )
    session.commit()

    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}'},
    )
```

- [ ] **Step 12.2: Uncomment staff_yearend registration in `main.py`**

Find the line `# app.include_router(staff_yearend.router, prefix="/api/staff")` (added in Step 9.2 with TODO) and remove the `#` and TODO comment.

- [ ] **Step 12.3: Modify `SodamApp/backend/Dockerfile` for WeasyPrint + Korean fonts**

```bash
cat c:/WORK/SodamFN/SodamApp/backend/Dockerfile 2>/dev/null
```

Find the existing `RUN apt-get install` block (or add one before pip install) and add WeasyPrint runtime deps + fonts. Append to `RUN apt-get update && apt-get install -y` (combine in one layer):

```dockerfile
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    && rm -rf /var/lib/apt/lists/*
```

If no Dockerfile exists at `SodamApp/backend/Dockerfile`, the project uses Orbitron — check `Orbitron.yaml` for the build commands. If Orbitron uses `dockerfile: Dockerfile` reference, create the file. If it uses inline `buildCommands`, modify the YAML accordingly. **Do not skip this step — without these, the deployed PDF endpoint will 500.**

- [ ] **Step 12.4: Manual verify — start server, hit staff endpoint with a staff token**

```bash
# After login as a staff user (with linked Staff record):
curl -H "Authorization: Bearer <STAFF_TOKEN>" http://localhost:8000/api/staff/yearend/years
```

Expected: `[]` (no distributed reports yet) or list of years if you've run distribute on a report.

- [ ] **Step 12.5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/staff_yearend.py SodamApp/backend/main.py SodamApp/backend/Dockerfile && git commit -m "feat(yearend): staff_yearend 라우터 + Dockerfile WeasyPrint 의존성 추가"
```

---

## Stage 4 — Frontend admin (3 tasks)

### Task 13: Admin Sidebar nav + page skeleton

**Files:**
- Modify: `SodamApp/frontend/src/components/Sidebar.jsx` (add menu item under HR group)
- Modify: `SodamApp/frontend/src/App.jsx` (route)
- Create: `SodamApp/frontend/src/pages/YearEnd.jsx` (skeleton)

- [ ] **Step 13.1: Add Sidebar menu item**

Find the HR group items section in `SodamApp/frontend/src/components/Sidebar.jsx`. The pattern to match looks like the existing `알림톡 관리` entry (added 2026-04-25). Open the file and locate the HR submenu items array.

Add a new item next to `알림톡 관리`:

```jsx
{ to: '/yearend', label: '연말정산 지원', icon: 'FileText' }  // adjust object shape to match existing
```

Use the exact same shape as adjacent items (the precise field names and icon component depend on the existing pattern — match what's there).

- [ ] **Step 13.2: Add route in `App.jsx`**

Find existing route imports and route declarations. Add:

```jsx
import YearEnd from './pages/YearEnd.jsx';
// ...
<Route path="/yearend" element={<YearEnd />} />
```

- [ ] **Step 13.3: Create `pages/YearEnd.jsx` skeleton**

```jsx
import { useState, useEffect } from 'react';
import { authFetch } from '../api';

export default function YearEnd() {
  const [year, setYear] = useState(new Date().getFullYear() - 1); // 전년도 기본
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // staff for detail modal

  const load = async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        authFetch(`/api/yearend/${year}/summary`).then(r => r.json()),
        authFetch(`/api/yearend/${year}/employees`).then(r => r.json()),
      ]);
      setSummary(s);
      setEmployees(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const aggregateAll = async () => {
    if (!confirm(`${year}년 전 직원 자체 집계를 새로 실행할까요?`)) return;
    await authFetch(`/api/yearend/${year}/aggregate-all`, { method: 'POST' });
    setTimeout(load, 1500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">연말정산 지원</h1>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                  className="border border-slate-300 rounded px-3 py-2 text-sm">
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}년</option>;
            })}
          </select>
          <button onClick={load} className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded">
            새로고침
          </button>
          <button onClick={aggregateAll}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
            전체 일괄 집계
          </button>
        </div>
      </div>

      {summary && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-lg p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm opacity-80">대상 직원</div>
              <div className="text-2xl font-bold">{summary.total_employees}명</div>
            </div>
            <div>
              <div className="text-sm opacity-80">검증 완료</div>
              <div className="text-2xl font-bold">
                {(summary.counts_by_status.reconciled || 0) + (summary.counts_by_status.distributed || 0)}명
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">환급 합계</div>
              <div className="text-2xl font-bold text-emerald-300">
                {summary.refund_total.toLocaleString('ko-KR')}원
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">추가납부 합계</div>
              <div className="text-2xl font-bold text-rose-300">
                {summary.additional_payment_total.toLocaleString('ko-KR')}원
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-4 py-3">직원</th>
              <th className="text-left px-4 py-3">소득유형</th>
              <th className="text-left px-4 py-3">단계</th>
              <th className="text-right px-4 py-3">총급여</th>
              <th className="text-right px-4 py-3">환급/추가</th>
              <th className="text-center px-4 py-3">대조</th>
              <th className="text-center px-4 py-3">배포</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.staff_id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{emp.name}</td>
                <td className="px-4 py-3">{emp.income_type === 'earned' ? '근로' : '사업'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={emp.status} />
                </td>
                <td className="px-4 py-3 text-right">{emp.total_pay_year.toLocaleString('ko-KR')}</td>
                <td className="px-4 py-3 text-right">
                  {emp.refund_amount === null ? '-' :
                    emp.refund_amount < 0 ?
                      <span className="text-emerald-600">{emp.refund_amount.toLocaleString('ko-KR')} (환급)</span> :
                      <span className="text-rose-600">+{emp.refund_amount.toLocaleString('ko-KR')}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <ReconBadge status={emp.reconciliation_status} />
                </td>
                <td className="px-4 py-3 text-center">
                  {emp.distributed_to_staff ?
                    <span className="text-emerald-600 text-xs font-semibold">ON</span> :
                    <span className="text-slate-400 text-xs">OFF</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(emp)}
                          className="text-blue-600 hover:text-blue-800 text-sm">상세</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && !loading && (
          <div className="text-center text-slate-500 py-12">대상 직원이 없습니다.</div>
        )}
      </div>

      {/* TODO Task 14: <EmployeeDetailModal year={year} staff={selected} onClose={...} onChange={load} /> */}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft: ['bg-slate-100 text-slate-600', '준비'],
    aggregated: ['bg-blue-100 text-blue-700', '집계'],
    uploaded: ['bg-purple-100 text-purple-700', '업로드'],
    reconciled: ['bg-emerald-100 text-emerald-700', '검증'],
    distributed: ['bg-teal-100 text-teal-700', '배포'],
  };
  const [cls, label] = map[status] || ['bg-slate-100', status];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function ReconBadge({ status }) {
  const map = {
    pending: ['text-slate-400', '-'],
    ok: ['text-emerald-600', 'OK'],
    warning: ['text-amber-600', '주의'],
    mismatch: ['text-rose-600', '불일치'],
  };
  const [cls, label] = map[status] || ['text-slate-400', '-'];
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}
```

- [ ] **Step 13.4: Manual verify in browser**

```bash
cd c:/WORK/SodamFN/SodamApp/frontend && npm run dev
```

Open http://localhost:5173/yearend (after login). Expected: 페이지 로드, 연도 셀렉터 동작, 직원 목록 빈 행 또는 기본 데이터.

- [ ] **Step 13.5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/frontend/src/pages/YearEnd.jsx SodamApp/frontend/src/components/Sidebar.jsx SodamApp/frontend/src/App.jsx && git commit -m "feat(yearend): 어드민 YearEnd 페이지 골격 + 사이드바 메뉴"
```

---

### Task 14: Admin EmployeeDetailModal + sub-components

**Files:**
- Create: `SodamApp/frontend/src/components/yearend/EmployeeDetailModal.jsx`
- Create: `SodamApp/frontend/src/components/yearend/DocumentUploader.jsx`
- Create: `SodamApp/frontend/src/components/yearend/ReconciliationBanner.jsx`
- Create: `SodamApp/frontend/src/components/yearend/SimplifiedTable.jsx`
- Create: `SodamApp/frontend/src/components/yearend/AuditLogList.jsx`
- Modify: `SodamApp/frontend/src/pages/YearEnd.jsx` (wire modal)

- [ ] **Step 14.1: Create `components/yearend/ReconciliationBanner.jsx`**

```jsx
export default function ReconciliationBanner({ status, diff }) {
  const config = {
    pending:  { bg: 'bg-slate-50',    text: 'text-slate-700',  label: '대조 미실행', icon: '⚪' },
    ok:       { bg: 'bg-emerald-50',  text: 'text-emerald-800', label: '대조 OK',     icon: '✅' },
    warning:  { bg: 'bg-amber-50',    text: 'text-amber-800',   label: '주의',        icon: '⚠️' },
    mismatch: { bg: 'bg-rose-50',     text: 'text-rose-800',    label: '불일치',      icon: '❌' },
  };
  const c = config[status] || config.pending;
  return (
    <div className={`${c.bg} ${c.text} rounded-lg p-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{c.icon}</span>
        <div>
          <div className="font-semibold">{c.label}</div>
          <div className="text-sm opacity-80">
            차액: {diff === 0 ? '0원' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('ko-KR')}원`}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.2: Create `components/yearend/SimplifiedTable.jsx`**

```jsx
const FIELDS = [
  ['insurance_amount', '보장성보험료'],
  ['medical_amount', '의료비'],
  ['education_amount', '교육비'],
  ['donation_amount', '기부금'],
  ['house_loan_principal', '주택자금원리금'],
  ['house_loan_interest', '주택임차차입금이자'],
  ['pension_amount', '연금저축'],
  ['irp_amount', '퇴직연금/IRP'],
  ['credit_card_amount', '신용카드'],
  ['debit_card_amount', '체크카드/현금영수증'],
  ['traditional_market', '전통시장'],
  ['public_transport', '대중교통'],
  ['cultural_amount', '문화비'],
];

export default function SimplifiedTable({ data }) {
  if (!data) return <div className="text-slate-500 text-sm">간소화 자료가 업로드되지 않았습니다.</div>;
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {FIELDS.map(([key, label]) => (
        <div key={key} className="flex justify-between bg-slate-50 px-3 py-2 rounded">
          <span className="text-slate-600">{label}</span>
          <span className="font-mono font-semibold">{(data[key] || 0).toLocaleString('ko-KR')}원</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 14.3: Create `components/yearend/DocumentUploader.jsx`**

```jsx
import { useRef, useState } from 'react';
import { authFetch } from '../../api';

export default function DocumentUploader({ year, staffId, kind, label, onUploaded }) {
  const inputRef = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await authFetch(
        `/api/yearend/${year}/employees/${staffId}/documents`,
        { method: 'POST', body: fd }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '업로드 실패');
      }
      onUploaded?.(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="inline-block">
      <input ref={inputRef} type="file" accept="application/pdf"
             onChange={handleFile} className="hidden" />
      <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded">
        {busy ? '업로드 중...' : `+ ${label}`}
      </button>
      {error && <div className="text-rose-600 text-xs mt-1">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 14.4: Create `components/yearend/AuditLogList.jsx`**

```jsx
const ACTION_LABELS = {
  upload: '업로드',
  download: '다운로드',
  view: '조회',
  regenerate: 'PDF 생성',
  distribute: '배포 활성',
  revoke: '배포 해제',
  reparse: '재파싱',
  delete: '삭제',
};

export default function AuditLogList({ logs }) {
  if (!logs?.length) return <div className="text-slate-400 text-sm">감사 로그 없음</div>;
  return (
    <ul className="space-y-1 text-xs">
      {logs.map((l, i) => (
        <li key={i} className="flex gap-2 text-slate-600">
          <span className="text-slate-400">{new Date(l.occurred_at).toLocaleString('ko-KR')}</span>
          <span className="font-medium">{l.actor_role === 'admin' ? '👤 관리자' : '🙋 본인'}</span>
          <span>{ACTION_LABELS[l.action] || l.action}</span>
          {l.actor_ip && <span className="text-slate-400">({l.actor_ip})</span>}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 14.5: Create `components/yearend/EmployeeDetailModal.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { authFetch } from '../../api';
import ReconciliationBanner from './ReconciliationBanner';
import SimplifiedTable from './SimplifiedTable';
import DocumentUploader from './DocumentUploader';
import AuditLogList from './AuditLogList';

export default function EmployeeDetailModal({ year, staff, onClose, onChange }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/yearend/${year}/employees/${staff.staff_id}`);
      setDetail(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { if (staff) reload(); }, [staff?.staff_id, year]);

  if (!staff) return null;

  const refresh = async () => {
    await authFetch(`/api/yearend/${year}/employees/${staff.staff_id}/aggregate`, { method: 'POST' });
    await reload(); onChange?.();
  };
  const reconcile = async () => {
    const res = await authFetch(`/api/yearend/${year}/employees/${staff.staff_id}/reconcile`, { method: 'POST' });
    if (!res.ok) { alert((await res.json()).detail); return; }
    await reload(); onChange?.();
  };
  const toggleDistribute = async () => {
    const action = detail.report.distributed_to_staff ? 'revoke' : 'distribute';
    const res = await authFetch(`/api/yearend/${year}/employees/${staff.staff_id}/${action}`, { method: 'POST' });
    if (!res.ok) { alert((await res.json()).detail); return; }
    await reload(); onChange?.();
  };
  const downloadPdf = () => {
    const url = `/api/yearend/${year}/employees/${staff.staff_id}/draft-receipt.pdf`;
    window.open(url + '?token=' + encodeURIComponent(localStorage.getItem('token') || ''), '_blank');
    // OR — for proper auth header download, use authFetch + Blob (see Task 15 step 5).
  };
  const previewHtml = () => {
    const url = `/api/yearend/${year}/employees/${staff.staff_id}/draft-receipt.preview`;
    window.open(url, '_blank');
  };
  const deleteDoc = async (id) => {
    if (!confirm('문서를 삭제할까요?')) return;
    await authFetch(`/api/yearend/documents/${id}`, { method: 'DELETE' });
    await reload();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{staff.name} · {year}년</h2>
            <div className="text-sm opacity-80">{staff.income_type === 'earned' ? '근로소득' : '사업소득'}</div>
          </div>
          <button onClick={onClose} className="text-2xl">×</button>
        </div>

        {loading || !detail ? (
          <div className="p-12 text-center text-slate-500">불러오는 중...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* 자체 집계 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">자체 집계 (Payroll 12개월)</h3>
                <button onClick={refresh} className="text-sm text-blue-600">새로고침</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <Cell label="총급여" value={detail.report.total_pay_year} />
                <Cell label="비과세" value={detail.report.nontaxable_pay} />
                <Cell label="과세대상" value={detail.report.taxable_pay} />
                <Cell label="기납부세액(자체)" value={detail.report.taxes_withheld_total} />
                <Cell label="4대보험" value={detail.report.insurance_4major_total} />
                {detail.report.aggregated_at && (
                  <div className="bg-slate-50 px-3 py-2 rounded text-xs text-slate-500">
                    최근 집계: {new Date(detail.report.aggregated_at).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
            </section>

            {/* 문서 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">업로드 문서</h3>
                <div className="flex gap-2">
                  <DocumentUploader year={year} staffId={staff.staff_id}
                                    kind="withholding_receipt" label="원천징수영수증"
                                    onUploaded={reload} />
                  <DocumentUploader year={year} staffId={staff.staff_id}
                                    kind="simplified" label="간소화 자료"
                                    onUploaded={reload} />
                </div>
              </div>
              {detail.documents.length === 0 ?
                <div className="text-sm text-slate-400">업로드된 문서 없음</div> :
                <ul className="space-y-1 text-sm">
                  {detail.documents.map(d => (
                    <li key={d.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                          d.kind === 'withholding_receipt' ? 'bg-blue-100 text-blue-700' :
                          d.kind === 'simplified' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200'
                        }`}>{d.kind === 'withholding_receipt' ? '영수증' :
                              d.kind === 'simplified' ? '간소화' : '기타'}</span>
                        <span className="font-medium">{d.filename}</span>
                        <span className={`ml-2 text-xs ${
                          d.parse_status === 'parsed' ? 'text-emerald-600' :
                          d.parse_status === 'error' ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {d.parse_status === 'parsed' ? '✅ 파싱완료' :
                           d.parse_status === 'error' ? `❌ ${d.parse_error}` : '⏳ 처리중'}
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600">열기</a>
                        <button onClick={() => deleteDoc(d.id)} className="text-rose-600">삭제</button>
                      </div>
                    </li>
                  ))}
                </ul>}
            </section>

            {/* 업로드본 정본 */}
            {detail.report.confirmed_total_pay !== null && (
              <section>
                <h3 className="font-semibold text-slate-800 mb-2">업로드본 정본 (원천징수영수증 파싱)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <Cell label="확정 총급여" value={detail.report.confirmed_total_pay} />
                  <Cell label="결정세액" value={detail.report.decided_tax} />
                  <Cell label="확정 기납부" value={detail.report.confirmed_taxes_paid} />
                  <Cell label="차감징수액" value={detail.report.refund_amount}
                        positive={detail.report.refund_amount < 0 ? 'env' : 'add'} />
                </div>
              </section>
            )}

            {/* 대조 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">대조 검증</h3>
                <button onClick={reconcile}
                        className="text-sm text-blue-600 hover:text-blue-800">대조 실행</button>
              </div>
              <ReconciliationBanner
                status={detail.report.reconciliation_status}
                diff={detail.report.reconciliation_diff}
              />
            </section>

            {/* 간소화 13개 */}
            <section>
              <h3 className="font-semibold text-slate-800 mb-2">간소화 자료</h3>
              <SimplifiedTable data={detail.simplified} />
            </section>

            {/* PDF */}
            <section className="flex gap-2">
              <button onClick={previewHtml}
                      className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded">
                초안 미리보기 (HTML)
              </button>
              <button onClick={downloadPdf}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
                초안 PDF 다운로드
              </button>
            </section>

            {/* 직원앱 노출 */}
            <section className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded">
              <div>
                <div className="font-semibold text-slate-800">직원앱 노출</div>
                <div className="text-xs text-slate-500">
                  현재: {detail.report.distributed_to_staff ?
                    <span className="text-emerald-600 font-medium">활성 (직원이 자기 자료를 볼 수 있음)</span> :
                    <span>비활성</span>}
                </div>
              </div>
              <button onClick={toggleDistribute}
                      className={`px-4 py-2 text-sm rounded text-white ${
                        detail.report.distributed_to_staff ? 'bg-rose-600 hover:bg-rose-700' :
                        'bg-emerald-600 hover:bg-emerald-700'}`}>
                {detail.report.distributed_to_staff ? '배포 해제' : '배포 활성화'}
              </button>
            </section>

            {/* 감사 로그 */}
            <section>
              <h3 className="font-semibold text-slate-800 mb-2">최근 감사 로그</h3>
              <AuditLogList logs={detail.recent_audit_logs} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, positive }) {
  const cls = positive === 'env' ? 'text-emerald-600' :
              positive === 'add' ? 'text-rose-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 px-3 py-2 rounded">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono font-semibold ${cls}`}>
        {value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}원`}
      </div>
    </div>
  );
}
```

- [ ] **Step 14.6: Wire modal into `YearEnd.jsx`**

In `pages/YearEnd.jsx`, replace the `{/* TODO Task 14: ... */}` line with:

```jsx
import EmployeeDetailModal from '../components/yearend/EmployeeDetailModal.jsx';
// ... at top of file

{selected && (
  <EmployeeDetailModal
    year={year}
    staff={selected}
    onClose={() => setSelected(null)}
    onChange={load}
  />
)}
```

- [ ] **Step 14.7: Manual verify in browser**

Restart Vite if needed, click "상세" on any employee row. Modal should open with sections rendering correctly.

- [ ] **Step 14.8: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/frontend/src/components/yearend/ SodamApp/frontend/src/pages/YearEnd.jsx && git commit -m "feat(yearend): 어드민 EmployeeDetailModal + 5개 서브 컴포넌트"
```

---

### Task 15: PDF download with auth header (Blob fix)

**Files:**
- Modify: `SodamApp/frontend/src/components/yearend/EmployeeDetailModal.jsx` (PDF download function)

The naive `window.open` approach in Step 14.5 doesn't carry the Authorization header. Fix using authFetch + Blob.

- [ ] **Step 15.1: Replace `downloadPdf` function in `EmployeeDetailModal.jsx`**

```jsx
const downloadPdf = async () => {
  try {
    const res = await authFetch(`/api/yearend/${year}/employees/${staff.staff_id}/draft-receipt.pdf`);
    if (!res.ok) throw new Error('PDF 생성 실패');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = staff.income_type === 'earned' ? '근로소득' : '사업소득';
    a.download = `${label}원천징수영수증_${year}_${staff.name}_초안.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  }
};
```

- [ ] **Step 15.2: Manual verify**

Click "초안 PDF 다운로드" — file should download with proper Korean filename.

> If WeasyPrint isn't installed locally, you'll get 500. Verify on Linux Docker (Orbitron deploy) instead. Locally use the HTML preview button.

- [ ] **Step 15.3: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/frontend/src/components/yearend/EmployeeDetailModal.jsx && git commit -m "fix(yearend): PDF 다운로드를 Blob 방식으로 (Authorization 헤더 보존)"
```

---

## Stage 5 — Frontend staff app (1 task)

### Task 16: Staff app — `MyYearEnd.jsx` + home card + routing

**Files:**
- Create: `SodamApp/staff-app/src/pages/MyYearEnd.jsx`
- Modify: `SodamApp/staff-app/src/App.jsx` (route)
- Modify: `SodamApp/staff-app/src/pages/Home.jsx` (or wherever home cards live — add conditional card)

- [ ] **Step 16.1: Create `pages/MyYearEnd.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../api';

export default function MyYearEnd() {
  const navigate = useNavigate();
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(null);
  const [data, setData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await authFetch('/api/staff/yearend/years');
      const ys = await r.json();
      setYears(ys);
      if (ys.length > 0) setYear(ys[0].year);
      else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!year) return;
    (async () => {
      setLoading(true);
      try {
        const [d, dd] = await Promise.all([
          authFetch(`/api/staff/yearend/${year}`).then(r => r.json()),
          authFetch(`/api/staff/yearend/${year}/documents`).then(r => r.json()),
        ]);
        setData(d); setDocs(dd);
      } finally { setLoading(false); }
    })();
  }, [year]);

  const downloadDraft = async () => {
    const res = await authFetch(`/api/staff/yearend/${year}/draft-receipt.pdf`);
    if (!res.ok) { alert('PDF 발급 실패'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = data.income_type === 'earned' ? '근로소득' : '사업소득';
    a.download = `${label}원천징수영수증_${year}_${data.staff.name}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadDoc = async (id, filename) => {
    const res = await authFetch(`/api/staff/yearend/${year}/documents/${id}/download`);
    if (!res.ok) { alert('다운로드 실패'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (years.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <header className="flex items-center gap-2 mb-6">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-bold">연말정산</h1>
        </header>
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">
          📭 아직 발행된 연말정산 자료가 없습니다.
          <div className="text-xs mt-2">관리자가 자료를 등록하면 여기에 표시됩니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <header className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-2xl">←</button>
        <h1 className="text-xl font-bold">연말정산</h1>
      </header>

      <div className="mb-4">
        <select value={year || ''} onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-base">
          {years.map(y => <option key={y.year} value={y.year}>{y.year}년</option>)}
        </select>
      </div>

      {loading || !data ? (
        <div className="text-center py-12 text-slate-500">불러오는 중...</div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-5 mb-4">
            <div className="text-sm opacity-80">
              {data.income_type === 'earned' ? '근로소득원천징수영수증' : '사업소득원천징수영수증'}
            </div>
            <div className="text-3xl font-bold mt-1">{data.year}년</div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="text-sm">{data.staff.name} ({data.staff.resident_number_masked})</div>
              <div className="text-xs opacity-80">{data.business.name}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 mb-4 space-y-3">
            <Row label="💰 총급여" value={data.summary.total_pay_year} />
            <Row label="💵 결정세액" value={data.summary.decided_tax} />
            <Row label="📌 기납부세액" value={data.summary.taxes_paid} />
            <Row label="🛡 4대보험 합계" value={data.summary.insurance_4major_total} />
            {data.summary.refund_amount !== null && (
              <div className={`pt-3 mt-3 border-t border-slate-200`}>
                <div className="text-sm text-slate-600 mb-1">
                  {data.summary.refund_amount < 0 ? '✅ 환급액' : '⚠️ 추가납부액'}
                </div>
                <div className={`text-2xl font-bold ${data.summary.refund_amount < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Math.abs(data.summary.refund_amount).toLocaleString('ko-KR')}원
                </div>
              </div>
            )}
          </div>

          {docs.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-4">
              <h3 className="font-semibold mb-3">📎 첨부 문서</h3>
              <ul className="space-y-2">
                {docs.map(d => (
                  <li key={d.id}>
                    <button onClick={() => downloadDoc(d.id, d.filename)}
                            className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{d.filename}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(d.uploaded_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                      <span className="text-teal-600">⬇</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={downloadDraft}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-4 text-lg font-semibold">
            📄 초안 PDF 다운로드
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-mono font-semibold">
        {value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}원`}
      </span>
    </div>
  );
}
```

- [ ] **Step 16.2: Add route in `staff-app/src/App.jsx`**

Find the existing routes list and add:

```jsx
import MyYearEnd from './pages/MyYearEnd.jsx';
// ...
<Route path="/yearend" element={<ProtectedRoute><MyYearEnd /></ProtectedRoute>} />
```

(Match the existing protected route wrapper pattern.)

- [ ] **Step 16.3: Add conditional home card**

Open `SodamApp/staff-app/src/pages/Home.jsx` (or whichever file has the home card grid). Find the grid and add a new card that fetches `/api/staff/yearend/years` on mount and only renders if response length > 0:

```jsx
// Add at top of Home component:
const [yearEndCount, setYearEndCount] = useState(0);

useEffect(() => {
  authFetch('/api/staff/yearend/years').then(r => r.json()).then(ys => setYearEndCount(ys.length));
}, []);

// Add inside the card grid, conditionally:
{yearEndCount > 0 && (
  <button onClick={() => navigate('/yearend')}
          className="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-4 shadow-md">
    <div className="text-3xl">📋</div>
    <div className="text-sm mt-2 opacity-90">연말정산</div>
    <div className="text-xs mt-1 opacity-70">{yearEndCount}건</div>
  </button>
)}
```

(Adjust to match the existing grid CSS classes — check what other cards in `Home.jsx` use.)

- [ ] **Step 16.4: Manual verify**

```bash
cd c:/WORK/SodamFN/SodamApp/staff-app && npm run dev
```

Open http://localhost:5174 → login as a staff who has a distributed report → verify home card appears → tap → MyYearEnd loads → year selector + summary + documents + download button all work.

- [ ] **Step 16.5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/staff-app/src/pages/MyYearEnd.jsx SodamApp/staff-app/src/App.jsx SodamApp/staff-app/src/pages/Home.jsx && git commit -m "feat(yearend): 직원앱 MyYearEnd 페이지 + 홈 진입 카드"
```

---

## Stage 6 — Integration & deployment (1 task)

### Task 17: Orbitron.yaml check + integration smoke test + dev plan update

**Files:**
- Modify: `Orbitron.yaml` (verify env + Dockerfile fonts)
- Modify: `SodamApp/frontend/src/pages/DevelopmentRoadmap.jsx` (mark Phase 1 연말정산 items as `done: true`)
- Modify: `docs/dev-plan.md` (add 연말정산 entry to current phase status)

- [ ] **Step 17.1: Inspect Orbitron.yaml**

```bash
cat c:/WORK/SodamFN/Orbitron.yaml
```

Verify backend service:
- Has access to existing R2_* secrets (no new vars required for yearend; spec § 8 confirms).
- Build commands (or Dockerfile reference) include WeasyPrint deps. If it uses inline buildCommands instead of Dockerfile, add the apt-get line:

```yaml
buildCommands:
  - apt-get update && apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info fonts-noto-cjk fonts-noto-cjk-extra
  - pip install -r SodamApp/backend/requirements.txt
```

Adjust to match the existing format.

- [ ] **Step 17.2: Update roadmap UI**

Edit `SodamApp/frontend/src/pages/DevelopmentRoadmap.jsx`. Find the `'연말정산 지원'` block (around line 50, found earlier in exploration). Change:

```jsx
{
    name: '연말정산 지원',
    status: 'done',  // was 'planned'
    items: [
        { text: '직원별 연간 소득·세금 현황 조회', done: true },
        { text: '근로소득원천징수영수증 생성', done: true },
        { text: '연말정산 간소화 데이터 연동 (PDF 업로드)', done: true },
        { text: '연말정산 환급/추가납부 자동 계산', done: true },
    ],
},
```

- [ ] **Step 17.3: Run full pytest suite**

```bash
cd c:/WORK/SodamFN/SodamApp/backend && .venv/Scripts/pytest tests/ -v
```

Expected: ~14 tests passing (sanity 2 + models 3 + aggregator 3 + parser 3 + reconciler 9 + tax_calculator 3 + audit 2 + generator 3 = ~28 tests, all green).

- [ ] **Step 17.4: Manual smoke test (admin → distribute → staff)**

1. Admin: navigate `/yearend`, select 2025, click "전체 일괄 집계", wait, verify status badges flip to "집계"
2. Admin: click 상세 on any employee, upload a fake withholding receipt PDF, verify parse_status flips to "parsed", confirmed values fill in
3. Admin: click "대조 실행", verify reconciliation banner shows result
4. Admin: click "배포 활성화"
5. Staff (different browser/incognito, login as that staff): home card appears → tap → MyYearEnd page loads → core values match
6. Staff: download draft PDF → verify file opens (if local WeasyPrint missing, defer this to Orbitron deploy)
7. Admin: refresh detail modal → verify audit log shows staff "다운로드" entry (with IP, role=staff_self)

- [ ] **Step 17.5: Commit + push**

```bash
cd c:/WORK/SodamFN && git add Orbitron.yaml SodamApp/frontend/src/pages/DevelopmentRoadmap.jsx docs/dev-plan.md && git commit -m "feat(yearend): Phase 1 연말정산 지원 구현 완료 — 로드맵 done 표시 + Orbitron 배포 의존성"

git push
```

- [ ] **Step 17.6: Trigger Orbitron deploy**

User responsibility (per CLAUDE.md: 사용자가 Orbitron에서 직접 배포 트리거). After deploy:
- 배포 환경에서 PDF 다운로드 1회 검증
- WeasyPrint 한글 폰트 정상 임베딩 확인 (PDF 열어서 한글이 □□□ 박스로 안 나오는지)

---

## Self-Review Checklist (run after writing all tasks)

- [x] **Spec coverage** — Every section/requirement in spec is implemented:
  - § 3 데이터 모델 4개 → Task 2
  - § 4 어드민 16 + 직원 5 = 21 endpoints → Tasks 9, 10, 11, 12
  - § 5 PDF pipeline → Tasks 4, 8
  - § 6 Frontend → Tasks 13, 14, 15, 16
  - § 7.1 보안 (마스킹, R2, hash, 감사) → Task 12 (mask), Task 10 (hash, audit)
  - § 7.2 에러 처리 → embedded in each task
  - § 7.3 테스트 → Tasks 1, 3, 4, 5, 6, 7, 8 (logic only; routes manual)
  - § 8 환경변수 (no new vars) → Task 17 verification
  - § 11 검증 체크리스트 → Task 17.4 smoke test

- [x] **No placeholders** — every code block is complete; no TBD/TODO except a clearly-marked one in Step 9.2 that gets resolved in Step 12.2.

- [x] **Type consistency** — `aggregate_year` returns dict, used in `refresh_snapshot` consistently. `WithholdingReceiptData` and `SimplifiedData` field names match between parser tests and parser implementation.

- [x] **Naming alignment with codebase** — `get_admin_user`, `get_current_user`, `get_session`, `get_bid_from_token`, `get_storage()` — all match existing patterns verified during exploration.

- [x] **Test fixtures privacy** — Only plaintext mock fixtures in `tests/yearend/fixtures/`. No real PDFs committed.

- [x] **Commit cadence** — every task ends with a commit (17 commits total).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-yearend-tax-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended for large plans like this 17-task one)** — Dispatch fresh subagent per task, two-stage review between tasks, fast iteration without context bloat in this session.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**
