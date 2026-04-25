# 연말정산 지원 Phase 1 — 설계 명세

- **작성일**: 2026-04-25
- **로드맵 연결**: Phase 1 — 내부 경영관리 고도화 → "연말정산 지원" 모듈 (4개 항목 일괄 처리)
- **상태**: 설계 합의 완료, 구현 미착수
- **다음 단계**: writing-plans 스킬로 구현 계획서 작성 → 별도 세션에서 실행

---

## 1. 배경 및 목표

### 1.1 문제 정의

매년 1~2월 연말정산 시즌에 사업주(소담김밥 등 셈하나 고객)는 다음 부담을 짐:

1. 직원별 1년치 급여·공제 데이터를 수기 합산해서 세무대리인에게 전달
2. 세무대리인이 보낸 원천징수영수증 PDF 를 보관하고 직원에게 교부 (출력+카톡 전송)
3. 회사가 매월 신고한 원천징수세 합계와 세무대리인 계산이 어긋나는지 점검할 수단 없음
4. 직원이 자기 원천징수영수증을 다시 받고 싶을 때마다 사업주에게 연락

이 모든 작업이 셈하나 시스템 안에서 자동화되어야 한다는 것이 **로드맵 Phase 1 "연말정산 지원" 모듈**의 동기다.

### 1.2 Phase 1 범위

- ① 직원별 연간 소득·세금 현황 조회 (Payroll 12개월 자동 집계)
- ② 근로소득원천징수영수증 + 사업소득원천징수영수증 생성 (초안 PDF)
- ③ 연말정산 간소화 데이터 PDF 업로드 + 13개 카테고리 합계 파싱·저장
- ④ 환급/추가납부 표시 (PDF에서 추출 + 자체 집계와 대조 검증)

### 1.3 비범위 (Phase 1 에서 안 하는 것)

- 한국 세법 풀 계산 엔진 (소득공제·세액공제·인적공제 등 수십 종) — Phase A 업그레이드 시 도입
- 일용직 지급명세서 — 별도 도메인
- 홈택스 직접 신고 자동화 — 사업주가 홈택스에서 처리
- 세무대리인 시스템 직접 연동 — 사업주가 PDF 수령 후 업로드

### 1.4 핵심 설계 결정 (브레인스토밍 합의)

| # | 결정사항 | 선택 |
|---|---|---|
| Q1 | 처리 범위 | 4개 항목 모두 한 세션 |
| Q2 | 원천징수영수증 생성 방식 | **경로 C (하이브리드)**: 자체 집계 + 업로드본 정본. 향후 경로 A (자체 세법 계산)로 업그레이드 가능하게 어댑터 분리 |
| Q3 | 대상자 | 근로소득자(별지24호) + 사업소득자 3.3%(별지23호). 일용직 제외 |
| Q4 | 간소화 PDF 파싱 깊이 | **B**: 13개 카테고리 합계만 파싱·저장. 영수증 단위 풀 파싱은 미구현 |
| Q5 | 환급/추가납부 표시 | **B**: PDF 추출 + 자체 집계 대조 검증. 자체 추정 계산 안 함 |
| Q6 | 자체 발행 PDF 양식 | **C**: 별지 24/23호 유사 레이아웃, HTML→PDF (WeasyPrint) |
| Q7 | 직원앱 노출 | **B**: 직원본인 조회·다운로드. 감사 로그 자동 기록. 비밀번호 재확인 없음 |
| Q8 | 첫 적용 연도 | **C**: 다년 모델. 2025년분(이미 종결)은 일반 업로드 흐름으로 보관용 처리 |

### 1.5 향후 업그레이드 경로 (Phase A)

`services/yearend/tax_calculator.py` 의 어댑터를 `StubTaxCalculator` → `StandardKoreanTaxCalculator` 로 교체하면 자체 세법 계산이 활성화된다. 그 외 모듈(aggregator/parser/generator/reconciler/audit)은 변경 없이 재사용된다.

---

## 2. 아키텍처

### 2.1 백엔드 패키지 구조

```
SodamApp/backend/
├── routers/
│   ├── yearend.py              [NEW] 어드민 라우터 — 사업주 호출
│   └── staff_yearend.py        [NEW] 직원앱 전용 라우터 — 직원 본인만
│
├── services/yearend/           [NEW] 도메인 패키지
│   ├── __init__.py
│   ├── aggregator.py           # Payroll 12개월 → 자체 집계
│   ├── parser.py               # PDF 파싱 (영수증 + 간소화 분기)
│   ├── generator.py            # HTML→PDF 초안 생성
│   ├── reconciler.py           # 자체 vs 업로드본 대조
│   ├── tax_calculator.py       # 세법 어댑터 (Stub / Standard)
│   └── audit.py                # 감사 로그 헬퍼
│
├── templates/yearend/          [NEW] Jinja2 템플릿
│   ├── withholding_receipt_24.html.j2  # 별지 24호 (근로)
│   └── business_income_receipt_23.html.j2  # 별지 23호 (사업)
│
├── tests/yearend/              [NEW]
│   ├── test_aggregator.py
│   ├── test_parser.py
│   ├── test_reconciler.py
│   ├── test_generator.py
│   ├── test_tax_calculator.py
│   └── fixtures/                # sample PDF 3종 + 정답 dict
│
└── models.py                   # 4개 신규 테이블 추가
```

### 2.2 프론트엔드

```
SodamApp/frontend/src/                    # 어드민 (Vite, port 5173)
├── pages/YearEnd.jsx                     [NEW] 메인 페이지 (~700줄)
└── components/yearend/                   [NEW]
    ├── EmployeeDetailModal.jsx
    ├── DocumentUploader.jsx
    ├── ReconciliationBanner.jsx
    ├── SimplifiedTable.jsx
    └── AuditLogList.jsx

SodamApp/staff-app/src/                   # 직원앱 (Vite, port 5174)
└── pages/MyYearEnd.jsx                   [NEW] 본인 조회·다운로드 (~200줄)
```

### 2.3 의존성 추가

| 라이브러리 | 용도 | 비고 |
|---|---|---|
| `pdfplumber` | PDF 파싱 | 이미 사용 중 |
| `weasyprint` | HTML→PDF 변환 | **신규** — Docker 이미지에 한글 폰트 포함 필요 |
| `jinja2` | HTML 템플릿 | FastAPI 가 이미 의존 |

WeasyPrint 선택 이유: Playwright 대비 Docker 이미지 가볍고 메모리 사용량 적음. 한글 폰트 임베딩(Pretendard/NotoSansKR) 안정적.

---

## 3. 데이터 모델 (신규 테이블 4개)

### 3.1 `YearEndReport` — 직원·연도 마스터

**1 row per (staff_id, year)**. 자체 집계 스냅샷 + 업로드본 정본 + 대조 결과를 모두 보유.

```python
class YearEndReport(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("staff_id", "year", name="uq_yearend_staff_year"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    income_type: str = Field(default="earned")  # "earned" / "business"

    # 자체 집계 스냅샷 (Payroll 월별 합산)
    aggregated_at: Optional[datetime] = None
    total_pay_year: int = 0            # 연 총급여 (base_pay + bonus 합)
    taxable_pay: int = 0               # 과세대상 (= total - nontaxable)
    nontaxable_pay: int = 0            # 비과세소득 (식대 등)
    taxes_withheld_total: int = 0      # 월별 소득세+지방소득세 합 (자체 기납부세액)
    insurance_4major_total: int = 0    # NP+HI+LTI+EI 합

    # 업로드본 정본 (원천징수영수증 PDF 파싱 결과)
    confirmed_doc_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    confirmed_total_pay: Optional[int] = None
    confirmed_taxes_paid: Optional[int] = None     # 회사 신고 기납부세액
    decided_tax: Optional[int] = None              # 결정세액 (소득세+지방소득세)
    refund_amount: Optional[int] = None            # 차감징수세액 (음수=환급, 양수=추가납부)
    confirmed_at: Optional[datetime] = None

    # 대조 검증
    reconciliation_status: str = Field(default="pending")  # pending/ok/warning/mismatch
    reconciliation_diff: int = 0                            # confirmed_taxes_paid - taxes_withheld_total

    # 라이프사이클
    status: str = Field(default="draft")  # draft/aggregated/uploaded/reconciled/distributed
    distributed_to_staff: bool = Field(default=False)
    distributed_at: Optional[datetime] = None
```

**대조 임계값**: `|diff| ≤ 1,000원` → `ok`, `≤ 10,000원` → `warning`, 초과 → `mismatch` (어드민 확인 필요).

**상태 전이**:
```
draft → aggregated (자체 집계 1회 실행 후)
     → uploaded (원천징수영수증 PDF 업로드+파싱 완료)
     → reconciled (대조 실행 후, status에 무관하게)
     → distributed (어드민이 명시적으로 직원앱 노출 ON)
```

### 3.2 `YearEndDocument` — 업로드 PDF 보관

```python
class YearEndDocument(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    kind: str    # "simplified" / "withholding_receipt" / "other"
    file_url: str            # R2 storage URL
    original_filename: str
    file_size: int
    file_hash: str = Field(index=True)   # SHA256 (중복 업로드 검출)
    uploaded_by_user_id: int = Field(foreign_key="user.id")
    uploaded_at: datetime
    parse_status: str = Field(default="pending")  # pending/parsed/error
    parse_error: Optional[str] = None
    parsed_at: Optional[datetime] = None
```

**Unique 제약**: `(staff_id, year, kind, file_hash)` — 동일 파일 중복 업로드 차단. 다른 hash면 추가 보관 (이력).

### 3.3 `YearEndSimplified` — 13개 카테고리 합계

```python
class YearEndSimplified(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("document_id", name="uq_yes_doc"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="yearenddocument.id")
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)

    # 13개 카테고리 합계
    insurance_amount: int = 0       # 보장성 보험료
    medical_amount: int = 0         # 의료비
    education_amount: int = 0       # 교육비
    donation_amount: int = 0        # 기부금
    house_loan_principal: int = 0   # 주택자금 원리금
    house_loan_interest: int = 0    # 주택임차차입금 이자
    pension_amount: int = 0         # 연금저축
    irp_amount: int = 0             # 퇴직연금/IRP
    credit_card_amount: int = 0     # 신용카드
    debit_card_amount: int = 0      # 체크/현금영수증
    traditional_market: int = 0     # 전통시장
    public_transport: int = 0       # 대중교통
    cultural_amount: int = 0        # 문화비

    raw_extracted_text: Optional[str] = None  # 디버깅용
    parsed_at: datetime
```

### 3.4 `YearEndAuditLog` — 감사 로그

```python
class YearEndAuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    action: str    # upload/view/download/regenerate/distribute/revoke/reparse/delete
    actor_user_id: int = Field(foreign_key="user.id")
    actor_role: str    # "admin" / "staff_self"
    actor_ip: Optional[str] = None
    user_agent: Optional[str] = None
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    detail: Optional[str] = None    # JSON 문자열
```

**로그 대상**: upload / download / regenerate(초안 PDF 생성) / distribute / revoke / reparse / delete. 어드민의 단순 GET 조회는 로깅하지 않음.

---

## 4. API 엔드포인트

### 4.1 어드민 라우터 — `/api/yearend/*` (16개)

**조회 & 집계**

| Method | Path | 책임 |
|---|---|---|
| GET | `/api/yearend/{year}/summary` | 연도 대시보드: 직원 수, 단계별 카운트, 환급/추가납부 합계 |
| GET | `/api/yearend/{year}/employees` | 직원별 행: name/income_type/status/refund/reconciliation_status |
| GET | `/api/yearend/{year}/employees/{staff_id}` | 직원 상세: report + 문서 목록 + 간소화 13개 + 최근 감사 로그 5건 |
| POST | `/api/yearend/{year}/employees/{staff_id}/aggregate` | 자체 집계 새로고침 |
| POST | `/api/yearend/{year}/aggregate-all` | 전 직원 일괄 집계 (BackgroundTasks) |

**문서 업로드/파싱**

| Method | Path | 책임 |
|---|---|---|
| POST | `/api/yearend/{year}/employees/{staff_id}/documents` | multipart 업로드. body: `kind` 필드. 응답: 파싱 결과 |
| GET | `/api/yearend/{year}/employees/{staff_id}/documents` | 문서 목록 |
| DELETE | `/api/yearend/documents/{document_id}` | 삭제 (R2 + DB + 감사) |
| POST | `/api/yearend/documents/{document_id}/reparse` | 재파싱 |

**검증 & PDF**

| Method | Path | 책임 |
|---|---|---|
| POST | `/api/yearend/{year}/employees/{staff_id}/reconcile` | 대조 실행 → status 갱신 |
| GET | `/api/yearend/{year}/employees/{staff_id}/draft-receipt.pdf` | 초안 PDF (income_type 분기) |
| GET | `/api/yearend/{year}/employees/{staff_id}/draft-receipt.preview` | HTML 미리보기 |

**배포 관리**

| Method | Path | 책임 |
|---|---|---|
| POST | `/api/yearend/{year}/employees/{staff_id}/distribute` | `distributed_to_staff = True` |
| POST | `/api/yearend/{year}/employees/{staff_id}/revoke` | `distributed_to_staff = False` |

**감사**

| Method | Path | 책임 |
|---|---|---|
| GET | `/api/yearend/{year}/employees/{staff_id}/audit-logs` | 직원별 로그 (페이징) |
| GET | `/api/yearend/{year}/audit-logs` | 연도 전체 로그 |

### 4.2 직원앱 라우터 — `/api/staff/yearend/*` (5개)

| Method | Path | 책임 |
|---|---|---|
| GET | `/api/staff/yearend/years` | 본인의 노출된 연도 목록 (`distributed_to_staff=True`) |
| GET | `/api/staff/yearend/{year}` | 본인 연도별 요약. **주민번호 마스킹** (`850101-1******`) |
| GET | `/api/staff/yearend/{year}/documents` | 본인 문서 목록 (`kind=withholding_receipt` 만 노출) |
| GET | `/api/staff/yearend/{year}/documents/{document_id}/download` | 원본 PDF 다운로드 + 감사 로그 자동 |
| GET | `/api/staff/yearend/{year}/draft-receipt.pdf` | 초안 PDF + 감사 로그 자동 |

### 4.3 권한 가드

```python
# 어드민 (yearend.py)
user: User = Depends(require_business_admin)

# 직원본인 (staff_yearend.py)
user: User = Depends(require_staff_user)
# URL 에 staff_id 없음. user.staff_id 로만 조회.
# distributed_to_staff=False 면 404 (존재 자체 숨김)
```

---

## 5. PDF 파이프라인

### 5.1 파싱 (`services/yearend/parser.py`)

**원천징수영수증 (별지24호)**
- 입력: PDF 경로
- 추출: 인적정보 / 근무처 / 근무기간 / 총급여 / 비과세소득 / 결정세액 / 기납부세액(주현근무지) / 차감징수세액 / 4대보험 합계
- 정규식 패턴은 `PATTERNS = {"결정세액": [r"...", r"..."]}` dict 로 외부화 → 양식 변경 시 패턴 추가만으로 대응
- 누락 필드는 `None` 반환 → UI 에서 수동 보정

**간소화 자료**
- 입력: 홈택스 간소화서비스 PDF
- 추출: 13개 카테고리 합계
- 카테고리 라벨 매칭은 `CATEGORY_LABELS` dict 기반
- 직원 식별 검증: PDF 상의 성명 + 주민번호 앞6자리 ↔ `Staff.resident_number` 매칭 → 잘못된 직원 업로드 방지

**기존 코드 활용**
- `scripts/parse_yearend_tax.py` 의 정규식을 재구성 (모듈화 + dataclass 반환). 일회성 print 디버그 코드는 production 으로 가져오지 않음.

### 5.2 생성 (`services/yearend/generator.py`)

**템플릿** (`backend/templates/yearend/`)
- `withholding_receipt_24.html.j2` — 근로소득용 (별지 24호 유사)
- `business_income_receipt_23.html.j2` — 사업소득용 (별지 23호 유사)

**렌더링 섹션**
1. 타이틀 + 발행일 + 발행처
2. 인적사항 (이름/주민번호/주소/부양가족)
3. 근무처 (사업장명/사업자등록번호/대표자/근무기간)
4. 소득명세 (총급여/비과세/과세대상)
5. 공제명세 (4대보험 + 간소화 합산이 있으면 표시)
6. 세액명세 (결정세액/기납부세액/차감징수세액. 확정본 있으면 그 값, 없으면 자체 집계로 추정 + "초안" 워터마크)
7. 안내문 (정식 영수증은 홈택스/세무대리인 발급)

**스타일**
- 폰트: Pretendard + NotoSansKR (백업)
- A4 세로, 여백 20mm
- 헤더 슬레이트 `#1e293b → #334155` (CLAUDE.md 디자인 시스템 준수)
- 직원앱 다운로드 시 주민번호 마스킹

**파일명**
- 어드민: `원천징수영수증_2025_김금순_초안.pdf`
- 직원앱: `근로소득원천징수영수증_2025_김금순.pdf`

---

## 6. 프론트엔드

### 6.1 어드민 — `pages/YearEnd.jsx`

**Sidebar 메뉴 추가**: HR > 연말정산 지원 (어제 추가된 "알림톡 관리" 와 같은 그룹)

**구조**
- 상단: 연도 셀렉터 + 전체 새로고침 + 전체 일괄 집계
- 요약 대시보드: 단계별 카운트, 환급/추가납부 합계
- 직원 목록 테이블: 이름/소득유형/단계/환급/대조/배포/Action
- 직원 상세 모달:
  - 자체 집계 (Payroll 12개월) + 새로고침 버튼
  - 업로드 문서 목록 + 업로드 버튼 (영수증/간소화 분리)
  - 업로드본 정본 표시
  - 대조 검증 배너 (3색)
  - 간소화 13개 카테고리 표
  - 초안 PDF 미리보기/다운로드
  - 직원앱 노출 토글
  - 감사 로그 최근 5건

### 6.2 직원앱 — `pages/MyYearEnd.jsx`

**홈 화면 진입점**: 본인의 노출된 연도가 1개 이상일 때만 카드 표시.

**구조**
- 연도 셀렉터 (노출된 연도만)
- 본인 인적정보 (주민번호 마스킹)
- 사업장/근무기간
- 핵심 4개 수치 (총급여/결정세액/기납부세액/환급액)
- 첨부 문서 다운로드 (원천징수영수증만 노출, 간소화 미노출)
- 초안 PDF 다운로드 버튼

**디자인 톤**: Inter 폰트, 밝은 배경 + Teal 액센트, 큰 터치 영역 (CLAUDE.md staff-app 가이드 준수)

---

## 7. 보안·에러·테스트

### 7.1 보안

- **주민번호**: 평문 DB 저장 유지(기존 `Staff.resident_number` 패턴), 응답 직전에 직원앱에서만 마스킹
- **PDF 파일**: R2 비공개 버킷 + signed URL (1시간 만료)
- **업로드 검증**: MIME `application/pdf` 만, 최대 10MB, SHA256 해시로 중복 차단
- **업로드 후 비동기 파싱**: FastAPI BackgroundTasks
- **감사 로그**: 모든 다운로드/업로드/배포 액션. IP·UA·시각 기록

### 7.2 에러 처리

| 상황 | 처리 |
|---|---|
| PDF 텍스트 추출 실패 (스캔본) | `parse_status=error`, UI에 수동 입력 폴백 |
| 파싱 부분 누락 (결정세액 없음 등) | 누락 필드 표시, 어드민 수동 보정 가능 |
| 자체 vs 업로드본 차액 ±10,000원 초과 | `mismatch` + 빨간 배너 + 직원앱 자동 차단 |
| 직원앱이 distributed=False 연도 직접 URL 접근 | 404 |
| 동일 hash 중복 업로드 | 409 Conflict |
| 다른 hash 추가 업로드 (영수증 재발행 케이스) | 기존 유지 + 새 문서 추가, 어드민이 정본 선택 |
| WeasyPrint 변환 실패 | 500 + 로그, UI 에 일반 메시지 |
| Payroll 데이터 누락 월 | 0 합산, 결과에 "X개월 누락" 경고 |

### 7.3 테스트

**유닛 테스트** (`backend/tests/yearend/`)
- `test_aggregator.py` — Payroll 12행 fixture → 자체 집계 정확성
- `test_parser.py` — 별지 24/23/간소화 sample PDF 3종 → dataclass 비교
- `test_reconciler.py` — 차액 0/500/5000/15000원 → status 분기
- `test_generator.py` — 템플릿 렌더 → 핵심 키 문자열 포함
- `test_tax_calculator.py` — Stub 구현체 동작 확인

**통합 테스트**
- 업로드 → 파싱 → 대조 → 배포 → 직원앱 다운로드 → 감사 로그 E2E 1개

**테스트 안 하는 것**
- WeasyPrint 실제 PDF 변환 (느림 + Docker 의존). HTML 렌더만 검증.
- 직원앱 UI E2E.

**Fixture PII 정책**

- `tests/yearend/fixtures/` 의 sample PDF 는 **반드시 익명화된 합성 데이터** 사용. 실 직원 주민번호/이름/주소가 포함된 PDF (예: `D:\GoogleDrive\소담김밥\직원급여\2025연말정산\*.pdf`) 는 git 에 커밋하지 않는다.
- 합성 PDF 생성 방법: 위 실 PDF 1개를 PDF 편집기로 인적정보(주민번호/이름/주소)만 가짜 값으로 교체 → fixture 로 사용. 금액 등 형식 검증에 필요한 수치는 유지.
- `.gitignore` 에 `tests/yearend/fixtures/real_*.pdf` 등 패턴 추가하여 실수 방지.

---

## 8. 환경변수 (Orbitron.yaml 동기화 필요)

신규 환경변수 없음. 기존 `R2_*` 변수 재사용 (`storage_service.get_storage()` 통해).

WeasyPrint 가 Docker 이미지에 한글 폰트를 요구하므로 Dockerfile 변경 필요:
- `Pretendard.otf` 또는 `NotoSansKR-*.ttf` 를 `/usr/share/fonts/` 에 설치
- `apt-get install -y libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0` (WeasyPrint 의존)

---

## 9. 마이그레이션

신규 테이블 4개:
- `yearendreport`
- `yearenddocument`
- `yearendsimplified`
- `yearendauditlog`

기존 테이블 변경 없음. `Staff` 의 `resident_number` 등 인적정보 필드는 이미 충분.

---

## 10. main.py 라우터 등록

```python
app.include_router(yearend.router, prefix="/api")
app.include_router(staff_yearend.router, prefix="/api/staff")
```

---

## 11. 검증 체크리스트 (구현 완료 후 확인)

- [ ] 14명 직원 × 2025년 자체 집계 결과가 기존 `parse_yearend_tax.py` 출력 4명분과 일치
- [ ] 별지 24호 sample PDF 1개 업로드 → 결정세액/기납부세액/차감징수세액 정확 추출
- [ ] 간소화 sample PDF 1개 업로드 → 13개 카테고리 합계 정확 추출
- [ ] 자체 ↔ 업로드본 차액 0원/500원/15000원 케이스에서 ok/ok/mismatch 반환
- [ ] 어드민이 distribute 클릭 시 직원앱에 즉시 노출
- [ ] 직원앱에서 download 시 감사 로그 1행 추가됨
- [ ] 초안 PDF 가 별지 24호와 시각적으로 유사한 레이아웃으로 렌더링됨
- [ ] 사업소득자 1명에 대해 별지 23호 유사 레이아웃이 자동 분기 발행됨
- [ ] WeasyPrint Docker 이미지에서 한글 폰트 정상 렌더링
- [ ] Orbitron 배포 환경에서 PDF 다운로드 동작 확인

---

## 12. 다음 단계

1. **이 spec 사용자 검토 및 승인**
2. **writing-plans 스킬 호출** → 단계별 구현 계획서 작성
3. **별도 세션에서 executing-plans 로 구현 진행**
4. **구현 후 verification-before-completion 으로 체크리스트 검증**

---

## 부록 A. 브레인스토밍 Q&A 요약

| Q | 질문 | 답 |
|---|---|---|
| Q1 | 처리 범위 | (C) 4개 항목 모두 |
| Q2 | 원천징수영수증 생성 방식 | (C) 하이브리드 → 차후 (A) 자체계산 업그레이드 |
| Q3 | 대상자 | (B) 근로 + 사업소득자(3.3%) |
| Q4 | 간소화 PDF 깊이 | (B) 13개 카테고리 합계 파싱 |
| Q5 | 환급/추가납부 표시 | (B) PDF 추출 + 자체 집계 대조 검증 |
| Q6 | 자체 발행 PDF 양식 | (C) 공식 유사 레이아웃, HTML→PDF |
| Q7 | 직원앱 노출 | (B) 직원본인 다운로드 + 감사 로그 |
| Q8 | 첫 적용 연도 | (C) 다년 모델, 2025년은 일반 업로드로 흡수 |
