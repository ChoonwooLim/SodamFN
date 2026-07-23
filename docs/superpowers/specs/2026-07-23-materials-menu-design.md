# 자재관리 통합 메뉴 설계 (2026-07-23)

## 목적

손익관리·직원관리와 동급의 **"자재관리"** 그룹 메뉴를 신설하고,
자재/매입/재고/거래처 품목/구매요청서 기능을 서브메뉴로 구성한다.
기존에 흩어져 있던 관련 메뉴를 전부 이 그룹으로 통합한다.

## 결정 사항 (가정 명시)

- 세션이 자율 실행 모드이므로 사장님 상시 지침("추천대로 진행 + 결과보고만")에 따라
  아래 설계로 확정 진행. 변경 요청 시 라벨/배치는 쉽게 조정 가능.
- **카톡 전송**은 알림톡(팝빌)이 아닌 **기기 공유(Web Share API) + 클립보드 복사 폴백**으로 구현.
  (알림톡은 거래처 수신동의·템플릿 필요, SMS는 발신번호 미등록으로 불가 — 기기 카톡이 가장 확실)
- 매입관리 = 기존 `/purchase`(비용관리)를 이 그룹으로 **이동** (경로 유지, 라벨만 변경).
  손익관리 그룹에서는 제거.

## 메뉴 구조 (Sidebar — 경영관리 섹션, 손익관리 바로 아래)

```
자재관리 (Boxes 아이콘)
├── 구매요청서 작성      /materials/order-form     ★신규 (플래그십)
├── 거래처·품목 관리     /materials/items          ★신규
├── 재고관리             /materials/inventory      ★신규
├── 직원 구매요청        /purchase-requests        기존 (메뉴 미노출 상태였음 → 통합)
├── 매입·비용관리        /purchase                 기존 (손익관리에서 이동)
├── 오픈 재고 체크       /inventory-check-admin    기존 (통합게시판에서 이동)
└── 거래처 관리          /vendor-settings          기존 (도구에서 이동)
```

## 데이터 모델

기존 재사용: `Vendor`(거래처, phone 보유), `Product`(거래처별 품목: 규격·단가·과세),
`Inventory`(품목별 현재고/안전재고), `PurchaseRequest`(직원 요청), `DailyExpense`(매입).

신규 1개 — `PurchaseOrder` (물품 구매 요청서, 거래처 단위 1건):

| 필드 | 타입 | 설명 |
|------|------|------|
| business_id / vendor_id | FK | 테넌트 / 거래처 |
| vendor_name, vendor_phone | str | 스냅샷 (거래처 삭제 대비) |
| order_date | date | 요청일 |
| items_json | str | `[{product_id, name, spec, quantity, unit_price, amount}]` |
| item_count / total_amount | int | 집계 |
| status | str | draft → sent → completed / canceled |
| sent_via / sent_at | str/dt | phone·kakao·copy / 전송 시각 |
| memo | str | 거래처별 요청 메모 |

테이블 생성은 startup `init_db()`의 `create_all`로 자동.

## API — `routers/materials.py` (prefix `/api/materials`, admin 전용, bid 필터)

- `GET /catalog` — 지출 거래처 + 품목 + 재고 통합 조회 (주문서·재고 화면 공용)
- `PUT /inventory/{product_id}` — 현재고/안전재고 upsert
- `POST /orders` — 장바구니 → 거래처별 요청서 일괄 생성 (draft)
- `GET /orders` — 이력 (status 필터, limit)
- `PATCH /orders/{id}` — 상태/전송수단 갱신 (sent 시 sent_at 스탬프)
- `DELETE /orders/{id}`

## 구매요청서 작성 UX (`/materials/order-form`)

1. **작성 탭**: 거래처별 아코디언 → 품목 행 `[체크] 품명 (규격·단가) [− 수량 +]`
   수량 입력 시 자동 체크. 상단 품목 검색. 하단 고정바: 거래처 N · 품목 M · 예상금액 → **[요청서 만들기]**
2. **만들기** = 거래처별 `PurchaseOrder` 즉시 저장(draft) 후 요청서 카드 화면 전환.
3. **요청서 카드** (거래처별): 거래처명 + **[📞 전화]**(tel:) **[💬 카톡 전송]**(navigator.share
   → 폴백 클립보드) **[복사]** 버튼. 품목 표 + 합계 + 인사말 포함 메시지 미리보기.
   전송/복사 시 `PATCH status=sent, sent_via` 기록.
4. **이력 탭**: 최근 요청서 목록 (상태 칩, 재전송, 완료/취소 처리).
5. 직원 구매요청 대기 건 배너 → `/purchase-requests` 링크.
6. 재고관리 화면의 "부족 품목 담기" → sessionStorage prefill로 진입.

## 프론트 변경

- `App.jsx`: lazy 라우트 3개 추가 (adminOnly)
- `Sidebar.jsx`: matSubItems 그룹 추가, 이동 항목 제거(손익관리·통합게시판·도구),
  active 경로 갱신, 서브메뉴 active 판정 `startsWith(path + '/')`로 교정
  (`/purchase` vs `/purchase-requests` 오점등 방지)
- 신규 페이지 3종 (`pages/Materials/`): Tailwind, Slate 팔레트, 모바일 우선,
  큰 터치영역(44px+) — 40~50대 사용자 배려

## 비범위 (YAGNI)

- 알림톡/문자 발송 (발신번호 미등록), 발주 단가 이력, 입고 처리 자동 재고 반영,
  카탈로그 외 자유 품목 입력 — 추후 요청 시.
