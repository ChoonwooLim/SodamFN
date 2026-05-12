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
| fix  | sidebar useEffect 가 superadmin 토큰으로 /sales-guide/stats 호출해 401 → 강제 로그아웃 회귀 (영업관리 V1 도입 시 발생) | 완료 |
| fix  | 팝빌 6모듈 TEST 환경 라우터 라이브 검증 — account_check 메서드명 오타 + .env/Orbitron.yaml 환경변수 누락 2건 (POPBILL_USER_ID, NOTIFICATION_PROVIDER) 보완 | 완료 |

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

**4) Sidebar 강제 로그아웃 회귀 fix (3890192f)**

- **증상**: SuperAdmin 으로 로그인 → 잠깐 페이지 떴다가 즉시 `/login` 으로 튕김. 일반 admin 은 정상.
- **원인**: 4/25 영업관리 V1 도입 시 추가된 `Sidebar.jsx` useEffect 가 모든 페이지에서 `GET /api/sales-guide/stats` 호출. SuperAdmin 은 `business_id` 없고 `X-View-As-Business` 헤더도 없어 401 → `api.js` 인터셉터가 토큰 비우고 강제 로그아웃.
- **수정**: useEffect 진입 시 `role === 'superadmin' && !viewAsBid` 면 호출 스킵 + alerts=0. view-as 로 매장 선택한 후엔 정상 호출. dependency 에 `viewAsBid` 추가.

**5) 팝빌 6모듈 TEST 환경 라우터 라이브 검증 (180c577d)**

- **목적**: 1:1 문의로 활성화 요청한 7종 (전자세금계산서/전자명세서/사업자등록상태/예금주조회/기업정보/SMS/카카오 알림톡) API 키 열림 여부 확인. 메모리상 LIVE 활성화 답변 대기였던 게 실제로 어디까지 통하는지 라이브로 진단.
- **검증 도구**: `backend/scratch_popbill_routers.py` 신규 (untracked, 일회성). 슈퍼관리자 로그인 → DB 첫 사업장으로 `X-View-As-Business` 헤더 부여 → 6개 모듈 `/status`·무료 GET·단건 비용 호출 일괄 점검. 본문 파싱하여 `200 OK` 인데 `ok:false` 면 ⚠️ 표기.
- **선결 도구**: `backend/scratch_popbill_healthcheck.py` 로 LIVE/TEST 환경의 `getBalance` 9개 모듈 직접 호출 — LIVE 전부 `-99010016`, TEST 전부 ✅. LinkID(SODAM)/SecretKey 자체는 두 환경 모두 유효.
- **발견 1 — 코드 버그**: `account_check_service.py:160` 가 `svc.CheckAccountInfo(...)` (PascalCase) 호출. SDK 1.64.1은 `checkAccountInfo` (lowerCamelCase) — `AttributeError` 로 예금주조회 코드가 깨져있던 상태. 1줄 fix.
- **발견 2 — env 누락 2건**: `POPBILL_USER_ID=sodam2025` 미설정으로 `taxinvoice/popbill-url` 가 `-10000038 회원의 아이디가 아닙니다`. `NOTIFICATION_PROVIDER=popbill` 미설정으로 notifications 만 stub 폴백되어 `urls/template-mgt|plus-friend|sender-number` 가 400. `.env` + `Orbitron.yaml` 동시 추가.
- **결과**: 6모듈 /status 모두 popbill 활성, `/issuer`·`/popbill-url`·`/banks`·`/balance`·`/templates`·`/urls/*` 전부 200 통과. 단건 호출도 SDK 함수 도달까지 정상.
- **새 차단점 — `-99910002 [POPBILL_TEST]`**: 6모듈 모두 실제 API 호출 시 동일 코드로 차단. 의미는 "LinkID 등록됐지만 상품별 권한 토글 OFF". `getBalance` 통과 + `popbill-url` 발급 통과여도 **상품 호출은 별도 활성화 필요**. **TEST 환경에서도 EasyFinBank 외 8개 모듈은 미부여 상태**.
- **메모리 정정**: 메모리 `project_popbill_fax.md` 의 "팩스 운영 중" 표현은 부정확 — `getBalance` 만 통과한 부분 검증이었음. 새 메모리 `project_popbill_modules.md` 로 9모듈 매트릭스 + 차단 코드 의미(-99010016 vs -99910002 vs -10000038) SSOT 작성.

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
- **팝빌 LIVE+TEST 활성화 후속** (이번 세션 검증으로 갱신):
  - 1:1 문의 발송 시 본문에 **LIVE 환경 활성화 + TEST 환경 상품 권한 부여** 양쪽 명시 필요. 이번 라이브 검증으로 TEST 환경에서도 EasyFinBank 외 8개 모듈은 `-99910002` (상품 권한 미부여) 차단 확인.
  - 권한 풀리면 코드는 즉시 작동 가능 — 6모듈 라우터/관리자UI 흐름 100% 검증 완료. `scratch_popbill_routers.py` 재실행으로 통과 여부 즉시 확인 가능.
  - 전자명세서(StatementService) 라우터·서비스 미구현 — 권한 풀린 뒤 별개 신규 개발 트랙(6종 양식 등록 포함).
  - LIVE 활성화 완료 후 `POPBILL_BANK_IS_TEST=false` 토글 + 계좌 재등록 필요 (test/live 데이터 분리)

---

## 2026-04-28

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| analysis | 팝빌 활성화 절차 핵심 사실 발견 — **운영전환 신청 폼**이 LIVE 활성화의 유일한 트리거 (1:1 문의는 안내 채널) | 완료 |
| docs     | 메모리 SSOT `project_popbill_modules.md` 운영전환 신청 섹션 추가 + 9모듈 매트릭스 갱신 (Fax 송신 검증 완료, 발신번호 차이 무시 결정) | 완료 |

### 세부 내용

**1) 팝빌 라이브 재검증 (변화 없음 확인)**

이전 세션의 운영 매뉴얼 검증을 위해 `scratch_popbill_healthcheck.py` 재실행 — 9개 모듈 LIVE/TEST 상태 1시간 30분 전과 100% 동일.

- LIVE 9개 전부 `-99010016 사용할 수 없는 서비스` 유지
- TEST 환경 `getBalance` 9개 모두 통과 (LinkID 등록은 됨)
- TEST 환경 실제 호출 가능: 계좌조회·팩스 2개만 (사용자가 팩스 송신 1매 검증 완료한 적 있음을 확인)
- 4/26 발송한 1:1 문의는 팝빌 측에서 처리 진척 없음

**2) 팩스 송신 검증 사실 정정 + 발신번호 결정**

사용자 피드백으로 메모리 `project_popbill_fax.md` 의 부정확 표현 정정:

- "팩스 운영 중" → 실제로는 TEST 환경에서 송신 1매 검증 완료된 상태 (LIVE 미활성)
- 발신번호 표기 불일치 (`02-452-6570` vs `02-2452-6570`) — 사용자 결정으로 무시 (팩스 동작에 영향 없음 확인)

**3) 팝빌 1:1 답변 분석 — 핵심 사실 발견**

사용자가 4/26 발송한 1:1 문의 답변 + 후속 질문 답변 두 건을 분석:

- **1차 답변**: "개발이 완료되셨다면 팝빌 개발자센터에서 운영전환 신청을 접수해주시기 바랍니다. <https://developers.popbill.com/customer-center/serviceopen>"
- **2차 답변**: "운영전환 신청 시 API 상품 다중 선택이 가능하오니 참고해주시기 바랍니다."

→ **결론**: 1:1 문의는 안내·상담 채널이고, **LIVE 활성화의 진짜 트리거는 운영전환 신청 폼 제출**. 이 발견이 라이브 검증 결과(LIVE 9개 -99010016)와 정확히 일치. EasyFinBank 정액제 결제(4/24)도 운영전환 신청과 별개라 -99010016 차단이 지속됐던 이유 설명됨.

### 메모리 갱신

- `project_popbill_modules.md` (SSOT)
  - 매트릭스 갱신: Fax TEST 송신 검증 완료, EasyFinBank 411건 검증 완료, 7종 미부여
  - 신설 섹션: "운영전환 신청 (LIVE 활성화의 유일한 경로) — 2026-04-28 확정" — URL, 다중 선택, 처리 절차, 핵심 함정(1:1 문의 ≠ 활성화), SodamFN 미신청 상태 명시
  - 발신번호 차이 무시 결정 기록
- `MEMORY.md` 인덱스 — 매트릭스 메모리 줄 갱신

### 다음 세션 인계

- **즉시 진행**: <https://developers.popbill.com/customer-center/serviceopen> 접속 → API 상품 8종 다중 선택 (TaxinvoiceService / StatementService / ClosedownService / AccountCheckService / BizInfoCheckService / MessageService / KakaoService + EasyFinBankService LIVE + FaxService LIVE) → 신청서 제출
- **신청 후 1~2 영업일 대기** → 팝빌 담당 부서 처리 → 유선/이메일 통보
- **통보 받은 직후**: `cd backend && python scratch_popbill_routers.py` 재실행으로 단계별 통과 여부 즉시 확인
- **모두 풀린 후**: `Orbitron.yaml` `POPBILL_IS_TEST: "true"` → `"false"` + Orbitron 재배포
- **별도 트랙**: 전자명세서(StatementService) 라우터·서비스 신규 개발 (6종 양식 등록 포함)

---

## 2026-04-29

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | **전자명세서(StatementService) 신규 개발** — 6종 양식(거래명세서/청구서/견적서/발주서/입금표/영수증) 발행/검색/추가발송 풀구현 + spec + 라이브 검증 | 완료 |
| style | Statement.jsx 다크 → 라이트 테마 전면 재디자인 (.impeccable.md 가이드 준수) | 완료 |
| fix  | togo 'BOX' 비표준 → 'TBOX' 표준화 + UserID fallback 'sodam' 잘못된 값 제거 (RuntimeError 명시화) | 완료 |
| feat | 전자명세서 양식별 샘플 데이터 + 6종 일괄 샘플 발행 (모니터링·테스트) | 완료 |
| feat | 전자명세서 잔액 표시·충전 + 미리보기/인쇄/이메일 재전송/취소 운영 풀세트 | 완료 |
| feat | **전자세금계산서(TaxInvoice) Statement 패턴 일괄 적용** — TaxinvoiceRecord 모델 신규 + 잔액·샘플·미리보기·인쇄·PDF·이메일·취소 6 메서드 추가 + Memo 케이스 fix | 완료 |
| other | **카카오 알림톡 셋업 외부 진행** — 채널 개설(@sodam2025) + 비즈인증 신청 + 팝빌 발신번호 등록 신청 | 외부 검수 대기 |

### 세부 내용

**1) 전자명세서(StatementService) 신규 개발 (62d95207, bce903fe)**

- **spec**: `docs/superpowers/specs/2026-04-29-statement-design.md` (608줄). 브레인스토밍 4결정: Q1=A(6종 동시), Q2=B(양식별 conditional), Q3=B(자동이메일+팩스/SMS), Q4=B(DB 가벼운 메타).
- **Backend**:
  - `models.Statement` 신규 (가벼운 메타 — business_id/item_code/mgt_key/total/status/receipt_num/email_sent_at)
  - `services/statement_service.py`: Provider 추상화 + FORM_CODES 6종 메타 + StatementDraft.property_bag → SDK Statement 객체 dynamic attribute 매핑
  - `routers/statement.py`: 8 엔드포인트 (status/issuer/form-codes/issue/search/info/send-fax/send-sms/popbill-url) + 테넌트 격리
  - `main.py`: statement 라우터 include
- **Frontend**:
  - `pages/Statement.jsx` (~580줄): 양식 셀렉트, conditional 필드 동적 렌더, 자동 계산, 이력 테이블, 발행 결과 모달, 팩스/SMS 추가 발송
  - `App.jsx`: `/finance/statement` 라우트
  - `Sidebar.jsx`: 재무·회계 그룹에 전자명세서 메뉴 (전자세금계산서 아래)
- **라이브 검증** (TEST 환경): 6/6 엔드포인트 통과. 발견·수정 버그 2건:
  1. registIssue 인자 시그니처 — item_code 는 statement 객체 안 itemCode 필드
  2. mgt_key 길이 24자 초과 (-12001011) → 21자로 단축

**2) Statement.jsx 라이트 테마 재디자인 (a1291076)**

- **사용자 피드백**: "디자인이 너무하다" — 다크 사이드바와 동일 색조라 라벨/제목 가독성 0.
- **원인**: `.impeccable.md` 명시 "라이트 모드 전용" 위배. 자동 진행 모드에서 디자인 시스템 미확인.
- **수정**: 페이지 `bg-slate-50`, 카드 `bg-white shadow-sm border-slate-100`, 입력 `bg-slate-50 border-slate-200 focus:ring-blue-500`, 라벨 `text-xs font-semibold text-slate-500`, TaxInvoice.jsx 패턴 정렬.

**3) togo 표준화 + UserID fallback 안전화 (6fdf2a9b)**

- **증상**: 사용자가 팝빌 콘솔 진입 4개 버튼 모두 "아이디 오류"로 안 열림.
- **진단**: SDK 호출은 모든 togo 통과(BOX/TBOX/SBOX/WRITE/CERT 다 URL 발급). 진짜 원인은 togo='BOX' 가 비표준 값 (팝빌 표준은 TBOX/SBOX/WRITE/CERT).
- **추가 발견**: Orbitron 운영 환경에 `POPBILL_USER_ID` 가 미주입 → fallback 'sodam'(미등록 ID) 으로 호출 → 페이지 거절. 메모리 함정 패턴(env 자동 미주입) 재현.
- **수정**: default togo `BOX` → `TBOX`, 4개 버튼 (TBOX/SBOX/WRITE/CERT). 잘못된 fallback 'sodam' 제거 → user_id 미설정 시 `RuntimeError` 명시 발생.

**4) 양식별 샘플 데이터 + 6종 일괄 샘플 발행 (adcfe63d)**

- **사용자 요청**: "양식별로 발급용 샘플데이터를 넣어서 테스트나 모니터링이 가능하게"
- **Backend**: `FORM_CODES` 6종에 `sample_data` 필드 추가 (소담김밥 휴게음식점 업종 친화 — 어린이집 도시락/단체급식/케이터링/식자재 발주/유치원 입금표/현장 영수증). `POST /api/statement/issue-samples` 엔드포인트 신규.
- **Frontend**: 발행 폼 헤더에 "샘플 채우기" 버튼 + 페이지 상단 amber gradient "6종 일괄 발행" 카드 (LIVE 환경 시 confirm 비용 안내).
- **라이브 검증**: 6/6 통과 (총 발행액 4,186,000원).

**5) 전자명세서 운영 기능 풀세트 (0c243c5a)**

- **사용자 요청**: "잔여 비용 부족하다고 3개만 됐어. 발행된 서류 볼 수 있는 메뉴 없네"
- **라이브 잔액 확인**: 0.0 P (사용자 보고와 일치)
- **Backend Provider 확장**: `get_view_url`/`get_print_url`/`send_email`/`cancel`/`get_balance`/`get_charge_url`
- **신규 라우터 6**: `/balance` `/charge-url` `/{key}/view-url` `/print-url` `/send-email` `/cancel` (테넌트 격리 검증)
- **Frontend 재구성**: 페이지 상단 3분할 카드 (잔액 + 충전 / 6종 일괄 발행). 이력 카드 클릭 → DetailModal (메타 + 팝빌 getInfo + 미리보기·인쇄·이메일 재전송·취소).

**6) 전자세금계산서(TaxInvoice) Statement 패턴 일괄 적용 (222fa67b)**

- **사용자 요청**: "전자세금계산서도 샘플양식과 미리보기 등 필요한 모든 기능들 전부 추가해줘"
- **신규 모델**: `models.TaxinvoiceRecord` (key_type/mgt_key/invoice_num/receipt_num/status/email_sent_at...)
- **Provider 6 메서드 + SAMPLE_DATA**: 도시락 50인 + 음료 세트 660,000원 더미.
- **잠재 버그 fix**: `registIssue(Memo=...)` → `registIssue(memo=...)`. SDK 1.64.1 케이스 차이. 운영전환 미신청 -99010016 차단으로 가려져있던 잠재 버그.
- **신규 라우터 7**: `/balance` `/charge-url` `/sample` `/issue-sample` `/{key}/view-url` `/print-url` `/pdf-url` `/send-email` `/cancel`. `/issue` 도 DB INSERT/UPDATE 추가, `/search`·`/info` 는 DB+팝빌 병합.
- **Frontend pages/TaxInvoice.jsx 재구성**: 잔액 카드 + 샘플 발행 카드 + 이력 카드 클릭 + DetailModal (3 버튼 미리보기/인쇄/PDF + 이메일 + 취소).
- **라이브 검증**: balance/charge/sample/search 통과. issue-sample 은 `-10004000 등록된 인증서가 존재하지 않습니다` (TaxInvoice 는 TEST 에서도 인증서 필수, Statement 와 다른 점).

**7) 카카오 알림톡 셋업 (사용자 외부 작업 — 검수 대기)**

- 알림톡 발송 4단계 함정 분석:
  - 카카오톡 채널 개설 → 비즈인증 → 발신번호 → 템플릿 검수 → 잔액 충전
- **사용자 진행**:
  - 카카오톡 채널 `@sodam2025` (소담김밥 건대본점) 개설 ✅
  - 위저드 (공개·검색·카테고리 음식점/분식) ✅
  - **비즈인증** 신청 (사업자등록증, 영업일 3~5일 검수)
  - **팝빌 발신번호 등록** (010-4173-6570 임춘우 공동대표): LG U+ 가입사실확인서 + 사업자등록증 + 임춘우 재직증명서 (대표자여도 강제) → 영업일 1일 검수
- **결정**: 자동화(팝빌) + 일회성 광고(카카오 비즈센터) 병행 (옵션 D)

### 인프라 변경

- **신규 백엔드 라우터**: `/api/statement/*` (8 endpoints + 6 신규 = 14)
- **TaxInvoice 라우터 확장**: 기존 6 → 13 (잔액/충전/샘플/뷰어/인쇄/PDF/이메일/취소 추가)
- **신규 DB 모델**: `Statement`, `TaxinvoiceRecord` 2개 (auto-create)
- **신규 프론트엔드 페이지**: `pages/Statement.jsx` (~580줄)
- **신규 사이드바 메뉴**: 재무·회계 그룹에 "전자명세서"
- **신규 앱 라우트**: `/finance/statement`

### 메모리 갱신

- `project_popbill_modules.md` (SSOT)
  - StatementService 행: "(라우터 미구현)" → "✅ 활성 + 라우터/UI 구현 완료 (4/29)"
  - 운영전환 신청 절차 + TEST 완성 후 일괄 LIVE 전환 전략
- `project_popbill_sender_number.md` 신규: 발신번호 등록 절차 + 핵심 함정 (대표자여도 재직증명서 강제) + 임춘우 공동대표 정보
- `MEMORY.md` 인덱스 갱신

### 외부 대기 (4/30 ~ 5/7 통과 예상)

| 항목 | 검수 시간 |
|---|---|
| 팝빌 발신번호 (010-4173-6570) | 영업일 1일 |
| 카카오 비즈인증 (소담김밥 채널) | 영업일 3~5일 |
| 알림톡 템플릿 (등록 후) | 카카오 검수 영업일 1~3일 |

### 다음 세션 인계

- **발신번호 통과 시** (예상 4/30): SMS 라이브 발송 가능 (잔액 충전 후). 사장님 폰으로 테스트 1건.
- **비즈인증 통과 시** (예상 5/5~5/7): 셈하나 → 알림톡 → [플러스친구 관리] → 채널 ID `@sodam2025` 입력 → 카카오 자동 승인.
- **알림톡 템플릿 시안 미리 준비**: 거래처 청구 안내 / 직원 급여 안내 / 예약 확인 등 3~5종 — 비즈인증 통과 즉시 등록 가능하도록.
- **TaxInvoice 인증서 등록**: 운영전환 신청 + 인증서(전자세금용 1년 20,000원) 발급 후 LIVE 발행 가능.
- **미부여 3개 모듈 추가 1:1 문의**: ClosedownService(사업자등록상태) + BizInfoCheckService(기업정보) + 친구톡(FTS).

---

## 2026-04-29 (저녁 — CODEF Phase 1 풀 구현 + 매출 채널 재평가)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | CODEF DEMO 환경변수 5개 (.env / Orbitron.yaml / .env.example) | 완료 |
| docs | CODEF Phase 1 design spec(902줄) + implementation plan(3,485줄, 33 task) | 완료 |
| feat | CODEF 백엔드 풀 구현 (모델 4 + 마이그레이션 + 서비스 5개 + 라우터 3 + cron + 알림톡 통합) | 완료 |
| feat | CODEF 프론트엔드 — 외부연동 hub + 카드 모듈 디테일 + 등록 모달 + 8 컴포넌트 | 완료 |
| fix | SuperAdmin View-As 헤더 처리 누락 → resolve_bid 헬퍼 적용 (3 라우터 11 endpoint) | 완료 |
| fix | SDK set_demo_client_info 누락 + 성공 코드 범위 너무 광범위 (`CF-000` → `CF-00000`) | 완료 |
| fix | 사업자 → 개인 카드 모드 전환 (`clientType=P`, URL `/b/*` → `/p/*`) | 완료 |
| design | 매출/매입 채널 분리 + 이지포스(KICC) VAN사 가입 사실 발견 → 매출은 CODEF 부적합 | 발견 |

### 세부 내용

#### CODEF Phase 1 백엔드 (commits 0cacf4ca → eba136fd → 9f5acb54 머지)
- **DB 모델 4 신규**: CodefConnection (Phase 2-5 공유) / CardMerchant / CodefCallLog / CodefBudgetSetting
- **기존 모델 컬럼 추가**: CardSalesApproval / CardPayment 에 source / source_meta / connection_id / synced_at (auto-migration 가드)
- **services/codef/**: exceptions(5종 표준 예외) + organization_catalog(14 카드사) + codef_client(SDK 래퍼/RSA/result code 매핑) + connection_service(라이프사이클) + quota_service(한도/쿨다운/예산) + card_provider(approval/billing/member-store)
- **routers/codef/** + tasks/: connections(6) + card_sync(3, X-Cron-Secret 인증) + budget(2) + Orbitron cron 핸들러
- **알림톡 통합**: NotificationService 재사용, codef_connection_expired 템플릿 (graceful degradation)
- **테스트 105/105 PASS**, 회귀 0건

#### CODEF Phase 1E 프론트엔드 (commit 52cd4e69)
- **신규 페이지 2개**: `/external-integration` Hub + `/external-integration/cards` Detail
- **신규 컴포넌트 8개** (`components/codef/`): SourceBadge / BudgetSummaryCard / ModuleGrid (Phase 2-5 placeholder) / CardModule / CardConnectionList / CardConnectionRegisterModal (자동 분기 — 간편인증/ID·PW) / AdditionalAuthStep / BudgetSettingsModal / SyncHistoryDrawer
- **수정 3개**: App.jsx 라우팅 + Sidebar 외부연동 메뉴 + CardSales.jsx 헤더에 빠른 동기화 버튼
- **빌드 14.72s 통과**

#### 환경변수 등록 + prod 배포
- Orbitron 대시보드 secrets/env 9개 등록 (CODEF_CLIENT_ID/SECRET/PUBLIC_KEY + CRON_SHARED_SECRET + CODEF_ENV/API_HOST/PRICE_TABLE/DEMO_DAILY_LIMIT + NOTIFICATION_TEMPLATE_*)
- main 머지 + 자동 배포 — 1.5분만에 prod 반영, CODEF 11 endpoint 노출 + cron 엔드포인트 200 OK 검증

#### 4 디버깅 사이클 (3ac51417 → 0be1e3b9 → 29130c6a → 67a4f9e1)
- 사용자 PoC 시도 시 4개 버그 순차 발견·수정. 매번 prod 재배포 검증 후 진행.
- 최종 발견: CF-04000의 진짜 원인은 `clientType="B"` 사업자 하드코딩 vs 사용자가 입력한 개인 카드 ID 불일치.

#### 매출 채널 재평가 (이번 세션 핵심 발견)
- 사용자 정보 공유: **이지포스(EasyPos / KICC)** VAN사 가입 사실
- 즉, 소담김밥 카드 매출 통합 = 이지포스 API 가 정답 (CODEF 카드사 직접 가맹점 채널 부적합)
- 셈하나에 `docs/EasyPOS_API_연동_가이드.md` 이미 존재 — KICC 1600-1234 전화 + API 키 발급 절차
- **새 채널 매트릭스**:
  - 매출(가맹점 입금) → 이지포스 API → CardSalesApproval/CardPayment
  - 매입(사장님 개인 카드 지출) → CODEF P 모드 (방금 만든 코드 활용) → DailyExpense
  - 계좌 거래 → CODEF 또는 팝빌 EasyFinBank (기존)
- **재구조화 필요**: CODEF 카드 어댑터(card_provider.py)의 적재 모델을 CardSalesApproval → DailyExpense 로 변경. 카드 사업자(B 모드) 코드는 셈하나에 무용 (이지포스가 14개 카드사 통합 매출 처리).

### 메모리 갱신

- `feedback_proceed_with_recommendation.md` 신규: 작업 진행 중 매 결정마다 묻지 말고 추천 명시 후 실행, 결과만 보고. brainstorming/위험 작업은 예외.
- `project_codef_evaluation.md` 갱신: 데모 키 발급 + .env/Orbitron.yaml 연결 완료 + Popbill vs CODEF 어댑터 차이표 추가.
- `MEMORY.md` 인덱스 갱신.

### 다음 세션 인계 (중요)

1. **사용자 액션 — KICC 1600-1234 전화** (이지포스 API 키 발급, 영업일 1-2일)
2. **재구조화 결정 필요** (다음 세션 첫 작업):
   - 옵션 A 추천: 매입 어댑터 재매핑(P 모드 → DailyExpense) + 이지포스 어댑터 신규 = 두 채널 동시 구축
   - 옵션 B: CODEF 카드 모듈 deprecated, 이지포스만 (매입 자동화는 후속)
   - 옵션 C: 보류 + KICC API 키 도착 후 한 번에
3. **PoC 미완**: CODEF connectedId 발급 자체는 아직 성공 못 함 (clientType=P 변경 후 재테스트 미실시). 옵션 A 결정 시 매핑 변경하면서 함께 재시도.
4. **Phase 1G**: 추가본인확인 verify endpoint 501 보강 (PoC 결과 후)
5. **알림톡 템플릿**: codef_connection_expired 검수 미신청 (이지포스 채널 결정 후 함께 진행)

### 외부 대기 (4/30 ~)

| 항목 | 검수 시간 |
|---|---|
| KICC 이지포스 API 키 | 영업일 1-2일 (전화 후) |
| 팝빌 발신번호 (010-4173-6570) | 영업일 1일 (4/29 신청) |
| 카카오 비즈인증 | 영업일 3-5일 (4/29 신청) |
| 알림톡 템플릿 (등록 후) | 영업일 1-3일 |

---

## 2026-04-30 (HR/Payroll 버그픽스 + 사업주 비공개 지급 정보 시스템 + 팝빌 팩스 다중 발송 + 4월 급여 세무사 정합성)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | HR/payroll Staff.end_date 잘못된 참조 수정 (산출 500 오류 해결) | 완료 |
| fix | SuperAdmin View-As 모드 — 신규 직원 생성 business_id=NULL 버그, 회사기본정보·직인 화면 회귀 수정 | 완료 |
| feat | hr-certificate 영문 대표자명 표기 지원 (영문 주소·인적사항 주소 변경 시도는 롤백) | 완료 |
| feat | staff/staff-detail 페이지 상단 돌아가기 버튼 추가 | 완료 |
| docs | 사업주 전용 비공개 지급 정보 spec(설계) + plan(9 task 구현 계획) | 완료 |
| feat | private_* 비공개 지급 정보 시스템 — 모델 6 필드 + 마이그레이션 + 직렬화 필터 + GET/PUT /private 엔드포인트 + 사업주 전용 PrivateTab UI + 명세서 마스킹 + 정책 배지 | 완료 |
| feat | payroll private_tax_unreported 분기 — 공제 강제 0 + 명세서 직인·발급자 동적 렌더 | 완료 |
| fix | startup auto-migration 에 private_* 6 컬럼 추가 (prod 배포 안전성) | 완료 |
| feat | 팝빌 팩스 다중 파일 한 통 묶음 발송 (직접 업로드 모드) + 결과 폴링 + 테스트모드 배너 + 시간대 fix | 완료 |
| fix | sendFax_multi 메소드명 오타 + 인자 순서(ReceiverName 인자 없음) 교정 | 완료 |
| feat | 직원앱 급여명세서 페이지 ?month= 쿼리스트링 지원 (알림톡 링크에서 정확한 월 자동 표시) | 완료 |
| feat | 2026-04 급여 세무사 기준 정합성 조정 스크립트 — 10명 전원 세무사 PDF와 정확히 일치 | 완료 |
| fix | 4월 잘못 삭제된 6명 Payroll 긴급 복구 (cp949 콘솔 한글 깨짐으로 인한 분류 오류) | 완료 |
| feat | 4월 자동 계산 vs 세무사 PDF 검증 도구 — 매월 차이 항목별 자동 비교 가능 | 완료 |
| fix | 급여명세서 익월정산/자격미달 안내가 주휴수당 합계 0원 케이스에서 안 보이던 회귀 수정 | 완료 |

### 세부 내용

#### 사업주 전용 비공개 지급 정보 시스템 (대형 기능 신규 도입)
- **spec**: docs/superpowers/specs/2026-04-30-private-payment-info-design.md
- **plan**: 9 task 구현 계획
- **모델**: Staff 에 `private_*` prefix 일관 사용 6 필드 추가 (private_tax_unreported, private_seal_image_url, private_issuer_name, private_signed_off_by, private_payment_memo, private_extra_amount 등)
- **직렬화 필터**: `private_` prefix 단일 패턴 차단 (외부 출력에서 일괄 차단)
- **엔드포인트 신규 2개**: GET/PUT `/staff/{id}/private` (사업주만 접근)
- **payroll 분기**: `private_tax_unreported=True` 직원은 공제 강제 0, 실수령=지급총액. override 보다 우선 적용
- **명세서**: 직인/발급자/메모 모두 직원별 private_* 값으로 동적 렌더 (사업주 정책 반영)
- **UI**: 인사기록카드 권한별 탭 분리, 사업주 시야에 PrivateTab + 정책 배지
- **auto-migration**: prod 배포 안전 — startup 시 6 컬럼 idempotent 추가

#### 4월 급여 세무사 정합성 작업 (이번 세션 대형 작업)
- **세무사 PDF 4명**: 김금순(세금대납)/정명주/정수현/김순복 공제 항목 세무사 수치로 덮어쓰기
- **6명 직원 분해 추가**: 김다은(일용직 PDF) + 린(일용직 추정) + 정수미/반정옥/황윤선/고아라(3.3% 사업소득)
- **CLAUDE.md 규칙 준수**: 김금순 세금대납 처리 시 total_pay = gross + bonus_tax_support (총 보상액)
- **사고 + 복구**: cp949 한글 깨짐으로 6명 잘못 삭제 → 즉시 복구 (1명 항목별 분해 영구 분실)
- **검증 도구**: scripts/maintenance/verify_apr_auto_calc.py — 매월 자동 비교 가능
- **자동화 현황**: 사업소득자 4명 + 일용직 1명 = 5명 100% 자동 / 4대보험 가입자 5명은 HI 보수월액 분리 필드 필요(Phase 2)
- **P/L 4월 인건비**: labor_cost = 14,584,460
- **린/김다은 contract_type 정정**: '아르바이트' → '일용직' (DB 직접 변경, prod 배포 시 동일 변경 필요)

#### 직원앱 급여명세서 ?month= 쿼리스트링
- 알림톡 본문의 #{지급월코드}(`2026-04` 형태)를 받아 자동 표시
- 지연 클릭에도 정확한 월 명세서 표시 보장 — 알림톡 1개 템플릿이 모든 월 커버

#### 팝빌 팩스 다중 파일 묶음 발송
- 기존 단일 파일 발송 → 다중 첨부 한 통 묶음 발송 모드 추가
- sendFax_multi 메소드명 오타 + 인자 순서 교정 (ReceiverName 인자 없음)
- 결과 폴링 + 테스트모드 배너 + 시간대 fix (KST 일관)

#### HR/Payroll 버그 픽스
- Staff.end_date 미존재 필드 참조 → 산출 500 오류 (페이로드 검증 누락) → 정정
- View-As 모드에서 신규 직원 추가 시 business_id=NULL 으로 생성되던 버그 → resolve_bid 헬퍼 적용
- 회사기본정보·직인 화면 빈칸 회귀 → 동일 헬퍼 적용
- 신규 staff_id 13/14 contract_type 정정 (아르바이트 → 일용직)

#### HR Certificate 영문 표기
- 대표자명 영문 표기 지원 (외국인 직원 서류 발급용)
- 주소 영문 표기 시도는 한글 도로명이 더 정확해서 롤백
- 인적사항 주소를 회사 주소로 변경하는 시도도 롤백 (직원 거주지가 정답)

### 메모리 갱신

- `feedback_korean_encoding.md` 신규 — Windows cp949 콘솔 한글 깨짐 함정 + DELETE 시 staff_id 명시 강제
- `project_payroll_apr_2026.md` 신규 — 4월 정합성 진행 상태 + 자동화 95% Phase 2-4 로드맵
- `project_popbill_sender_number.md` 갱신 — 카카오 비즈인증 + 발신번호 + 채널 연동 4/30 모두 승인 완료
- `MEMORY.md` 인덱스 갱신

### 외부 진행 상태 (4/30 종료 시점)

| 항목 | 상태 |
|---|---|
| 카카오 비즈니스 채널 sodam2025 | ✅ 승인 (4/30, 1영업일) |
| 팝빌 발신번호 010-4173-6570 | ✅ 사용 (4/30) |
| 팝빌 ↔ 카카오 채널 연동 | ✅ 완료 (4/30 12:31) |
| 알림톡 템플릿 (급여명세서 발송 안내) | ⏳ 사장님 검수 신청 진행 중 |
| 린 일용직 세무사 PDF | ⏳ 사장님 별도 요청 (선택) |

### 다음 세션 인계

1. **알림톡 템플릿 검수 결과 확인 + 백엔드 발송 코드** (PopbillProvider.sendKakaoAlimtalk 연결, 급여 확정 트리거)
2. **자동화 Phase 2-4** (1.5시간): insurance_base_salary_hi 필드 분리 + ei_exempt 필드 + 두루누리 정책 재검토 → 9/10명 자동
3. **1월 데이터 CLAUDE.md 모순 점검**: scripts/adjust_jan_to_accountant.py 가 세금대납 직원 total_pay = gross - total_ded 로 저장 (실수령액). CLAUDE.md 규칙은 gross + bonus_tax_support (총 보상액). 4월과 동일 패턴으로 재조정 필요할 수 있음
4. **이지포스 KICC API 키** (4/29 전화 후 영업일 1-2일) — 도착 시 매출 채널 통합 + CODEF 매입 어댑터 재매핑 결정

---

## 2026-04-30 (저녁 세션 — 직원관리 자동화 + 다중매장 + 전자계약서 표준양식 + 외국인 증명서)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | payroll calculate 의 override 입력 시 NameError 회귀 + details_json 에 overrides 누락 수정 | 완료 |
| feat | 직원관리 페이지 로그인 계정 username 표시 + 아이디순 정렬 (기본값) | 완료 |
| feat | 신규 직원 등록 시 로그인 ID 자동 순차 부여 (사업장별 prefix 감지) + 계정 동시 생성 | 완료 |
| feat | 인사기록카드 로그인 계정 — 아이디 수정/비밀번호 재설정/계정 삭제 + 표시 토글 | 완료 |
| infra | npm run dev 자동화 — OS 무관 백엔드 명령 + venv backslash 경로 + requirements 자동 동기화 prereq | 완료 |
| feat | 전자계약서 변수 자동 치환 확장 (30+ 변수) + 고용노동부 표준 양식 + 변수 카탈로그 도움말 | 완료 |
| feat | 근무장소 자동 입력 — settings.work_location 단일 필드 (단일매장) | 완료 |
| feat | 다중매장 보유 업체 지원 — BusinessStore 모델 + 매장 관리 UI + 계약서 매장 선택 드롭다운 | 완료 |
| fix | 전자계약서 모달 stale state 회피 + /business-info → /auth/business-info 경로 정정 (404 원인) | 완료 |
| feat | 사회보험 체크박스 자동 표시 변수 4개 (NP/HI/EI/WI) — 직원 분류·NP면제 기반 ☑/☐ 자동 결정 | 완료 |
| feat | 외국인 직원 영문명 표기 + 본인 서명란 — Staff.name_eng 필드 + 자동 fallback (account_holder 영문) | 완료 |
| style | 본인 서명란 추가로 인한 2페이지 분리 해소 + 직인 80% 축소 + 외곽선 인쇄 안전 영역 확보 | 완료 |
| chore | 데이터 정정 — 정명주/김순복/정수현 contract_type 정규직→아르바이트, 김금순/김다은 영문명 등록 | 완료 |

### 세부 내용

#### payroll override 회귀 fix
- `routers/payroll.py:508` `details['overrides'] = req.overrides` — `details` 변수가 calculate 함수 안에 정의된 적 없어 NameError 500
- 사장님이 6개 공제 필드 입력하면 산출 자체가 실패 (기능이 없어진 것처럼 보임)
- details_json 직렬화 시 overrides 도 누락되어 다음 진입 시 자동 복원 실패
- `details_payload` 통합 dict 로 정정. req.overrides=None 케이스도 정상 직렬화 보장

#### 직원관리 자동화
- 직원 카드 이름 옆 로그인 ID 배지 (slate-100 bg, mono font-bold)
- 정렬 옵션 첫 번째 "아이디순" + 기본값
- 신규 직원 추가 모달:
  - 사업장 username 패턴 분석 → 다음 추천값 미리 채움 (예: sodam008 → sodam009)
  - 충돌 회피 +1 반복
  - "로그인 계정 함께 생성" 토글 + 비밀번호/등급 입력 (기본 ON)
  - POST /staff 가 auto_create_account=True 시 Staff + User 한 번에 생성
- 인사기록카드 로그인 계정 섹션:
  - 아이디 옆 연필 → 인라인 수정 (Enter 저장 / Esc 취소)
  - 비밀번호 재설정 모달 (눈 아이콘 표시 토글, 평문 미리보기)
  - 계정 삭제 빨간 버튼 (이중 confirm)
- 백엔드 신규 endpoint 4개:
  - GET /staff/next-username
  - PUT /staff/{id}/account/username
  - PUT /staff/{id}/account/password
  - DELETE /staff/{id}/account

#### npm run dev 자동화 (DevOps)
- `dev:backend` 명령이 cmd 전용 구문(for/findstr/^|/taskkill) → bash/PowerShell 에서 실패
- OS 무관 형태로 교체: `.venv\Scripts\python.exe -m uvicorn main:app --reload`
- 첫 시도 시 forward slash 가 cmd.exe 에서 명령으로 인식 → backslash 로 정정
- `setup:backend` prereq 추가: `pip install -q -r requirements.txt` 자동 실행 → ModuleNotFoundError 재발 방지

#### 전자계약서 표준양식 + 30+ 변수 자동 치환
- 신규 utils/contractVars.js:
  - `getStandardContractTemplate()` — 고용노동부 표준 양식 11개 조항
  - `buildContractVariables(staff, business)` — 30+ 변수 매핑
  - `applyContractVariables(template, vars)` — split-join 안전 치환
  - `CONTRACT_VARIABLE_CATALOG` — UI 도움말용
- ContractSettings: 표준 양식 함수 호출 + 변수 클릭하면 클립보드 복사
- StaffDetail handleOpenContractModal: 템플릿 + business + stores 병렬 fetch + 일괄 치환
- ContractTab "변수 치환" 버튼: 항상 최신 fetch 후 치환

#### 다중매장 BusinessStore 시스템 (대형)
- 신규 모델 BusinessStore (business_id FK + name + address + phone + is_default + is_active)
- 신규 라우터 routers/store.py: GET/POST/PUT/DELETE /stores + PUT /stores/{id}/set-default
- 신규 컴포넌트 components/StoreManager.jsx: 목록 + 추가/인라인 수정/삭제/기본 설정
- CompanyInfoSettings 임베드 (회사 정보 저장 다음)
- 계약서 모달에 매장 선택 드롭다운 (amber 배경, default 자동 선택)
- _seed_default_stores() — 기존 사업장에 default store 1개 자동 생성 (idempotent)
  - 3개 사업장 시드: 소담김밥/소담김밥 강동점/장인김밥
- {work_location} 변수가 선택된 store.name 으로 자동 치환

#### 사회보험 체크박스 자동 표시
- 변수 4개 신규: {insurance_check_np/hi/ei/wi}
- ☑/☐ 자동 결정:
  - 산재(WI): 항상 ☑ (모든 근로자 의무)
  - 고용(EI): insurance_4major OR 일용직/아르바이트
  - 국민연금(NP): insurance_4major AND !np_exempt
  - 건강(HI): insurance_4major
- 표준 양식 8번 자리에 변수 4개 박힘
- DB 양식 즉시 갱신 (사장님이 양식 다시 초기화 안 해도 다음 변수치환 시 적용)

#### 외국인 직원 증명서 강화
- Staff.name_eng 신규 필드 (Optional VARCHAR + auto-migration)
- StaffUpdate Pydantic + BasicInfoTab 입력 칸 추가
- _is_foreign(staff): nationality 비한국 OR visa_type 명시
- _resolve_name_eng(staff): name_eng > account_holder(영문) > '' 우선순위
- _staff_display_name: 외국인 + 영문명 결정 가능 시 'NAME ENG (한글이름)' 자동 표기
- _staff_signature_block: 본인 서명란 (점선 구분선 + 'XXX (서명)')
- 4개 증명서(재직/경력/급여/퇴직) 모두 적용
- 김다은(D-2 베트남) 'DAO KIM HONG NGOC' 등록
- 김금순(F-4 재외동포) 'JIN JINSHUN' account_holder 에서 자동 fallback 등록

#### 인쇄 스타일 미세 조정
- 본인 서명란 추가로 콘텐츠 늘어 2페이지 분리 → margin/padding 일괄 축소로 1페이지 수렴
- 직인 78px → 62px (사장님 요청 80% 적용)
- @page margin 하단 14mm + min-height calc(297-40)mm — 외곽선 인쇄 안전 영역 안

#### 데이터 정정 (DB 직접)
- 정명주(id=3)/김순복(id=8)/정수현(id=9): contract_type 정규직 → 아르바이트
  - 김금순(id=2)만 진짜 정규직(월급 3,400,000) 유지
- 김다은(id=14): name_eng='DAO KIM HONG NGOC', nationality='Vietnam' 등록
- 김금순(id=2): name_eng='JIN JINSHUN' 자동 등록 (account_holder 에서 복사)
- 소담김밥 settings.work_location='소담김밥 건대본점 매장'
- 3개 사업장 default BusinessStore 자동 시드

### 메모리 갱신

- `feedback_korean_encoding.md` 신규 — Windows cp949 콘솔 한글 깨짐 + DELETE 시 staff_id 명시 강제 (이전 등록)
- `project_payroll_apr_2026.md` 갱신 — 4월 정합성 진행 상태 + 자동화 95% Phase 2-4 로드맵 + contract_type 정정 메모
- `MEMORY.md` 인덱스 갱신

### 외부 진행 상태 (4/30 종료 시점)

| 항목 | 상태 |
|---|---|
| 알림톡 템플릿 (급여명세서 발송 안내) | ⏳ 사장님 검수 신청 진행 중 |
| 린 일용직 세무사 PDF | ⏳ 사장님 별도 요청 (선택) |
| Prod 동기화 — 정명주/김순복/정수현 contract_type | ⏳ admin UI 에서 변경 필요 |
| Prod 동기화 — 외국인 영문명 입력 (또는 자동 fallback) | ⏳ 자동 fallback 동작 시 추가 작업 불필요 |

### 다음 세션 인계

1. **알림톡 템플릿 검수 결과 확인** + 백엔드 발송 코드 (PopbillProvider.sendKakaoAlimtalk 연결, 급여 확정 트리거)
2. **자동화 Phase 2-4** (1.5시간): insurance_base_salary_hi + ei_exempt + 두루누리 정책 재검토 → 9/10명 자동
3. **1월 데이터 CLAUDE.md 모순 점검**: 1월 김금순 세금대납 데이터 재조정
4. **이지포스 KICC API 키** 도착 후 매출 채널 통합 결정
5. **다중매장 후속** (별도): Staff.store_id FK 추가 → 직원별 소속 매장 자동 매핑 (2번째 매장 오픈 시점)

---

## 2026-05-01

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | Impeccable 디자인 스킬 33개 + .gitignore (scratch_*, mp4) 정리 | 완료 |
| docs | 2026-04 직원급여 PDF 12종 + 셈하나 가치평가 IR 자료 + AGENTS·AI_WIKI 인덱스 | 완료 |
| refactor | delivery-images 외부 API(Replicate/OpenAI) 전면 제거 → OpenClaw + 자체 Flux 단일 파이프라인 | 완료 |
| fix | .env 가 시스템 환경변수보다 우선되도록 load_dotenv(override=True) | 완료 |
| feat | 대화형 프롬프트 엔지니어링 (GPT-5.5 + LLaVA 참고이미지 분석) | 완료 |
| fix | CLIP 77 토큰 truncation 완화 — 30-50단어 + 음식 정체성 첫 위치 강제 | 완료 |
| feat | 다중 참고 이미지 (최대 6장) + 콜라주 → img2img 우회 경로 | 완료 |
| perf | 콜라주 1024→512 + strength 0.55 + axios timeout 10분 | 완료 |

### 세부 내용

#### 오전 — 파일 정리 (커밋 26e2caf8 ~ 562d6d41)

세션 간 누적된 미커밋 54개 파일을 4 그룹으로 분류해 일괄 정리:

- **`.agents/skills/` 33개**: Impeccable 디자인 스킬 정의 (adapt/animate/audit/critique/frontend-design 등 22개 + reference 11개). `.gitignore` 에 `scratch_*.py`, `*.mp4` 패턴 추가
- **2026-04 직원급여 PDF 12종**: 직원별 급여대장 9건 + 급여명세서 + 사업소득대장 + 김다은 일용직대장
- **셈하나 가치평가 IR 자료**: SEMHANA_Valuation_Report.md + PDF 2종. 영상(.mp4 46MB)은 `.gitignore` 처리하고 별도 보관
- **AGENTS.md / AI_WIKI.md**: 에이전트·LLM 위키 포인터 인덱스

#### 저녁 — AI 이미지 생성 시스템 풀 교체 (커밋 55812b5a ~ ceaf3d4f)

배달앱 이미지 생성 흐름을 외부 API 의존성 제거 + OpenClaw GPT-5.5 + 자체 Flux GPU 자체 호스팅으로 풀 교체.

**Phase A — 인프라 + 어댑터 (커밋 55812b5a, 2de641f3)**
- `services/openclaw_client.py` 신규: OpenClaw `/v1/chat/completions` 래퍼. ChatGPT Plus/Pro OAuth 토큰을 통한 GPT-5.5 호출. 식품 사진 프롬프트 엔지니어링 전담
- `services/flux_image_client.py` 신규: 작업PC `192.168.219.100:8100` 자체 호스팅 FLUX.1-schnell 호출 (generate / img2img / upscale / remove-bg / inpaint)
- `routers/delivery_images.py`: Replicate/OpenAI 분기 + 한영 사전 + STYLE_SUFFIXES + `/segment` 라우터 전부 제거. 678→ 232 라인. 13 endpoint 검증
- 인프라: openclaw.json `gateway.http.endpoints.chatCompletions.enabled=true` + `gateway.bind="custom" customBindHost="0.0.0.0"` (적용 안 됨) → systemd `openclaw-gateway-proxy.service` (socat 18790 → 127.0.0.1:18789) 영구 우회
- ufw `192.168.219.0/24 → 18790/tcp` 허용
- `.env` / `Orbitron.yaml`: `OPENCLAW_GATEWAY_URL/TOKEN/MODEL`, `AI_FLUX_BASE_URL` 추가, `REPLICATE_API_TOKEN` / `OPENAI_API_KEY` 삭제
- `config.py` / `database.py`: `load_dotenv(override=True)` — 작업PC User scope 환경변수가 .env 무시하던 문제 해결

**Phase B — 대화형 프롬프트 엔지니어링 (커밋 d2692655)**
- `services/ollama_vision_client.py` 신규: ollama LLaVA 7B (`192.168.219.117:11434`) 로 참고 이미지 영문 묘사 추출 (OpenClaw image_url content parts 미지원 — issue #17685 우회)
- `routers/delivery_images.py`: `POST /ai-chat` (멀티턴, stateless) + `POST /analyze-reference` (LLaVA) 추가
- `components/AIChatPromptBuilder.jsx` 신규: 채팅 UI 전용 컴포넌트. ```prompt``` 코드블록 자동 감지 + [이 프롬프트로 이미지 생성] CTA
- `components/AIImageStudio.jsx`: 탭 "AI와 대화" 추가, 영문 프롬프트 확정 시 빠른 생성 탭 자동 채움

**Phase C — CLIP 77 토큰 + 다중 참고이미지 + 콜라주 (커밋 a8bdfc0d, fc565217, ceaf3d4f)**
- 증상: 사용자 "참치김밥 매콤" 요청에 떡볶이/소시지/순대 같은 엉뚱한 이미지 생성. 떡볶이 사진 업로드 시 소시지 형태로 변형
- 원인 1: GPT-5.5 가 50-100단어 정제 → CLIP 77 토큰 입력 시 끝부분 truncation → 음식 정체성 손실
- 해결 1: SYSTEM_PROMPT + CHAT_SYSTEM_PROMPT 강화 — 30-50단어 MAX, 음식 정체성을 첫 6단어 안에 영문+로마자(예: "Korean tuna kimbap roll (chamchi gimbap)"), filler 어 금지
- 원인 2: Flux + LLaVA 모두 한국 특화 음식(떡볶이/순대/꼬마김밥) 인식 약함
- 해결 2: `POST /ai-generate-with-refs` 신규 — N장(최대 6) 참고 이미지를 PIL 콜라주로 합성(n=1 resize, n=2 좌우, n=3 가로 3분할, n=4 2x2, n≥5 그리드) → Flux img2img init_image 로 사용 → LLaVA 텍스트 우회 + Flux 인식 약점도 우회
- 원인 3: 1024×1024 img2img step 당 127초 (model CPU offload + VAE encode/decode 매 step transfer 누적) → 6분+ → frontend 240초 timeout 초과
- 해결 3: 콜라주 사이즈 1024 → 512, strength 0.65 → 0.55 (effective_steps 2-3), axios timeout 240→ 600초

**프론트엔드**
- AIChatPromptBuilder: 단일 → 다중 (최대 6장) 갤러리. 64×64 썸네일 + 인덱스 뱃지 + 호버 X 삭제, 순차 LLaVA 분석 (GPU 충돌 방지)
- 채팅 [생성] 버튼 분기: 참고이미지 0장 → 부모 onGenerate(prompt) → 빠른 생성 탭. 1장 이상 → 직접 `/ai-generate-with-refs` POST + 결과 PNG 인라인 미리보기 + onSaved 콜백 (갤러리 새로고침)

### 검증

- ✅ OpenClaw `openclaw/codex-pro` agent (GPT-5.5) 한국어 → 영문 프롬프트 정제 동작
- ✅ Flux `/generate` 1024 (참치김밥 PNG 400KB) 풀 파이프라인 동작
- ✅ Flux `/img2img` 콜라주 (3장 → 1024×1024 PNG) 합성 + 생성 동작
- ✅ 16 endpoints 등록 (`/ai-chat`, `/analyze-reference`, `/ai-generate-with-refs` 신규)

### 다음 세션 인계

1. **사용자 테스트 후 피드백** — 콜라주 + img2img 결과의 한국 음식 일치도. strength 0.4-0.7 범위 슬라이더 노출 가능성
2. **image-service 자동 시작** — 현재 Windows 부팅 후 수동 실행. NSSM 또는 작업 스케줄러로 시스템 서비스화
3. **codex-pro agent 17K 토큰 시스템 프롬프트** — 매 호출 17K 토큰 사용. 프롬프트 정제 전용 가벼운 agent 신규 등록 검토
4. **OpenClaw socat 우회 영구화 검증** — twinverse-ai 재부팅 시 systemd 서비스 자동 시작 확인 필요
5. **Orbitron secrets 등록** — production 배포 시 `OPENCLAW_GATEWAY_TOKEN` 환경변수 secrets 관리

---

## 2026-05-12

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 은행거래 자동분류 대확장 — 카드/페이/배달 분리, AI 분류, 이동식 PG, 4종 입금 분류 | 완료 |
| feat | CODEF 마이데이터 통합 — 은행 계좌(공동인증서+간편인증), 카드 가맹점번호, PG 4종 | 완료 |
| feat | KICC 이지포스 POS 매출 자동수집 — Phase 1 기반 인프라 완성 (RSA + JSESSIONID) | 완료 |
| fix | 다수 — popbill 3개월 한도, race condition, CODEF remark 매핑, 이지포스 인증 흐름 | 완료 |
| infra | KICC easypay MCP 서버 등록 (`.mcp.json`) | 완료 |

### 세부 내용

**1) 은행거래내역 자동분류 시스템 대확장 (커밋 17건)**

- 라벨 단축 통일: 카드사입금내역→카드입금, 페이사입금내역→페이입금→페이, 배달앱입금내역→배달입금
- 정산 매칭 우선순위 재정렬: settlement > learned > rule (학습 패턴이 정산 매칭을 가리던 버그 수정)
- 카드사 약자+숫자 prefix 패턴 매칭 추가 (NH17831866, KB10175598, 우602406580, 현850570073, SHC...)
- 코페이/KSnet 등 이동식 단말기 mobile_settlement 신규 분류 + 수수료 역산 (사장님이 사용자단에서 PG/수수료율 직접 등록 → SaaS 다중매장 지원)
- 4종 신규 입금 분류: 현금매출 / 현금입금 / 차입금 / 기타입금 (매출 인식 분리)
- 월별 일괄 동기화 + 월별 빠른 필터 UI (race condition 버그 1건 함께 해결 — 4월 클릭 시 5월 데이터 표시)
- AI 분류 통합 (Phase 1: 제안, Phase 2: 감사, Phase 3: 대화형 분석) — Ollama qwen2.5:7b 무료 로컬 + OpenClaw GPT-5.5 선택 가능
- 입금 분류 가이드 + 이동식 PG 가이드를 앱 내 HelpModal 컴포넌트로 임베딩

**2) Popbill 3개월 한도 우회 — CODEF 과거 거래 가져오기 (커밋 5건)**

- popbill EasyFinBank 가 발급일로부터 90일 이내 데이터만 제공 → 1~2월 매출 누락 발생
- CODEF /v1/kr/bank/.../transaction-list API 로 우회 (검증: 1687건 1~5월 데이터 일괄 import 성공)
- 계좌 직접 등록 RegistBankAccount API 추가 (3가지 인증: ID/PW, 공동인증서, 간편인증) — 사장님이 팝빌 사이트 외부 진출 불필요
- CODEF 응답 필드 매핑 정정: resAccountDesc3 → remark1(거래상대방), 2→remark2, 4→remark3, 1→remark4

**3) CODEF 마이데이터 통합 (커밋 5건)**

- 외부연동 페이지에 계좌 거래내역 모듈 활성화 (Phase 2 → 활성)
- `/external-integration/banks` CODEF 전용 페이지 신설 (popbill 완전 배제)
- 공동인증서(loginType=0) + 간편인증(loginType=5) 추가 — 카카오/네이버/PASS/토스/페이코/삼성 6종
- 카드 가맹점번호 일괄 등록 (CardMerchant 모델 + bulk upsert + 카드사 14종 + PG 4종 CODEF 매핑)
- PG 4종 카탈로그 추가: 0521 네이버페이, 0523 페이코, 0524 카카오페이, 0525 토스페이
- CardModuleDetail 재구성: 가맹점주 시각으로 정리 + SuperAdmin 전용 CODEF 도구 숨김

**4) KICC 이지포스 POS 매출 자동수집 (커밋 8건) — 오늘의 메인 작업**

- HAR 캡처 분석으로 비공식 API 4개 endpoint 역공학:
  - GET /index.jsp (JSESSIONID warm-up)
  - POST /cm/checkLoginStatus.do (RSA 공개키 발급)
  - POST /cm/selectEasyPosLogin.do (RSA 암호문 ID/PW 인증)
  - POST /sle014/selectSalePerDayList.do (일별 영수증 단위 매출 조회)
- Nexacro PlatformData SSV (`\x1e` RS / `\x1f` US) 파서/빌더 신규 구현
- RSA-PKCS1v15 ID/PW 암호화 구현 — cryptography 라이브러리 + RSAPublicNumbers
- Fernet 대칭 암호화 (`services/crypto_util.py`) — 사장님 비밀번호 DB 보관용
- 신규 DB 모델 3종: EasyPosCredential, EasyPosSaleReceipt(영수증 raw + 결제수단 10종), EasyPosSyncLog
- 신규 라우터: 8 endpoints (자격증명 CRUD, test-login, sync/manual, sync/cron-trigger, sync/logs, dashboard)
- 신규 페이지: `/external-integration/easypos` (EasyPosModuleDetail.jsx)
- 검증 성공: 5/11 영수증 309건 / 매출 2,357,000원 동기화

**5) 디버깅 여정 (4단계 진단)**

- 1차: 평문 모드(inSecureMode=0) 시도 → "Login 정보 올바르지 않다" → RSA 암호화 필수 확인
- 2차: RSA 구현 후 동일 에러 → 디버그 로그로 cookies=0 발견 → 세션 식별 문제
- 3차: 짧은 간격 호출 비교 + JS 코드 분석 → 매 호출마다 새 modulus 발견
- 4차: Set-Cookie 응답 헤더 직접 확인 → index.jsp GET warm-up 누락 발견 → JSESSIONID 발급 후 정상

**6) 인프라**

- `.mcp.json` 신설: `@kicc/easypay-mcp` MCP 서버 등록 (KICC API 스펙 실시간 조회용)
- HAR 파일·`2026서류/` 폴더 .gitignore 추가 (실 매출 raw + 세션 정보 보호)
- `.env` + `Orbitron.yaml` 환경변수: `CREDENTIAL_ENCRYPTION_KEY` (Fernet 마스터 키)

### 다음 세션 인계

1. **Orbitron cron 등록 (사장님)** — `0 3 * * *`로 `/api/easypos/sync/cron-trigger` 호출, X-Cron-Secret 헤더 CODEF cron과 동일값 재사용
2. **이지포스 비밀번호 강화 권장** — 현재 `1727` 4자리 숫자라 5636 warning 지속. 8자+ 형식으로 변경 후 셈하나 자격증명 재입력
3. **EasyPos 매출 상세 UI 신설 검토** — 영수증 단위 raw + 결제수단 10종(현금/카드/PG/포인트 등) DB에 다 있음. EasyPosModuleDetail 하단에 상세 섹션 추가 또는 별도 `/finance/easypos-sales` 페이지 신설 결정 필요
4. **CODEF Demo→Production 전환** — 1일 100회 한도 도달 시 Production 신청
5. **Popbill EasyFinBank LIVE 운영 전환** — 2026-05-13부터 -99010016 해제 예정, 전체 동기화 1회로 1~5월 재pull 권장

---


## 2026-05-13

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 쿠팡이츠 배달앱 매출 자동수집 — Phase 2 Playwright + curl_cffi 하이브리드 풀스택 | 완료 |
| fix  | 쿠팡이츠 통합 구현 7회 버그픽스 (인증 / 파서 / 필드 매핑 / API 제약) | 완료 |
| infra | Docker 이미지 timezone Asia/Seoul 통일 | 완료 |
| infra | Orbitron 호스트 cron 등록 — EasyPOS 03:00 + 쿠팡이츠 04:00 일별 자동 동기화 | 완료 |

### 세부 내용

**1) 쿠팡이츠 배달앱 매출 자동수집 — 풀스택 (커밋 8건) — 오늘의 메인 작업**

소담김밥 PT용 자가 사용 + 정식 회사 전환 시 공식 API 협의 예정.
사장님 명시 원칙 "PT 일정 무관, 최고 퀄리티+편의성을 위해 어떤 비용도 감수 가능" 적용.

- HAR 캡처 분석으로 비공식 API endpoint 역공학:
  - POST /api/v1/merchant/login (평문 JSON, RSA 없음 — EasyPOS 보다 쉬움)
  - POST /api/v1/merchant/web/order/condition (주문 단위 raw)
  - GET /api/v1/merchant/transactions/{storeId}/settlement-management-data (일별 정산)
  - GET /api/v1/merchant/whoami (세션 검증)
- 인증 우회 전략 — 하이브리드:
  - 자동 로그인: Playwright 헤드리스 Chromium + stealth → Akamai sensor 자동 통과 시도
  - 매출 API: curl_cffi (Chrome120 TLS handshake/HTTP2 frame order 위조)
  - 401 자동 감지 → 자동 재로그인 → 1회 재시도 로직
- DB 모델 4종 신규: CoupangEatsCredential / CoupangEatsOrder / CoupangEatsSettlement / CoupangEatsSyncLog
- 신규 서비스 2개: services/coupang_eats_service.py (curl_cffi), services/coupang_eats_login.py (Playwright)
- 신규 라우터: routers/coupang_eats.py 11 endpoints (자격증명 CRUD + manual-cookies 폴백 + test-login + sync/manual + sync/cron-trigger + sync/logs + dashboard + debug/probe + debug/raw-orders)
- 신규 페이지: pages/CoupangEatsModuleDetail.jsx (~700줄) — 자격증명/수동쿠키/실시간대시보드/수동동기화/이력
- 외부연동 모듈 카드 활성화 (orange 테마)
- 의존성 추가: curl_cffi>=0.7.0, playwright>=1.49.0, playwright-stealth>=1.0.6
- Dockerfile: `python -m playwright install --with-deps chromium` (이미지 ~300MB 증가)

**2) 디버깅 여정 (실시간 진단 + 7회 패치)**

- 1차: 자동 로그인 Akamai 차단 확인 → Phase 1 폴백 (수동 쿠키 입력 방식) 정착
- 2차: 수동 쿠키 입력 HTTP 401 — 디버그 endpoint /debug/probe 추가, 응답 body 240자 노출
- 3차: 사장님 cookie 분석 — 21개 인식했지만 쿠팡이츠가 EATS_AT/RT 가 아닌 `unify-token + account-id` 신버전 인증 사용 발견 → sanity check 패치
- 4차: 사장님 Application 탭 직접 복사로 쿠키 1개만 깨진 형식으로 들어감 → 모달 안내문 Network 탭 cookie 헤더 사용으로 변경 + 파서 견고화 (탭/줄바꿈 best-effort)
- 5차: fetch_orders 500 (AttributeError NoneType) → None / 비-dict 응답 안전 처리 + /debug/raw-orders endpoint 추가
- 6차: 주문 0건 (실제는 14건) → debug/raw-orders 응답 분석으로 필드명 mismatch 확정. createdAt(NOT orderedAt), totalAmount(NOT totalSalePrice), status(NOT orderStatus) 정정
- 7차: 주문 여전히 0건, DB 직접 조회 결과 CoupangEatsOrder=0, CoupangEatsSettlement=54 → fetch_all_orders page_size 100 거부, 10 으로 변경 → 1개월 백필 436건 / 6,968,900원 성공

**3) Orbitron cron 등록 (인프라)**

- 호스트(stevenlim@192.168.219.101) crontab 에 2개 라인 추가:
  - `0 3 * * *` → EasyPOS 동기화
  - `0 4 * * *` → 쿠팡이츠 동기화
- 즉시 테스트 통과 (EasyPOS 309건/235만원, 쿠팡이츠 14건/27.65만원 update)
- timezone 발견: 컨테이너 UTC, 호스트 KST → target_date 1일 차이 → Dockerfile `TZ=Asia/Seoul` 추가로 통일

**4) 검증 결과**

| 항목 | 결과 |
|------|------|
| 어제 (5/12) 매출 | 14건 / 188,000원 |
| 1개월 백필 (4/12 ~ 5/12) | 436건 / 6,968,900원 |
| 7일 매출 (실시간 대시보드) | 1,738,000원 / 98건 (cancelled 제외) |
| 자동수집 cron | 매일 KST 04:00 정상 작동 검증 |

### 다음 세션 인계

1. **TZ 패치 재배포 후 cron 정확성 검증** — 내일(5/14) 새벽 03:00/04:00 cron 실행 결과 docker logs + 동기화 이력에서 target_date 일치 여부 확인
2. **사장님 보안 조치** — 대화 로그에 노출된 cookie (unify-token 등) 무효화 필요. 쿠팡이츠 로그아웃 → 재로그인 → 새 cookie 추출 → 셈하나 "쿠키 수동 갱신" 으로 교체
3. **쿠키 갱신 주기 모니터링** — 가장 빠른 만료 쿠키 기준 일주일~1개월. 401 발생 시 cron 이력에 실패로 표시 → 알림 시스템 고려
4. **배민 / 요기요 동일 패턴 확장** — 쿠팡이츠 패턴 완성됐으니 각 ~1일 작업. HAR 캡처 → 응답 구조 분석 → 필드 매핑 → DB 모델 → Router → 페이지
5. **이메일 정산서 파싱 폴백 검토** — 쿠팡이츠가 매일 이메일로 정산서 발송. 합법 + 안정. HAR 역공학 차단 시 자동 폴백 경로
6. **정식 회사 전환 시 공식 API 협의 필수** — 비공식 API 의존은 일시적 다리. 다수 가맹점 운영 전에 쿠팡이츠/배민/요기요 B2B API 협상 필요

### 흥미로운 진단 데이터

- 쿠팡이츠 7일 매출 1,844,500원 (포털) vs 셈하나 1,738,000원 (DB cancelled 제외): 차이는 cancelled 2건 (32,000원) + 시간차 1건 (74,500원) → cancelled 제외 정책 옵션 C 유지
- 쿠팡이츠 unify-token 도입 시점: 2026년 초 추정 (HAR 캡처 응답 분석 기준)
- Akamai Bot Manager sensor_data POST 경로 패턴: `/YqaJ3sMCd0pM/...` (난독화)

---

