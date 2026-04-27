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

## 2026-04-24

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 환경설정에 '회사정보 관리' 탭 신설 — 15개 기본정보 + 12유형 공식문서 보관함 + 직인 이미지 업로드 | 완료 |
| feat | 재직/경력/급여/퇴직 증명서 직인 렌더링 개선 — SVG seal-11 "English Traditional" 추가, 모든 증명서에 실제 직인 자동 삽입 | 완료 |
| feat | `/hr/fax` 팩스 전송 메뉴 신설 — 증명서 자동생성 / 회사 보관함 / 직접 업로드 3종 소스 + 전송 이력 | 완료 |
| feat | FAX 프로바이더 추상화 + PopbillProvider 구현 (팝빌 SDK 래핑) | 완료 |
| fix | 증명서 HTML → PDF 변환 시 빈 페이지 생성 버그 (DOMParser로 style/body 분리 주입) | 완료 |
| infra | Orbitron.yaml 팝빌 env 선언 + Orbitron DB에 AES-256-GCM 암호화 env 직접 주입 후 재배포 | 완료 |
| style | 재직증명서 양식 정리 시도 → revert (원복) | 완료 |

### 세부 내용

- `fae1c23` / `be5499f` 재직증명서 출력 양식 정리 시도 후 원복
- `733bf74` Settings "회사정보 관리" 탭: 사업장명/번호/대표자(한글·영문)/업태/종목/주소/전화/이메일/팩스/홈페이지/개업일/관할세무서 15필드 편집. `BusinessDocument` 모델 신설(12유형). `/auth/business-settings` 확장(직접 필드+settings_json 병합). `/business-docs` CRUD + 직인 이미지 업로드/삭제. `certificate.py` SVG seal-11 "English Traditional" 추가 + `_render_seal_svg()`/`_seal_block()` 헬퍼, 4개 증명서에서 placeholder → 실제 SVG/img 교체. 소담김밥 Business 1 DB에 실값 주입(639-12-01514 / 홍지연 / 02-452-6570 / 서울시 광진구 능동로 110 스타시티 영촌빌딩 B208호)
- `92076de` 팩스 전송 기능 전체 스택: `FaxTransmission` 모델(테넌트 격리), `services/fax_service.py` BaseFaxProvider + DevStubProvider + PhaxioProvider + KoreanGenericProvider, `routers/fax.py` send/history/get/retry/delete/providers. `FaxTransmission.jsx` 신규 페이지(받는번호/수신자/제목 + 3종 소스 + 이력 패널 + URL 딥링크). Sidebar HR 서브메뉴에 "팩스 전송", DocumentTab 증명서 카드마다 인쇄/팩스 버튼 분리. html2pdf.js 0.14 dep
- `deb3980` PopbillProvider — popbill>=1.64.0 SDK 래핑, sendFax 호출, file_bytes → 임시파일, PopbillException 래핑, getBalance()/get_result() 헬퍼
- `a95174f` PDF 빈페이지 버그 수정 — 기존 코드가 완전 HTML 문서를 `<div>`에 innerHTML로 넣어 브라우저가 중첩 html/body 무시. DOMParser로 `<style>` + body.innerHTML 분리해 별도 주입. document.fonts.ready + 250ms 대기
- `a71aa55` Orbitron.yaml에 Popbill env 6개 키 선언 추가
- **SSH 작업(커밋 외)**: Orbitron devdb `projects.env_vars` JSONB가 AES-256-GCM 암호화라 Orbitron crypto.js로 decrypt→merge→encrypt→UPDATE. 기존 12개 env에 Popbill 6개 추가. `deployer.deploy(project)` 직접 호출로 재배포, 컨테이너 재생성 후 env 반영 확인. 테스트: 김금순→임춘우 재직증명서 PDF → 팝빌 접수번호 `026042417423100001`, sendState=3(전송완료) convState=2(변환완료) result=100 확인
- **문제 발견 및 해결 (팩스 수신확인 후)**: 팝빌 API가 "전송완료/변환완료" 보고했지만 실제 050 수신기에는 **빈 용지** 도착. 서버 측 PDF 파일 분석 결과 content stream 24byte, XObject 0개, Font 14개 — html2canvas 캡처 실패한 빈 PDF. DOMParser 분리 방식으로 commit `a95174f`에서 한번 수정했으나 여전히 빈 페이지. `e08be9d`로 전환: Dockerfile에 libpango/libpangoft2/libharfbuzz/libfribidi + fonts-nanum/noto-cjk 추가, weasyprint>=60.0 requirements 추가, `GET /hr/certificate/pdf/{cert_type}/{staff_id}` 신설 (기존 4개 HTML 엔드포인트 재사용 → WeasyPrint 변환), 프론트 `buildCertificatePdf()` 단순화(html2pdf.js 제거, axios blob 직접 fetch). 프로덕션 컨테이너에서 WeasyPrint로 임춘우 재직증명서 생성 테스트 → 41KB PDF (2페이지, 텍스트 313자 추출, 한글 정상 렌더) 확인
- **`08cb84c`** 사용자 수신 확인 후 "직인 빠짐 + 2페이지로 분리" 피드백. 원인: seal_image_url이 상대 URL(`/api/media/...`)이라 WeasyPrint가 컨테이너 내에서 resolve 실패 → `alt="직인"` 텍스트만 표시. `_fetch_image_as_data_uri()` 헬퍼 추가해 FRONTEND_URL(https://sodamfn.twinverse.org)에서 다운받아 base64 data URI로 embed. 동시에 cert-issuer 블록에 page-break-inside:avoid
- **`f48caf0b`** 스페이싱 축소로 A4 1페이지 수렴: cert-title 28→26px, cert-table padding 10x14→7x12, cert-purpose/date/issuer 마진 전반 축소
- **`8d3bde09`** cert-wrap의 padding/min-height 중복 문제 해결 — @page margin 20→12mm + cert-wrap padding 0 / min-height 제거. 1페이지 확정
- **`ca8dbcbe`** 환경설정 탭의 직인 이미지 미리보기 비어 보이는 버그 — `get_business_info` 응답에 seal_image_url 누락되어 있어서 추가
- **`16981547`** cert-issuer 좌측정렬 (text-align:center → left + padding-left: 25mm)
- **`ff88fada`** "서류가 서류다워야지" 피드백 반영하여 전면 재디자인: 이중 프레임(border 2px + outline 1px offset 4px), 타이틀 명조체 30px letter-spacing 14px + 이중선 divider, 섹션 헤더 검은 배경 + 흰 글자, 발급자 블록 양분(좌측 사업장정보 + 우측 대표자+직인), cert-date 명조체, 로고 워터마크 중앙 6% 투명도, `_issuer_block(business)` 헬퍼로 4개 증명서 통일
- **`a410f261`** 워터마크 로고 크기 5배 (120mm → 600mm), cert-wrap에 overflow:hidden 추가해 페이지 바깥 클리핑

---

## 2026-04-25

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|---|---|---|
| feat | 팝빌 알림톡/SMS 전송 기반 (Phase A) | 완료 |
| feat | 팝빌 사업자등록상태 자동 조회 (Phase B / 3순위) | 완료 |
| feat | 팝빌 이지펀뱅크 계좌조회 자동 수집 기반 (Phase C) | 코드 완료 / API -99010016 차단 |
| fix  | bank-sync 팝빌 SDK 메서드명/시그니처 재구성 (500 에러) | 완료 |
| feat | bank-sync 진단 엔드포인트/UI (test vs live 자가 판별) | 완료 |
| fix  | bank-sync 진단 모달 에러 상세 자동 펼침 + 가독성 | 완료 |
| feat | bank-sync 계좌 수동 추가 우회 (listBankAccount 권한 회피) | 완료 |
| feat | bank-sync 진단에 requestJob/getJobState 1회 테스트 | 완료 |
| feat | bank-sync live/test 환경 나란히 비교 진단 (force_is_test) | 완료 |
| fix  | bank-sync 진단 UI 내부 ok=False/skipped도 실패 인식 | 완료 |
| feat | 예금주조회 API + 급여계좌 자동확인 UI (4순위) | 완료 |
| feat | 전자세금계산서 발행/이력 (5순위 · Phase D) | 완료 |
| feat | 기업정보(BizInfoCheck) 자동채움 (8순위) | 완료 |
| feat | 홈택스 전자세금계산서 자동 수집 (6순위 · Phase E) | 완료 |
| feat | 알림톡 관리 UI 페이지 신설 (2순위 골격 보강) | 완료 |
| feat | 현금영수증 발행/이력/취소 (우선순위 외) | 완료 |

### 세부 내용

**1) 새벽 — 팝빌 인프라 5건 (a864384c → 73dc72a4)**

- `a864384c` Phase A 카카오 알림톡 + SMS 기반 — `services/notification_service.py` 374줄(KakaoService + MessageService 래핑, stub/popbill 프로바이더), `routers/notifications.py` 11 엔드포인트, `NotificationHistory` 모델 신설. payroll/contract/purchase_requests에서 `NotificationService.send_*` 사용. NOTIFICATION_PROVIDER=stub 기본값(카카오 검수 통과 후 popbill로 전환).
- `cb3ac2f8` Phase B 사업자등록상태 — `services/biz_check_service.py` ClosedownService 래핑(check_one/check_many), `/api/biz-check` 단건+배치 엔드포인트. `VendorInfoManagement.jsx`에 "자동확인" 버튼 + 결과 배너(state '01' 정상 → 녹색, 그 외 → 적색).
- `7da0637c` ~ `73dc72a4` Phase C 이지펀뱅크 7커밋 — `services/bank_sync_service.py` EasyFinBankService 래핑(BANK_NAMES 23개, BankAccountInfo/BankTxRow dataclass, listBankAccount/getBankAccountInfo/requestJob/getJobState/search/summary 6 메서드), `routers/bank_sync.py` 30+ 엔드포인트, BankAccount/BankTransaction 모델 신설. `pages/BankSync.jsx` 7섹션 UI(현재 상태/계좌 목록/수동 추가/진단/거래조회/거래목록/엑셀 업로드). **현장 발견**: live 환경에서 `listBankAccount` / `getBankAccountInfo` / `requestJob` 모두 `Popbill[-99010016] 사용할 수 없는 서비스` 차단. `getBalance`/`getBankAccountMgtURL`만 정상. → 정액제 결제는 됐지만 API 모듈 활성화 누락 패턴. 팝빌 1:1 문의 발송 후 답변 대기.

**2) 오전 후반 — 팝빌 신규 6 모듈 (034cbe1e → d364feb6)**

- `034cbe1e` 예금주조회 — `services/account_check_service.py` AccountCheckService 래핑(BANK_NAME_TO_CODE 역매핑 + 별칭 dict), `/api/account-check` POST/status/banks. `ContractTab.jsx` 급여계좌 입력 UI 강화: 은행명 input → 23개 드롭다운, "예금주 자동확인" 버튼, 조회 결과 배너(불일치 시 amber 경고). 빈 예금주 필드 자동 채움.
- `1c568740` 전자세금계산서 — `services/taxinvoice_service.py` TaxinvoiceService 래핑(TaxinvoiceDraft + TaxinvoiceDetail dataclass + RegistIssue/getInfo/search/getPopbillURL), `routers/taxinvoice.py` 6 엔드포인트(발행 시 공급자는 현재 Business 자동 prefill). `pages/TaxInvoice.jsx` — 팝빌 4종 바로가기(TBOX/SBOX/WRITE/CERT) + 빠른 발행 폼(공급받는자 + 품목 동적 추가, VAT 10% 자동 계산) + 90일 발행 이력.
- `135ce078` 기업정보 — `services/bizinfo_check_service.py` BizInfoCheckService 래핑(상호/대표/업태/종목/주소/규모/설립일 등 10+ 필드), `/api/bizinfo-check`. `VendorInfoManagement.jsx`에 기존 "상태확인" 옆 "자동채움" 버튼 추가 — 빈 phone/address만 자동 입력 + 결과 배너로 업태/종목/규모/설립일 등 표시. 건당 88원 confirm 다이얼로그.
- `06a000ca` 홈택스 수집 — `services/hometax_service.py` HTTaxinvoiceService 래핑(부서사용자 등록/삭제/login-check + RequestJob/JobState/Search/Summary 비동기 모델), `routers/hometax.py` 12 엔드포인트(quick-range 프리셋: 이번달/지난달/3개월). `pages/HomeTaxCollect.jsx` 5단계 워크플로우(인증→수집요청→폴링 3초 주기→요약→리스트+CSV).
- `2a0eb8f4` 알림톡 관리 UI — `routers/notifications.py`에 `GET /urls/sender-number` 엔드포인트 1개 추가. `pages/KakaoNotifications.jsx` 신설 — 잔액/템플릿 검수현황(P/A+S/R)/발송통계 카드 3개, 팝빌 관리 3종(플친/템플릿/발신번호) 바로가기, 템플릿 목록(상태배지 + 본문 미리보기 + 코드 복사) + 발송 이력 + 빠른 테스트 발송 모달.
- `d364feb6` 현금영수증 — `services/cashbill_service.py` CashbillService 래핑(소득공제용/지출증빙용 + 거래옵션 일반/도서공연/대중교통), `routers/cashbill.py` 7 엔드포인트(issue/cancel/search/info/popbill-url/issuer/status). `pages/CashBill.jsx` — 거래용도 토글 + 식별번호 placeholder 자동 전환(사업자번호 vs 휴대폰) + VAT 10% 자동 계산 + 90일 이력.

### 인프라 변경

- 신규 백엔드 라우터 6개: `account_check.py` `bank_sync.py` `biz_check.py` `bizinfo_check.py` `cashbill.py` `hometax.py` `taxinvoice.py` (notification은 이전부터 존재, 6개 신규 + bank_sync 1개 = 7개 main.py에 신규 등록)
- 신규 서비스 7개: 위 라우터들의 `services/*_service.py` 짝
- 신규 프론트 페이지 4개: `BankSync.jsx` `CashBill.jsx` `HomeTaxCollect.jsx` `KakaoNotifications.jsx` `TaxInvoice.jsx` (5개)
- Sidebar 경영관리에 4개 메뉴 추가: 은행계좌 연동 / 전자세금계산서 / 현금영수증 / 홈택스 수집
- Sidebar HR에 1개 메뉴 추가: 알림톡 관리
- 신규 모델: `NotificationHistory` `BankAccount` `BankTransaction`

### 다음 세션 인계

- **팝빌 1:1 문의 답변 대기**: live 환경 EasyFinBank `-99010016`. 답변 받으면 분기:
  - 활성화 승인 → 수집/자동분류 검증
  - 거부 → Excel 업로드 자동화로 선회
- **2순위 알림톡 외부 절차**: 카카오 비즈센터 플러스친구 채널 + 발신번호 + 템플릿 검수 진행 필요. 코드는 검수 통과 즉시 사용 가능한 상태.
- 같은 모듈 활성화 차단 가능성 — 답변에 AccountCheck/Taxinvoice/HTTaxinvoice/Cashbill도 함께 확인 권장.

---

## 2026-04-25 (오후 세션 — 연말정산 Phase 1)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | 연말정산 Phase 1 설계 명세 (12 sections + Q&A 부록) | 완료 |
| docs | 연말정산 구현 계획서 (17 tasks, 3700 lines) | 완료 |
| feat | pytest 인프라 (프로젝트 최초 테스트 셋업) | 완료 |
| feat | 4 신규 모델 (YearEndReport/Document/Simplified/AuditLog) | 완료 |
| feat | services/yearend/ 패키지 (aggregator/parser/reconciler/tax_calculator/audit/generator) — 23 unit tests | 완료 |
| feat | 별지24/23호 Jinja2 템플릿 + WeasyPrint HTML→PDF | 완료 |
| feat | admin 라우터 16 엔드포인트 (요약/집계/문서업로드+파싱/대조/PDF/배포/감사) | 완료 |
| feat | staff_yearend 라우터 5 엔드포인트 (직원본인 조회+다운로드+감사) | 완료 |
| feat | 어드민 YearEnd 페이지 + EmployeeDetailModal + 5 서브 컴포넌트 | 완료 |
| feat | 직원앱 MyYearEnd 페이지 + 홈 진입 카드 | 완료 |
| feat | DevelopmentRoadmap "연말정산 지원" 4 항목 done 표시 | 완료 |
| fix  | get_bid_from_token Depends 누락 (16 endpoints, Staff 0건 버그) | 완료 |

### 세부 내용

**Brainstorming → Spec (935877fe)**

8개 결정사항 합의:
- Q1 범위: 4개 항목(연간조회/원천징수영수증/간소화 PDF/환급 표시) 모두 처리
- Q2 경로 C(하이브리드): 자체 집계 + 업로드본 정본. 차후 A(자체 세법 계산) 업그레이드용 `tax_calculator.py` 어댑터 분리
- Q3 대상자: 근로(별지24호) + 사업소득자 3.3%(별지23호). 일용직 제외
- Q4 간소화 PDF: 13 카테고리 합계만 파싱
- Q5 환급/추가납부: 추출 + 자체 집계 대조 검증 (±1k OK / ±10k Warning / 그 외 Mismatch)
- Q6 자체 발행 PDF: 별지24/23호 유사 레이아웃, WeasyPrint HTML→PDF
- Q7 직원앱 노출: 본인 다운로드 + 감사 로그
- Q8 다년 모델: 2025년 백필은 일반 업로드 흐름

→ `docs/superpowers/specs/2026-04-25-yearend-tax-phase1-design.md`

**Plan (9d8f1f76)**

17-task 단계별 구현 계획. TDD 적용: 로직(parser/aggregator/reconciler/tax_calculator/audit/generator). 매뉴얼 검증: 라우터·UI.

→ `docs/superpowers/plans/2026-04-25-yearend-tax-phase1.md`

**Implementation (16 commits, Subagent-Driven Development)**

Stage 0-1 (29736bde, 23e18b8a): pytest 인프라(conftest StaticPool 인메모리) + 4 모델 추가(`YearEndReport/Document/Simplified/AuditLog`). 5 tests pass.

Stage 2 (4f3c061f, e1f0ae4a, 85029c03, c86b5408, 841f8428, 2b846f03): 6 서비스 모듈 — `services/yearend/` 패키지. 23 unit tests pass.
- aggregator: Payroll 12개월 합산 → 자체 집계 dict + `refresh_snapshot` (status 전이)
- parser: 별지24호(이름/주민번호/총급여/결정세액/기납부세액/차감징수세액/4대보험) + 간소화(13 카테고리 dict 매칭). 텍스트 fixture 기반 테스트(실 PDF는 Task 17 매뉴얼)
- reconciler: ±1k/±10k 임계값 분류
- tax_calculator: Phase C `StubTaxCalculator` (uploaded → confirmed, 없으면 self_aggregated). Phase A 자리표시자 `NotImplementedError`
- audit: `log_action` + `extract_actor_meta` (Request 객체 IP/UA 추출)
- generator: Jinja2 템플릿 2종(별지24/23호 유사) + `html_to_pdf` (WeasyPrint)

Stage 3 (dd0d1a94, 48f75b1a, 9bd549ed, ada7de29): admin 라우터 21 엔드포인트(yearend.py 16 + staff_yearend.py 5). storage 메서드는 실제 시그니처 확인 후 `upload_file(BinaryIO, key, content_type)` / `delete_file(key)` 사용. Orbitron.yaml build command 에 WeasyPrint OS 의존성 + 한글 폰트(libpango/libcairo/fonts-noto-cjk) 추가.

Stage 4 (cd5b8c0e, 88ad1634): 어드민 프론트 — `pages/YearEnd.jsx`(연도 셀렉터/대시보드/직원 테이블/모달) + 5 컴포넌트(`ReconciliationBanner`/`SimplifiedTable`/`DocumentUploader`/`AuditLogList`/`EmployeeDetailModal`). axios `api` 사용(authFetch 가 아님 발견 후 적용). PDF는 `responseType: 'blob'`.

Stage 5 (922028b1): 직원앱 — `pages/MyYearEnd.jsx`(본인 요약/문서/초안 PDF). 홈 화면 conditional 카드 (distributed years count > 0 일 때만). staff-app 자체 CSS 디자인 시스템(`.action-card`) 매칭.

Stage 6 (bdcc8310): DevelopmentRoadmap UI — Phase 1 "연말정산 지원" status `planned → done`, 4 items `done: true`. Phase 4 "연말정산 자동화"(자체 세법 계산)는 그대로 planned.

**Bug Fix (9c783873)**

배포 후 어드민 페이지에서 "대상 직원이 없습니다" 출력. 원인: 16개 엔드포인트 모두 `biz_id = get_bid_from_token(request)` 식 직접 호출 → `get_bid_from_token` 은 FastAPI Header dependency 함수 → Request 객체 첫 인자로 전달 시 내부 예외로 항상 None 반환 → `Staff.business_id == None` 필터링 → 0 row. 다른 라우터(cashbill 등)의 패턴 `bid: int = Depends(get_bid_from_token)` 으로 16개 모두 변경. DB 라이브 쿼리 재검증: biz_id=1 staff 19명 정상 조회.

### 인프라 변경

- 신규 백엔드 패키지: `services/yearend/` (6 모듈, 약 1,200 줄) + `templates/yearend/` (2 Jinja2 템플릿)
- 신규 백엔드 라우터: `routers/yearend.py` + `routers/staff_yearend.py` (총 21 엔드포인트)
- 신규 모델: `YearEndReport`/`YearEndDocument`/`YearEndSimplified`/`YearEndAuditLog` (4 테이블, PostgreSQL `init_db()` 자동 생성)
- 신규 프론트 페이지: 어드민 `YearEnd.jsx` + 5 컴포넌트, 직원앱 `MyYearEnd.jsx`
- Sidebar HR 그룹에 "연말정산 지원" 메뉴 추가
- 신규 의존성: `pytest`, `pytest-asyncio`, `Jinja2`, (이미 있던) `weasyprint`
- pytest 인프라(`tests/`, `conftest.py`, `pytest.ini`) — 프로젝트 최초 테스트 셋업
- Orbitron 배포: build command 에 `libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info fonts-noto-cjk fonts-noto-cjk-extra` 추가

### 다음 세션 인계

- **배포 검증**: Orbitron 자동 배포 완료. 어드민 `/yearend` 19명 직원 정상 조회 확인됨. 추가 검증 시나리오:
  - "전체 일괄 집계" → Payroll 54건 기반 자체 집계 결과 확인
  - 한 직원에 별지24호 PDF 업로드 → 파싱 결과(결정세액/차감징수액)와 자체 집계 대조 검증
  - 직원앱 로그인 후 본인 PDF 다운로드(R2 + 감사 로그 자동 기록 확인)
- **Fixture 사용 시 주의**: `tests/yearend/fixtures/sample_*.txt` 는 합성 데이터. 실 PDF 와 텍스트 layout 차이 가능 (`주(현)근무지` 라인의 다중 컬럼 등) → 실 PDF 1개 파싱 검증 필요
- **알려진 deferred 이슈**:
  - BackgroundTasks 가 request-scoped session 사용 — 장시간 작업 시 fresh `Session(engine)` 권장
  - 감사 로그 어드민 조회 UI 미구현 (DB 에는 기록됨)
  - `datetime.utcnow()` deprecation warning 6건 — 기존 코드베이스 패턴, 추후 `datetime.now(datetime.UTC)` 마이그레이션 권장
  - Orbitron build command apt-get 권한 검증 필요 (Python 런타임 정책 확인 시)
- **Phase A 업그레이드 경로**: 향후 자체 세법 계산 도입 시 `services/yearend/tax_calculator.py` 의 `StubTaxCalculator` → `StandardKoreanTaxCalculator` 교체. 다른 모듈(aggregator/parser/generator/reconciler/audit) 변경 없이 재사용

---

## 2026-04-25 (저녁 세션 — 영업관리 V1 신규 메뉴)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | 영업관리 설계 명세 (브레인스토밍 7라운드, 12 합의사항) | 완료 |
| docs | 영업관리 구현 계획서 (22 task, 3923줄) | 완료 |
| feat | SalesGuideProgress 모델 + 4 모델 테스트 | 완료 |
| feat | sync-status 4 자동 카운트 (보건증/4대보험/근로계약/사업자번호) | 완료 |
| feat | compute_stats 카테고리 진행률 (만료/sync 처리) | 완료 |
| feat | 라우터 4 엔드포인트 + main.py 등록 | 완료 |
| feat | kimbap.js 38 항목 마스터 데이터 (1226줄) | 완료 |
| feat | useSalesGuide 훅 + 5 React 컴포넌트 (617줄) | 완료 |
| feat | SalesGuideHome + CategoryPage + App.jsx 라우트 + redirect | 완료 |
| feat | 사이드바 새 그룹 + 빨간 배지 + 외국인고용 메뉴/페이지 정리 | 완료 |

### 세부 내용

**Brainstorming (7835b4dd)**

7라운드 Q&A 합의 결과:
- 사이드바 위치: 새 최상위 그룹 "영업관리" (메인 다음, 상품관리 위)
- 6 카테고리 모두 1차 노출, 운영팁은 골격만 (콘텐츠 V2.3 점진)
- 데이터: SodamFN 자체 보유 + 정부 사이트 deep-link
- UI 모티브: gaongn.net `/certifications` 카드+모달
- 인터랙션: L3 (체크리스트 + 핵심 날짜). L4 자동알림은 V2.1
- 콘텐츠 저장: 정적 JS (kimbap.js) + DB 진행상태만
- 외국인고용 가이드: HR 메뉴 폐지 → 영업관리/인력·노무로 이주
- business_docs 5종: 영업관리 항목 카드에서 직접 업로드 가능
- SYNC-LINK 5개 핵심 자동 카운트

→ `docs/superpowers/specs/2026-04-25-sales-guide-design.md`

**Plan (6ea34528)**

22 task 단계별 구현 계획. 백엔드 TDD (5 task), 콘텐츠 작성 (6 task), 프론트엔드 매뉴얼 검증 (11 task).

→ `docs/superpowers/plans/2026-04-25-sales-guide.md`

**Implementation (10 commits, Subagent-Driven Development)**

- **Stage 0-1 (dece1ab0, 1a95896a)**: pytest venv 설치 + tests/sales_guide/ 패키지 + SalesGuideProgress 모델 (UniqueConstraint business_id+item_key). 4 모델 테스트 PASS.

- **Stage 2-4 (d9ef607d, 5bf8c910, bc6b03d3)**: services/sales_guide.py — compute_sync_status (4 카운트: 활성 직원 status="재직" 기준 보건증 partial, 4대보험 partial, signed ElectronicContract 보유 직원, business_number 1/0). compute_stats — 필수 항목만 진행률 반영, sync 100% 자동완료, 만료 다운그레이드, 만료 30일 alert. 11 + 4 = 15 단위 테스트 PASS.

  주의: hr.hygiene_certificates 는 사업장 단위 위생교육 모델 부재로 V1 제외. 데이터 파일에서 syncWith 제거, 수동 체크리스트로 동작.

- **Stage 5 (cb15b556)**: routers/sales_guide.py 4 엔드포인트 + CATALOG_FOR_STATS (38 항목 메타). 모든 endpoint `Depends(get_bid_from_token)` + `Depends(get_admin_user)`. yearend 16-endpoint 버그 패턴 회피. main.py 라우터 등록.

- **Stage 6 (7a1478a3)**: kimbap.js 1226줄 — 38 항목 6 카테고리. 각 항목: title/required/renewalCycle/authority/processingDays/legalBasis/description/steps/documents/tips/deepLinks/internalLinks/syncWith/mergedDocs/dateFields. 외국인 고용 콘텐츠 흡수.

- **Stage 7 (d8ef7586)**: useSalesGuide 훅 (3 API 병렬 페치 + patchItem 뮤테이터) + 5 컴포넌트 (DeepLinkButton/ProgressCard/ItemCard/DateInputDrawer/ItemDetailModal — 5섹션 모달, business_docs 통합 업로드). business_docs 엔드포인트 plan과 다른 점 발견하여 수정 (`/business-docs` POST, `doc_type` Form field).

- **Stage 8 (6c2ba6fa)**: 2 페이지 (SalesGuideHome 6 카테고리 그리드 + 진행률 헤더 + 1차방문 배너 / CategoryPage 단일 컴포넌트 + 5 필터 + 모달) + App.jsx 2 라우트 + foreign-worker-guide → /sales-guide/hr Navigate redirect.

- **Stage 9-10 (4e53f90b)**: Sidebar 새 최상위 "영업관리" 그룹 (7 하위 메뉴: 랜딩 + 6 카테고리). useEffect로 /sales-guide/stats 페치 → 라벨에 (미완료+만료임박) 카운트 빨간 배지. HR hrSubItems 외국인고용 제거, hrPaths 정리. ForeignWorkerGuide.jsx 페이지 자체 삭제 (App.jsx redirect만 남음).

### 인프라 변경

- 신규 백엔드 라우터: `routers/sales_guide.py` (4 엔드포인트)
- 신규 백엔드 서비스: `services/sales_guide.py` (compute_sync_status + compute_stats)
- 신규 모델: `SalesGuideProgress` (PostgreSQL `init_db()` 자동 생성)
- 신규 프론트엔드 페이지: `pages/sales-guide/SalesGuideHome.jsx` + `CategoryPage.jsx`
- 신규 프론트엔드 컴포넌트: `components/sales-guide/` (5 컴포넌트)
- 신규 프론트엔드 훅: `hooks/useSalesGuide.js`
- 신규 정적 데이터: `data/sales-guide/index.js` + `kimbap.js` (38 항목)
- 사이드바 새 최상위 그룹 "영업관리" + HR 외국인고용 메뉴 제거
- pages/ForeignWorkerGuide.jsx 삭제

### 검증 결과

- Backend pytest: 15/15 PASS (모델 4 + sync 7 + stats 4)
- Frontend npm run build: 성공 (14.27초). SalesGuideHome 4.6KB chunk + useSalesGuide 40KB chunk
- 라우트 등록 확인: 4개 endpoint (`/api/sales-guide/progress` GET/PATCH, sync-status, stats)
- 12 git commit, push 완료 (`4e53f90b`)

### 다음 세션 인계

- **Orbitron 배포 트리거 필요** (사용자 작업): 백엔드 + 프론트엔드 재배포. PostgreSQL `init_db()` 가 sales_guide_progress 테이블 자동 생성.
- **운영 환경 매뉴얼 검증 7 시나리오** (Task 21):
  - 신규 사업장 첫 진입 → 6 카테고리 + 1차방문 배너
  - 항목 완료 토글 + 갱신주기 만료일 입력 → 진행률 변동
  - 보건증 항목 → 직원 N/M sync 카운트 표시
  - 사업자등록 → biz_registration 업로드 → Settings 회사정보 동기화
  - `/hr/foreign-worker-guide` 직접 진입 → `/sales-guide/hr` redirect
  - 모바일 뷰 (1열 + 풀스크린 모달)
  - 사이드바 빨간 배지 카운트 정확성
- **알려진 V1 제약**:
  - 운영팁 7항목 본문 placeholder ("준비 중") — V2.3 점진 작성
  - 자동 알림 cron 없음 — V2.1 (만료일 기록은 가능)
  - 휴게음식점 1 종 하드코딩 — V2.2 업종 확장 (cafe/chicken)
  - hr.hygiene_certificates 위생교육 sync 비활성 (사업장 단위 모델 부재)
- **콘텐츠 출처 주의**: kimbap.js 의 정부 사이트 URL 은 정부24 개편 시 깨질 수 있음. V2 자동 점검 cron 검토.

---

## 2026-04-27

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 팝빌 EasyFinBank TEST 환경 검증 진입 (POPBILL_BANK_IS_TEST 토글 + UI 모드 라벨 STUB/TEST/LIVE 3색) | 완료 |
| fix  | is_test 결정 로직 fallback 추가 (POPBILL_BANK_IS_TEST 미설정 시 POPBILL_IS_TEST 따라감) | 완료 |
| feat | bank-sync 자동분류 → 매출관리/매입관리(DailyExpense) 연동 + 키워드 보강 + 학습 패턴 + on-pull 자동분류 | 완료 |
| feat | bank-sync 21분 단위 자동 갱신 + 거래내역 탭 타이틀 동적 변경 (계좌별) | 완료 |

### 세부 내용

**1) 팝빌 EasyFinBank TEST 환경 검증 (320e38cf, 88dd7814)**

- **배경**: 2026-04-24 정액제 결제 후 LIVE 환경 `-99010016 사용할 수 없는 서비스` 차단 지속. 팝빌 1:1 답변으로 TEST 환경에서 검증 진행 권고. 사용자가 test.popbill.com 에 신한 110-357-7***** 등록(사용기간 ~2026-06-04, 시뮬레이션 거래 411건 보유).
- **320e38cf**: `Orbitron.yaml` `POPBILL_BANK_IS_TEST: "false"` → `"true"` + 사유 주석. `routers/bank_sync.py` `/status` 응답에 `is_test` 필드 추가, `BankSync.jsx` 헤더 배지·안내 박스를 STUB(amber)/TEST(sky)/LIVE(emerald) 3색 분기.
- **88dd7814 (fix)**: Orbitron 대시보드는 `Orbitron.yaml` env 자동 주입 안 됨 → 사용자가 새 변수 추가 안 하면 (empty) 상태. 해결: `services/bank_sync_service.py` `__init__` 에서 `POPBILL_BANK_IS_TEST` 미설정 시 `POPBILL_IS_TEST` (이미 설정됨) fallback. 진단 응답에 `is_test_source` 필드 추가 (POPBILL_BANK_IS_TEST / POPBILL_IS_TEST(fallback) / default 식별).
- **결과**: 재배포 후 자동 TEST 모드 진입, 5/5 진단 통과, 411건 거래 적재 성공.

**2) 자동 분류 → 매출/매입관리 DailyExpense 연동 (d8059968)**

- **결정적 버그**: `_materialize_link` 가 구식 `Revenue`/`Expense` 테이블에 INSERT 했지만 매출관리(/revenue/daily) · 매입관리(/api/purchase/daily) 화면은 `DailyExpense` 만 읽음 → 분류해도 화면에 안 보였음.
- **스키마**: `BankTransaction.linked_daily_id INTEGER` 신규 컬럼 + `init_db._run_migrations` 자동 ALTER TABLE (레거시 linked_revenue_id/linked_expense_id 보존).
- **헬퍼 분리**: `_resolve_revenue_channel(remark1, remark2)` 매핑, `_get_or_create_vendor` revenue/expense Vendor 자동 생성, `_classify_one_tx` 단일 tx 분류, `_classify_txs` 배치+학습 패턴 적용, `_build_learned_remark_map` (manual 가중치 2배, 80% threshold).
- **REVENUE_CHANNEL_MAP 31개 키워드** — 배달앱(쿠팡이츠/배달의민족/요기요/음식배달) · 페이먼트(카카오페이/네이버페이/토스/서울페이/제로페이) · 카드매입(BC/신한/KB국민/삼성/현대/롯데/하나/NH/우리 + 매출표) · 팝빌 test 데이터 패턴(원신한/FB자금/FB이체).
- **출금 default expense**: vendor 매칭 실패 시 vendor_id=NULL + remark1을 vendor_name으로 → 매입관리에 표시 가능.
- **/pull 자동 분류**: `service.session.flush()` 후 `_classify_txs(only_unclassified=True)` 호출. 응답에 `auto_classified` 카운트 포함.
- **auto_classify endpoint 리팩터**: 동일 `_classify_txs` 헬퍼 재사용. 구식 키워드 인라인 코드 제거.

**3) 21분 자동 갱신 + 거래내역 탭 타이틀 동적 변경 (5b56b50b)**

- **`_do_pull` 헬퍼 추출**: `pull_transactions` 의 단일계좌 pull 로직을 함수로 분리. `/pull`, `/refresh-all` 공용.
- **`POST /api/bank-sync/refresh-all`**: 사업장의 모든 활성 계좌 일괄 갱신 + 자동분류. `skip_recent_minutes` (기본 20분) 파라미터로 중복 호출 방지. 계좌별 try/except 격리. 응답: total_accounts/ok/skipped/failed/total_inserted/total_classified.
- **거래내역 탭 타이틀 동적 변경** (사용자 요청): 단일 계좌 등록 시 "신한은행 거래내역", 거래내역 탭 필터 적용 시 해당 계좌 은행명, 다중+미필터 시 "거래내역" 그대로. `txTabLabel` useMemo + `tabs` useMemo 재계산.
- **AutoRefreshControl 컴포넌트**: 탭 우측, ON/OFF Power 토글 + 분 input(1~60, 기본 21) + 카운트다운 MM:SS + 마지막 갱신 시각/신규건수. `localStorage(bankSyncAutoRefresh_v1)` 영속화. `useEffect` `setInterval` 로 페이지 열려있는 동안 21분마다 `/refresh-all` 호출, 백엔드는 `skip_recent_minutes=interval-1` 로 중복 방지.

### 인프라 변경

- 신규 백엔드 엔드포인트: `POST /api/bank-sync/refresh-all`
- 신규 DB 컬럼: `banktransaction.linked_daily_id` (auto-migration)
- 신규 환경변수 사용: `POPBILL_BANK_IS_TEST` (Orbitron.yaml 토글 + fallback)
- Vendor 자동 생성 로직 추가 (revenue 채널별, expense 매칭 실패 시 vendor_id=NULL)

### 검증 결과

- 운영 환경 재배포 후 `is_test_source: POPBILL_IS_TEST (fallback)` 확인, is_test_mode: true 전환
- 거래내역 수집 정상 (411건 신규 적재, 중복 411건 스킵 검증)
- 헤더 배지 "🧪 TEST 모드 · 0P" 출력 확인 (사용자 스크린샷)
- frontend npm run build 성공 (16.69s)

### 다음 세션 인계

- **운영 매뉴얼 검증** (Phase 2 검증 7 시나리오):
  - "자동 분류" 클릭 → 음식배달/카드매입/카카오페이정산 등이 매출로, 광장동 모바일 출금이 매입으로 분류 확인
  - /매출관리 페이지 → revenue Vendor 자동 생성된 채널명들이 거래내역과 함께 표시되는지
  - /매입관리 페이지 → 분류된 매입(vendor_id 매칭 / 미매칭 모두) 표시되는지
  - 자동 갱신 토글 ON 21분 → 카운트다운 + 첫 즉시 실행 + 21분 후 재실행 검증
- **알려진 V2 후보**:
  - 24/7 백그라운드 자동 갱신 — 현재는 페이지 열려있을 때만. Orbitron cron 으로 `/refresh-all` 호출 추가 검토
  - 학습 패턴 정확도 — 80% threshold 가 적절한지 운영 데이터로 튜닝
  - 출금 default expense 분류 — 사람 이름 송금이 인건비/매입 어느 쪽인지 사용자 보정 후 학습 인계
- **팝빌 LIVE 활성화 후속**:
  - 1:1 문의로 견적서 7종 (전자세금계산서/전자명세서/사업자등록상태/예금주조회/기업정보/SMS/알림톡+친구톡) 일괄 LIVE 활성화 요청 메시지 초안 작성 완료 (사용자 발송 대기)
  - LIVE 활성화 완료 후 `POPBILL_BANK_IS_TEST=false` 토글 + 계좌 재등록 필요 (test/live 데이터 분리)

---
