# 작업일지

이 프로젝트의 모든 세션별 작업 내역을 날짜순으로 기록합니다.
`/end` 스킬이 세션 종료 시 자동으로 append 합니다.

---

## 2026-04-19

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 서류 업로드 오류 수정 (로컬 폴백 제거, multipart boundary 누락, 한글 파일명 500 오류) | 완료 |
| refactor | 관리자 프론트엔드 직원 라우트 /staff → /employees 변경 | 완료 |
| feat | 서류관리 다중 파일 지원 + 미리보기 모달 추가 | 완료 |
| feat | 직원 등급 체계 변경 (normal/VIP → 정직원/아르바이트) | 완료 |
| fix | 보건증 → 건강진단서 라벨 변경 | 완료 |
| refactor | 계약 및 급여 섹션을 기본정보 → 전자계약 탭으로 이동 + 휴게시간 추가 | 완료 |
| feat | 급여대장을 인사기록관리 급여대장 탭으로 통합 | 완료 |
| fix | 급여대장 실수령액 계산 — 세금대납 반영 | 완료 |
| fix | 헤더 간소화 + 급여 상태 지급완료/지급대기 토글 | 완료 |
| feat | 이체 버튼 복원 + 계좌이체 실행 로직 구현 | 완료 |
| feat | 전월 급여 카드, 특별수당 입력, 세금대납 조건부 표시 | 완료 |
| fix | 세금대납 급여 계산 수정 — 실수령액→총 보상액 용어 변경 | 완료 |
| feat | 급여 테이블에 총 보상액 + 실수령액 두 컬럼 분리 표시 | 완료 |
| refactor | 근태관리 AttendanceInput 모달→인라인 전환 | 완료 |

### 세부 내용

- `e7b3e43` 서류 업로드 시 로컬 디스크 폴백 제거, 미디어 서버 전용 저장
- `dc0e971` multipart boundary 누락으로 인한 서류 업로드 실패 수정 + 에러 핸들링 개선
- `1042568` 한글 파일명으로 미디어 서버 500 오류 발생 수정
- `e536aeb` 관리자 프론트엔드 라우트 /staff → /employees로 통일
- `33cdaf7` 서류관리에 다중 파일 업로드 지원 및 미리보기 모달 추가
- `d59b1a4` 직원 등급 체계를 normal/VIP에서 정직원/아르바이트로 변경
- `5174611` 보건증 라벨을 건강진단서로 변경
- `3e91285` 계약/급여 관련 UI를 기본정보 탭에서 전자계약 탭으로 이동, 휴게시간 필드 추가
- `bb26f99` 급여대장 페이지를 인사기록관리의 급여대장 탭으로 통합
- `d33da98` 급여대장 실수령액 계산에 세금대납 로직 반영
- `571e822` 헤더 UI 간소화, 급여 상태 지급완료↔지급대기 토글 기능
- `dd68d47` 이체 버튼 복원 및 계좌이체 API 실행 로직 구현
- `a1cab09` 전월 급여 카드 추가, 특별수당 입력 필드, 세금대납 조건부 컬럼 표시
- `fd5e551` 세금대납 급여 계산 수정: 실수령액→총 보상액 용어 변경, PayrollStatement 이중 계산 버그 수정
- `3fe110d` 급여 테이블에 총 보상액과 실수령액 두 컬럼을 분리하여 표시
- (미커밋) AttendanceInput 컴포넌트를 모달에서 인라인 모드로 전환, AttendanceTab에서 직접 렌더링

### 작업 요약 (세션 2 — HR SaaS 전문화 Phase 1~8)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | Cache-Control 헤더 설정 — 새로고침 없이 최신 빌드 반영 | 완료 |
| feat | 퇴직금 산출을 인사기록카드 탭으로 이관 | 완료 |
| style | 계약관리 탭 명칭 변경, 급여 카드 색상 통일, 기본정보 레이아웃 재구성 | 완료 |
| feat | 인사기록카드 전체 데이터 자동 연동 시스템 | 완료 |
| feat | 외국인 고용안내 전용 페이지 + 사이드메뉴 등록 | 완료 |
| feat | Phase 1: 연차/휴가관리 탭 — 잔여현황, 신청, 이력, 잔액조정 | 완료 |
| feat | Phase 2-3-6: 인사변경이력 자동추적 + 근로시간 모니터링 + HR 대시보드 | 완료 |
| feat | Phase 4-5: 교육/자격증 관리 + HR 알림 시스템 (계약만료, 서류미비 등) | 완료 |
| feat | Phase 7: 증명서 자동발급 (재직/경력/급여확인/퇴직 4종 A4 HTML) | 완료 |
| feat | Phase 8: 5인 미만/이상 사업장 규모 모드 구분 (간편/전체 기능 분리) | 완료 |

### 세부 내용 (세션 2)

- `05d1793` Cache-Control 헤더 설정 — vercel.json headers로 캐시 무효화
- `913faf0` 퇴직금 산출을 별도 페이지에서 인사기록카드 탭으로 이관
- `29ec27f` 전자계약→계약관리 탭 명칭 변경, 퇴직금에 계약정보 입사일 자동 반영
- `7780eb4` 연간 급여 요약 카드 색상 통일 — 다크녹색/청색 계열
- `4893742` 기본정보 탭 레이아웃 재구성 — 재직현황/체류자격 우측 이동
- `8d9ec6c` 인사기록카드 전체 데이터(계약정보, 인사기록 등) 자동 연동
- `5cac344` 외국인 고용안내 전용 페이지 생성 (비자별 상세정보, 관공서 연락처)
- `e175472` [Phase 1] 연차/휴가관리 — LeaveBalance/LeaveRequest 모델, 한국 노동법 연차 자동계산, 휴가신청/승인/반려
- `b4878af` [Phase 2-3-6] StaffChangeLog 자동 기록, 근로시간 모니터링(주 48h 초과 경고), HR 대시보드
- `4c20b56` [Phase 4-5] StaffTraining/StaffCertification CRUD, 법정교육 5종 이수체크, HR 알림 통합 API
- `fe26c1b` [Phase 7] certificate.py — 재직/경력/급여확인/퇴직 증명서 HTML 생성 API, DocumentTab에 발급 UI
- `5df377d` [Phase 8] Business.employee_scale 필드, BusinessConfigProvider, StaffDetail 탭 조건부 렌더링, Settings 사업장 규모 UI

### 작업 요약 (세션 3 — 로드맵 업그레이드 + 버그 수정)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 셈하나 개발 로드맵 전면 업그레이드 (5→6단계 확장, HR Phase 2 추가) | 완료 |
| fix | HR 대시보드 직원 데이터 0명 표시 수정 (Axios 응답 중첩 추출 버그) | 완료 |
| feat | HR 대시보드에 사업장 규모 모드 즉시 전환 버튼 추가 | 완료 |
| fix | 퇴직금 탭 재직 직원 급여 내역 미표시 수정 (미래 계약종료일 문제) | 완료 |
| infra | DB employee_scale 컬럼 누락 → ALTER TABLE 수동 추가 | 완료 |
| infra | 소담김밥 사업장 규모를 under5로 SQL 직접 설정 | 완료 |

### 세부 내용 (세션 3)

- `6512f85` 개발 로드맵 5→6단계 확장 (Phase 2: HR 인사관리 시스템 추가, Phase 6: AI 경영비서)
- `84199c5` HR 대시보드 staffRes.value.data가 응답 객체를 직접 참조하여 0명 표시 — Array.isArray 체크 + .data 추출 수정
- `bab2dfa` HR 대시보드 헤더에 5인미만/이상 모드 즉시 전환 버튼 추가 (ArrowRightLeft 아이콘)
- `f6487ed` 퇴직금 탭 calc_end_date가 미래 contract_end_date(2026-12-31) 사용 → 3개월 급여 윈도우가 미래로 밀려 빈 배열 반환 — min(contract_end_date, today)로 제한
- (미커밋) DB ALTER TABLE business ADD COLUMN employee_scale VARCHAR DEFAULT 'over5'
- (미커밋) UPDATE business SET employee_scale='under5' WHERE id=1 (소담김밥)

### 작업 요약 (세션 4 — 휴가 자가신청 · 사업장 규모 안정화 · HR 대시보드 강화)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 직원앱 프로필 등급 표시 — stale JWT → /auth/me 최신값 조회 | 완료 |
| fix | 연차 승인 트랜잭션 원자성 + 테넌트 검증 + 잔액 부족 체크 | 완료 |
| feat | 사업장 규모(under5) 라우팅 가드 + StaffDetail 탭 이중 방어 | 완료 |
| feat | 직원앱 연차/휴가 자가 신청 기능 (Profile/Home 진입점 포함) | 완료 |
| fix | 사업장 규모 설정 API 경로 중복(/api/api/...) + HR 대시보드 토글 [현재] 배지 | 완료 |
| fix | 사업장 규모 설정 성공/실패 메시지 + refreshBusinessConfig 강제 재조회 | 완료 |
| fix | SuperAdmin이 사업장 규모 변경 시 400 — X-View-As-Business 헤더 서버 지원 | 완료 |
| feat | 5인 미만 사업장도 무급/병가/경조사 신청 허용 + HR 대시보드 대기 알림 | 완료 |
| feat | HR 대시보드 알림/연차 카드 h-[440px] 통일 + 5인 미만용 휴가 신청 현황 카드 | 완료 |
| feat | 사업장 규모별 노동법 핵심 안내 패널 (under5 6+6건, over5 12건 아코디언) | 완료 |
| feat | 직원관리 > 구인등록 서브메뉴 — 국내 구인 플랫폼 15곳 비교 가이드 | 완료 |

### 세부 내용 (세션 4)

- `819acad` 직원앱 Profile에서 토큰 payload만 읽어 등급이 DB 변경 후 갱신 안 되던 문제 — /auth/me 재조회로 최신 grade 반영
- `0f14c82` 연차 승인 로직: 승인·잔액 차감을 단일 트랜잭션으로 묶고 X-View-As-Business 기준 테넌트 검증, 잔액 부족 시 즉시 반려
- `bd121e1` SCALE_FEATURES + ScaleProtectedRoute + StaffDetail 탭 레벨 방어 (router ↔ UI 이중 가드)
- `df4523d` staff-app /leave 페이지, Home 빠른 그리드/Profile 메뉴 진입점 추가 (under5는 초기 ANNUAL 차단 설계)
- `8a78b7c` useBusinessConfig.jsx에서 axios baseURL `/api` + `/api/auth/...` 중복으로 404 → `/auth/...`로 수정, HR 토글에 [현재] 배지 + "○○으로 전환" 힌트
- `06e8c56` Settings 사업장 규모 카드 클릭 시 성공/실패 배너 + refreshBusinessConfig 호출로 Context 즉시 갱신
- `2442bae` PUT /auth/business-settings에 X-View-As-Business Header 지원 — SuperAdmin이 admin.business_id=None인 상황에서 400 나던 문제 해결
- `620a87e` 5인 미만 휴가 재설계: leave.py `_resolve_self_staff`를 (staff, is_under5) 튜플로 변경, 연차(ANNUAL_TYPES)만 차단하고 무급/병가/경조사 허용. 신규 GET `/hr/leave/requests` 대기 리스트 엔드포인트. 직원앱 Leave.jsx는 규모별 옵션 분기 + balance 카드 숨김, HR 대시보드 알림 최상단에 대기 신청 표시
- `430001e` HRDashboard 알림/연차 카드 공통 `h-[440px]` + 내부 스크롤, 5인 미만은 연차 현황 대신 '휴가 신청 현황' 테이블(상태 배지), 하단 LaborLawPanel 서브컴포넌트로 규모별 조항 아코디언 (lucide Scale/BookOpen/Banknote/GraduationCap 추가)
- `99f332a` JobPosting.jsx 신규 — 워크넷·EPS·HI KOREA·알바몬·알바천국·당근알바·벼룩시장·사람인·잡코리아·인크루트·커리어·원티드·잡플래닛·리멤버·링크드인 15곳 비교. 카테고리 필터+검색+정렬(추천순/이름순/무료우선)+시나리오 추천 5종+비교표+상세카드

### 작업 요약 (세션 5 — 회사직인 관리)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 회사직인 관리 메뉴 신설 + 10종 SVG 직인 샘플 선택 시스템 | 완료 |

### 세부 내용 (세션 5)

- `9a6d9cb` 환경설정에 '회사직인 관리' 탭 추가 (10종 스타일: 클래식 원형·이중 원·사각 인장·톱니 테두리·모던 블루·프리미엄 골드·블랙 포멀·꽃문양·미니멀·대표이사 직인). 공용 `CompanySeal.jsx` 컴포넌트 분리하여 계약서·증명서 등 재사용 가능. `Business.settings_json`에 `seal_style`/`seal_text`를 JSON 병합 저장(DB 마이그레이션 불필요). `/auth/business-info`·`/auth/business-settings` 확장으로 조회/저장 지원

### 작업 요약 (세션 6 — 로드맵 최신화 + HEAD DevWorkLog 고정 콘텐츠 전면 업데이트)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 셈하나 개발 로드맵 — 오늘 완료 기능 4종 반영 (회사직인·구인등록 등) | 완료 |
| infra | DevWorkLog [HEAD] 고정 엔트리 전면 재작성 (14섹션 / ai_summary 16개) | 완료 |
| infra | `/end` 스킬에 "3-8단계: [HEAD] DevWorkLog 고정 콘텐츠 업그레이드" 섹션 추가 (opt-in) | 완료 |

### 세부 내용 (세션 6)

- `cacea36` DevelopmentRoadmap.jsx의 Phase 2 모듈에 오늘 완료 기능 반영: 증명서 자동발급 → "증명서 자동발급 & 회사직인"로 확장, 연차/휴가 관리에 직원앱 자가 신청 추가, HR 대시보드 알림에 휴가 대기·카드 높이 통일 추가, 5인 미만/이상 사업장 모드에 무급 휴가 허용·노동법 안내 패널·라우팅 가드·View-As 헤더 지원 추가, 신규 "구인/채용 지원" 모듈(15곳 플랫폼 비교) 추가
- [HEAD] DevWorkLog id=4 content 4045→5679자, ai_summary 590→962자로 전면 재작성. 라우터 25→32개, DB 모델 30+개로 최신화. HRDashboard·JobPosting·ForeignWorkerGuide·CompanySeal·LeaveBalance·LeaveRequest·StaffChangeLog·StaffTraining·StaffCertification 등 반영. ai_summary에 세금대납 규칙/연차법/settings_json/storage_service/stale JWT/ALTER TABLE 등 핵심 gotcha 16개 정리 (임시 스크립트는 실행 후 삭제)
- `~/.claude/skills/end/SKILL.md` 3-8단계 추가: `[HEAD]` 로 시작하는 DevWorkLog 엔트리가 있을 때만 실행되는 opt-in 단계. 신규 라우터/모델/페이지/컴포넌트/메뉴/인프라 변화 발생 시 HEAD 콘텐츠를 전면 재작성하도록 가이드. 핵심 규칙 3번에 `[HEAD]` 마커 추가

---
