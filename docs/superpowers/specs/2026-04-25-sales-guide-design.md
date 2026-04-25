# 영업관리 (Sales Guide) — 설계 명세

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-04-25 |
| 작성자 | Claude (브레인스토밍 합의 기반) |
| 대상 사용자 | 처음 사업을 시작하는 사장님 (소담김밥 = 휴게음식점) |
| V1 범위 | 어드민 앱 한정, 휴게음식점 1 업종 콘텐츠 |
| 후속 단계 | `docs/superpowers/plans/` 의 구현 계획서 |

---

## 1. 목적

처음 사업을 시작하는 사장님이 어드민 앱에 접속하면, **영업 시작·운영에 필요한 모든 정보를 한 자리에서 파악**할 수 있도록 새로운 최상위 메뉴 "영업관리"를 추가한다. 1차는 소담김밥(휴게음식점) 기준으로 작성하고, 차후 카페·치킨 등 업종으로 확장한다.

설계 모티브는 https://gaongn.net/certifications 의 카드형 인허가 정보 표시 패턴(카테고리 카드 → 항목 모달 → 신청 절차/필요서류/법적근거 표시).

---

## 2. 합의된 결정 (브레인스토밍 결과)

| 결정 항목 | 결정 |
|---|---|
| 사이드바 위치 | 새 최상위 그룹 "영업관리" — "메인" 다음, "상품관리" 위 |
| 카테고리 수 | 6 (인허가·신고 / 배달·온라인 / 결제·POS / 세무·회계 / 인력·노무 / 운영팁) |
| 운영팁 | 1차는 7 서브카테고리 골격만 노출, 본문은 "준비 중" — 콘텐츠는 점진 업데이트 |
| 데이터 출처 | SodamFN 자체 보유 (자체 콘텐츠 작성). 각 항목에 정부 사이트 deep-link 제공 |
| UI 패턴 | gaongn.net `/certifications` 스타일 (카테고리 카드 + 항목 상세 모달) |
| 인터랙션 레벨 | **L3** — 체크리스트 + 핵심 날짜 입력. 자동 알림은 V2.1로 분리 |
| 권한 | V1 어드민(사장) 전용. 직원앱 노출 없음 |
| 업종 확장 | 데이터 구조에 `industry` 키 도입, V1 은 "kimbap" 한정 |
| 콘텐츠 저장 | 정적 JS 파일 (frontend `src/data/sales-guide/*.js`) + DB 는 진행상태만 |
| 외국인 고용 가이드 | HR > 외국인고용 메뉴 폐지 → 영업관리 인력 카테고리로 이주 |
| 회사 문서 통합 | `business_docs.py` 5 개 문서 타입을 영업관리 항목 카드에서 직접 업로드 가능 |
| 자동 동기화 (sync) | 5 개 핵심 연결 (보건증/위생교육/사업자등록/근로계약서/4대보험) |

---

## 3. 아키텍처

### 3.1 디렉토리·파일 구성

```
SodamApp/
├── frontend/src/
│   ├── data/sales-guide/
│   │   ├── index.js                # 업종 레지스트리
│   │   ├── kimbap.js               # 휴게음식점 마스터 데이터 (V1 유일)
│   │   └── _shared.js              # 업종 공용 항목 (사업자등록 등 공통)
│   ├── pages/sales-guide/
│   │   ├── SalesGuideHome.jsx      # /sales-guide 랜딩
│   │   ├── CategoryPage.jsx        # /sales-guide/{category} 카테고리별
│   │   └── ItemDetailModal.jsx     # 항목 상세 모달
│   └── components/sales-guide/
│       ├── ProgressCard.jsx        # 카테고리 진행률 카드
│       ├── ItemCard.jsx            # 항목 체크리스트 카드
│       ├── DateInputDrawer.jsx     # 완료일/만료일 입력
│       └── DeepLinkButton.jsx      # 외부/내부 링크 버튼
├── backend/
│   ├── models.py                   # SalesGuideProgress 모델 1개 추가
│   └── routers/sales_guide.py      # 4 엔드포인트
└── docs/superpowers/
    ├── specs/2026-04-25-sales-guide-design.md   (본 문서)
    └── plans/2026-04-25-sales-guide.md          (writing-plans 단계에서 작성)
```

### 3.2 라우팅

| 경로 | 페이지 |
|---|---|
| `/sales-guide` | SalesGuideHome (랜딩, 6 카테고리 카드) |
| `/sales-guide/permits` | CategoryPage (인허가·신고) |
| `/sales-guide/delivery-apps` | CategoryPage (배달·온라인) |
| `/sales-guide/payment` | CategoryPage (결제·POS) |
| `/sales-guide/tax` | CategoryPage (세무·회계) |
| `/sales-guide/hr` | CategoryPage (인력·노무) |
| `/sales-guide/operations` | CategoryPage (운영팁, 1차는 골격만) |

CategoryPage 1 컴포넌트가 6 페이지 모두 처리 (URL 파라미터로 카테고리 키 전달).

### 3.3 데이터 흐름

```
[정적 콘텐츠] kimbap.js  ──┐
                           ├─▶ React 화면 머지 렌더
[사업장 진행상태] DB       ─┤
                           ↑
          ┌─ 사장님 체크/날짜 입력 (PATCH /api/sales-guide/progress/{key})
          └─ 외부 모듈 자동 카운트 (HR·세무 → sync-status API)
```

### 3.4 핵심 설계 원칙

1. **콘텐츠는 코드, 진행상태는 DB**: 두 데이터 소스를 화면에서 머지
2. **deep-link 표준**: 모든 항목이 1+ 개 deep-link 보유 (외부 정부 사이트 또는 내부 SodamFN 페이지)
3. **HR·세무 모듈과 중복 금지**: 영업관리는 *가이드 + 메타정보*. 실제 데이터 입력은 기존 페이지로 안내. 단, 진행 상태는 자동 카운트로 가져와 표시
4. **업종 확장 차원**: `kimbap.js` 만 추가하면 신규 업종 지원
5. **MERGE-DOCS**: `business_docs.py` 5 개 문서 타입은 영업관리 항목 카드에서도 업로드 가능 (백엔드 API 재사용)

---

## 4. 데이터 스키마

### 4.1 정적 콘텐츠 형식 (JS)

```js
// frontend/src/data/sales-guide/kimbap.js
export default {
  industry: 'kimbap',
  industryLabel: '휴게음식점 (김밥)',
  categories: [
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
          description: '사업 개시 후 20일 이내 신청 필수.',
          steps: [/* 단계 배열 */],
          documents: [/* 필요 서류 배열 */],
          tips: [/* 팁 배열 */],
          deepLinks: [
            { label: '홈택스 사업자등록', url: 'https://hometax.go.kr/...', external: true },
          ],
          internalLinks: [
            { label: 'Settings > 회사정보', path: '/settings', external: false },
          ],
          syncWith: 'business.business_number',  // 자동 동기화 키
          mergedDocs: ['biz_registration'],      // business_docs 통합 키
          dateFields: [{ key: 'completed_at', label: '등록일' }],
        },
        // ... 나머지 항목
      ],
    },
    // ... 나머지 5 카테고리
  ],
};
```

### 4.2 항목 스키마 필드 정의

| 필드 | 타입 | 필수 | 용도 |
|---|---|---|---|
| `key` | string | ✓ | 전역 고유 ID (DB join key, 점-구분 네임스페이스) |
| `title` | string | ✓ | 항목 이름 |
| `required` | boolean | ✓ | 필수(true) vs 권장(false) |
| `renewalCycle` | `{months}` \| `null` | ✓ | 갱신 주기. null = 1회성 |
| `authority` | string | ✓ | 담당 기관 |
| `processingDays` | string | ✓ | 예상 처리 기간 |
| `legalBasis` | string | — | 법적 근거 |
| `description` | string | ✓ | 1~2 줄 설명 |
| `steps` | string[] | ✓ | 신청 단계 (모달 numbered list) |
| `documents` | string[] | — | 필요 서류 |
| `tips` | string[] | — | 주의·팁 |
| `deepLinks` | `{label, url, external:true}[]` | ✓ | 외부 정부/공공 사이트 (1+ 개) |
| `internalLinks` | `{label, path, external:false}[]` | — | SodamFN 내부 페이지 (HR·세무 등) |
| `syncWith` | string | — | 진행상태 자동 동기화 키 (sync-status 응답에서 매칭) |
| `mergedDocs` | string[] | — | business_docs 문서 타입 키 (해당 항목 카드에서 업로드 가능) |
| `dateFields` | `{key, label}[]` | — | 사용자 입력 가능한 날짜 필드 |

### 4.3 DB 모델

```python
# backend/models.py

class SalesGuideProgress(SQLModel, table=True):
    __tablename__ = "sales_guide_progress"
    __table_args__ = (UniqueConstraint("business_id", "item_key"),)

    id: int | None = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    item_key: str = Field(index=True)               # "permits.business_registration"

    is_completed: bool = Field(default=False)
    completed_at: date | None = None                # 발급/완료일
    expires_at: date | None = None                  # 만료일 (renewalCycle 있는 항목)
    notes: str | None = None                        # 사장님 자유 메모

    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: int | None = Field(default=None, foreign_key="user.id")
```

- 1 사업장 × 1 항목 = 1 row
- 신규 사업장은 진행상태가 빈 상태로 시작, 항목 토글 시 upsert 로 row 생성
- `notification_enabled` 필드는 V1 에 두지 않음. V2.1 마이그레이션에서 추가

---

## 5. 1차 콘텐츠 카탈로그 (38 항목)

V1 출시 시점에 데이터 파일에 포함될 항목. 각 항목의 본문(steps/documents/tips)은 구현 단계에서 작성한다.

### 5.1 인허가·신고 (7 항목)

| # | item_key | 제목 | 필수 | 갱신 | 담당기관 | sync | mergedDocs |
|---|---|---|---|---|---|---|---|
| 1 | permits.business_registration | 사업자등록 | ✓ | — | 국세청/홈택스 | business.business_number | biz_registration |
| 2 | permits.restaurant_report | 휴게음식점 영업신고 | ✓ | — | 시·군·구청 위생과 | — | biz_license |
| 3 | permits.hygiene_education | 위생교육 이수 | ✓ | 매 1년 | 한국휴게음식업중앙회 | hr.hygiene_certificates | — |
| 4 | permits.health_certificate | 보건증 (직원 건강진단) | ✓ | 매 1년 | 보건소 | hr.health_certificates | — |
| 5 | permits.fire_insurance | 화재배상책임보험 | ✓ | 매 1년 | 보험사 | — | insurance |
| 6 | permits.lpg_report | LPG 사용신고 | △ | — | 시·군·구청 가스과 | — | — |
| 7 | permits.waste_food_report | 음식물쓰레기 신고 | ✓ | — | 시·군·구청 청소과 | — | — |

### 5.2 배달·온라인 채널 (8 항목, 모두 NEW)

| # | item_key | 제목 | 필수 |
|---|---|---|---|
| 1 | delivery.baemin | 배달의민족 사장님 가입 | △ |
| 2 | delivery.coupang_eats | 쿠팡이츠 사장님 가입 | △ |
| 3 | delivery.yogiyo | 요기요 사장님 가입 | △ |
| 4 | delivery.naver_place | 네이버 스마트플레이스 등록 | ✓ |
| 5 | delivery.kakao_map | 카카오맵 사장님 등록 | ✓ |
| 6 | delivery.instagram | 인스타그램 비즈니스 계정 | △ |
| 7 | delivery.naver_booking | 네이버 예약/주문 | △ |
| 8 | delivery.local_apps | 위메프오·배달특급 등 지역 앱 | △ |

### 5.3 결제·POS (5 항목)

| # | item_key | 제목 | 필수 | 비고 |
|---|---|---|---|---|
| 1 | payment.card_terminal | 카드 단말기 신청 | ✓ | NEW |
| 2 | payment.cashbill_merchant | 현금영수증 가맹점 등록 | ✓ | LINK → /finance/cashbill |
| 3 | payment.pos_system | POS 시스템 도입 | △ | NEW |
| 4 | payment.simple_pay | 제로페이/페이코 등록 | △ | NEW |
| 5 | payment.delivery_settlement | 배달앱 정산계좌 등록 | ✓ | LINK |

### 5.4 세무·회계 일정 (6 항목)

| # | item_key | 제목 | 필수 | 주기 | sync | mergedDocs |
|---|---|---|---|---|---|---|
| 1 | tax.vat_filing | 부가가치세 신고 | ✓ | 1월·7월 (반기) | — | vat_return |
| 2 | tax.income_tax | 종합소득세 신고 | ✓ | 5월 | — | — |
| 3 | tax.withholding | 원천세 신고 | ✓ | 매월/반기 | — | — |
| 4 | tax.business_card | 사업자 신용카드 발급 | △ | — | — | — |
| 5 | tax.social_insurance_org | 4대보험 사업장 가입 신고 | ✓ | 1회 | — | insurance |
| 6 | tax.daily_worker_report | 일용직 근로내용 확인 신고 | △ | 매월 | — | — |

### 5.5 인력·노무 (5 항목)

대부분 HR 메뉴 deep-link.

| # | item_key | 제목 | 필수 | sync | LINK |
|---|---|---|---|---|---|
| 1 | hr.labor_contract | 근로계약서 작성 | ✓ | hr.contracts (Staff별 ElectronicContract) | /employees |
| 2 | hr.social_insurance_staff | 4대보험 직원별 가입 | ✓ | hr.insurance_4major | /employees |
| 3 | hr.minimum_wage | 최저임금·법정수당 이해 | ✓ | — | (가이드 only) |
| 4 | hr.foreign_worker | 외국인 고용 절차 | △ | — | /employees (visa_type 입력) |
| 5 | hr.severance_pay | 퇴직금 적립 (퇴직연금/IRP) | ✓ | — | /hr/retirement |

### 5.6 운영팁 (1차는 골격만, 7 서브카테고리)

각 서브카테고리는 카드만 노출하고 본문은 "준비 중 — 곧 공개됩니다" 표시. 콘텐츠는 점진 업데이트.

| # | item_key | 제목 |
|---|---|---|
| 1 | ops.hygiene_check | 위생관리 일일/주간 체크리스트 |
| 2 | ops.inventory | 식자재·재고 관리 |
| 3 | ops.daily_routine | 오픈/마감 루틴 |
| 4 | ops.customer_service | 고객응대·클레임 대응 |
| 5 | ops.sns_marketing | SNS·리뷰 마케팅 |
| 6 | ops.financial_analysis | 매출/인건비 분석 |
| 7 | ops.crisis_response | 위기대응 (식중독·단전·민원) |

---

## 6. 통합·이주 결정

### 6.1 MIGRATE-CONTENT (1 건)

| 항목 | 현재 위치 | 처리 |
|---|---|---|
| 외국인 고용 가이드 | `/hr/foreign-worker-guide` (ForeignWorkerGuide.jsx) | 콘텐츠를 영업관리 `hr.foreign_worker` 항목 모달 본문으로 흡수. 기존 라우트 → 새 위치로 redirect. 사이드바 HR > 외국인고용 메뉴 제거. 직원별 visa_type 입력은 `/employees` 안에서 계속 |

### 6.2 MERGE-DOCS (5 건)

`backend/routers/business_docs.py` 의 회사 단위 문서 타입을 영업관리 항목 카드와 1:1 매핑. 백엔드 API 는 재사용, UI 는 두 곳 (영업관리 + Settings 회사정보) 모두에서 업로드/조회 가능.

| business_docs 키 | 영업관리 항목 |
|---|---|
| `biz_registration` | permits.business_registration |
| `biz_license` | permits.restaurant_report |
| `insurance` | permits.fire_insurance / tax.social_insurance_org (다중 매핑) |
| `vat_return` | tax.vat_filing |

### 6.3 SYNC-LINK 자동 카운트 (5 개)

`GET /api/sales-guide/sync-status` 가 반환하는 동기화 정보. 항목 카드에 보조 표시 + 카테고리 진행률 계산에 반영.

| 영업관리 항목 | 동기화 소스 (백엔드 계산) | 표시 예 |
|---|---|---|
| permits.health_certificate | `Staff.doc_health_cert` 등록 카운트 | "직원 18/19" |
| permits.hygiene_education | HR `certificate.py` 식품위생교육증 | "이수 / 만료 D-15" |
| permits.business_registration | `Business.business_number` + biz_registration 문서 존재 | "등록 완료" |
| hr.labor_contract | Staff별 ElectronicContract 발효 카운트 | "발효 12/19" |
| hr.social_insurance_staff | `Staff.insurance_4major` 카운트 | "가입 17/19" |

### 6.4 SYNC-LINK 완료 판정 규칙

- 카운트가 `total` 미만 → partial 표시 (예: 18/19)
- 카운트가 `total` 100% → 자동 완료 판정 (sales_guide_progress 의 is_completed 와 무관하게 카테고리 진행률에 완료로 반영)
- 카운트가 0 → 미시작
- 만료 D-day < 0 → 만료 (재발급 필요, 미완료로 다운그레이드)

### 6.5 사이드바 변경

| 변경 | 내용 |
|---|---|
| 신규 추가 | 최상위 그룹 "영업관리" — "메인" 다음, "상품관리" 위. 6 하위 카테고리 메뉴. 라벨에 미완료/만료임박 카운트 빨간 배지 (예: `영업관리 ⓘ3`) |
| 제거 | HR > 외국인고용 (`/hr/foreign-worker-guide`) |
| 변경 없음 | Settings > 회사정보 탭 (영업관리와 동일 백엔드 API 사용, 양쪽 모두에서 접근 가능) |

---

## 7. UI 흐름·컴포넌트

### 7.1 화면 계층

```
사이드바 [영업관리]
    ↓
[1] SalesGuideHome  /sales-guide
    ├─ 헤더: 업종 + 전체 진행률
    ├─ 6 카테고리 카드 (데스크탑 2×3 그리드, 모바일 1열)
    └─ 1차 방문자 안내 배너
    ↓ 카드 클릭
[2] CategoryPage  /sales-guide/{category}
    ├─ 브레드크럼 + 진행률 바
    ├─ Sticky 필터 (전체/필수/완료/미완료/만료임박)
    ├─ 항목 카드 리스트
    └─ 다음 카테고리 네비
    ↓ "자세히" 클릭
[3] ItemDetailModal
    ├─ 헤더: 제목/필수배지/담당기관/처리기간
    ├─ 본문 5 섹션:
    │    1. 개요 + 법적근거
    │    2. 신청 절차 (steps numbered)
    │    3. 필요 서류 (documents 체크리스트)
    │    4. 팁·주의사항
    │    5. 내 진행 상황 (체크 토글, 날짜, 메모, 문서 업로드, sync 카운트)
    └─ 푸터: deepLinks 버튼들
```

### 7.2 ProgressCard (랜딩 카드)

표시:
- 카테고리 아이콘 + 라벨
- 진행률 바 + 백분율
- "필수 N개 중 M개 완료"
- 만료임박/만료 항목 1+ → 주황 경고 한 줄

상태별 시각:
- 진행률 100% → 초록 테두리
- 만료임박 1+ → 주황 줄 추가
- 0% → 점선 테두리 + "시작하기 →"

### 7.3 ItemCard (카테고리 페이지)

표시:
- 좌측 체크박스 (44px+ 터치영역)
- 제목 + 1줄 설명
- 배지: [필수], [매 1년], [D-day], [sync 카운트]
- 우측 "자세히 →" 버튼

색상 규칙:
- 만료 D-day 60 이하 → 주황, 30 이하 → 빨강
- sync partial (예: 18/19) → 주황
- 필수 미완료 → 좌측 빨간 점

### 7.4 ItemDetailModal

데스크탑: 가운데 모달. 모바일: 풀스크린 시트.

**진행상태 섹션 (5번)** 의 상호작용:
1. **완료 토글** → PATCH /api/sales-guide/progress/{key} { is_completed }
2. **날짜 입력** (dateFields 정의된 항목만) → PATCH … { completed_at, expires_at }
3. **메모** → PATCH … { notes }
4. **문서 업로드** (mergedDocs 정의된 항목만) → 기존 `business_docs` upload API 호출. 업로드 성공 후 사용자에게 "이 항목을 완료로 표시하시겠습니까?" 확인 모달을 띄워 (자동 체크하지 않음) 명시적 의사결정 유도
5. **sync 카운트 표시** (syncWith 정의된 항목만) → "직원 18/19 등록됨" + 미등록자 deep-link to `/employees`

### 7.5 진행률 계산 규칙

```python
def category_progress(category_items, business_id):
    required = [i for i in category_items if i.required]
    completed = sum(1 for i in required if is_item_complete(i, business_id))
    return completed / len(required) * 100 if required else 0

def is_item_complete(item, business_id):
    progress = get_progress(item.key, business_id)
    if progress and progress.is_completed:
        if item.renewalCycle and progress.expires_at and progress.expires_at < today:
            return False  # 만료됨
        return True
    if item.syncWith:
        sync = get_sync_status(item.syncWith, business_id)
        return sync.completed >= sync.total  # 100%
    return False
```

- **필수 항목만** 진행률에 반영 (선택 항목은 별도 카운트 표시)
- sync 자동 완료 항목은 명시적 체크 없이도 완료 판정
- 만료된 항목은 미완료로 다운그레이드
- **갱신주기 있는 항목 (renewalCycle != null) 의 완료 처리**: `is_completed=true` 만으로는 부족. `expires_at` 입력이 함께 있어야 완료 판정. 사용자가 완료 토글을 켰는데 만료일을 안 입력한 경우, ItemDetailModal 에서 expires_at 입력을 강제하거나 카테고리 진행률에서 미완료로 처리

### 7.6 데이터 로딩

페이지 진입 시 3 API 동시 호출:
- `GET /api/sales-guide/progress` → 모든 항목 진행상태 (1 회)
- `GET /api/sales-guide/sync-status` → 5 개 자동 카운트 (1 회)
- `GET /api/sales-guide/stats` → 카테고리별·전체 진행률 (서버 계산)

정적 콘텐츠는 React 번들에 포함되므로 추가 요청 없음. 카테고리 페이지·모달 진입 시 추가 API 호출 없음 (랜딩 데이터 재사용).

### 7.7 모바일 대응

- 사이드바 6 카테고리는 BottomNav 에 별도 노출하지 않음 (햄버거 → 진입)
- ItemDetailModal 은 모바일에서 풀스크린 시트로 전환
- 체크박스·버튼은 최소 44px 터치영역 (Slate 디자인 시스템 준수)

---

## 8. 백엔드 API 명세

### 8.1 GET /api/sales-guide/progress

현재 사업장의 모든 영업관리 항목 진행상태.

**응답**:
```json
{
  "business_id": 1,
  "items": [
    {
      "item_key": "permits.business_registration",
      "is_completed": true,
      "completed_at": "2026-04-12",
      "expires_at": null,
      "notes": null,
      "updated_at": "2026-04-12T10:23:00",
      "updated_by": 1
    },
    ...
  ]
}
```

### 8.2 PATCH /api/sales-guide/progress/{item_key}

항목 체크/날짜/메모 업데이트. Upsert 시멘틱 (row 없으면 생성).

**요청 body** (모든 필드 optional, 부분 업데이트):
```json
{
  "is_completed": true,
  "completed_at": "2026-04-12",
  "expires_at": "2027-04-12",
  "notes": "사장님 메모"
}
```

**응답**: 업데이트된 row 전체.

### 8.3 GET /api/sales-guide/stats

카테고리별·전체 진행률 (서버에서 계산, 만료 처리·sync 100% 자동완료 반영).

**응답**:
```json
{
  "overall": { "completed": 28, "total": 31, "percent": 90 },
  "categories": [
    {
      "key": "permits",
      "required_total": 6,
      "required_completed": 5,
      "percent": 83,
      "alerts": [
        { "item_key": "permits.health_certificate", "type": "expiring_soon", "days": 15 }
      ]
    },
    ...
  ]
}
```

### 8.4 GET /api/sales-guide/sync-status

외부 모듈(HR·세무) 자동 카운트 정보 한 번에. (5 개)

**응답**:
```json
{
  "hr.health_certificates": { "completed": 18, "total": 19, "label": "직원 보건증" },
  "hr.hygiene_certificates": { "completed": 1, "total": 1, "expires_at": "2026-12-30" },
  "business.business_number": { "completed": 1, "total": 1 },
  "hr.contracts": { "completed": 12, "total": 19 },
  "hr.insurance_4major": { "completed": 17, "total": 19 }
}
```

### 8.5 권한·인증

- 모든 엔드포인트: 어드민 권한 (`role >= admin`) 필수
- `business_id` 는 `Depends(get_bid_from_token)` 로 주입 — 직접 인자 받지 않음 (연말정산 라우터에서 발생한 16-endpoint 버그 패턴 회피)
- SuperAdmin "View As" 헤더 지원 (axios `api` 인스턴스가 자동 처리)

---

## 9. V2 확장 경로

V1 출시 후 단계적으로 추가할 기능. V1 데이터·아키텍처가 V2 를 막지 않도록 설계.

### V2.1 자동 알림 (L4)
- 매일 새벽 cron → 만료 60/30/7/0 일 항목 스캔
- 카카오 알림톡 우선 → SMS 폴백
- `notification_log` 테이블 신규
- `SalesGuideProgress.notification_enabled` 필드 마이그레이션 추가

### V2.2 업종 확장
- `cafe.js`, `chicken.js`, `convenience.js` 등 추가
- `Business.industry` 필드 추가 (현재 없음)
- 사이드바 메뉴는 사업장 industry 따라 자동 분기

### V2.3 운영팁 콘텐츠 채우기
- 골격만 있는 7 서브카테고리에 본문 작성
- 인쇄용 PDF 다운로드 (위생 체크리스트 등)

### V2.4 사장님 프로필 기반 개인화
- 운영 프로필 (좌석수·가스사용·다중이용업소 여부 등) 기반으로 해당 안 되는 항목 자동 hide
- `Business` 모델 확장

### V2.5 협력업체 마켓플레이스 (장기)
- 항목별 추천 업체 카드 (카드 단말기 VAN 사 비교 등)

### V1 이 V2 를 막지 않게 하는 설계 결정

| V1 결정 | V2 가능하게 함 |
|---|---|
| `industry` 키 데이터 구조 | V2.2 업종 확장 |
| `expires_at` 필드 보유 | V2.1 자동 알림 |
| `item_key` 점-구분 네임스페이스 | V2.2 업종간 키 충돌 방지 |
| 정적 파일 분리 (kimbap.js) | V2.2 새 파일 추가만으로 신규 업종 |
| `syncWith` 외부 모듈 카운트 메커니즘 | V2.4 개인화도 같은 패턴 |

---

## 10. V1 범위 외 (의도적 제외)

- 자동 알림 cron / 알림톡 템플릿 (V2.1)
- 업종 분기 UI (V1 은 휴게음식점 1 종 하드코딩)
- 운영팁 본문 콘텐츠 (V2.3, V1 은 골격만)
- 협력업체 추천 (V2.5)
- Business 운영 프로필 (V2.4)
- 사업장간 진행상태 비교/벤치마킹
- 직원 앱 노출 (V1 어드민 전용)

---

## 11. 의존성·전제

- **기존 인프라 활용**:
  - `business_docs.py` API (문서 업로드 통합)
  - `Business` / `Staff` / `ElectronicContract` 모델 (sync-status 카운트)
  - axios `api` 인스턴스 (JWT + View As 자동)
  - Sidebar `renderSubmenu` 패턴 (메뉴 추가)
  - lucide-react 아이콘
  - Slate Tailwind 디자인 시스템

- **신규 의존성**: 없음

- **마이그레이션**: `SalesGuideProgress` 테이블 1 개 추가 (PostgreSQL `init_db()` 자동 생성)

---

## 12. 위험·미해결 이슈

1. **외국인 고용 가이드 이주 시 broken link** — 기존 페이지 외부에서 링크된 곳이 있는지 확인 필요. 없으면 redirect 만으로 충분.
2. **MERGE-DOCS UI 동기화** — Settings > 회사정보 탭과 영업관리 양쪽에서 동시 업로드 시 race condition 가능성. business_docs 의 unique constraint 가 처리하므로 마지막 업로드 승리 정책으로 충분.
3. **콘텐츠 작성 분량** — 38 항목 × steps/documents/tips 작성은 큰 작업. 구현 단계에서 1 항목당 약 10~15 분, 총 6~10 시간 예상. 운영팁 7 골격은 즉시 가능 (각 1~2 줄 placeholder).
4. **법령·정부 사이트 URL 변경** — deep-link URL 이 정부 사이트 개편 시 깨질 수 있음. V2 에서 링크 유효성 자동 점검 cron 검토.
5. **소담김밥 = 휴게음식점 가정** — 실제 영업신고 종류 확정 필요. "일반음식점"일 경우 일부 인허가 항목 변경. 작업 시작 전 사장님께 확인.

---

## 13. 다음 단계

1. ✅ 본 문서 (spec) 사용자 리뷰
2. ⏭ `superpowers:writing-plans` 스킬로 구현 계획서 작성 → `docs/superpowers/plans/2026-04-25-sales-guide.md`
3. 구현 (TDD: 백엔드 API → 프론트 컴포넌트 → 통합)
4. 콘텐츠 작성 (38 항목 본문)
5. 배포 검증
