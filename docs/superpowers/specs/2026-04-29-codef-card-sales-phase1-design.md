# CODEF 통합 Phase 1 — 인프라 + 카드 사업자 매출 자동수집

**작성일**: 2026-04-29
**작성자**: Claude (brainstorming skill, 사용자 합의 8개 핵심 결정)
**상태**: Design 합의 완료 → Implementation plan 작성 대기
**선행 작업**: 2026-04-29 CODEF 데모 키 발급 + `.env` / `Orbitron.yaml` 환경변수 연결 완료 (commit `9aae78fa`)

---

## 0. Executive Summary

소담김밥(셈하나) 외부 통합 전략(2026-04-25 결정)의 첫 실행 단계. CODEF 마이데이터 통합 API를 카드 사업자 매출 자동수집에 적용하면서, 후속 Phase 2~5(계좌·4대보험·전자세금계산서·신분증)가 모두 공유할 인프라를 함께 구축한다.

**산출물**:
- 신규 백엔드 디렉토리 `services/codef/` + `routers/codef/` + `tasks/`
- 신규 DB 모델 4개 (`CodefConnection`, `CardMerchant`, `CodefCallLog`, `CodefBudgetSetting`)
- 기존 모델 2개 컬럼 추가 (`CardSalesApproval`, `CardPayment`에 `source` 등 4컬럼)
- 신규 프론트엔드 페이지 1개 (외부연동 hub `/external-integration`) + 매출관리 페이지 변경
- Orbitron cron 1개 (매일 23:30 KST)
- 카카오 알림톡 템플릿 1개 (장애 알림)
- CODEF 공식 SDK `easycodefpy` 의존성 추가

**Phase 1 호출량 추정**: 14개 카드사 × 1회/일(승인) + 14개 × 1회/월(청구·가맹점) ≈ **28회/일 호출** (DEMO 100회/일 한도 내 안전).

**롤아웃**: SANDBOX 코드검증(1주) → DEMO 1개 카드(1주) → DEMO 4개 카드(2주) → DEMO 14개 전체 → PRODUCT 전환 (영업 견적 후).

---

## 1. 배경 및 동기

### 1.1 사업적 배경

소담김밥은 매장 카드 매출을 현재 **Excel 업로드** 방식으로 셈하나에 입력한다 ([routers/finance.py:40,75](../../SodamApp/backend/routers/finance.py#L40)). 사장님이 매주 카드사 사이트에서 매출 내역을 다운로드 → 셈하나 업로드. 주 2-3시간 소요. 누락·실수 빈번.

CODEF 마이데이터 본허가 API로 자동화하면:

- 매장 마감 후(매일 23:30) 14개 카드사 매출이 자동 적재
- 사장님이 이튿날 아침 셈하나 들어왔을 때 어제 매출 정리됨
- Excel 업로드 작업 제거 (월 ~12시간 절약)
- **수수료율 자동 갱신** → 카드사별 비용 비교 가능 (신규 가치)

### 1.2 기술적 배경

2026-04-25 팝빌 EasyFinBank `-99010016` 차단 사건 → 단일 provider 의존 리스크 확인. 외부 통합 전략 재정립:
- **팝빌 = 발급/전송 ASP** (팩스·세금계산서·알림톡·현금영수증)
- **CODEF = 마이데이터 조회/수집** (계좌·카드매출·4대보험·홈택스 일부)
- 어댑터 패턴(`BANK_SYNC_PROVIDER` 등 환경변수 스위치)으로 단일 장애점 회피

CODEF 카드 사업자 매출은 **CODEF only 영역** (팝빌 미제공). CREFIA(여신금융협회) 직접 접근 우회 핵심.

### 1.3 선행 완료 사항 (2026-04-29 오늘)

- ✅ codef.io 회원가입 + DEMO 키 발급
- ✅ `backend/.env` CODEF 환경변수 5개 활성 (commit `9aae78fa`)
- ✅ `Orbitron.yaml` CODEF 섹션 추가 (Secrets 등록 대기)
- ✅ `.env.example` CODEF placeholder 추가 + `BANK_SYNC_PROVIDER`에 `codef` 옵션
- ❌ 어댑터 코드 0건 (본 spec이 첫 구현)

### 1.4 사용자 명시 요구사항

> "codef연결에 대한 브레인스토밍으로 철저하게 계획한 후 셈하나에 도움이 될듯한 기능은 전부 포함해서 개발해 주고 팝빌과 중복되는 기능도 둘다 별도로 구현해 각 기능에 표시만 해 주고"

- "도움 될 만한 기능 전부" → 26개 패키지 중 A 高(3) + B 中(10) + 카드 사업자 매출(별도) = 14개 영역. **본 spec은 그중 카드 매출만 다룸**. 후속 Phase 2~5에서 나머지 처리.
- "팝빌 중복 기능 둘 다 별도 구현 + 라벨 표시" → Phase 4에서 본격 적용 (전자세금계산서, 사업자 등록상태). 본 Phase 1에서는 **출처 라벨 시스템(`source` 컬럼 + UI 배지)을 미리 구축**해 후속 Phase 4에서 같은 패턴 재사용.

---

## 2. Scope Decomposition

전체 요구사항(14개 도메인 + 인프라)을 단일 spec에 욱여넣지 않고 5개 Phase로 분해. 각 Phase는 독립 spec → 독립 PR → 독립 배포.

| Phase | 범위 | 예상 | spec |
|---|---|---|---|
| **Phase 1** | **인프라 코어 + 카드 사업자 매출** (본 문서) | 2주 | `2026-04-29-codef-card-sales-phase1-design.md` |
| **Phase 2** | 계좌 거래내역 (CODEF 어댑터를 `BANK_SYNC_PROVIDER=codef`로 추가, 팝빌 EasyFinBank 백업) | 1주 | (추후) |
| **Phase 3** | 4대보험 자격득실 + 인사/임금 자동화 | 2주 | (추후) |
| **Phase 4** | 팝빌 중복 영역에도 CODEF 어댑터 병행 (전자세금계산서, 사업자등록상태) + 출처 라벨 토글 UI 본격화 | 1주 | (추후) |
| **Phase 5** | B 中 가치 묶음 (신분증 OCR/진위, 종소세 신고, 거래처 신용평가, 자금정보 등) | 3주+ | (추후, 추가 분해 가능) |

**Phase 1이 후속 모든 Phase의 토대**: OAuth2/RSA/connectedId/디스패처/UI 라벨 인프라 전부 여기서 구축. Phase 2~5는 같은 인프라 위에 어댑터만 추가.

---

## 3. 핵심 의사결정 종합 (Q1-Q8)

브레인스토밍 단계에서 사용자와 합의한 8개 핵심 결정:

| # | 영역 | 결정 |
|---|---|---|
| Q1 | 카드사 인증 UX | (C) 카드사별 자동 분기 — 간편인증 가능하면 EasyCodef Connect 위젯, 안 되면 ID/PW 폼 |
| Q2 | 동기화 트리거 | (B) Orbitron cron 매일 23:30 KST + 사장님 수동 "지금 동기화" 버튼 |
| Q3 | 출처 라벨 | (B) `source` 컬럼 + UI 배지 + 출처 필터 토글 |
| Q4 | UI 진입점 | (D) 매출관리 페이지 요약 + 신규 "외부 연동" hub 페이지 |
| Q5 | 수집 범위 | (B) 승인내역(`/b/approval`) + 청구내역(`/b/billing`) + 가맹점 정보(`/b/member-store`) |
| Q6 | 장애 알림 | (B) 화면 배지 + 카카오 알림톡 (NotificationService 재사용) |
| Q7 | 한도 보호 | (C) 카운터 + 비용 대시보드 + 월 예산 알림 (80%/100% 임계) |
| Q8 | 인프라 | (A) Orbitron cron + 신규 `CodefConnection` 테이블 (Phase 2~5 공유) |

각 결정의 옵션·트레이드오프·추천 근거는 brainstorming 대화 기록 참조.

---

## 4. 시스템 아키텍처

### 4.1 컴포넌트 다이어그램

```
┌─────────────────── 프론트엔드 (React) ──────────────────────┐
│                                                             │
│  [신규] 외부연동 Hub          매출관리 페이지               │
│   /external-integration       /sales (요약 + 동기화 버튼)   │
│         │                            │                      │
└─────────┼────────────────────────────┼──────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────── 백엔드 라우터 (FastAPI) ─────────────────┐
│                                                             │
│  /api/codef/connections       /api/codef/sync-cards         │
│  - GET  list                  - POST /run     (cron)        │
│  - POST register              - POST /manual  (사용자)      │
│  - DELETE deactivate          - GET  /history               │
│  - POST verify  (재인증)                                    │
│                                                             │
│  /api/codef/budget                                          │
│  - GET  current                                             │
│  - PUT  settings                                            │
│                                                             │
│  /api/codef/organizations/catalog                           │
└─────────────┬─────────────────────┬─────────────────────────┘
              │                     │
              ▼                     ▼
┌──── 서비스 레이어 ────────┐  ┌──── 어댑터 ──────────────────┐
│                           │  │                              │
│ codef_client.py           │  │ codef_card_provider.py       │
│ - OAuth2 토큰 관리/갱신   │  │ - approval → CardSales-      │
│ - RSA 비번 암호화         │  │   Approval                   │
│ - HTTP 호출 + 결과 코드   │  │ - billing → CardPayment      │
│   해석                    │  │ - member-store →             │
│ - 추가본인확인 응답 처리  │  │   CardMerchant (신규)        │
│                           │  │                              │
│ connection_service.py     │  │ codef_quota_service.py       │
│ - connectedId 발급/저장   │  │ - 호출 카운터 (DB)           │
│ - 카드사별 정책 매핑      │  │ - 일/월 한도 체크            │
│ - 재인증 흐름             │  │ - 비용 집계                  │
│                           │  │ - 예산 알림 트리거           │
│ organization_catalog.py   │  │                              │
│ - 카드사·은행·공공 코드↔  │  │                              │
│   라벨↔인증정책 매핑      │  │                              │
└──────────┬────────────────┘  └──────────┬───────────────────┘
           │                              │
           └─────────────┬────────────────┘
                         ▼
┌──── 외부 시스템 ────────────────────────────────────────────┐
│  CODEF API (development.codef.io for DEMO)                  │
│  - OAuth2 token endpoint                                    │
│  - /v1/kr/card/common/b/{approval,billing,member-store}     │
│                                                             │
│  Orbitron cron (매일 23:30 KST)                             │
│  - POST /api/codef/sync-cards/run                           │
│  - X-Cron-Secret 헤더 인증                                  │
│                                                             │
│  팝빌 알림톡 (NotificationService 재사용)                   │
│  - 신규 템플릿: codef_connection_expired                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 데이터 흐름 4가지

#### 1) 카드사 등록 (사장님 1회 셋업)

```
사장님 → 외부연동 hub → "신한카드 등록" 클릭
  → 백엔드: organization_catalog에서 카드사 인증정책 조회
  → 카드사가 간편인증 지원:
     EasyCodef Connect 위젯 팝업 → 카카오인증 완료 → connectedId 수신
  → 카드사가 ID/PW only:
     ID/PW 폼 노출 → 사장님 입력 → 백엔드에서 RSA 암호화 → CODEF 호출 → connectedId 수신
  → 추가본인확인 요구 시:
     SMS 코드 입력 폼 → 백엔드 → CODEF 재호출 → connectedId 확정
  → CodefConnection 테이블 저장 (status='active', auth_method 기록)
```

#### 2) 자동수집 (매일 23:30 cron)

```
Orbitron cron → POST /api/codef/sync-cards/run (X-Cron-Secret 헤더)
  → 헤더 검증
  → CodefConnection 조회: organization_type='card' AND status='active'
  → business_id별로 그룹핑
  → 각 connection에 대해 CodefCardProvider.sync_one_connection 호출
  → 카드사별로:
    a. quota_service.check_before_call (한도/예산 체크)
    b. /b/approval 호출 → CardSalesApproval 적재 (source='codef')
    c. /b/billing 호출 → CardPayment 적재 (source='codef')
    d. (월 1회만) /b/member-store → CardMerchant 갱신
    e. quota_service.record_call (CodefCallLog 적재)
  → 실패 시: connection.status='expired' or 'failed_2fa'
  → 사장님별 실패 합산 → 알림톡 1건 발송 (다중 카드사 실패해도 알림 1건으로 뭉침)
  → quota_service.check_budget_alerts (월 80%/100% 임계 검사)
```

#### 3) 수동수집 (사장님 새로고침 버튼)

```
사장님 → 매출관리 "지금 동기화" 클릭
  → POST /api/codef/sync-cards/manual (admin/owner 권한)
  → quota_service.check_cooldown (카드사별 5분 쿨다운)
  → quota_service.check_before_call (한도/예산)
  → 자동수집과 동일한 sync_one_connection 호출
  → 응답에 적재 결과 포함 → 프론트엔드가 매출 테이블 invalidate
```

#### 4) 중복 처리 + 라벨

```
적재 시 unique key = (business_id, approval_date, approval_number, card_corp)
  CODEF 호출 결과가 Excel 업로드 row와 중복:
    - 동일 amount: CODEF row insert (source='codef'), Excel row → source='excel_overridden' 마킹
    - 다른 amount: 둘 다 보존, 매출관리 행에 ⚠️ 경고 배지
  매출관리 화면 출처 필터:
    [전체] [CODEF] [Excel] [수동] 토글로 분리 보기
```

---

## 5. 데이터 모델

### 5.1 신규 테이블 4개

#### 5.1.1 `CodefConnection` — 모든 외부 통합의 토대

Phase 2~5가 같은 테이블 재사용. `organization_type` 컬럼이 도메인 분기점.

```python
class CodefConnection(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_conn_business_org", "business_id", "organization_code"),
        UniqueConstraint("business_id", "organization_code", "organization_type"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    # CODEF 분류
    organization_type: str = Field(index=True)
        # 'card' | 'bank' | 'public_health' | 'public_employment' | 'public_tax' | ...
    organization_code: str = Field(index=True)
        # CODEF 표준 코드 — 예: 신한카드 '0306', 국민은행 '0004'
    organization_label: str
        # 사람용 표시명 — '신한카드' '국민은행'

    # CODEF 자격증명
    connected_id: str  # CODEF 발급, 영구
    auth_method: str   # 'simple_auth' | 'id_pw' | 'cert'

    # 운영 상태
    status: str = Field(default="active", index=True)
        # 'active' | 'expired' | 'paused' | 'failed_2fa' | 'deactivated'
    last_verified_at: Optional[datetime.datetime] = None
    last_failed_at: Optional[datetime.datetime] = None
    last_error_code: Optional[str] = None      # CODEF result.code (예: 'CF-12100')
    last_error_message: Optional[str] = None

    # 메타
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    deactivated_at: Optional[datetime.datetime] = None
```

#### 5.1.2 `CardMerchant` — 가맹점 정보 + 수수료율

```python
class CardMerchant(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", "merchant_id"),
        Index("ix_card_merchant_business_corp", "business_id", "card_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    card_corp: str = Field(index=True)     # 신한/삼성/현대 등
    merchant_id: str                        # 가맹점번호(MID)
    merchant_name: Optional[str] = None     # 가맹점명

    # 수수료율 (셈하나 신규 활용처 — MonthlyProfitLoss 와 연동)
    fee_rate: Optional[float] = None         # 예: 0.018 (=1.8%)
    fee_rate_updated_at: Optional[datetime.datetime] = None

    # 메타
    registered_at: Optional[datetime.date] = None  # 가맹점 등록일
    status: str = Field(default="active")          # active | suspended

    source: str = Field(default="codef")            # 가맹점 정보는 CODEF only
    last_synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

#### 5.1.3 `CodefCallLog` — 호출 카운터 + 비용 집계

```python
class CodefCallLog(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_log_business_date", "business_id", "called_date"),
        Index("ix_codef_log_path_date", "api_path", "called_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")

    # 호출 식별
    api_path: str = Field(index=True)           # '/v1/kr/card/common/b/approval'
    organization_code: Optional[str] = None

    called_date: datetime.date = Field(index=True, default_factory=datetime.date.today)
    called_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    # 결과
    status: str  # 'success' | 'failed' | 'rate_limited' | 'auth_expired'
    result_code: Optional[str] = None           # CODEF result.code
    rows_returned: Optional[int] = None         # approval 110건 등

    # 비용 (PRODUCT 환경에서만 의미)
    estimated_cost_krw: Optional[int] = None
        # CODEF_PRICE_TABLE env 기반 산출 (DEMO 시 0)

    # 트리거
    triggered_by: str  # 'cron' | 'user_button' | 'registration' | 'verify'
    triggered_user_id: Optional[int] = None  # 사용자 버튼 시 누구
```

#### 5.1.4 `CodefBudgetSetting` — 월 예산 + 알림 임계값

```python
class CodefBudgetSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)

    monthly_budget_krw: int = Field(default=0)        # 0 = 무제한 (DEMO 단계)
    warning_threshold_pct: int = Field(default=80)    # 80% 도달 시 알림톡
    hard_limit_pct: int = Field(default=100)          # 100% 도달 시 자동 거부

    # 알림 추적 (중복 발송 방지)
    last_warning_sent_at: Optional[datetime.datetime] = None
    last_hardlimit_sent_at: Optional[datetime.datetime] = None
    current_month_first_day: Optional[datetime.date] = None  # 월 바뀌면 reset

    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

### 5.2 기존 모델 변경 2개

#### `CardSalesApproval` 컬럼 추가 4개 ([models.py:239](../../SodamApp/backend/models.py#L239))

```python
source: str = Field(default="excel", index=True)
    # 'codef' | 'excel' | 'manual' | 'excel_overridden'
source_meta: Optional[str] = None  # JSON 문자열, CODEF 응답 원본 일부
connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
synced_at: Optional[datetime.datetime] = None  # CODEF 적재 시각
```

#### `CardPayment` 컬럼 추가 4개 ([models.py:256](../../SodamApp/backend/models.py#L256))

`CardSalesApproval`과 동일 4개 컬럼.

### 5.3 마이그레이션 전략

셈하나 자동 마이그레이션 패턴 따름 (메모리: "linked_daily_id 컬럼 신규 + auto-migration"):

1. `database.py`의 `init_db()`에서 `SQLModel.metadata.create_all(engine)` → 신규 테이블 4개 자동 생성
2. 기존 테이블 컬럼 추가는 가드 함수로 `ALTER TABLE ADD COLUMN` (이미 있으면 skip)
3. 1회성 백필: `UPDATE cardsalesapproval SET source = 'excel' WHERE source IS NULL` (`CardPayment` 동일)

```python
def _ensure_column(engine, table, column, ddl):
    if not _column_exists(engine, table, column):
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))

# database.py 의 init_db() 끝에 호출
def _run_codef_phase1_migrations(engine):
    for table in ("cardsalesapproval", "cardpayment"):
        _ensure_column(engine, table, "source", "VARCHAR DEFAULT 'excel'")
        _ensure_column(engine, table, "source_meta", "TEXT")
        _ensure_column(engine, table, "connection_id", "INTEGER REFERENCES codefconnection(id)")
        _ensure_column(engine, table, "synced_at", "TIMESTAMP")
        with engine.begin() as conn:
            conn.execute(text(f"UPDATE {table} SET source = 'excel' WHERE source IS NULL"))
```

**롤백**: 새 컬럼은 nullable / default 있어 기존 코드와 호환. 롤백 시 DROP COLUMN 1회.

---

## 6. 백엔드 컴포넌트

### 6.1 디렉토리 구조

```
SodamApp/backend/
├── services/codef/                    [신규]
│   ├── __init__.py
│   ├── codef_client.py                # OAuth2 + RSA + HTTP + result code 해석
│   ├── connection_service.py          # connectedId 발급·저장·재인증
│   ├── quota_service.py               # 카운터·한도·비용·예산 알림
│   ├── card_provider.py               # 어댑터: approval/billing/member-store
│   └── organization_catalog.py        # 카드사·은행·공공 코드↔라벨↔인증정책 매핑
│
├── routers/codef/                     [신규]
│   ├── __init__.py
│   ├── connections.py                 # /api/codef/connections
│   ├── card_sync.py                   # /api/codef/sync-cards
│   └── budget.py                      # /api/codef/budget
│
└── tasks/                             [신규]
    └── codef_card_sync_task.py        # /api/codef/sync-cards/run의 핵심 로직
```

**왜 디렉토리 분리?**: Phase 2~5 추가 시 `services/codef/` 안에 `bank_provider.py`, `health_insurance_provider.py` 등으로 자연스레 확장. `routers/codef/`도 동일.

### 6.2 `codef_client.py` — 저수준 통신 레이어

**SDK 선택**: 공식 `easycodefpy` 사용 (`pip install easycodefpy==0.5.0`). 팝빌도 `popbill` SDK 패턴이라 일관성 ↑.

**책임**: SDK 호출 + 결과 코드 해석 + 예외 표준화. 비즈니스 로직 0%.

```python
from easycodefpy import Codef, ServiceType

class CodefClient:
    def __init__(self):
        self.client_id = os.getenv("CODEF_CLIENT_ID")
        self.client_secret = os.getenv("CODEF_CLIENT_SECRET")
        self.public_key = os.getenv("CODEF_PUBLIC_KEY")
        self.env = os.getenv("CODEF_ENV", "demo")
        self._codef = Codef()
        self._codef.set_client_info(self.client_id, self.client_secret)

    def _service_type(self) -> ServiceType:
        return {
            "sandbox": ServiceType.SANDBOX,
            "demo": ServiceType.DEMO,
            "production": ServiceType.PRODUCT,
        }[self.env]

    def encrypt_password(self, plain: str) -> str:
        """RSA 공개키로 비번 암호화 (CODEF 요구사항)"""

    def create_account(self, account_payload: dict) -> CreateAccountResult:
        """connectedId 발급. 추가본인확인 응답이면 CodefAdditionalAuth 예외"""

    def request_product(self, url: str, params: dict) -> RequestProductResult:
        """일반 API 호출. result.code 해석 → 표준 예외로 변환"""

# 표준 예외
class CodefAuthExpired(Exception): ...      # 비번/인증 만료 → 재등록 필요
class CodefAdditionalAuth(Exception): ...    # 추가본인확인 (SMS 코드 등)
class CodefRateLimited(Exception): ...      # 한도 초과
class CodefAPIError(Exception): ...          # 그 외
```

### 6.3 `connection_service.py` — connectedId 라이프사이클

```python
class CodefConnectionService:
    def register_card(self, business_id: int, card_corp: str, auth_payload: dict) -> CodefConnection:
        """
        1. organization_catalog 에서 카드사 정책 조회 (간편인증 가능?)
        2. CodefClient.create_account 호출
        3. 추가본인확인 필요 시 CodefAdditionalAuth 예외 → 라우터가 SMS 코드 입력 폼 트리거
        4. 성공 시 CodefConnection 생성/갱신
        """

    def reverify(self, connection_id: int, auth_payload: dict) -> CodefConnection:
        """비번 만료 후 재인증 — 동일 흐름이지만 기존 row update"""

    def deactivate(self, connection_id: int) -> None:
        """사장님이 해제 — status='deactivated', deactivated_at=now"""

    def list_active(self, business_id: int, organization_type: str) -> list[CodefConnection]:
        """활성 connection만 (cron이 사용)"""
```

### 6.4 `quota_service.py` — 한도·비용·예산

```python
class CodefQuotaService:
    DEMO_DAILY_LIMIT = int(os.getenv("CODEF_DEMO_DAILY_LIMIT", "100"))
    PRICE_TABLE = json.loads(os.getenv("CODEF_PRICE_TABLE", "{}"))

    def check_before_call(self, business_id: int, api_path: str) -> None:
        """
        호출 전 가드. 위반 시 CodefQuotaExceeded 예외.
        - DEMO: 일별 카운트 ≥ 100 → 거부
        - PRODUCT: 이달 비용 ≥ budget × hard_limit_pct → 거부
        """

    def check_cooldown(self, business_id: int, organization_code: str, api_path: str) -> None:
        """수동 호출 전용 5분 쿨다운"""

    def record_call(self, business_id: int, connection_id: int, api_path: str,
                    status: str, rows: int, result_code: str, triggered_by: str,
                    triggered_user_id: int | None = None) -> None:
        """호출 후 CodefCallLog 적재 + 비용 산출"""

    def check_budget_alerts(self, business_id: int) -> None:
        """월 예산 80%/100% 임계 체크 → 알림톡 트리거 (1회만)"""

    def current_month_summary(self, business_id: int) -> dict:
        """대시보드용: 호출 수, 비용, 카드사별 breakdown"""
```

### 6.5 `card_provider.py` — 카드 매출 어댑터

```python
class CodefCardProvider:
    def __init__(self):
        self.client = CodefClient()
        self.quota = CodefQuotaService()

    def sync_one_connection(self, connection: CodefConnection,
                            sync_modes: set[str] = None,
                            triggered_by: str = "cron",
                            triggered_user_id: int | None = None) -> SyncResult:
        """
        sync_modes default = {'approval', 'billing', 'member_store'} (Q5 결정).
        member_store는 month-1 호출 (월 1회면 충분).
        """

    def _sync_approval(self, connection: CodefConnection) -> int:
        """/b/approval 호출 → CardSalesApproval 적재. 반환: 신규 적재 수"""

    def _sync_billing(self, connection: CodefConnection) -> int:
        """/b/billing 호출 → CardPayment 적재. 반환: 신규 적재 수"""

    def _sync_member_store(self, connection: CodefConnection) -> int:
        """/b/member-store 호출 → CardMerchant 적재. 반환: 갱신 수"""

    def _upsert_approval(self, business_id: int, connection_id: int, codef_rows: list) -> int:
        """
        unique key = (business_id, approval_date, approval_number, card_corp)
        - 신규: source='codef' insert
        - 동일 amount의 excel 행 발견: excel 행 → source='excel_overridden'
        - 다른 amount: 둘 다 보존 (UI에서 ⚠️ 경고)
        """
```

### 6.6 라우터 엔드포인트

#### `routers/codef/connections.py`

| 메서드 | 경로 | 권한 | 용도 |
|---|---|---|---|
| GET | `/api/codef/connections` | owner/admin | 활성 connection 리스트 (organization_type 필터 가능) |
| POST | `/api/codef/connections/register` | owner | 신규 등록 (auth_payload 포함) |
| POST | `/api/codef/connections/{id}/verify` | owner | 추가본인확인 (SMS 코드 등) |
| POST | `/api/codef/connections/{id}/reverify` | owner | 만료 후 재인증 |
| DELETE | `/api/codef/connections/{id}` | owner | 해제 |
| GET | `/api/codef/organizations/catalog` | owner/admin | 카드사·은행·공공 코드 목록 (드롭다운용) |

#### `routers/codef/card_sync.py`

| 메서드 | 경로 | 권한 | 용도 |
|---|---|---|---|
| POST | `/api/codef/sync-cards/run` | `X-Cron-Secret` 헤더 | Orbitron cron 호출 |
| POST | `/api/codef/sync-cards/manual` | owner | 사용자 버튼 (5분 쿨다운) |
| GET | `/api/codef/sync-cards/history` | owner/admin | 최근 30일 동기화 이력 |

#### `routers/codef/budget.py`

| 메서드 | 경로 | 권한 | 용도 |
|---|---|---|---|
| GET | `/api/codef/budget/current` | owner/admin | 이달 호출 수/비용/카드사별 breakdown |
| PUT | `/api/codef/budget/settings` | owner | 월 예산/임계값 설정 |

### 6.7 스케줄러 (Orbitron cron)

```python
# tasks/codef_card_sync_task.py
def run_card_sync_for_all_businesses() -> SyncSummary:
    """
    1. CodefConnection 조회: organization_type='card' AND status='active'
    2. business_id 별로 그룹핑
    3. 각 connection에 대해 CodefCardProvider.sync_one_connection 실행
    4. 사장님별 실패 합산 → 알림톡 1건 (다중 카드사 실패해도 알림 1건)
    5. quota_service.check_budget_alerts (월 80%/100% 검사)
    """
```

라우터 `/api/codef/sync-cards/run`은 thin wrapper — `X-Cron-Secret` 검증 후 위 함수 호출.

### 6.8 알림 통합 (Q6)

`NotificationService` 재사용 ([services/notification_service.py](../../SodamApp/backend/services/notification_service.py)). 알림톡 템플릿 신규 1개:

```
템플릿명: codef_connection_expired
내용:
  [셈하나]
  #{card_corp} 자동 매출 수집이 중단되었습니다.

  ▸ 사유: #{reason}
  ▸ 발생 시각: #{occurred_at}

  매출 누락을 막기 위해 셈하나에 접속해서 재인증해 주세요.
  https://sodamfn.twinverse.org/external-integration
```

PoC 코드 작업과 동시에 팝빌 콘솔에서 템플릿 신규 등록 → 영업일 2-3일 검수.

---

## 7. 프론트엔드

### 7.1 디렉토리 구조

```
SodamApp/frontend/src/
├── pages/
│   ├── ExternalIntegration.jsx           [신규] hub 페이지
│   ├── CardModuleDetail.jsx              [신규] 카드 매출 디테일
│   └── revenue/...                       [기존 변경]
│
├── components/external-integration/      [신규]
│   ├── BudgetSummaryCard.jsx
│   ├── ModuleGrid.jsx
│   ├── CardModule.jsx
│   ├── CardConnectionList.jsx
│   ├── CardConnectionRegisterModal.jsx
│   ├── AdditionalAuthStep.jsx
│   ├── BudgetSettingsModal.jsx
│   └── SyncHistoryDrawer.jsx
│
└── components/revenue/                   [기존 변경]
    ├── SalesPageHeader.jsx               # + "지금 동기화" + 출처 필터
    ├── SalesTableRow.jsx                 # + 출처 배지, 차이 경고
    └── SourceBadge.jsx                   [신규] 재사용 컴포넌트
```

### 7.2 외부연동 Hub (`/external-integration`)

**사이드바 메뉴 신규**: "🔌 외부 연동" 메뉴 + 5개 서브메뉴 (Phase 1만 활성, Phase 2~5는 placeholder).

**레이아웃**:
- 헤더: 이달 사용량 카드 (호출 수, 비용 진행 바, DEMO/PRODUCT 환경 표시)
- 모듈 그리드: 5개 (카드 / 계좌 / 4대보험 / 전자세금계산서 / 신분증)
- 각 모듈: 활성 카드사 수, 만료 알림, [관리] 버튼 (Phase 2~5는 [준비중])

### 7.3 카드 매출 모듈 디테일 (`/external-integration/cards`)

- 등록된 카드사 리스트 (상태 배지 + 마지막 수집 시각 + 가맹점 수/수수료율)
- [+ 카드사 등록] 버튼
- 각 카드사: [재인증] [해제] 버튼
- [최근 동기화 이력 보기] → 우측 drawer

### 7.4 카드사 등록 모달 (Q1 자동 분기)

**1단계**: 카드사 선택 드롭다운. 선택 시 `organization_catalog` 정책에 따라 가용 인증 수단 표시.

**2단계 (간편인증 지원 카드사)**:
- 옵션 버튼: [카카오 간편인증] [네이버] [PASS] [ID/PW]
- 클릭 시 EasyCodef Connect 위젯 팝업 (CODEF 표준 흐름)
- 위젯 완료 후 백엔드가 connectedId 수신

**2단계 (ID/PW only 카드사)**:
- ID/비번 폼
- "비번은 RSA 암호화 후 즉시 폐기됩니다" 안내
- 백엔드: 메모리에서 RSA 암호화 → CODEF 호출 → connectedId 수신 → 비번 폐기

**추가본인확인 단계**:
- CODEF가 SMS 코드 요구 시 6자리 코드 입력 폼
- `POST /api/codef/connections/{id}/verify` 호출

### 7.5 매출관리 페이지 변경

- **페이지 헤더**: "마지막 동기화: 3시간 전 (CODEF 자동) [지금 동기화]" 버튼 추가
- **출처 필터**: [전체] [CODEF] [Excel] [수동] 토글
- **각 행**: `<SourceBadge>` 컴포넌트로 출처 표시
- **차이 경고**: 동일 (date, approval_number)에 amount 다르면 ⚠️ 마커 + 툴팁
- **차이 해결**: 사장님이 한 쪽 신뢰 선택 → source 변경 (감사 로그)

### 7.6 디자인 토큰 (CLAUDE.md 디자인 컨텍스트)

- 폰트: **Pretendard** (Admin 표준)
- 팔레트: **Slate** + **Blue** primary
- 배지 색:
  - CODEF: `bg-blue-100 text-blue-800` (자동수집 = 신뢰)
  - Excel: `bg-slate-200 text-slate-700` (수동 업로드)
  - 수동: `bg-amber-100 text-amber-800` (직접 입력)
  - excel_overridden: `bg-slate-100 text-slate-400 line-through` (보존하지만 inactive)
- 글씨 크기 최소 14px (40-50대 사용자)
- 터치 영역 44px (모바일 어드민 대비)

### 7.7 상태 관리

셈하나 패턴 따름 — `useState` + `axios`. React Query·Redux 도입 안 함.

- `CardConnectionList`: 진입 시 `GET /api/codef/connections?organization_type=card`, 폴링 30초 간격
- 동기화 버튼 클릭: `POST /api/codef/sync-cards/manual` → 응답 후 매출 테이블 다시 fetch
- 카드사 등록 후: `connections` 리스트 invalidate

### 7.8 라우팅

```jsx
// frontend/src/App.jsx
<Route path="/external-integration" element={<ExternalIntegration />} />
<Route path="/external-integration/cards" element={<CardModuleDetail />} />
```

---

## 8. 운영

### 8.1 환경변수 추가 (Phase 1)

이미 추가된 5개 (오늘 commit `9aae78fa`):
- `CODEF_ENV`, `CODEF_API_HOST`, `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_PUBLIC_KEY`

Phase 1에 추가 필요한 4개:

| 변수 | 위치 | 값 | 용도 |
|---|---|---|---|
| `CRON_SHARED_SECRET` | `.env` + Orbitron secrets | 32자 random (`secrets.token_urlsafe(32)`) | cron 엔드포인트 인증 |
| `CODEF_PRICE_TABLE` | `.env` + `Orbitron.yaml` env | JSON `{}` (DEMO) | API별 단가 (PRODUCT 견적 후 입력) |
| `CODEF_DEMO_DAILY_LIMIT` | `.env` + `Orbitron.yaml` env | `100` | DEMO 한도 (변경 시 1곳만) |
| `NOTIFICATION_TEMPLATE_CODEF_EXPIRED` | `.env` + Orbitron secrets | 팝빌 검수 후 받는 templateCode | 알림톡 발송 |

`.env.example` 업데이트도 함께 (placeholder 4개 추가).

### 8.2 Orbitron Cron 설정 (한 번)

```
대시보드 → Cron Jobs → New Job
  Name:      codef-card-sync-daily
  Schedule:  30 23 * * *      (매일 23:30 KST)
  Command:   curl -X POST https://sodamfn.twinverse.org/api/codef/sync-cards/run \
             -H "X-Cron-Secret: $CRON_SHARED_SECRET" \
             --max-time 600 \
             -f -s
  Timeout:   10 min
  Retry:     실패 시 1회 재시도 (5분 후)
```

**왜 23:30?**: 매장 마감 후 + 카드사 정산 시간(00:00~02:00) 직전 → 데이터 신선 + 사장님 다음날 아침에 정리됨.

### 8.3 알림톡 템플릿 등록 (병행 작업)

코드 작업 중에 검수 진행:

1. 팝빌 관리 콘솔 → 알림톡 템플릿 → 신규 등록
2. 본문 (§ 6.8 참조)
3. 카카오 검수 영업일 **2-3일**
4. 승인 후 templateCode 받아 `.env` + Orbitron secrets에 입력
5. 미승인 상태에선 화면 배지만 작동 (graceful degradation)

### 8.4 보안

| 영역 | 정책 |
|---|---|
| **카드사 비번** | 사장님 폼 입력 → 백엔드 메모리에서 RSA 즉시 암호화 → CODEF 전달 → 메모리 폐기 (DB 저장 절대 X) |
| **connectedId** | DB 평문 저장 OK (이게 자체로 비번이 아님 — CODEF가 토큰으로 처리) |
| **OAuth2 access_token** | DB 저장 X, 메모리 캐시 (1주 만료, SDK 자동 갱신) |
| **CRON_SHARED_SECRET** | 32자 random, Orbitron secrets만 |
| **Cron 엔드포인트** | `X-Cron-Secret` 헤더 일치 검증, 일치 안 하면 403 |
| **추가본인확인 SMS 코드** | 사장님 폼 입력 → 즉시 CODEF 전달 → 메모리 폐기 |
| **감사 로그** | `CodefCallLog`에 모든 호출 기록 → 누가/언제/어디로 호출했는지 100% 추적 |

### 8.5 호출 한도 운영

#### DEMO 단계 (현재)
- 일별 한도: 100회
- 월 비용: 0원
- 14 카드사 자동수집 = ~28회/일 << 100 안전
- 사용자 수동 버튼: 카드사별 5분 쿨다운

#### PRODUCT 전환 시 (1-2개월 후)
1. 영업 견적 받음 → `CODEF_PRICE_TABLE` env 업데이트
2. 사장님이 외부연동 hub에서 월 예산 설정 (예: 50,000원)
3. 80% 도달 → 알림톡 1건 ("이달 외부연동 비용 40,000원 도달")
4. 100% 도달 → 자동 수집 일시 중지 + 알림톡 + 화면 배지
5. 사장님이 예산 증액 또는 다음달 자동 재개

#### 비용 시뮬레이션 (PRODUCT 환경 추정)
- 14 카드사 × 1회/일(승인) × 50원 = **21,000원/월**
- 14 카드사 × 1회/월(청구) × 100원 = **1,400원/월**
- 14 카드사 × 1회/월(가맹점) × 50원 = **700원/월**
- **합계 ~23,000원/월** (단가 추정치, 실제는 영업 견적)
- 사장님이 매출 관리에 손으로 쓰던 시간(주 2-3시간) 대비 매우 저렴

### 8.6 의존성 추가

`SodamApp/backend/requirements.txt`:
```
easycodefpy==0.5.0
```

기타 추가 의존성 없음 — `httpx`, `sqlmodel`, `fastapi`, `popbill`은 이미 있음.

### 8.7 테스트 전략

#### 단위 테스트 (mock)
- `codef_client_test.py` — RSA 암호화 검증, result.code → 예외 매핑
- `quota_service_test.py` — 한도/쿨다운/예산 임계 로직
- `card_provider_test.py` — 적재 시 중복 처리, source 라벨링, excel_overridden 마킹

#### 통합 테스트
- `test_card_sync_flow.py` — `easycodefpy.SANDBOX` 환경으로 실제 호출 → DB 적재 검증
- `test_connection_register.py` — 등록 → connectedId 수신 → DB 저장
- 추가본인확인 시뮬레이션

#### 수동 검증 (PoC 단계)
1. SANDBOX 환경에서 모든 흐름 검증 (가짜 데이터)
2. DEMO 환경에서 **소담김밥 실제 신한카드 1개**만 등록 → 7일간 자동수집 검증
3. 데이터 품질 비교 (Excel 업로드분 vs CODEF 자동분)
4. 5일 후 → 삼성/현대/KB 추가 → 4개 카드사 운영
5. 1개월 후 → 14개 전체 등록

#### 회귀 테스트
- 기존 Excel 업로드 흐름이 깨지지 않는지 ([routers/finance.py:40,75](../../SodamApp/backend/routers/finance.py#L40))
- 매출관리 페이지의 기존 통계 그래프가 새 source 컬럼 도입 후에도 정상

### 8.8 모니터링

`/external-integration` hub에 자동 노출:
- 이달 호출 수 / 이달 비용 / 일별 추이 그래프
- 카드사별 마지막 성공 시각
- 누적 실패 카드사 리스트 (재인증 액션 CTA)
- 일별 동기화 이력 drawer (`CodefCallLog` 기반, 최근 30일)

별도 관리자용 모니터링은 PoC 결과 후 추가.

### 8.9 롤아웃 단계 (4단계)

| 단계 | 환경 | 카드사 수 | 기간 | 검증 항목 |
|---|---|---|---|---|
| 1. 코드 검증 | SANDBOX | 0 (mock) | 1주 | 단위·통합 테스트 통과 |
| 2. 첫 PoC | DEMO | 1 (신한) | 1주 | 데이터 품질, 자동수집 안정성 |
| 3. 확장 PoC | DEMO | 4 (신한·삼성·현대·KB) | 2주 | 다중 카드사 동시 운영, 알림 흐름 |
| 4. 전체 운영 | DEMO → PRODUCT | 14 전체 | - | PRODUCT 견적 받고 전환 결정 |

각 단계 끝에 사용자 승인 받고 다음으로.

---

## 9. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| `easycodefpy` SDK 버그 / 미지원 카드사 | 일부 카드사 등록 불가 | SANDBOX 환경에서 14개 카드사 사전 검증, 미지원 카드사는 organization_catalog에서 비활성 |
| 카카오 알림톡 템플릿 검수 거절 | 장애 알림 지연 | 화면 배지로 graceful degradation, 검수 본문 보수적 작성 |
| Orbitron cron 설정 실수 (시각/secret) | 자동수집 누락 | 첫 1주 사용자가 수동 버튼으로 보강, hub 페이지 "마지막 cron 실행" 표시 |
| 데모 100회/일 한도 초과 (디버깅 중) | 정상 호출도 막힘 | quota_service가 자동 거부 + 알림톡, SANDBOX에서 디버깅 |
| RSA 암호화 키 노출 | 카드사 비번 위험 | RSA public_key는 공개여도 OK (비밀키는 CODEF만 보유), 비번은 메모리 폐기 |
| 카드사 비번 변경 누적 (사장님이 며칠 모름) | 매출 누락 | 자동 재시도 1-2회 → 알림톡 + 화면 배지로 즉시 인지 |
| `CardSalesApproval` source 컬럼 추가가 기존 통계 깨뜨림 | 매출관리 통계 오류 | 회귀 테스트, 기본 default='excel' 백필로 기존 행 호환 |
| Phase 2 와서 `CodefConnection` 스키마 변경 필요 | 마이그레이션 부담 | `organization_type`/`organization_code`로 도메인 확장 가능하게 설계 — 컬럼 추가 거의 불필요 예상 |

---

## 10. 다음 단계 — Implementation Plan 작성

본 design 문서는 **structural 결정의 집합**. 구현 순서·의존성·테스트 진행은 별도 implementation plan에서 다룬다.

`writing-plans` skill 호출 → 다음 산출물:
- 단계별 구현 todo 리스트
- 각 단계의 acceptance criteria
- 의존성 그래프 (어느 컴포넌트부터 만들어야 하는지)
- 리뷰 체크포인트

---

## 11. 후속 Phase 연결

본 Phase 1이 후속 Phase 2~5의 토대를 제공:

- **Phase 2 (계좌 거래내역)**: `CodefConnection`에 `organization_type='bank'` row 추가 + `services/codef/bank_provider.py` 어댑터 + `services/bank_sync_service.py`의 `_PROVIDERS` dict에 `codef` 등록 → 라우터 0줄 수정
- **Phase 3 (4대보험)**: `organization_type='public_health'` / `'public_employment'` row + `health_insurance_provider.py` + Staff 모델 자동 토글 로직
- **Phase 4 (팝빌 중복 영역)**: 본 Phase 1에서 구축한 `source` 컬럼 패턴이 `TaxinvoiceRecord` 등에도 적용 — `source='popbill' | 'codef'` 토글
- **Phase 5 (B 中 가치)**: 신분증 OCR/진위, 종소세 신고 등 — 같은 인프라 위에 새 어댑터만

---

## 12. 참조

### 외부 문서
- CODEF 개발자 포털: https://developer.codef.io/
- `easycodefpy` GitHub: https://github.com/codef-io/easycodefpy
- llm-wiki SSOT: `C:/WORK/llm-wiki/40-Tools/CODEF.md` (가격, 카탈로그)
- llm-wiki 비교: `C:/WORK/llm-wiki/40-Tools/Popbill-vs-CODEF.md`

### 셈하나 내부 문서
- 외부 통합 전략 결정: `docs/dev-plan.md` § 외부 통합 전략
- 26개 패키지 우선순위: `docs/dev-plan.md` § CODEF 26개 패키지 상품 카탈로그
- 팝빌 모듈 매트릭스 (참고): 메모리 `project_popbill_modules.md`

### 코드 참조 (기존)
- 기존 카드 매출 모델: [`models.py:239-268`](../../SodamApp/backend/models.py#L239-L268)
- 기존 Excel 업로드 흐름: [`routers/finance.py:40,75`](../../SodamApp/backend/routers/finance.py#L40)
- 기존 어댑터 패턴 (참고): [`services/bank_sync_service.py:509-525`](../../SodamApp/backend/services/bank_sync_service.py#L509-L525)
- 알림 인프라 (재사용): [`services/notification_service.py`](../../SodamApp/backend/services/notification_service.py)
- 환경변수 설정 (선행 완료): [`backend/.env`](../../SodamApp/backend/.env), [`Orbitron.yaml`](../../Orbitron.yaml)
- 환경변수 sample: [`backend/.env.example`](../../SodamApp/backend/.env.example)

### 환경변수 추가 작업 commit
- `9aae78fa` (2026-04-29): infra(codef): 데모버전 환경변수 추가 - Orbitron + .env.example
