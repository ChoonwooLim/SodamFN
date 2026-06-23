# 매장별 통합 메뉴 상품(MenuItem) — 설계

> 2026-06-23 · 상품관리(레시피·메뉴판)를 매장 고유 데이터 + 등록기능으로 전환

## 배경 / 문제

상품관리 4페이지 중 2개가 **전역 하드코딩**이라 모든 매장이 같은 데이터를 본다:

| 페이지 | 현재 | 매장별? |
|---|---|---|
| 배달앱 이미지 | `DeliveryImage` DB (`/api/delivery-images`) | ✅ |
| 매장 홍보물 | `/promotions` API | ✅ |
| 레시피 관리 | 프론트 `data/recipes.js` (전역) | ❌ |
| 메뉴판/가격표 | 프론트 `data/menuPrices.js` (전역) | ❌ |

→ 레시피관리·메뉴판을 **매장별 DB + 등록기능**으로 전환한다.

## 결정 (승인됨)

1. **통합 메뉴 상품 1개 모델** — 가격·재료·조리법을 한 메뉴에 함께. 메뉴판/레시피가 같은 데이터 공유.
2. **기본 메뉴로 채워서 시작** — 신규/기존 매장 모두 기본 메뉴 자동 시드.
3. **레시피 + 메뉴판 둘 다** 이번에 작업.

## 데이터 모델 — `MenuItem` (신규 테이블)

매장별(`business_id`) 스코프. 레시피관리의 **상품/재료 두 탭**을 `item_type` 하나로 커버.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | int PK | |
| business_id | int FK, index | 매장 격리 |
| item_type | str | `product`(판매메뉴, 가격O) / `ingredient`(재료 레시피, 가격X) |
| name | str | 메뉴/재료명 |
| category | str | product: gimbap/bunsik/onigiri/ramen/drinks · ingredient: banchan/tuna/sauce/sushi/meat/prep/onigiri |
| price | int=0 | 판매가 (product만) |
| emoji | str? | 표시 이모지 (🍱 등) |
| spec | str? | 규격/수율 (예: "1인분", "10개") |
| ingredients | str?(JSON 배열) | 재료 목록 |
| steps | str?(JSON 배열) | 조리 단계 |
| image_url | str? | 메뉴 사진 (선택, 추후 배달앱이미지 연동 여지) |
| sort_order | int=0 | 표시 순서 |
| is_active | bool=true | 판매/표시 여부 |
| created_at | datetime | |

## 백엔드 API — `routers/menu_items.py` (prefix `/api/menu-items`)

모두 `get_bid_from_token` + `apply_bid_filter`로 매장 격리. 쓰기는 viewer 메서드차단으로 자동 읽기전용.

- `GET /api/menu-items?item_type=` — 매장 메뉴 목록 (type 필터). **목록이 비어 있으면 기본 메뉴 자동 시드 후 반환** (idempotent).
- `POST /api/menu-items` — 메뉴 등록
- `PUT /api/menu-items/{id}` — 수정 (이름/가격/카테고리/재료/조리법/순서/활성)
- `DELETE /api/menu-items/{id}` — 삭제
- (선택) `POST /api/menu-items/reset-defaults` — 기본 메뉴로 초기화

### 기본 메뉴 시드 데이터
`services/default_menu.py` 의 `DEFAULT_MENU` 상수 — 현재 `recipes.js`(일반 레시피) + `menuPrices.js`(가격)를 병합·일반화(브랜드명 제거)한 product/ingredient 목록. 자동 시드(첫 GET) + 기존 매장 일괄 시드 스크립트가 공유.

### 기존 매장 마이그레이션
`scripts/maintenance/seed_menu_items.py` — 소담(1)·장인(2)·강동(3) 등 기존 매장에 기본 메뉴 1회 시드(이미 있으면 skip).

## 프론트엔드

### 메뉴판/가격표 (`ProductManagement/MenuBoard.jsx`)
- `MENU_PRICES` 하드코딩 제거 → `GET /menu-items?item_type=product` 로드.
- 편집모드에 **＋메뉴 추가 / 이름·가격·카테고리 인라인 수정 / 삭제** (POST/PUT/DELETE).
- 카테고리 라벨: 김밥류·분식류·주먹밥류·라면류·음료류. 메뉴판 이미지(PNG/PDF) 생성은 유지.

### 레시피 관리 (`RecipeBook.jsx`)
- `data/recipes.js` 제거 → `GET /menu-items` 로드, `item_type`으로 상품/재료 탭 분리.
- 카드에 **＋레시피 추가 / 재료·조리법 편집 / 삭제** 모달(POST/PUT/DELETE).
- 한 메뉴 등록 시 메뉴판·레시피 동시 반영(같은 레코드).

### 공통
- `src/api.js`(토큰+View-As bid) 사용 → 매장 격리 자동. 빈 매장은 백엔드 자동 시드로 첫 진입부터 채워짐.

## 영향 없음 / 비범위
- 배달앱 이미지·매장 홍보물: 이미 매장별 → 변경 없음.
- 거래처용 `Product` 모델(품목/세금계산서): 별개 → 건드리지 않음.
- 전역 `data/recipes.js`·`data/menuPrices.js`: 시드로 이전 후 프론트 참조 제거(파일은 남겨도 무방, import만 제거).

## 테스트/검증
- 백엔드: MenuItem CRUD가 bid 스코프(타 매장 격리), 빈 매장 GET 시 자동 시드.
- 마이그레이션: 기존 3개 매장 시드 건수 확인.
- 프론트: 빌드 통과, 메뉴판·레시피가 매장별 데이터 표시 + 등록/수정/삭제 동작.
