# 배민(배달의민족) 매출/정산 자동수집 — 디자인 스펙

- **작성일**: 2026-05-14
- **작성자**: Steven Lim + Claude
- **선행 작업**: [쿠팡이츠 자동수집](../../../SodamApp/backend/routers/coupang_eats.py) (2026-05-13 완성)
- **상태**: Design approved → Implementation plan 작성 예정

---

## 1. 목표

ceo.baemin.com (배민 사장님사이트) 에서 매일 자동으로 주문/정산 데이터를 수집하여 손익 페이지의 배민 매출·수수료 정확도를 100% 로 끌어올린다. 쿠팡이츠 자동수집과 동일한 아키텍처·운영 패턴을 따른다.

### 비목표

- 배민 공식 API 연동 (신청·승인 부담 — 추후 검토)
- 이메일 정산서 파싱 (실시간 매출 조회 불가)
- 멀티 매장 셀러 지원 (사장님 매장 1개로 가정 — 추후 확장)
- Playwright 자동 로그인 (쿠팡 경험상 봇 차단으로 무용 — YAGNI)

---

## 2. 의사결정 요약

| # | 결정 | 근거 |
|---|------|------|
| Q1 | **사장님사이트 스크래핑** (ceo.baemin.com) | 신청·승인 부담 없음, 쿠팡 코드 80% 재사용 |
| Q2 | **수동 쿠키 인증만** (Playwright 생략) | 쿠팡에서도 봇 차단으로 자동 로그인 정착 못 함. 코드 ~30% 단순. |
| - | **채널별 분리 테이블** (BaeminOrder 등) | 응답 스키마가 채널마다 다름. 통합 시 nullable 폭증. |
| - | **Cron 04:30 KST** | 쿠팡 04:00 와 30분 차이 — 차단 회피 + 부하 분산 |
| - | **store 1개 가정** | 사장님 단일 매장. 멀티는 추후 확장. |

---

## 3. 아키텍처

### 3.1 4계층

```
BaeminCredential   ← 쿠키 보관 (Fernet 암호화)
       ↓
BaeminClient       ← curl_cffi (Chrome TLS) → ceo.baemin.com
       ↓
BaeminOrder        ← 주문 raw (취소 포함)
BaeminSettlement   ← 일별 정산 (수수료 분해)
BaeminSyncLog      ← 동기화 이력
       ↓
DeliveryRevenue    ← 월별 요약 (channel="배달의민족") — 손익 페이지가 읽는 곳
```

### 3.2 데이터 흐름 (1회 sync)

```
사장님 쿠키 입력
   ↓
BaeminCredential 저장 (Fernet)
   ↓
[/sync/manual or cron]
   ↓
BaeminClient.fetch_orders(start, end, pageSize=N)  ← 페이지네이션
   ↓
upsert_orders → BaeminOrder
   ↓
upsert_revenue_from_orders → DeliveryRevenue(channel="배달의민족") total_sales/order_count 갱신
   ↓
BaeminClient.fetch_settlements(start, end)
   ↓
upsert_settlements → BaeminSettlement (수수료 분해 컬럼 채움)
   ↓
sync_delivery_revenue_to_pl(year, month) ← 손익 페이지 자동 반영
```

---

## 4. 데이터 모델

### 4.1 BaeminCredential

```python
class BaeminCredential(SQLModel, table=True):
    """배민 사장님사이트 자격증명 + 쿠키 — business 당 1건. 수동 쿠키 only."""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)
    login_id: Optional[str] = None              # 표시용 — 인증엔 미사용
    store_id: Optional[str] = None              # 배민 가맹점 ID (HAR 후 확정)
    shop_name: Optional[str] = None

    cookies_encrypted: Optional[str] = None     # Fernet(json.dumps(cookies))
    cookies_obtained_at: Optional[datetime.datetime] = None
    cookies_expires_at: Optional[datetime.datetime] = None
    last_verified_at: Optional[datetime.datetime] = None

    status: str = Field(default="active")       # active / cookie_invalid / failed
    last_failed_at: Optional[datetime.datetime] = None
    last_error_message: Optional[str] = None
    consecutive_failures: int = 0

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

**쿠팡 대비 차이점**: `password_encrypted` / `login_method` 컬럼 제거 (Q2: manual only). Playwright 코드 0줄.

### 4.2 BaeminOrder

```python
class BaeminOrder(SQLModel, table=True):
    """배민 주문 단위 raw."""
    __table_args__ = (
        UniqueConstraint("business_id", "order_id", name="uq_baemin_order"),
        Index("ix_baemin_order_biz_date", "business_id", "ordered_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)
    order_id: str = Field(max_length=64)        # 배민 주문번호

    ordered_at: Optional[datetime.datetime] = Field(default=None, index=True)
    delivered_at: Optional[datetime.datetime] = None

    total_sale_price: int = 0
    discount_amount: int = 0
    cancelled: bool = Field(default=False)

    payment_method: Optional[str] = Field(default=None, max_length=32)
    order_status: Optional[str] = Field(default=None, max_length=32)
    delivery_type: Optional[str] = Field(default=None, max_length=32)  # 배민/포장/한집

    raw_json: Optional[str] = None              # 응답 원본
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

### 4.3 BaeminSettlement

```python
class BaeminSettlement(SQLModel, table=True):
    """배민 일별 정산 + 수수료 분해. raw_json 도 보관해 컬럼 추가에 대비."""
    __table_args__ = (
        UniqueConstraint("business_id", "settlement_date", "seller_transfer_id",
                         name="uq_baemin_settlement"),
        Index("ix_baemin_settle_biz_date", "business_id", "settlement_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)

    settlement_date: datetime.date = Field(index=True)
    settlement_type: str = Field(max_length=16)  # SETTLEMENT / WITHDRAWAL 등
    amount: int = 0                              # 정산액 / 출금액
    balance: int = 0
    seller_transfer_id: Optional[str] = Field(default=None, max_length=64, index=True)

    # 수수료 분해 — 후보 (HAR 후 확정)
    total_sales: int = 0
    fee_brokerage: int = 0      # 중개수수료
    fee_payment: int = 0        # 결제수수료
    fee_delivery: int = 0       # 배달비
    fee_advertising: int = 0    # 광고비 (오픈리스트/울트라콜)
    fee_coupon_owner: int = 0   # 쿠폰 점주부담

    raw_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
```

**미확정**: HAR 캡처 후 응답 보고 컬럼 확정. raw_json 으로 우선 보관 → 추후 ALTER TABLE.

### 4.4 BaeminSyncLog

쿠팡 `CoupangEatsSyncLog` 와 동일 컬럼 구조 (이름만 변경).

---

## 5. API 라우터

`/api/baemin/*` (10개 엔드포인트)

| 엔드포인트 | 메소드 | 용도 | 권한 |
|------------|--------|------|------|
| `/credential` | POST | login_id + store 메타 등록 (PW 없음) | admin |
| `/credential` | GET | 등록 상태 + 쿠키 만료 확인 | admin |
| `/credential` | DELETE | 자격증명·쿠키 삭제 | admin |
| `/manual-cookies` | POST | 사장님 쿠키 붙여넣기 | admin |
| `/sync/manual` | POST | 기간 지정 동기화 (최대 91일) | admin |
| `/sync/cron-trigger` | POST | Orbitron cron 호출 | X-Cron-Secret |
| `/sync/logs` | GET | 동기화 이력 (최대 200건) | admin |
| `/dashboard` | GET | 잔액·예상정산·주간 합계 (응답 있는 항목만) | admin |
| `/debug/probe` | GET | 쿠키 진단 + whoami raw | superadmin |
| `/debug/raw-orders` | GET | fetch_orders 응답 raw | superadmin |

**제외**: `/test-login` — Playwright 미사용 (Q2).

**핵심 로직**: `_execute_with_action(client_fn)` 헬퍼 — 쿠팡의 `_execute_with_refresh` 단순화. 401 받으면 자동 재시도 없이 즉시 `status="cookie_invalid"` 마킹 + HTTPException 422 (사장님 쿠키 갱신 유도).

---

## 6. 프론트엔드 UI

### 6.1 외부연동 페이지 카드

쿠팡이츠 카드 옆에 동일 패턴 배민 카드 배치.

- **카드 헤더**: "배민 자동수집" + 상태 뱃지 (활성 / 쿠키만료 / 미등록)
- **자격증명 등록 폼**: 로그인 ID + (선택) 매장 ID
- **쿠키 입력 textarea**: 브라우저 F12 → Application → Cookies 복사 방법 안내문 포함
- **"지금 동기화" 버튼**: 기본 = 어제 하루, 기간 지정 옵션
- **"동기화 이력" 토글**: 최근 30건, 상태/주문 수/매출 표시
- **대시보드 미니위젯**: 오늘 매출 / 예상정산 (응답에 있으면)

### 6.2 쿠키 만료 알림

- 화면 상단 빨간 배너: "배민 쿠키 만료됨 — F12 → Cookies 다시 복사해서 입력해주세요"
- 클릭하면 카드의 쿠키 입력 폼으로 스크롤
- 2회 연속 실패 시 이메일 알림 (rate-limited)

---

## 7. 운영

### 7.1 Cron 스케줄

- **매일 04:30 KST** 자동 트리거 (쿠팡 04:00 와 30분 차이)
- 대상: `BaeminCredential.status="active"` 인 모든 사업장
- 수집 범위: 전일 1일치 (어제 ~ 어제)
- 실패 시: `SyncLog.status="failed"` 기록, 다음 사업장 계속

### 7.2 백필

- 2026-01 ~ 2026-04 백필: `/sync/manual` 두 번 분할 호출 (1~3월, 4~5월 — 91일 제한)
- 사장님이 UI 버튼으로 트리거 (자동 X — 부하 큼)

### 7.3 쿠키 만료 처리

- 401 받으면 → `status="cookie_invalid"`, `last_error_message` 기록, `consecutive_failures` 증가
- cron 은 해당 사업장 skip, 화면 알림으로 사장님 수동 갱신 유도

---

## 8. 위험 / 의존성

| 위험 | 영향 | 대응 |
|------|------|------|
| 배민 응답 스키마 모름 | service 코드 확정 불가 | HAR 캡처 받은 후 1차 구현 → `/debug/raw-orders` 로 검증 |
| 배민 봇 차단 (Akamai/Datadome) | 401 빈발 | manual cookie 유지, 갱신 빈도 측정 후 cron 시간대 조정 |
| 페이지네이션 함정 | 일부 주문 누락 | pageSize 명시 + total 비교 검증 |
| 정산 수수료 분해 항목 다름 | DB 컬럼 부족 | `raw_json` 전체 보관 + 추후 ALTER TABLE 로 컬럼 추가 |
| 다매장 사장님 (미래) | 한 자격증명에 매장 여러 개 | 1차: 첫 매장만. 추후 store list 멀티 select. |

### 8.1 사장님 작업 의존성

1. **HAR 캡처 1회** — ceo.baemin.com 로그인 후 매출/정산 페이지 클릭하면서 F12 Network HAR 저장 → 파일 전달. **블로커**.
2. **첫 쿠키 입력** — F12 → Application → Cookies → 복사. 화면 안내문이 JSON 변환 도움.
3. **쿠키 만료 시 갱신** — 화면 알림 받으면 1~2분 작업.

---

## 9. 테스트 전략

- **Service 단위 테스트**: HAR fixture 기반 — `tests/auto_collection_sync/test_baemin_normalizer.py`
- **Router 통합 테스트**: mock client 로 sync flow 검증 — `tests/auto_collection_sync/test_baemin_router.py`
- **Manual E2E**: 사장님 prod 쿠키 + `/sync/manual` 1일치 → 화면 확인

---

## 10. 작업 순서 (구현 미리보기)

1. 모델 4개 + Alembic 마이그레이션
2. `BaeminClient` 스켈레톤 (HAR 받기 전까지 URL/응답 형식 placeholder)
3. **🛑 HAR 캡처 받기** (사장님 작업 — 블로커)
4. Service 코드 확정 (`fetch_orders` / `fetch_settlements` / `parser`)
5. 라우터 + Pydantic DTO
6. 프론트엔드 카드 컴포넌트 (쿠팡 카드 컴포넌트 복제 후 수정)
7. Cron 등록 (Orbitron 배포)
8. 1일치 prod 검증 → 1개월 백필 → 1~4월 백필
9. work-log 기록 + 메모리 업데이트

---

## 11. 성공 기준

- 손익 페이지의 2026-05 배민 매출이 cron 자동수집으로 0 인 채로 표시되지 않는다 (사장님 개입 없이).
- BaeminOrder/BaeminSettlement 가 prod 에 1개월치 쌓이며, BankTransaction codef 입금과 settlement_amount 가 ±1% 이내로 일치한다.
- 쿠키 만료 시 사장님이 화면 알림 따라 2분 안에 갱신 가능.
