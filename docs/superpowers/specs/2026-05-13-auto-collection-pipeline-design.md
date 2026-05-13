# 자동수집 → 손익반영 파이프라인 설계

| 항목 | 내용 |
|------|------|
| **문서 상태** | 사장님 승인 대기 (6개 섹션 구두 승인 완료 — 입금 모니터링 포함) |
| **작성일** | 2026-05-13 |
| **대상 시스템** | 셈하나(SEMHANA) — `c:\WORK\SodamFN` |
| **다음 단계** | writing-plans 스킬로 단계별 구현 계획 생성 |

---

## 1. 배경 — 왜 이 작업이 필요한가

코덱스 코드 리뷰(P1·P2 6건) 후속 검증 과정에서 자동수집 시스템에 **구조적 단절**이 있다는 사실이 드러났다.

### 1.1 현재 상태

- **자동수집은 잘 작동한다**: EasyPOS POS, 쿠팡이츠 정산, 은행 거래내역이 cron으로 매일 수집되어 raw 테이블(`EasyPosSaleReceipt`, `CoupangEatsOrder`, `BankTransaction`)에 정상 적재된다.
- **그러나 매출관리 화면에는 닿지 않는다**: 매출관리 ([revenue.py:113](../../../SodamApp/backend/routers/revenue.py#L113), [revenue.py:199](../../../SodamApp/backend/routers/revenue.py#L199))은 `DailyExpense` 테이블만 본다. 자동수집된 데이터가 적재되는 `Revenue` 테이블은 매출관리에서 읽지 않는다("Revenue table reads REMOVED — DailyExpense is single source of truth" 주석 명시).
- **단, 손익 화면 일부는 Revenue를 본다**: [profitloss.py:329-358](../../../SodamApp/backend/routers/profitloss.py#L329-L358)의 `/delivery/{channel}/{year}[/{month}]` 엔드포인트는 Revenue 테이블을 직접 읽는다. 즉 Revenue 테이블 사용은 **혼재** 상태이고, source of truth가 한 곳에 통일되지 않음.
- **결과**: cron이 매일 잘 돌지만 사장님은 여전히 매출/매입을 수동 입력 중이고, 화면별로 데이터 출처가 달라 정합성이 어긋난다. 자동수집의 가치가 실제로 흘러가지 않는다.

### 1.2 수수료 산정의 비합리성

- **카드 수수료**: `(이번달 카드매출 합계 − 이번달 카드사 입금 합계)` 월별 역산 ([finance.py:108](../../../SodamApp/backend/routers/finance.py#L108)). 카드사 입금이 D+2~5일 후에 발생하므로 월말 매출이 다음 달 입금에 잡혀 **월별 수수료가 들쭉날쭉**해진다.
- **카드사별 차등 수수료율 미반영**: BC/삼성/신한/롯데 등 카드사마다 다른 우대 수수료율을 통째로 묶어 평균치만 본다.
- **배달앱 수수료**: `DeliveryRevenue.total_fees`가 어디서 채워지는지 불명확. 중개수수료/결제수수료/배달비/광고비/멤버십이 한 덩어리로 묶여 항목별 분석 불가.

---

## 2. 합의된 결정 사항 (4개)

브레인스토밍 단계에서 확정한 핵심 결정.

| # | 결정 | 의미 |
|---|------|------|
| 1 | **자동수집 채널 = EasyPOS + 쿠팡이츠 + 은행 계좌거래내역** | 3채널 모두 자동수집 → 손익 반영 파이프라인의 정식 채널 |
| 2 | **은행 입금내역 = 채널이자 수수료 산정 재료** | 시점 보정(D+N일 매칭)으로 카드/배달 수수료의 실측 근거 |
| 3 | **수수료 산정 재설계 = A+B+C+D 전부** | 카드사별 차등율, 승인일 기준, 배달앱 항목별 분해, **사장님 입력 불필요** (자동 추정) |
| 4 | **마이그레이션 정책 = B (덮어쓰기 + 백업 보존)** | 자동수집으로 1월부터 다시 가져와 기존 수동을 덮어쓰되, 옛 행은 `source='manual_overwritten'`으로 백업 |

---

## 3. 아키텍처 — 옵션 3 (분류 기반 fan-out)

### 3.1 큰 그림

```
[Cron 03:00] EasyPOS Service   → EasyPosSaleReceipt (raw)
[Cron 03:10] 쿠팡이츠 Service   → CoupangEatsOrder/Settlement (raw)
[Cron 03:20] BankSync Service  → BankTransaction (raw, 기존)
[Cron 03:25] 은행 자동 분류    → tx.classified_as 설정 (기존)

[Cron 03:30] orchestrator      ┐
   │  채널별 normalizer 호출    │
   │  raw → SyncEvent 표준 DTO  │
   │                            ├→ fan_out.py
   │                            │     ├→ DailyExpense (매출/비용)
   │                            │     ├→ CardPayment (카드 입금)
   │                            │     ├→ PayPayment (페이 입금)
   │                            │     └→ DeliveryRevenue (월별 정산)
   │                            │
   │                            └→ fee_estimator.py (수수료 자동 추정)
   │                                  ├→ 경로 1: CODEF 명세서 fees
   │                                  ├→ 경로 2: 입금↔승인 매칭 역산
   │                                  └→ 경로 3: CardFeeRateLearned (학습값)
   │
[Cron 03:40] 손익 재계산         → MonthlyProfitLoss
[Cron 03:45] 사장님 텔레그램 알림 → 수집 건수 + 실패 채널 요약
[Cron 일요일 04:00] 수수료율 학습 갱신
```

### 3.2 옵션 3을 선택한 이유

1. **이미 코드 70% 깔려 있음**: [bank_sync.py:946 `_sync_classified_to_models`](../../../SodamApp/backend/routers/bank_sync.py#L946)가 정확히 이 패턴이고 검증된 상태. EasyPOS·쿠팡이츠를 같은 패턴으로 흡수.
2. **재처리 능력**: 분류 룰을 고치면 raw는 그대로 두고 분류만 다시 돌려서 손익 전체 재산출 가능.
3. **등급 전환 단순**: "자동 등급"은 orchestrator cron 활성, "수동 등급"은 비활성. 같은 테이블 한 곳(`DailyExpense`)만 보면 됨.
4. **신규 채널 확장 = 파일 하나**: 배민/요기요/땡겨요 API 통합 시 `normalizers/{channel}.py` 한 파일 + raw 모델 추가만 하면 자동으로 흡수됨.

---

## 4. 설계 섹션 A — 데이터 모델 변경

### 4.1 `DailyExpense.source` 컬럼 신설

자동/수동 식별이 불가능한 현 상태를 해결한다.

```python
class DailyExpense(SQLModel, table=True):
    # ... 기존 필드
    source: str = Field(default="manual", index=True)
    source_meta: Optional[str] = None  # JSON. 자동수집 ref (raw row id, classification rule)
```

| `source` 값 | 의미 |
|------------|------|
| `manual` | 사장님 수동 입력 (기존 행 backfill 기본값) |
| `auto_easypos` | EasyPOS POS 매출 자동수집 |
| `auto_coupang` | 쿠팡이츠 정산/주문 자동수집 |
| `auto_bank` | 은행 거래내역 자동 분류 결과 |
| `auto_baemin` / `auto_yogiyo` / `auto_ddangyo` | (추후) 배달앱 API 통합 시 추가 |
| `manual_overwritten` | 마이그레이션 B로 자동에 의해 덮인 옛 수동 행 (백업 보존) |

**Unique constraint**:
```python
UniqueConstraint("business_id", "date", "vendor_id", "payment_method", "source",
                 name="uq_dailyexpense_natural")
```
- 같은 자동 채널에서 중복 적재 방지
- 자동/수동은 source가 다르면 공존 가능 (등급 전환 안전성)

### 4.2 `CardFeeRateLearned` 신설 (수수료율 학습 결과)

```python
class CardFeeRateLearned(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)        # 'BC', '삼성', '신한', '롯데', '현대', '하나', '우리', '기타'
    learned_rate: float                        # 0.0219 같은 비율
    sample_size: int                           # 학습 표본 (입금↔승인 매칭 성공 건수)
    sample_period_start: datetime.date
    sample_period_end: datetime.date
    confidence: float                          # 0.0~1.0 (표본 크기 + 분산 기반)
    last_updated_at: datetime.datetime
    notes: Optional[str] = None

    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", name="uq_cardfee_business_corp"),
    )
```

### 4.3 `CardFeeMatchLog` 신설 (학습 표본 기록)

수수료율 학습에 사용되는 입금↔승인 매칭 성공 기록.

```python
class CardFeeMatchLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    deposit_date: datetime.date                # 은행 입금일
    approval_dates_start: datetime.date         # 매칭된 승인 구간 시작
    approval_dates_end: datetime.date           # 매칭된 승인 구간 끝
    sales_amount: int                           # 승인 합계
    deposit_amount: int                         # 실 입금액
    effective_fee: int                          # sales - deposit
    effective_rate: float                       # effective_fee / sales
    matched_at: datetime.datetime
```

365일 후 자동 정리 (별도 cron).

### 4.4 `CoupangEatsSettlement` 항목별 분해 컬럼 추가

현재 `amount` 한 덩어리만 저장된다. 응답 원문(`raw_json`)에는 항목별 분해가 있으므로 컬럼만 추가하면 즉시 활용 가능.

```python
class CoupangEatsSettlement(SQLModel, table=True):
    # ... 기존 필드
    total_sales: int = 0           # 정산 대상 매출 (gross)
    fee_brokerage: int = 0         # 중개수수료
    fee_payment: int = 0           # 결제수수료
    fee_delivery: int = 0          # 배달비 (점주 부담분)
    fee_advertising: int = 0       # 광고비 청구분
    fee_membership: int = 0        # 쿠팡이츠 멤버십/와우 분담
    fee_other: int = 0             # 기타/포인트 차감
    deduction_etc: int = 0         # 정정/환불 등 별도 차감
    # 검증식: amount ≈ total_sales - sum(fee_*) - deduction_etc
```

### 4.5 `DeliveryFeeRate` 신설 (API 통합 전 채널의 사장님 입력 수수료율)

API 통합이 안 된 배민/요기요/땡겨요 채널에 한해, 사장님이 1회 입력한 수수료율을 사업장 × 채널 × 효력 기간 단위로 저장. 상세는 [섹션 6.4.1](#641-사장님-입력-수수료율-저장--deliveryfeerate-신설) 참조.

### 4.6 `SubscriptionPlan`에 자동수집 기능 플래그

```python
class SubscriptionPlan(SQLModel, table=True):
    # ... 기존 필드
    feature_auto_collection: bool = Field(default=False)
    feature_fee_auto_estimate: bool = Field(default=False)
```

| 등급 예시 | feature_auto_collection | feature_fee_auto_estimate |
|----------|------------------------|--------------------------|
| Basic (수동만) | False | False |
| Standard | True | False |
| Premium | True | True |

### 4.7 마이그레이션 백업 정책

- 마이그레이션 B 정책 실행 시 기존 수동 행 → `source='manual_overwritten'` (삭제 X)
- 같은 (business_id, date, vendor_id, payment_method) 위치에 새 자동 행 (`source='auto_*'`) 삽입
- 화면 표시: 같은 위치 충돌 시 **`auto_*` 우선**, `manual_overwritten`은 감사용 토글 시에만 노출
- 1년 후 archive 정책은 별도 검토 (현 단계에서는 영구 보존)

---

## 5. 설계 섹션 B — 분류·동기화 service 설계

### 5.1 모듈 구조

```
services/
└── auto_collection_sync/
    ├── __init__.py
    ├── orchestrator.py          # cron 진입점
    ├── sync_event.py            # SyncEvent 표준 DTO
    ├── normalizers/
    │   ├── __init__.py
    │   ├── easypos.py           # EasyPosSaleReceipt → SyncEvent[]
    │   ├── coupang_eats.py      # CoupangEatsOrder/Settlement → SyncEvent[]
    │   └── bank.py              # BankTransaction → SyncEvent[]
    ├── fan_out.py               # SyncEvent → DailyExpense/CardPayment/Revenue
    ├── vendor_resolver.py       # vendor_lookup_key → Vendor.id (자동 생성 포함)
    ├── fee_estimator.py         # 수수료 자동 추정 (섹션 C 참조)
    └── migration.py             # 마이그레이션 B 정책 (섹션 D 참조)
```

**핵심 원칙**: 채널별 normalizer는 raw → SyncEvent 변환만 책임. DB 쓰기는 `fan_out.py`가 일괄 책임. 신규 채널 추가 = normalizer 한 파일 추가만.

### 5.2 SyncEvent 표준 DTO

```python
@dataclass
class SyncEvent:
    business_id: int
    date: datetime.date
    event_type: Literal["revenue", "expense", "card_settlement", "delivery_settlement"]
    vendor_lookup_key: str        # 'store' | 'coupang_eats' | 'coupang_eats_fee_brokerage' | ...
    payment_method: str            # 'Card' | 'Cash' | 'Point' | 'Delivery' | 'Voucher' | ...
    amount: int                    # revenue: +, expense: -
    source: str                    # 'auto_easypos' | 'auto_coupang' | 'auto_bank'
    source_ref: str                # 원본 raw row id (재처리 추적용)
    raw_payload: dict              # 디버깅용 원본 일부
```

### 5.3 EasyPOS 변환 룰

13개 결제수단 컬럼을 일자별로 합산해서 **결제수단별 SyncEvent** 로 분해.

```python
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

def normalize_easypos(business_id, date_range) -> list[SyncEvent]:
    events = []
    for sale_date in date_range:
        receipts = EasyPosSaleReceipt.daily_rows(business_id, sale_date)
        for pm, col in PAYMENT_METHOD_COLUMNS.items():
            total = sum(getattr(r, col) or 0 for r in receipts)
            if total <= 0:
                continue  # 0원은 행 생성 안 함
            events.append(SyncEvent(
                business_id=business_id, date=sale_date,
                event_type="revenue", vendor_lookup_key="store",
                payment_method=pm, amount=total,
                source="auto_easypos",
                source_ref=f"easypos_daily:{business_id}:{sale_date}",
                raw_payload={"receipt_count": len(receipts), "payment_method": pm},
            ))
    return events
```

### 5.4 쿠팡이츠 변환 룰

```python
def normalize_coupang_eats(business_id, date_range) -> list[SyncEvent]:
    events = []
    for sale_date in date_range:
        # 1) 매출 1행
        orders = CoupangEatsOrder.daily_rows(business_id, sale_date,
                                              cancelled=False)
        total_sale = sum(o.total_sale_price for o in orders)
        if total_sale > 0:
            events.append(SyncEvent(
                business_id=business_id, date=sale_date,
                event_type="revenue", vendor_lookup_key="coupang_eats",
                payment_method="Delivery", amount=total_sale,
                source="auto_coupang",
                source_ref=f"coupang_orders:{business_id}:{sale_date}",
                raw_payload={"order_count": len(orders)},
            ))

        # 2) 수수료 분해 (정산 발생일 기준)
        settlements = CoupangEatsSettlement.daily_rows(
            business_id, sale_date, settlement_type="SETTLEMENT"
        )
        for st in settlements:
            for fee_field, vendor_key in [
                ("fee_brokerage", "coupang_eats_fee_brokerage"),
                ("fee_payment", "coupang_eats_fee_payment"),
                ("fee_delivery", "coupang_eats_fee_delivery"),
                ("fee_advertising", "coupang_eats_fee_advertising"),
                ("fee_membership", "coupang_eats_fee_membership"),
                ("fee_other", "coupang_eats_fee_other"),
            ]:
                fee = getattr(st, fee_field) or 0
                if fee <= 0:
                    continue
                events.append(SyncEvent(
                    business_id=business_id, date=sale_date,
                    event_type="expense", vendor_lookup_key=vendor_key,
                    payment_method="Delivery", amount=-fee,
                    source="auto_coupang",
                    source_ref=f"coupang_settle:{st.id}:{fee_field}",
                    raw_payload={"settlement_id": st.id},
                ))
    return events
```

### 5.5 은행 변환 룰

기존 [bank_sync._sync_classified_to_models](../../../SodamApp/backend/routers/bank_sync.py#L946) 로직을 표준 DTO 형태로 리팩토링.

- 카드사 입금 → `CardPayment` 직접 (DailyExpense 아님, 기존 흐름 유지)
- 페이 입금 → `PayPayment` 직접
- 배달앱 정산 입금 → `DeliveryRevenue` (월별 요약, 일별은 쿠팡이츠 채널이 처리)
- 일반 분류된 출금/입금 → `SyncEvent` → `DailyExpense`

**로직 변경은 최소화**하되 source 컬럼만 `auto_bank`로 통일. 기존 검증된 코드 패스 유지.

### 5.6 fan-out 로직

```python
def apply(business_id, events: list[SyncEvent]) -> FanOutReport:
    counts = defaultdict(int)
    for ev in events:
        vendor = vendor_resolver.get_or_create(
            business_id=ev.business_id,
            lookup_key=ev.vendor_lookup_key,
        )
        if ev.event_type in ("revenue", "expense"):
            upsert_daily_expense(
                business_id=ev.business_id, date=ev.date,
                vendor_id=vendor.id, vendor_name=vendor.name,
                payment_method=ev.payment_method,
                amount=ev.amount, source=ev.source, source_meta=ev.raw_payload,
            )
            counts[f"{ev.event_type}:{ev.source}"] += 1
        # card_settlement / delivery_settlement 은 별도 테이블로 fan-out
    return FanOutReport(counts=dict(counts))
```

### 5.7 vendor_resolver — 채널 vendor 자동 생성

```python
# services/auto_collection_sync/vendor_resolver.py

CHANNEL_VENDORS = {
    "store": ("매장", "store", "revenue"),
    "coupang_eats": ("쿠팡이츠", "delivery", "revenue"),
    "coupang_eats_fee_brokerage": ("쿠팡이츠 중개수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_payment": ("쿠팡이츠 결제수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_delivery": ("쿠팡이츠 배달비", "delivery_fee", "expense"),
    "coupang_eats_fee_advertising": ("쿠팡이츠 광고비", "advertising", "expense"),
    "coupang_eats_fee_membership": ("쿠팡이츠 멤버십", "delivery_fee", "expense"),
    "coupang_eats_fee_other": ("쿠팡이츠 기타", "delivery_fee", "expense"),
    # 추후 배민/요기요/땡겨요 동일 패턴으로 추가
}

def get_or_create(business_id: int, lookup_key: str) -> Vendor:
    name, category, vtype = CHANNEL_VENDORS[lookup_key]
    # business 별 매장명을 붙여 "매장 (소담김밥 건대본점)" 같은 식으로 유니크 보장
    if lookup_key == "store":
        biz = Business.get(business_id)
        name = f"매장 ({biz.name})"
    vendor = Vendor.find_one(
        business_id=business_id, name=name, vendor_type=vtype
    )
    if not vendor:
        vendor = Vendor.create(
            business_id=business_id, name=name,
            category=category, vendor_type=vtype,
        )
    return vendor
```

### 5.8 결제수단별 매출 분해 표현

**vendor 1개 + payment_method 분해** 방식 채택:
- 매장 매출: vendor = "매장 (소담김밥 건대본점)" 1개. payment_method가 다른 행으로 분해.
- 배달 매출: vendor = "쿠팡이츠" 1개. payment_method = 'Delivery'.

이유:
1. 사장님이 화면에서 "결제수단 = 카드"로 한 번에 필터 가능
2. vendor 폭증 방지 (만약 vendor를 결제수단별로 만들면 11배 비대)
3. 기존 `category=='store'` 매장 vendor 매핑 패턴 유지

---

## 6. 설계 섹션 C — 수수료 자동 추정 로직

### 6.1 카드 수수료 — 3경로 우선순위

```python
def estimate_card_fee(business_id: int, card_corp: str, year: int, month: int) -> CardFeeEstimate:
    # 1순위 — CODEF 명세서 직접값 (가장 정확)
    payments = CardPayment.find_all(
        business_id=business_id, card_corp=card_corp,
        payment_date_between=(date(year, month, 1), last_day_of_month(year, month)),
        source='codef',
    )
    payments_with_fee = [p for p in payments if (p.fees or 0) > 0]
    if payments_with_fee:
        return CardFeeEstimate(
            amount=sum(p.fees for p in payments_with_fee),
            source='codef_settlement',
            confidence=1.0,
            basis_count=len(payments_with_fee),
        )

    # 2순위 — 입금↔승인 매칭 실측 역산
    fee, samples = match_deposits_to_approvals(business_id, card_corp, year, month)
    if fee is not None and samples >= 5:
        return CardFeeEstimate(
            amount=fee, source='deposit_match',
            confidence=min(0.95, samples / 30),
            basis_count=samples,
        )

    # 3순위 — 학습된 카드사별 실효 수수료율
    rate = CardFeeRateLearned.find_one(business_id=business_id, card_corp=card_corp)
    if rate and rate.confidence >= 0.5:
        sales = CardSalesApproval.month_sum(business_id, card_corp, year, month)
        return CardFeeEstimate(
            amount=int(sales * rate.learned_rate),
            source='learned_rate',
            confidence=rate.confidence * 0.8,
            basis_count=rate.sample_size,
        )

    # 4순위 — 산정 불가 (UI 명시적 경고)
    return CardFeeEstimate(amount=0, source='unavailable', confidence=0.0)
```

### 6.2 매출↔입금 매칭 알고리즘 (경로 2)

```
입력: BankTransaction (카드사 입금)
     - payment_date = T
     - in_amount = X
     - card_corp = Y (입금자명에서 추출)

알고리즘:
1) 후보 승인 구간: [T-7, T-1] 일자 + card_corp 일치하는 CardSalesApproval 들
2) 부분집합 탐색: amount 합 ≈ X / (1-r_estimated) 인 연속 일자 묶음
   r_estimated = 학습값 있으면 그것, 없으면 2.2% default
3) 정확 매칭 판정: 합이 [X*(1+0.005), X*(1+0.04)] 범위 내인 연속 일자 묶음
4) 매칭 성공 → CardFeeMatchLog 에 (sales, deposit, fee, rate) 기록
5) 매칭 실패 → skip, 다음 입금으로
```

기존 [bank_sync.py:1111-1138](../../../SodamApp/backend/routers/bank_sync.py#L1111) Exact + Fuzzy 매칭 로직을 확장.

**핵심 추가**: 연속 일자 묶음 탐색. 현재는 단일 일자만 매칭하나, 카드사별로 입금 주기가 다르고 주말 묶음 입금이 흔하므로 묶음 매칭이 정확도를 크게 올린다.

### 6.3 학습 알고리즘 (경로 3)

```python
def update_learned_rate(business_id: int, card_corp: str):
    # 최근 90일 매칭 성공 표본
    samples = CardFeeMatchLog.recent(business_id, card_corp, days=90)
    if len(samples) < 10:
        return  # 표본 부족, 학습 보류

    # 가중 평균 (최근 표본일수록 가중치 ↑)
    def weight(d):  # 30일 반감기
        days_ago = (date.today() - d).days
        return 0.5 ** (days_ago / 30)

    sum_w = sum(weight(s.matched_at.date()) for s in samples)
    weighted_rate = sum(s.effective_rate * weight(s.matched_at.date())
                        for s in samples) / sum_w

    # 분산 (신뢰도 산정용)
    variance = sum((s.effective_rate - weighted_rate) ** 2 * weight(s.matched_at.date())
                   for s in samples) / sum_w
    std_dev = math.sqrt(variance)

    # 신뢰도: 표본 크기 + 분산 기반
    #   표본 30건 이상 + 표준편차 0.1%p 이하 → 1.0
    #   표본 10건 + 표준편차 0.5%p → 0.5
    confidence = min(1.0,
        (min(len(samples), 30) / 30) * 0.5 +
        (1.0 - min(1.0, std_dev * 100)) * 0.5
    )

    CardFeeRateLearned.upsert(
        business_id=business_id, card_corp=card_corp,
        learned_rate=weighted_rate, sample_size=len(samples),
        confidence=confidence, last_updated_at=now(),
        sample_period_start=min(s.matched_at.date() for s in samples),
        sample_period_end=max(s.matched_at.date() for s in samples),
    )
```

매주 일요일 새벽 04:00 cron으로 전사업장·전카드사 학습값 갱신.

### 6.4 배달 수수료

- **쿠팡이츠**: 정산 응답 항목별 분해(섹션 B-3)로 직접 추출. 추정 불필요.
- **배민/요기요/땡겨요** (API 통합 전): 1단계로 사장님이 채널별 표준 수수료율 1회 입력 (예: 배민 6.8%). 은행 정산 입금액 × 사장님 입력 수수료율로 역산. 화면에 "추후 자동화 예정" 안내 표시.
- **배민/요기요/땡겨요** (API 통합 후): normalizer 파일 추가로 쿠팡이츠와 동일한 자동 분해. 사장님 입력 수수료율은 자동 비활성.

#### 6.4.1 사장님 입력 수수료율 저장 — `DeliveryFeeRate` 신설

새 소형 테이블로 사업장 × 채널별 사장님 입력 수수료율을 저장한다.

```python
class DeliveryFeeRate(SQLModel, table=True):
    """API 통합 전 배달앱 (배민/요기요/땡겨요) 수수료율 사장님 입력값.

    API 통합 후에는 자동 비활성 (해당 채널 source='auto_*' 행이 생기면 우선).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    channel: str = Field(index=True)             # '배민' / '요기요' / '땡겨요'
    rate: float                                   # 0.068 같은 비율
    effective_from: datetime.date                 # 사장님 계약 시작일
    effective_to: Optional[datetime.date] = None  # 변경 시 이전 row 마감 후 새 row
    notes: Optional[str] = None
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

    __table_args__ = (
        UniqueConstraint("business_id", "channel", "effective_from",
                         name="uq_deliveryfeerate_business_channel_from"),
    )
```

수수료율 변경 이력을 보존하기 위해 `effective_from`/`effective_to`로 기간 모델. 산정 시 매출일 기준 활성 row의 rate를 조회.

```python
def estimate_delivery_fee_legacy(business_id, channel, settlement_date, settlement_amount):
    """API 통합 전 채널의 수수료 추정."""
    rate = DeliveryFeeRate.find_active(business_id, channel, settlement_date)
    if not rate:
        return DeliveryFeeEstimate(amount=0, source='unavailable', confidence=0.0)
    # 정산 입금액은 매출 - 수수료. 매출 추정 = 입금 / (1 - rate)
    estimated_sales = int(settlement_amount / (1 - rate.rate))
    estimated_fee = estimated_sales - settlement_amount
    return DeliveryFeeEstimate(
        amount=estimated_fee,
        source='owner_input_rate',
        confidence=0.7,  # 사장님 입력값이라 신뢰도 0.7로 고정
        basis_rate=rate.rate,
    )
```

### 6.5 화면 신뢰도 뱃지

```
카드수수료    158,000원    🟢 명세서        (CODEF 직접)
            120,500원    🟡 실측 매칭     (입금↔승인 매칭)
             87,200원    🟠 학습 추정     (2.18% × 매출, 표본 18건)
배달수수료     85,000원    🟢 정산 직접 추출 (쿠팡이츠)
              45,000원    🟡 사장님 입력 6.8% × 배민 매출 (추후 자동화 예정)
```

---

## 7. 설계 섹션 D — 마이그레이션 + 등급 토글

### 7.1 등급 체크 — orchestrator 단일 지점

```python
def run_all_businesses():
    for biz in active_businesses():
        plan = biz.plan
        if not plan or not plan.feature_auto_collection:
            log.info("skip business %s — plan does not include auto_collection", biz.id)
            continue

        events = []
        events += normalize_easypos(biz.id, date_range=last_day_window())
        events += normalize_coupang_eats(biz.id, date_range=last_day_window())
        events += normalize_bank(biz.id, date_range=last_day_window())

        fan_out.apply(biz.id, events)

        if plan.feature_fee_auto_estimate:
            fee_estimator.run_monthly(biz.id, current_month())
```

**등급 전환 영향:**
- 등급 다운 (자동 → 수동): cron이 다음날부터 자동 멈춤. 이미 들어간 `auto_*` 행은 그대로. 신규는 사장님 수동 입력.
- 등급 업 (수동 → 자동): 다음 cron부터 자동 행 추가. 사장님이 [백필 실행] 누르면 과거 데이터도 흡수.

### 7.2 마이그레이션 B 정책 구현

```python
def migrate_business(business_id: int, period_start: date, period_end: date) -> MigrationReport:
    """B 정책: 기간 내 자동수집 가능 영역의 수동 행을 'manual_overwritten' 으로 백업 후
    자동수집으로 다시 가져와 덮어쓴다.
    """
    affected_vendors = vendor_resolver.list_auto_covered(business_id)
    # → 매장 매출, 쿠팡이츠 매출, 배달 수수료 vendor 들
    # → 매입/원가/인건비/임차료 vendor 는 제외 (자동수집 영역 아님)

    # 1) 기존 수동 행 백업
    overwritten = DailyExpense.update_many(
        where=dict(
            business_id=business_id,
            date__between=(period_start, period_end),
            vendor_id__in=affected_vendors,
            source='manual',
        ),
        set=dict(
            source='manual_overwritten',
            source_meta=json.dumps({'migrated_at': now().isoformat()}),
        ),
    )

    # 2) 채널별 raw 백필
    easypos_result = EasyPOSService.backfill(business_id, period_start, period_end)
    coupang_result = CoupangEatsService.backfill(business_id, period_start, period_end)
    bank_result = BankSyncService.backfill(business_id, period_start, period_end)

    # 3) 분류·동기화 service 실행 → source='auto_*' 행 생성
    fan_out_result = orchestrator.run_one_business(
        business_id, period_start=period_start, period_end=period_end
    )

    # 4) 수수료 자동 추정 (기간 내 매월)
    fee_results = []
    for ym in months_between(period_start, period_end):
        fee_results.append(fee_estimator.run_monthly(business_id, ym))

    # 5) 손익 재계산
    pl_result = profit_loss_service.recalc(business_id, period_start, period_end)

    return MigrationReport(
        business_id=business_id, period=(period_start, period_end),
        overwritten_count=overwritten,
        new_auto_count=fan_out_result.total_events,
        channels=dict(easypos=easypos_result, coupang=coupang_result, bank=bank_result),
        fees_recomputed=fee_results,
        pl_recomputed=pl_result,
    )
```

**핵심**: 삭제 0건. 모든 옛 데이터는 `source='manual_overwritten'`로 식별 가능한 채로 살아 있다.

### 7.3 백업 보기 / 복구 UI

```
[손익 화면 우측 상단]
☑ 자동수집 데이터만 표시 (기본)
☐ 백업된 수동 입력도 표시 (감사용)
```

체크 풀면 같은 날짜에 자동/manual_overwritten 둘 다 보이고, 한 행씩 복구 가능:
```
[복구] 버튼 → manual_overwritten → manual 로 source 변경
        + 해당 위치의 auto_* 행은 disabled 또는 손익 산출에서 제외 플래그
```

1차 구현 범위에 포함하되 UI는 최소한(감사용 토글 + 복구 버튼). 화려한 비교 화면은 만들지 않음.

### 7.4 마이그레이션 안전 게이트

`[백필 실행]` 버튼 클릭 시 확인 다이얼로그:

```
[마이그레이션 확인]
이 작업은 다음을 수행합니다:
• 기간: 2026-01-01 ~ 2026-05-13
• 영향 받는 vendor: 매장 매출, 쿠팡이츠 매출, 배달 수수료 (12개)
• 영향 받지 않는 vendor: 매입, 인건비, 임차료, 광고 등 (24개)
• 기존 수동 행 N건이 백업으로 이동, 자동 데이터로 덮입니다.

[ ] 백업으로 보존된다는 사실을 이해했고, 복구 가능함을 확인했습니다.
[ ] 자동수집된 데이터의 신뢰도를 확인했습니다.

[취소] [실행]
```

영향 미리보기 + 명시적 동의 → 안전망.

---

## 8. 설계 섹션 E — 운영 / 모니터링 / 입금 감시

### 8.1 Cron 일정

Orbitron 환경에서는 cron 워커 컨테이너가 backend API를 HTTP로 트리거하는 패턴(메모리상 기존 자동수집들이 그렇게 작동 중).

```
03:00 KST  POST /api/auto-collection/cron/easypos            (모든 사업장)
03:10 KST  POST /api/auto-collection/cron/coupang-eats       (모든 사업장)
03:20 KST  POST /api/auto-collection/cron/bank-sync          (모든 사업장)
03:30 KST  POST /api/auto-collection/cron/orchestrator       (분류·동기화 fan-out)
03:40 KST  POST /api/auto-collection/cron/profit-loss        (손익 재계산)
03:45 KST  POST /api/auto-collection/cron/notify             (사장님 일일 알림)
04:00 KST  POST /api/auto-collection/cron/settlement-watch   (입금 모니터링 — 섹션 8.13)

일요일 04:30 KST
           POST /api/auto-collection/cron/learn-fee-rates    (수수료율 학습 갱신)
```

각 endpoint는 superadmin 토큰 + 사업장 화이트리스트 보호. 등급 체크는 orchestrator 단일 지점.

**시각 어긋남 안전장치**: orchestrator가 시작될 때 raw 테이블의 `synced_at`을 보고 "어제 데이터까지 들어왔는가" 확인. 안 들어왔으면 채널 수집을 직접 한 번 더 호출. 채널 수집 실패가 fan-out 전체를 중단시키지 않도록 격리.

### 8.2 실패 처리 + 재시도

```
# 채널 수집 실패 시
- 1차 실패: 5분 후 자동 재시도 (1회만)
- 재시도 실패: SyncLog 에 'failed' 기록, fan-out 단계는 그 채널 skip
- 다음날 정상 작동 시 누락분 자동 백필 (orchestrator 가 빈 일자 탐지)

# fan-out 실패 시
- 트랜잭션 롤백 → DailyExpense 변경 없음
- raw 데이터는 보존 (재처리 가능)

# 손익 재계산 실패 시
- 이전 손익 값 유지
- 알림에 "손익 재계산 보류" 명시
```

### 8.3 사장님 알림 (Phase 1)

매일 새벽 03:45 cron. 채널: **텔레그램 봇** (메모리상 `telegram:configure` 스킬 인프라 보유).

성공:
```
[소담 자동수집] 2026-05-14 03:45

매장 (EasyPOS):   ✅ 312건 수집, 매출 2,341,000원
쿠팡이츠:          ✅ 18건 수집, 매출 245,000원, 수수료 16,200원
은행:              ✅ 47건 거래 분류, 입금 3건 매칭
손익 재계산:      ✅ 2026-05 갱신

문제 없는 하루 — 자세히 보기: [링크]
```

실패:
```
[소담 자동수집] ⚠️ 2026-05-14 03:45

쿠팡이츠:          ❌ 인증 만료 — 쿠키 재등록 필요
                  → 다른 채널은 정상. 쿠팡이츠는 재로그인 후 [백필 실행]

매장 (EasyPOS):   ✅ 정상
은행:              ✅ 정상
```

### 8.4 사장님 화면 — 자동수집 대시보드

기존 [BankSync] 화면 옆에 새 탭 [자동수집] 추가:

```
┌─ 자동수집 상태 ────────────────────────────────────┐
│                                                     │
│  매장 (EasyPOS)       🟢 최근 동기화: 03:00 (오늘)  │
│                       312건 / 2,341,000원           │
│                       [지금 수집] [백필]            │
│                                                     │
│  쿠팡이츠             🟢 최근 동기화: 03:10 (오늘)  │
│                       18건 / 245,000원              │
│                       [지금 수집] [백필]            │
│                                                     │
│  은행 거래내역        🟢 최근 동기화: 03:20 (오늘)  │
│                       47건 / 12건 미분류            │
│                       [지금 수집] [분류 보정]       │
│                                                     │
│  ─────────────────────                              │
│  수수료 자동 추정     🟢 신뢰도 평균 87%            │
│                       [학습 즉시 갱신]              │
│                                                     │
│  ─────────────────────                              │
│  데이터 흐름 (어제 03:00 ~ 03:45)                   │
│  raw 수집 377건 → 분류 377건 → 손익 반영 ✅        │
│  실패 채널: 없음                                    │
└─────────────────────────────────────────────────────┘
```

[백필] 버튼이 마이그레이션 B 정책 실행 UI (섹션 D-4의 확인 다이얼로그).

### 8.5 디버깅 / 감사 도구 (superadmin 한정)

```
GET /api/auto-collection/audit/sync-events?date=YYYY-MM-DD&business_id=N
  → 그 날짜/사업장의 모든 SyncEvent 와 결과

GET /api/auto-collection/audit/dailyexpense/{id}/history
  → 한 행의 변경 이력 (manual → manual_overwritten → auto_easypos)

GET /api/auto-collection/audit/fee-estimate/{business_id}/{year}/{month}
  → 그 달의 카드/배달 수수료 산출 근거 (경로별, 표본별)
```

코덱스 리뷰 P2-1 패치 정책에 따라 **superadmin 한정**.

### 8.6 Retention 정책

| 데이터 | 보존 기간 |
|--------|----------|
| `EasyPosSaleReceipt.raw_json` | 영구 (감사용) |
| `CoupangEatsOrder.raw_json` / `CoupangEatsSettlement.raw_json` | 영구 |
| `manual_overwritten` 행 | 영구 (정리 정책 별도) |
| `SyncLog` | 90일 후 자동 정리 |
| `CardFeeMatchLog` | 365일 후 자동 정리 |

별도 cron 작성 필요 (1차 구현 후 단순 정리 cron 추가).

### 8.7 멱등성 + 동시 실행 방지

각 cron endpoint 첫 줄에 advisory lock:

```python
@router.post("/cron/orchestrator")
def cron_orchestrator():
    with pg_advisory_lock('auto_collection_orchestrator', timeout=0):
        # 이미 누가 잡고 있으면 즉시 종료 (sleep 안 함)
        ...
```

cron이 늦게 끝났을 때 다음 cron이 겹쳐 실행되어 데이터가 두 번 들어가는 사고 방지.

### 8.8 입금 모니터링 (Settlement Watch) — 개요

카드사·배달앱이 정상적으로 입금했는지 자동 감시한다. 손익 정확도와는 별개의 기능으로, 입금 누락(시스템 오류·정정 분쟁·영업일 차이 등)을 사장님이 빠르게 인지하고 카드사/채널에 문의할 수 있게 한다.

**기본 흐름**:
```
[카드 승인 발생]    ─→ 예상 입금일 = approval_date + 카드사별 D+N (영업일)
[은행 매칭 시도]    ─→ 예상 입금일 + grace_days 까지 매칭 안 됨
                    ─→ SettlementWatchAlert(status='open') 생성
                    ─→ 텔레그램 알림
[늦은 입금 도착]    ─→ 자동 close (status='received')
[사장님 처리]       ─→ 'acknowledged' / 'resolved' / 'false_positive'
                       (false_positive 는 학습값에 반영, 다음부터 같은 케이스 alert 안 뜸)
```

### 8.9 카드 입금 모니터링 로직

```python
@dataclass
class CardSettlementExpectation:
    business_id: int
    card_corp: str
    approval_dates: tuple[date, date]      # 승인 구간
    sales_amount: int
    expected_deposit_amount: int           # sales × (1 - rate)
    expected_deposit_date: date
    grace_days: int                        # 사업장 × 카드사별 학습값, default 3
    deadline: date                         # expected_deposit_date + grace_days
    status: Literal["pending", "received", "overdue", "partial"]


def watch_card_settlements(business_id: int) -> list[CardSettlementExpectation]:
    """최근 30일 승인 중 미매칭 + 예상 입금일+grace 지난 묶음을 overdue 로 식별."""
    unmatched_groups = CardSalesApproval.find_unmatched_groups(
        business_id=business_id, period=last_n_days(30)
    )
    overdue = []
    for group in unmatched_groups:
        n_days = settlement_days_for_corp(business_id, group.card_corp)
        expected = add_business_days(group.approval_dates[1], n_days)
        deadline = expected + timedelta(days=grace_days_for_corp(business_id, group.card_corp))
        if date.today() > deadline:
            est_rate = fee_estimator.get_rate(business_id, group.card_corp)
            overdue.append(CardSettlementExpectation(
                business_id=business_id,
                card_corp=group.card_corp,
                approval_dates=group.approval_dates,
                sales_amount=group.sales_amount,
                expected_deposit_amount=int(group.sales_amount * (1 - est_rate)),
                expected_deposit_date=expected,
                grace_days=grace_days_for_corp(business_id, group.card_corp),
                deadline=deadline,
                status="overdue",
            ))
    return overdue
```

**카드사별 D+N 기본값** (사업장별 학습으로 갱신됨):
```python
CARD_CORP_SETTLEMENT_DAYS_DEFAULT = {
    "BC": 3, "삼성": 2, "신한": 2, "롯데": 3, "현대": 2,
    "하나": 3, "우리": 3, "KB": 2, "NH농협": 3, "기타": 4,
}
# 영업일 계산은 한국 공휴일 캘린더(별도 라이브러리 또는 간이 룰) 사용.
```

학습: `CardFeeMatchLog` 의 (approval_date, deposit_date) 차이를 카드사별 누적 → 사업장별 실측 D+N 으로 갱신 (섹션 6.3 학습 알고리즘과 동일 패턴).

### 8.10 배달앱 정산 모니터링 로직

**쿠팡이츠** — 정산 명세에 입금일이 명시되어 옴:
```python
def watch_coupang_settlements(business_id: int):
    settlements = CoupangEatsSettlement.find_recent(
        business_id=business_id, days=30,
        settlement_type="SETTLEMENT",
    )
    overdue = []
    for st in settlements:
        expected = st.settlement_date  # 쿠팡이츠는 settlement_date 가 곧 입금 예정일
        deadline = expected + timedelta(days=3)  # 채널별 grace
        matched = BankTransaction.find_one(
            business_id=business_id,
            trans_date_range=(expected - timedelta(1), deadline),
            in_amount=st.amount,
            remark_contains="쿠팡이츠",
        )
        if not matched and date.today() > deadline:
            overdue.append(DeliverySettlementExpectation(
                business_id=business_id, channel="쿠팡이츠",
                settlement_date=st.settlement_date,
                expected_amount=st.amount,
                deadline=deadline, status="overdue",
                settlement_id=st.id,
            ))
    return overdue
```

**배민 / 요기요 / 땡겨요** (API 통합 전) — 정산 명세 자체가 없어 모니터링 불가. UI에 명시: "API 통합 후 활성화 예정". API 통합 후에는 쿠팡이츠와 동일 로직 자동 적용.

### 8.11 `SettlementWatchAlert` 모델

미입금 alert 의 중복 발송 방지 + 사장님 처리 워크플로우.

```python
class SettlementWatchAlert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    alert_type: str = Field(index=True)      # 'card_overdue' / 'delivery_overdue'
    channel_or_corp: str                      # '삼성카드' / '쿠팡이츠'
    expected_date: datetime.date
    expected_amount: int
    deadline: datetime.date
    status: str = Field(default="open", index=True)
    # values: 'open' / 'received' / 'acknowledged' / 'resolved' / 'false_positive'
    notified_at: Optional[datetime.datetime] = None
    received_amount: Optional[int] = None
    received_date: Optional[datetime.date] = None
    acknowledged_at: Optional[datetime.datetime] = None
    acknowledged_by: Optional[int] = Field(default=None, foreign_key="user.id")
    notes: Optional[str] = None
    raw_ref: Optional[str] = None             # 'card_approval_group:...' 또는 'coupang_settle:...'

    __table_args__ = (
        UniqueConstraint("business_id", "alert_type", "channel_or_corp",
                         "expected_date", name="uq_settle_watch_natural"),
    )
```

같은 입금건에 대해 매일 새 alert 를 만들지 않고, 한 번 만들어진 row 의 상태로 추적.

### 8.12 자동 close + 학습형 false-positive 감소

```python
def auto_close_received_alerts(business_id):
    """미입금 alert 발생 후 늦게라도 입금되면 자동 close."""
    open_alerts = SettlementWatchAlert.find_all(business_id=business_id, status="open")
    for alert in open_alerts:
        matched = match_late_deposit(alert)
        if matched:
            alert.status = "received"
            alert.received_amount = matched.in_amount
            alert.received_date = matched.trans_date
            # 늦은 입금이면 텔레그램에 "✅ 늦게 입금 확인됨" 보강 알림


def handle_false_positive(alert_id, user_id):
    """사장님이 '입금 안된 것 아님' 표시 시.

    그 카드사의 grace_days 를 +1 학습 (영업일 계산 보수화).
    같은 케이스의 alert 가 다음부터 안 뜨도록 함.
    """
    alert = SettlementWatchAlert.get(alert_id)
    alert.status = 'false_positive'
    alert.acknowledged_at = now()
    alert.acknowledged_by = user_id

    # 학습 — 사업장 × 카드사 grace_days 갱신
    if alert.alert_type == 'card_overdue':
        bump_grace_days(alert.business_id, alert.channel_or_corp, +1)
```

운영하면서 자동으로 false positive 가 줄어드는 구조.

### 8.13 입금 모니터링 cron 일정

기존 orchestrator(03:30) 직후 04:00 에 추가:

```
04:00 KST  POST /api/auto-collection/cron/settlement-watch
            ├ watch_card_settlements (전 사업장)
            ├ watch_coupang_settlements (전 사업장)
            ├ auto_close_received_alerts
            └ 신규 overdue 알림 텔레그램 발송 (배치)
```

### 8.14 사장님 화면 — 자동수집 대시보드에 입금 모니터 섹션 추가

기존 자동수집 대시보드(섹션 8.4)에 추가 카드:

```
┌─ 입금 모니터 ──────────────────────────────────────┐
│                                                     │
│  미입금 의심 건  ⚠️ 3건                             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 삼성카드  5/6~5/8 매출 1,240,000원           │   │
│  │ 예상 입금일: 5/10  (현재 5/13, 3일 경과)      │   │
│  │ [카드사에 문의함] [확인 완료] [입금 안된 것 아님]│  │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 쿠팡이츠  5/10 정산 245,000원                │   │
│  │ 예상 입금일: 5/10  (현재 5/13, 3일 경과)      │   │
│  │ [채널에 문의함] [확인 완료] [입금 안된 것 아님]│  │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ─────────────────────────                          │
│  최근 30일 입금 통계                                │
│  카드:    142건 / 142건 정상 입금                  │
│  쿠팡이츠: 31건 / 30건 정상 입금 (1건 미입금)      │
│  배민:    API 통합 후 활성화                       │
└─────────────────────────────────────────────────────┘
```

### 8.15 텔레그램 알림 통합

기존 일일 자동수집 알림(03:45)에 입금 모니터 결과 한 줄 추가. 미입금이 있으면 04:00 cron 직후 별도 강조 메시지:

미입금 있음:
```
[소담 자동수집] 2026-05-13 04:00 — ⚠️ 미입금 의심

⚠️ 카드 미입금: 1건
  • 삼성카드 5/6~5/8 1,240,000원 (예상 입금일 5/10, 3일 경과)

⚠️ 배달 미입금: 1건
  • 쿠팡이츠 5/10 정산 245,000원 (3일 경과)

→ 자세히 확인: [링크]
```

미입금 없음 (일일 알림 한 줄):
```
입금 모니터:  ✅ 미입금 의심 0건 / 최근 30일 정상 입금률 99.5%
```

---

## 9. 비범위 (Out of Scope) — 명시적으로 안 다룸

이 작업에서 **하지 않을 것**을 명시한다. 추후 별도 작업으로 분리.

| 비범위 | 이유 |
|--------|------|
| 배민/요기요/땡겨요 API 통합 | 별도 사장님 영업 협의 + 어댑터 구현 필요. 현재 사장님 입력 수수료율로 대체. |
| 매입/원가 자동수집 | EasyPOS·쿠팡이츠·은행 어디에서도 매입 데이터 자체가 안 옴. 별도 채널(농산물 도매시장 영수증 OCR 등) 필요. |
| 인건비 자동수집 | 이미 직원 관리 시스템에서 처리됨. 자동수집 파이프라인과 별개. |
| 화려한 충돌 비교 화면 | 마이그레이션 C 정책 시도했던 것. B 정책이라 불필요. |
| `manual_overwritten` 1년 후 자동 archive | 별도 retention cron으로 분리. 1차 구현 후 추가. |
| 카드 입금 ↔ 승인 다중 카드사 동시 묶음 매칭 (예: 한 입금이 여러 카드사 매출의 합) | 실제로 발생 빈도 낮음. 1차에서는 단일 카드사 묶음만. |
| 텔레그램 외 알림 채널 (메일/카카오톡) | 텔레그램으로 시작. 사장님 요구 시 추가. |
| **Revenue 테이블 사용 라우트 통일 (profitloss.py:329-358 등)** | Phase 2 정리 작업. 1차에서는 fan-out이 DailyExpense + Revenue 양쪽을 채워 기존 라우트가 깨지지 않도록 한다 (섹션 11 참조). |
| **배민/요기요/땡겨요 입금 모니터링** | 정산 명세 자체가 없어 추정 불가. API 통합 후 자동 활성화. 1차에서는 쿠팡이츠만 모니터링. |
| **카드사 영업일 캘린더의 정밀한 학습** | 1차에서는 사업장 × 카드사 단위 grace_days 가산 (단순 학습). 카드사별 휴일/연휴 패턴 정밀 모델링은 추후. |
| **자동 카드사 클레임/문의 발송** | 사장님이 [카드사에 문의함] 버튼만 누르면 alert 상태 기록. 실제 문의는 사장님이 수동 (카카오톡/전화). 자동 문의 발송은 추후. |

---

## 10. 데이터 모델 변경 요약 (DB 마이그레이션)

Alembic 또는 동등한 마이그레이션 도구로 적용할 변경:

```sql
-- 1) DailyExpense 에 source 컬럼
ALTER TABLE dailyexpense
    ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'manual',
    ADD COLUMN source_meta TEXT;
CREATE INDEX ix_dailyexpense_source ON dailyexpense (source);
CREATE UNIQUE INDEX uq_dailyexpense_natural
    ON dailyexpense (business_id, date, vendor_id, payment_method, source)
    WHERE vendor_id IS NOT NULL;

-- 2) CardFeeRateLearned 테이블
CREATE TABLE cardfeerratelearned (
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
);

-- 3) CardFeeMatchLog 테이블
CREATE TABLE cardfeematchlog (
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
);
CREATE INDEX ix_cardfeematchlog_biz_corp ON cardfeematchlog (business_id, card_corp);

-- 4) CoupangEatsSettlement 분해 컬럼
ALTER TABLE coupangeatssettlement
    ADD COLUMN total_sales BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_brokerage BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_payment BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_delivery BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_advertising BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_membership BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN fee_other BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN deduction_etc BIGINT NOT NULL DEFAULT 0;

-- 5) SubscriptionPlan 기능 플래그
ALTER TABLE subscriptionplan
    ADD COLUMN feature_auto_collection BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN feature_fee_auto_estimate BOOLEAN NOT NULL DEFAULT FALSE;

-- 6) DeliveryFeeRate 테이블 (API 통합 전 채널의 사장님 입력 수수료율)
CREATE TABLE deliveryfeerate (
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
);
CREATE INDEX ix_deliveryfeerate_biz_channel ON deliveryfeerate (business_id, channel);

-- 7) SettlementWatchAlert 테이블 (입금 모니터링)
CREATE TABLE settlementwatchalert (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES business(id),
    alert_type VARCHAR(32) NOT NULL,           -- 'card_overdue' / 'delivery_overdue'
    channel_or_corp VARCHAR(32) NOT NULL,      -- '삼성카드' / '쿠팡이츠' 등
    expected_date DATE NOT NULL,
    expected_amount BIGINT NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    -- 'open' / 'received' / 'acknowledged' / 'resolved' / 'false_positive'
    notified_at TIMESTAMP,
    received_amount BIGINT,
    received_date DATE,
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES "user"(id),
    notes TEXT,
    raw_ref TEXT,
    UNIQUE (business_id, alert_type, channel_or_corp, expected_date)
);
CREATE INDEX ix_settle_watch_biz_status ON settlementwatchalert (business_id, status);
CREATE INDEX ix_settle_watch_alert_type ON settlementwatchalert (alert_type);

-- 8) CardCorpSettlementProfile 테이블 (사업장 × 카드사 입금 주기 + grace_days 학습값)
CREATE TABLE cardcorpsettlementprofile (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES business(id),
    card_corp VARCHAR(32) NOT NULL,
    settlement_days_learned INTEGER NOT NULL DEFAULT 3,  -- 실측 D+N (영업일)
    grace_days INTEGER NOT NULL DEFAULT 3,                -- false-positive 가중치
    sample_size INTEGER NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, card_corp)
);
```

---

## 11. 코드 변경 영향 범위

| 파일/디렉토리 | 변경 유형 | 비고 |
|--------------|----------|------|
| `models.py` | 수정 | DailyExpense.source, SubscriptionPlan 플래그, CoupangEatsSettlement 컬럼, 신규 테이블 2개 |
| `services/auto_collection_sync/` (신규 디렉토리) | 신규 | orchestrator, normalizers/, fan_out, vendor_resolver, fee_estimator, migration |
| `services/easypos_service.py` | 수정 | `upsert_revenue_aggregate` **유지** (Revenue 테이블이 profitloss.py에서 여전히 읽힘). 단 fan_out도 호출되어 DailyExpense 까지 채워 양쪽 정합성 확보. Phase 2에서 Revenue 라우트 통일 후 폐기. |
| `services/coupang_eats_service.py` | 수정 | 정산 분해 저장 로직 추가 (raw_json → 분해 컬럼 채우기). `upsert_revenue_aggregate`는 EasyPOS와 동일 정책으로 유지. |
| `routers/bank_sync.py` | 수정 | `_sync_classified_to_models` 리팩토링 — SyncEvent emit으로 변경 |
| `routers/auto_collection.py` (신규) | 신규 | 7개 cron endpoint + 대시보드 endpoint + 마이그레이션 endpoint |
| `routers/revenue.py` | 수정 | `auto_*` source 행도 표시 (이미 DailyExpense 보므로 자동 포함, source 필터 추가 정도) |
| `routers/profitloss.py` | 수정 | 수수료 자동 추정 결과 반영 (source/confidence 표시) |
| `services/profit_loss_service.py` | 수정 | `expense_card_fee`/`expense_delivery_fee` 산출 로직을 fee_estimator 호출로 교체 |
| `frontend/src/pages/AutoCollection.jsx` (신규) | 신규 | 자동수집 대시보드 화면 + 입금 모니터 카드 |
| `frontend/src/pages/RevenueManagement/` | 수정 | 백업 토글, source 뱃지 |
| `frontend/src/pages/ProfitLoss/` | 수정 | 신뢰도 뱃지 |
| `services/auto_collection_sync/settlement_watch.py` (신규) | 신규 | 카드/배달 입금 모니터링 로직 (`watch_card_settlements`, `watch_coupang_settlements`, `auto_close_received_alerts`) |
| `services/auto_collection_sync/calendar.py` (신규) | 신규 | 한국 영업일 캘린더 (휴일/주말 보정) |
| `Orbitron.yaml` | 수정 | 신규 cron 8개 등록 (입금 모니터링 04:00 포함) |

---

## 12. 위험과 완화책

| 위험 | 영향 | 완화책 |
|------|------|--------|
| 마이그레이션 B로 사장님 수동 보정값 손실 | 손익 정확도 일시 저하 | 모든 옛 행 `manual_overwritten`로 보존, 1행 단위 복구 UI 제공 |
| 카드 수수료 학습값이 초기에는 표본 부족 | 4순위 'unavailable'로 표시 | UI에 명시적 경고 + 학습 진행률(표본/30) 표시 |
| 채널 인증 만료 (쿠팡이츠 쿠키, CODEF 인증서) | 자동수집 중단 | 텔레그램 알림 + 코덱스 P1-1 패치(401→422)로 사장님 자동 로그아웃 방지 |
| cron 시각 어긋남으로 fan-out이 raw 수집 전에 실행 | 어제 데이터 누락 | orchestrator 시작 시 `synced_at` 검증 + 직접 보강 호출 |
| 동시 실행으로 데이터 중복 | 매출 두 번 카운트 | pg_advisory_lock + Unique constraint (source 포함) 이중 방어 |
| 분류 룰 변경 시 과거 손익 영향 | 사장님 혼란 | 재처리는 명시적 트리거만 (자동 X), 변경 시 알림 |
| Orbitron 배포 환경에서 cron 7개 추가로 인한 부하 | 새벽 일시 부하 | 시각 분산 (00분, 10분, 20분...), 실패 격리 |
| 입금 모니터링 false positive 폭발 (영업일 계산 미정밀로 정상 입금까지 alert) | 사장님 알림 피로 | 카드사별 grace_days 학습 + 사장님 [입금 안된 것 아님] 버튼이 학습값에 즉시 반영 |
| 입금 모니터링 false negative (실제 미입금인데 매칭 알고리즘이 잘못 매칭) | 입금 누락 인지 지연 | CardFeeMatchLog 에 매칭 신뢰도 기록, 신뢰도 낮은 매칭은 입금 모니터에서 보조 표시 |
| 한국 공휴일 캘린더 정확성 | 입금 예상일 오산정 | 1차에서는 간이 룰 (주말 + 공휴일 하드코딩 리스트), 2차에서 holiday-kr 같은 라이브러리 도입 |

---

## 13. 성공 기준

| 기준 | 측정 방법 |
|------|----------|
| 사장님이 매장/쿠팡이츠 매출을 더 이상 손으로 입력하지 않는다 | 1주 운영 후 `source='manual'` 신규 행 수가 자동 채널 vendor에 대해 0 |
| 손익 화면의 카드 수수료가 월별 들쭉날쭉하지 않다 | 12개월 시뮬레이션 결과 월간 분산 < 기존 방식 30% |
| 사장님이 카드사 계약서를 입력하지 않는다 | `CardFeeRateLearned`에 카드사별 표본이 ≥ 20건 누적 후 신뢰도 ≥ 0.7 도달 |
| 자동수집 cron 1회 실패해도 다음날 자동 복구 | 의도 실패 테스트 후 누락 일자가 다음날 백필됨 |
| 사장님이 수동 등급으로 다운그레이드 시 자동 행 멈춤 | 등급 변경 다음날 cron이 해당 사업장 skip 로그 |
| 입금 모니터링이 실제 입금 누락을 잡아낸다 | 6개월 운영 중 입금 누락 alert 1건 이상 발견 + 카드사/채널 확인 후 정상 입금 받음 |
| 입금 모니터링 false positive 율이 학습 후 감소 | 1개월 후 false_positive 비율 < 10%, 3개월 후 < 5% |
| 사장님이 매일 아침 텔레그램 알림으로 입금 상황 파악 | 미입금 발생 후 평균 인지 시점이 deadline + 1일 이내 |

---

## 14. 다음 단계

이 설계 문서가 사장님 검토 통과되면:
1. **writing-plans 스킬** 호출 → 단계별 구현 계획 작성
2. 구현 단계는 다음 순서 추천 (각 단계 후 검증 → 다음):
   - 1단계: 데이터 모델 변경 + 마이그레이션 SQL (DailyExpense.source, CardFeeRateLearned, CardFeeMatchLog, CoupangEatsSettlement 분해 컬럼, SubscriptionPlan 플래그, DeliveryFeeRate, SettlementWatchAlert, CardCorpSettlementProfile)
   - 2단계: SyncEvent / fan_out / vendor_resolver 기반 인프라
   - 3단계: EasyPOS normalizer + 사장님 화면 1개 사업장 검증
   - 4단계: 쿠팡이츠 normalizer + 수수료 분해 추출
   - 5단계: 은행 normalizer 리팩토링
   - 6단계: 수수료 자동 추정 (3경로) + 학습 알고리즘
   - 7단계: 마이그레이션 B 정책 + 백업 UI
   - 8단계: 자동수집 대시보드 + 텔레그램 알림
   - 9단계: **입금 모니터링** (Settlement Watch) — 카드/배달 모니터링 로직 + alert 모델 + 대시보드 카드 + 학습형 grace_days
   - 10단계: cron 8개 등록 + Orbitron.yaml 반영
   - 11단계: 운영 검증 + 사장님 1주 사용

각 단계는 별도 PR + 검증 후 다음 단계 진행.
