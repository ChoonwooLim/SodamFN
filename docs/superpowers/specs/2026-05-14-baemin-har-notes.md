# 배민 self.baemin.com HAR 분석 노트

- **HAR 출처**: `C:/WORK/SodamFN/2026서류/self.baemin.com.har` (9.2MB, 450 entries)
- **캡처일**: 2026-05-14
- **계정**: HONG JI YEON / sodam2025hl@gmail.com / shopOwnerNumber=202504230008 / 소담김밥 shopNumber=14746996

---

## 1. 도메인 / API 호스트

**기존 spec 가정 변경 필요**: `ceo.baemin.com` ❌ → 실제 사용 도메인은 두 가지로 분리:

| 도메인 | 용도 |
|---|---|
| `https://self.baemin.com` | 브라우저 페이지 (사장님사이트 UI) — origin/referer 헤더에 사용 |
| `https://self-api.baemin.com` | API 호출 — fetch_orders/settlements 등 |
| `https://biz-member.baemin.com` | 로그인 / 인증 페이지 |
| `https://self-commerce.baemin.com` | 배민커머스 micro-frontend |
| `https://menu-self.baemin.com` | 메뉴 관리 micro-frontend |

---

## 2. 식별자 모델

기존 plan 의 `store_id: str` 단일 컬럼은 부족. **두 개 컬럼으로 분리** 필요:

- **`shop_owner_number`** = `202504230008` — 점주(사장님) ID. **정산/매출 API 의 핵심 파라미터** (`shopOwnerNumber=`).
- **`shop_number`** = `14746996` — 매장 ID. 통계/리뷰/대시보드 API 에서 사용 (`shopNumber=`).

→ `BaeminCredential` 에 `shop_owner_number` (필수) + `shop_number` (옵션, 매장 1개면 자동 채워짐) 분리. plan 의 `store_id` 컬럼은 `shop_owner_number` 로 의미를 재사용 가능 (이름 그대로 둘 수도, 명확화를 위해 추가도 가능).

---

## 3. 인증

### 쿠키
브라우저 세션 쿠키 (필수 추정 — break 전 자동 분석에 잡히지 않았으나 모든 self-api 호출에 동반).

### 커스텀 헤더 (필수)
- `x-e-request: 72im16|1778733548416|79e94e65cee5a0fd6b67748ef1056cc86eee6872d3bf6eee9241f9dff8f`
  - 형식: `{terminalId}|{timestamp_ms}|{deviceFingerprint}`
  - timestamp 는 호출마다 갱신 가능 (필수일 수도)
- `x-pathname-trace-key: /orders/history` — 현재 페이지 URL path (UI 화면 매핑용)
- `x-web-version: v20260513082427` — 빌드 버전

### 표준 헤더
- `accept: application/json`
- `accept-language: ko-KR`
- `origin: https://self.baemin.com`
- `referer: https://self.baemin.com/{page}`
- `user-agent: Chrome 계열`

→ HAR 캡처 시 사용된 `x-e-request` 값을 그대로 재사용해도 무방한지, timestamp 부분만 갱신해야 하는지는 구현 후 테스트.

---

## 4. 핵심 API 엔드포인트

### 4.1 세션 검증 — `GET /v1/session/user-profile`

```
GET https://self-api.baemin.com/v1/session/user-profile

Response:
{
  "memNo": "250905000155",
  "memName": "HONG JI YEON",
  "shopOwnerNumber": "202504230008",
  "decodedEmail": "sodam2025hl@gmail.com",
  "decodedMobileNo": "01071391796",
  ...
}
```

→ `whoami()` 메소드는 이 URL 호출. 응답에서 `shopOwnerNumber` 추출해 cred 에 자동 저장.

### 4.2 매장 list — `GET /v4/store/shops/search`

```
GET /v4/store/shops/search?shopOwnerNo={shopOwnerNumber}&pageSize=50&desc=true&lastOffsetId=

Response:
{
  "contents": [
    {
      "name": "소담김밥",
      "shopNumber": 14746996,   // 실제로 응답 어딘가에 shopNumber 있음 (URL 다음 호출이 /v4/store/shops/{14746996} 임)
      "serviceType": {"code": "FOOD", "name": "음식배달"},
      "deliveryTypes": ["AGENCY_DELIVERY", "OWN_DELIVERY", "VISIT"],
      "status": "OPEN",
      ...
    }
  ],
  "nextOffsetId": null,
  "hasNext": false
}
```

→ 매장 정보 + shopNumber 추출.

### 4.3 주문 (메인 매출) — `GET /v4/orders` ⭐

```
GET /v4/orders?offset=0&limit=10&startDate=2026-05-08&endDate=2026-05-14&shopOwnerNumber=202504230008&shopNumbers=&orderStatus=CLOSED

Response:
{
  "totalSize": 53,
  "totalPayAmount": 789500,
  "contents": [
    {
      "order": {
        "orderNumber": "T2CV0000CXL8",     // ← unique key
        "status": "CLOSED",
        "deliveryType": "DELIVERY",
        "payType": "BARO",
        "payAmount": 11500,                // ← 주문금액 (총 매출)
        "orderDateTime": "2026-05-14T12:37:00",
        "shopNumber": 14746996,
        "itemsSummary": "소담떡볶이 외 2",
        "items": [...],
        "adCampaign": {"key": "BAEMIN_1_PLUS", "baeminClubMemberShip": false},
        "serviceType": "FOOD",
        "totalInstantDiscountAmount": 2000,
        "instantDiscounts": [...],
        "partialCanceled": true,
        "isPartialCanceled": true
      },
      "settle": {
        "notDisplayReason": "NOT_READY",   // 정산 미준비 (실시간 주문)
        "orderBrokerageAmount": 0,
        "orderBrokerageItems": [
          {"code": "ORDER_AMOUNT", "name": "주문금액", "amount": 13000},
          {"code": "ADVERTISE_FEE", "name": "중개이용료", "amount": -936},
          {"code": "DISCOUNT_AMOUNT", "name": "고객할인비용", "amount": -1000,
           "depth3Items": [{"code": "TOTAL_ORDER_IMMEDIATE_DISCOUNT", "name": "주문금액 즉시할인", "amount": -1000}]}
        ],
        "deliveryItemAmount": -3400,
        "deliveryItems": [
          {"code": "DELIVERY_SUPPLY_PRICE", "name": "배달비", "amount": -3400},
          {"code": "DEVLIERY_TIP_INSTANT_DISCOUNT", "name": "배달팁 할인비용", "amount": 0},
          {"code": "BAEMIN_CLUB_INSTANT_DISCOUNT", "name": "배민클럽 할인비용", "amount": 0,
           "depth3Items": [
             {"code": "TOTAL_CLUB_DELIVERY_TIP_IMMEDIATE_DISCOUNT", "name": "배민클럽 배달팁 할인", "amount": -3091},
             {"code": "WOOWABROS_CLUB_DELIVERY_TIP_IMMEDIATE_DISCOUNT", "name": "배민클럽 배달팁 할인 지원", "amount": 3091}
           ]}
        ],
        "etcItemAmount": 0,
        "etcItems": [],
        "deductionAmountTotalVat": null,
        "meetAmount": null,
        "depositDueAmount": null,
        "depositDueDate": null,
        "total": 0
      }
    },
    ...
  ]
}
```

**핵심 발견**: **주문 단위에 수수료 분해가 포함**. 별도 정산 API 호출 안 해도 fee 데이터 추출 가능.

**페이지네이션**: `offset` + `limit` 패턴 (쿠팡의 page/size 와 다름).

**핵심 코드 매핑** (BaeminSettlement fee 컬럼 대응):
- `fee_brokerage` ← `orderBrokerageItems[code=ADVERTISE_FEE].amount` (음수, 절댓값 사용)
- `fee_payment` ← `etcItems[code=PG_COMMISSION 또는 PAYMENT_FEE].amount`
- `fee_delivery` ← `deliveryItems[code=DELIVERY_SUPPLY_PRICE].amount`
- `fee_advertising` ← 별도 API (광고비) — `/v3/statistics/order-costs` 가 후보
- `fee_coupon_owner` ← `orderBrokerageItems[code=DISCOUNT_AMOUNT].amount` (점주 부담분 = `distributions[type=SHOP].amount`)

→ Plan 의 BaeminSettlement 의 fee 컬럼들은 주문에서 추출한 합계로 채울 수도 있음. 또는 BaeminOrder 에 fee 컬럼 추가하는 옵션도 검토.

### 4.4 정산 (입금 내역) — `GET /v3/settle/history/summary` ⭐

```
GET /v3/settle/history/summary?settleType=ALL&startDate=2026-05-14&endDate=2026-05-17&shopOwnerNumber=202504230008&page=0&size=10

Response:
{
  "foodSuccess": true,
  "commerceSuccess": true,
  "contents": [
    {
      "giveId": 518740754,                    // ← unique key (seller_transfer_id)
      "depositDueDate": "2026-05-15",          // ← settlement_date
      "settleCode": "FOOD",
      "settleCodeName": "음식배달",
      "giveStatus": "REQUEST",                 // ← REQUEST / COMPLETE
      "giveStatusName": "입금요청",
      "giveTarget": "SHOP_OWNER",
      "giveCycleCode": "DAY_1",
      "giveStartDate": "2026-05-12",
      "giveEndDate": "2026-05-12",
      "giveAmount": 110000,                    // ← amount
      "giveSettleOneDay": true
    },
    ...
  ],
  "totalSize": 2
}
```

**페이지네이션**: `page` + `size`.

**모델 매핑** (BaeminSettlement):
- `seller_transfer_id` ← `giveId` (정수 → str)
- `settlement_date` ← `depositDueDate`
- `settlement_type` ← `giveStatus` (REQUEST/COMPLETE)
- `amount` ← `giveAmount`
- raw_json: 전체 dict 보관

### 4.5 부가세 / 매출 합계 (선택) — `GET /v3/surtax/history/sales`

```
GET /v3/surtax/history/sales?shopOwnerNumber=...&startDate=2025-11&endDate=2026-04&excludeMeet=true

Response: {totalSupplyPriceSum, totalVatSum, totalTxAmountSum, payGroups: [{code: PG/CARD/CASH, ...}]}
```

→ 검증용. 자동수집 main flow 에선 사용 안 함.

### 4.6 통계 일별 매출 (선택) — `GET /v3/statistics/orders/summary`

```
GET /v3/statistics/orders/summary?shopNumber=14746996&period=MONTH&month=2026-04

Response: {graph:{data:[{x:"YYYY-MM-DD", y:일별매출}]}, orderAmount, orderCount}
```

→ 일별 매출 빠른 조회 (대시보드용). 자동수집 main flow 에선 /v4/orders 직접 합계로 대체 가능.

---

## 5. 기존 Spec/Plan 변경 사항

| 항목 | Plan 가정 | HAR 실제 | 영향 |
|---|---|---|---|
| BASE_URL | `https://ceo.baemin.com` | `https://self-api.baemin.com` | 코드 상수 변경 |
| Origin/Referer | `ceo.baemin.com` | `self.baemin.com` | `_common_headers` 변경 |
| store_id | 단일 string | shopOwnerNumber + shopNumber 2개 | 모델/Pydantic DTO 보강 (단, 1차 구현은 shopOwnerNumber 만 필수) |
| fetch_orders 파라미터 | page_number/page_size | offset/limit, +orderStatus=CLOSED | 시그니처 변경 |
| fetch_settlements 파라미터 | page/size + settleType | 동일 | OK |
| 주문 응답 구조 | 추정 | `{totalSize, totalPayAmount, contents:[{order, settle}]}` | upsert_orders 파싱 로직 확정 |
| 정산 unique key | seller_transfer_id (string) | `giveId` (int → str) | OK |
| 수수료 분해 위치 | BaeminSettlement | 실제론 BaeminOrder.settle.{orderBrokerage/delivery/etc}Items | normalizer 에서 주문 단위 집계로 변경 |
| 필수 커스텀 헤더 | 없음 | `x-e-request`, `x-pathname-trace-key`, `x-web-version` | BaeminClient 의 `_common_headers` 보강 |

---

## 6. Task 5 구현 가이드 (요약)

`BaeminClient` 의 실제 메소드 구현 시:

1. `BASE_URL = "https://self-api.baemin.com"` + `WEB_ORIGIN = "https://self.baemin.com"`
2. `_common_headers` 에 `x-e-request` / `x-pathname-trace-key` / `x-web-version` 추가. 값은 HAR 의 값을 placeholder 로 시작 (실제 사용 시 timestamp 갱신 로직 추가 가능).
3. `whoami()` → `GET /v1/session/user-profile` 호출. 응답에서 `shopOwnerNumber` 추출 → 반환.
4. `list_stores(shop_owner_number)` → `GET /v4/store/shops/search?shopOwnerNo=...&pageSize=50&desc=true`
5. `fetch_orders(shop_owner_number, start_date, end_date, offset=0, limit=10, order_status='CLOSED')` → `/v4/orders?...`
6. `fetch_all_orders(shop_owner_number, start_date, end_date)` → 페이지네이션 (`totalSize` 검사 + `offset += limit`)
7. `fetch_settlements(shop_owner_number, start_date, end_date, page=0, size=10, settle_type='ALL')` → `/v3/settle/history/summary?...`
8. `fetch_all_settlements(...)` → 페이지네이션 (`totalSize` 검사 + `page += 1`)

응답 파싱 시 `notDisplayReason='NOT_READY'` 인 settle 블록은 정산 미준비 — 수수료 데이터 없음 (Order 만 사용, Settlement 합계는 별도 정산 API 가 정답).
