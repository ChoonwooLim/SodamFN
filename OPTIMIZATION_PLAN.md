# SEMHANA (셈하나) 프로젝트 종합 최적화 계획서

> 작성일: 2026-04-01
> 대상: SodamApp (Backend + Frontend + Staff App)

---

## 현재 상태 분석

| 영역 | 현황 |
|------|------|
| **프론트엔드 (Admin)** | 38개 페이지, 거대 파일 8개 (91~142KB), useState 남용, 유틸 함수 17개 파일에서 207건 중복 |
| **백엔드** | 25개 라우터 (최대 1,322줄), 세션 관리 3가지 방식 혼재, N+1 쿼리 패턴 다수 |
| **DB** | 28개 테이블, 주요 쿼리 패턴에 복합 인덱스 부재 |
| **Staff App (PWA)** | 코드 스플리팅 미적용, 빌드 최적화 미설정 |

---

## 우선순위: 높음

### 1. 데이터베이스 인덱스 최적화

**문제**: 자주 사용되는 쿼리 패턴에 복합 인덱스가 없어 풀테이블 스캔 발생 가능

**조치 사항**:

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| `DailyExpense` | `(business_id, date)` | 월별 조회 핵심 쿼리 |
| `DailyExpense` | `(business_id, vendor_id)` | 거래처별 집계 |
| `DailyExpense` | `vendor_id` 단독 | FK 조인 (현재 없음) |
| `MonthlyProfitLoss` | `(business_id, year, month)` UNIQUE | 대시보드 매번 조회 |
| `Attendance` | `(staff_id, date)` | 급여 계산 시 월별 출퇴근 조회 |
| `Payroll` | `(staff_id, month)` | 급여 이력 조회 |

**대상 파일**: `backend/models.py` + Alembic 마이그레이션

> 난이도: **낮음** / 효과: API 응답 30~50% 향상

---

### 2. N+1 쿼리 및 반복 쿼리 제거

**문제**: 루프 안에서 개별 DB 쿼리를 수행하는 패턴 다수 존재

| 위치 | 문제 | 해결 |
|------|------|------|
| `superadmin.py` (line 89-96) | `list_businesses()`에서 각 business마다 staff_count, user_count 개별 쿼리 | `outerjoin` + `group_by` 단일 쿼리로 집계 |
| `stats.py` (line 75-83) | 6개월 트렌드를 6번 개별 조회 | 범위 쿼리 1회로 통합 후 dict 매핑 |
| `finance.py` (line 24-41) | 카드매출 업로드 시 레코드별 중복 체크 | 일괄 조회 후 Set 비교 |
| `upload.py` (line 195-196) | 엑셀 업로드 시 행마다 vendor 개별 조회 | 전체 vendor dict 캐시 |

**대상 파일**: `backend/routers/superadmin.py`, `stats.py`, `finance.py`, `upload.py`

> 난이도: **중간** / 효과: 특정 API 5~10x 속도 향상

---

### 3. 프론트엔드 거대 파일 분리 (상위 5개)

**문제**: 단일 파일에 수천 줄 + 수십 개 useState + 여러 뷰 모드 혼재

| 파일 | 줄수 | useState | 분리 방향 |
|------|------|---------|----------|
| `RevenueManagement.jsx` | 2,225 | 26개 | `RevenueManagement/` 디렉토리 → index.jsx, Dashboard, List, Grid, DetailModal, Upload + `useRevenueData` 훅 |
| `VendorSettings.jsx` | 1,483 | 27개 | `VendorSettings/` → index.jsx, ExpenseTab, RevenueTab, MergeModal, ProductModal |
| `PurchaseManagement.jsx` | 1,578 | - | `PurchaseManagement/` → Dashboard, List, Upload, EditModal |
| `StaffDetail.jsx` | 1,423 | - | 탭별 분리 → InfoTab, AttendanceTab, PayrollTab, DocumentsTab, ContractTab |
| `ProfitLoss.jsx` | 1,349 | - | `ProfitLoss/` → Summary, Detail, Chart, EditModal |

**대상 파일**: `frontend/src/pages/` 내 5개 거대 파일

> 난이도: **높음** / 효과: 유지보수성 대폭 향상

---

### 4. 프론트엔드 공통 유틸리티 추출

**문제**: 17개 파일에서 207건 중복 정의 (formatNumber, toLocaleString, 날짜 포맷 등)

**조치 사항**:

| 신규 파일 | 포함 내용 |
|----------|----------|
| `frontend/src/utils/format.js` | `formatNumber`, `formatCurrency`, `fmtShort`, `getWeekday`, `formatDate` |
| `frontend/src/utils/constants.js` | `EXPENSE_CATEGORIES`, `REVENUE_CATEGORIES`, `DELIVERY_CHANNELS` |
| `frontend/src/hooks/useApiData.js` | 공통 fetch 패턴 (loading/error/data 추상화) |

> 난이도: **중간** / 효과: 코드 중복 제거, 일관성 확보

---

## 우선순위: 중간

### 5. 백엔드 세션 관리 통일

**문제**: 3가지 세션 관리 방식 혼재

| 방식 | 사용 횟수 | 라우터 수 |
|------|----------|----------|
| `Session(engine)` 수동 관리 | 87건 | 6개 |
| `DatabaseService()` | 85건 | 14개 |
| `Depends(get_session)` | 22건 | 3개 |

**조치**: `Depends(get_session)`으로 통일, `DatabaseService`는 세션 외부 주입으로 리팩토링

**주요 대상**: `database.py`, `services/database_service.py`, `routers/stats.py` (8건), `superadmin.py` (23건), `upload.py` (20건)

> 난이도: **중간** / 효과: 안정성, 세션 누수 방지

---

### 6. Staff App 빌드 최적화

**문제**: `vite.config.js`에 코드 스플리팅, terser, manualChunks 미설정. React.lazy 미사용.

**조치 사항**:

1. `vite.config.js`에 manualChunks 추가 (react/react-dom/react-router-dom 분리) + terser 적용
2. `App.jsx`에 React.lazy 적용 (17개 페이지)
3. `html2canvas-pro` + `jspdf`는 Payslip 페이지 로드 시에만 번들되도록 동적 임포트

**대상 파일**: `staff-app/vite.config.js`, `staff-app/src/App.jsx`

> 난이도: **낮음** / 효과: PWA 첫 로드 시간 단축

---

### 7. 백엔드 대형 라우터 분리

**문제**: 단일 라우터 파일이 1,000줄 이상

| 라우터 | 줄수 | 분리 방향 |
|--------|------|----------|
| `upload.py` | 1,322 | `upload/` → expense_upload, revenue_upload, card_upload, history |
| `hr.py` | 1,085 | `hr/` → staff, attendance, documents, location |
| `superadmin.py` | 925 | `superadmin/` → businesses, users, analytics |

> 난이도: **중간** / 효과: 유지보수성 향상

---

### 8. recharts / framer-motion 번들 분리

**문제**: recharts (차트 라이브러리)와 framer-motion이 공용 청크에 포함되어 모든 페이지에서 로드됨

**현재 설정** (`frontend/vite.config.js`):
```js
ui: ['lucide-react', 'recharts'],       // recharts는 2개 페이지만 사용
utils: ['axios', 'date-fns', 'framer-motion']  // framer-motion은 2개 페이지만 사용
```

**수정 후**:
```js
ui: ['lucide-react'],
utils: ['axios', 'date-fns']
// recharts, framer-motion → 사용하는 lazy 페이지의 청크에 자동 포함
```

> 난이도: **낮음** / 효과: 초기 번들 사이즈 20~30% 감소

---

## 우선순위: 낮음

### 9. API 응답 캐싱 및 페이지네이션

- 백엔드: 정적 데이터용 `Cache-Control` 헤더 추가
- 프론트엔드: stale-while-revalidate 패턴의 메모리 캐시
- `DailyExpense` 목록 조회에 페이지네이션 추가 (현재 월 전체 일괄 반환)

**대상**: `routers/stats.py`, `routers/purchase.py`, `routers/revenue.py`

---

### 10. 보안 및 에러 처리 개선

| 문제 | 위치 | 해결 |
|------|------|------|
| JWT Secret Key 하드코딩 기본값 | `tenant_filter.py` line 12 | 환경변수 필수화 (미설정 시 서버 시작 실패) |
| `except Exception: pass` 패턴 | `upload.py` line 118 | 최소한 로깅 추가 |
| 세션 누수 가능성 | `DatabaseService()` context manager 없이 사용 | 항상 context manager로 사용 강제 |

---

### 11. Admin / Staff 앱 간 코드 공유 (장기)

- `SodamApp/shared/` 디렉토리 생성
- 공통 상수, API 클라이언트 설정, 유틸 함수 추출
- 각 앱에서 workspace 또는 상대 경로로 참조

---

## 구현 순서 권장

| 단계 | 항목 | 난이도 | 기대 효과 |
|------|------|--------|----------|
| 1 | DB 인덱스 추가 (#1) | 낮음 | 즉시 성능 향상 |
| 2 | N+1 쿼리 제거 (#2) | 중간 | 특정 API 대폭 개선 |
| 3 | Vite 빌드 설정 수정 (#8) | 낮음 | 번들 20~30% 감소 |
| 4 | Staff App 최적화 (#6) | 낮음 | PWA 로드 시간 단축 |
| 5 | 공통 유틸 추출 (#4) | 중간 | 중복 제거 |
| 6 | 거대 파일 분리 (#3) | 높음 | 유지보수성 |
| 7 | 세션 관리 통일 (#5) | 중간 | 안정성 |
| 8 | 라우터 분리 (#7) | 중간 | 유지보수성 |
| 9 | 캐싱/페이지네이션 (#9) | 중간 | 반복 요청 성능 |
| 10 | 보안 강화 (#10) | 낮음 | 보안 취약점 해소 |
