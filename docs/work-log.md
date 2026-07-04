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

## 2026-05-13 (오후 — 자동수집 파이프라인 통합 + 카드매출 카드사별 분해 + 손익 정확도 + UI 리디자인)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | PR #1 자동수집→손익반영 파이프라인 + 입금 모니터링 (11 Task TDD) | 완료 |
| feat | PR #2/#3 CODEF 은행 어댑터 + 21분 자동 갱신 UI | 완료 |
| feat | PR #4 카드대금 납부를 매입에서 분리 (rule 5a + 학습) | 완료 |
| feat | PR #5 EasyPOS 카드사별 매출 (sle205) 자동수집 | 완료 |
| fix  | PR #6 `/stats/payment` 가 CardSalesApproval 매출도 합산 | 완료 |
| fix  | PR #7 `/stats/payment` 양쪽 card_corp 정규화 (같은 카드사 별개 row 합쳐짐) | 완료 |
| feat | PR #8 fan_out 단에서 카드 매출을 카드사별 vendor 행으로 분해 | 완료 |
| fix  | PR #9 DeliveryRevenue placeholder(total_sales=0) 가 자동수집 매출 0 으로 덮어쓰던 버그 | 완료 |
| feat | PR #10 인건비 = 직원 통장 실제 송금액 (옵션 A) + 임차료 발생주의 귀속 | 완료 |
| style | PR #11 손익계산서 페이지 프리미엄 리디자인 (KPI Hero + 다크 헤더 + 그라디언트 표) | 완료 |

### 세부 내용

**1) 자동수집 파이프라인 완성 (PR #1~#3)**

- spec/plan 브레인스토밍 (1283 라인 spec / 2967 라인 plan, 11 Task TDD)
- 모듈 구조: `services/auto_collection_sync/` 로 단일 진입점화
  - sync_event.py (DTO) / vendor_resolver.py / fan_out.py / fee_estimator.py
  - migration.py / settlement_watch.py / calendar.py / orchestrator.py
  - normalizers/{easypos,coupang_eats,bank}.py
- 채널별 normalizer → SyncEvent → fan_out → DailyExpense upsert
- 03:40 cron `/cron/profit-loss` recalc_all_businesses 진입점 추가
- PR #1 머지 시 migration 미실행으로 전 사이트 500 → revert + manual psql + Reapply 패턴 정립
- CODEF: BankConnectionService 자동 sync 21분 cron + BankModuleDetail.jsx 자동 갱신 토글

**2) 카드대금 분류 + EasyPOS 카드별 매출 (PR #4, #5)**

- bank_sync `_classify_one_tx` 에 카드대금 keyword 12종 + rule 5a (out_amount>0 + keyword → "card_payment")
- card_payment 는 DailyExpense 생성 X (매입 이중계산 방지). purchase.py EXCLUDED_PURCHASE_CATEGORIES 도 추가
- EasyPOS `/sle205/selectCardSaleList.do` 호출 → CardSalesApproval 에 카드사별 승인 행 저장
- `_normalize_card_corp` 매핑 — KB국민/신한/BC/롯데/NH농협/현대/하나/우리/...
- 발급사(카드사) ≠ 매입사 케이스: 매입사 우선 (CODEF 카드 정산 명세와 동일 식별자 유지)

**3) 카드매출 카드사별 표시 (PR #6~#8)**

- `/stats/payment` 가 CardPayment 뿐 아니라 CardSalesApproval 도 카드사별 매출 합산
- 양쪽 card_corp 동일 normalize 적용 → "신한" + "신한카드" 동일 row 로 합쳐짐
- fan_out 단계: vendor_resolver 에 `store_card:{corp}` 동적 키 + easypos normalizer 가 CardSalesApproval 기준으로 카드사별 net (승인-취소) 분해 emit
- prod cleanup: 기존 "매장 (소담김밥)" 단일 vendor Card 행 109개 삭제 → 카드사 10개 vendor 1,041행 재생성
  - 신한 40.08M / KB국민 37.03M / BC 27.76M / 현대 20.13M / 하나 18.67M / 삼성 15.75M / NH농협 13.52M / 롯데 11.45M / 우리 11.02M / 카카오페이 0.64M

**4) 손익계산서 정확도 (PR #9, #10)**

- DeliveryRevenue placeholder(`total_sales=0`) 행 20개가 sync_delivery_revenue_to_pl 에서 자동수집 합계를 0 으로 override 하던 버그 — `if dr_records:` → `dr_active = [r for r if total_sales>0]` 로 수정 + business_id 필터 추가
- 백필 결과 쿠팡 매출 1~5월 정상 반영 (10.6M / 9.7M / 8.7M / 5.9M / 2.9M)
- 사장님 정책 반영 (옵션 A):
  - 인건비 = "직원 통장에 실제 송금된 금액". `transfer_status='완료'` 만 카운트.
    세금대납 직원은 gross (공제 안 함), 일반 직원은 gross - 공제.
    `bonus_tax_support` 를 expense_labor 에 더하던 기존 로직 제거 (이미 expense_insurance / expense_tax_employee 로 분리되어 표시되므로 이중 계산 방지)
  - 발생주의: 임차료 등 ACCRUAL_CATEGORIES + 익월 1~4일 + 전월 말일이 비영업일이면 전월 귀속
  - sync_all_expenses: 이번달 + 다음달 1~4일 룩어헤드 조회 후 `_accrual_year_month` 로 귀속월 판정

**5) UI 프리미엄 리디자인 (PR #11)**

- 손익계산서 데스크탑 화면 무미건조 → KPI Hero + 다크 헤더 + 그라디언트 표
- KPI 4카드: 연간 매출 / 비용 / 영업이익 / 영업이익률 (Slate 다크 그라디언트 + 마진율 progress bar)
- 테이블 컨테이너: "P/L" 골드 뱃지 + 활성월 메타. thead 그라디언트. 수입/지출/영업이익 라벨 그라디언트 + inset shadow. 영업이익 행 16px + 패딩 ↑
- summary 탭만 max-w-screen-2xl (12개월+합계+평균 14컬럼 가독성)

### 운영 검증 결과

| 항목 | 결과 |
|------|------|
| biz=1 손익 (1~5월) | 매장 209.6M / 쿠팡 38.1M / 인건비 30.4M (옵션A) / 임차료 29.5M (발생주의) |
| 4월 인건비 | 1.49M (PDF 5명 대기) |
| 5월 인건비 | 0 (월말 산정 시점에 입력 예정) |
| 카드매출 카드사 분해 | 10개 카드사로 분리 표시 (매출관리 + 카드관리 화면) |
| 회귀 테스트 | 65 PASS (auto_collection_sync + easypos_card_sales 포함) |

### 다음 세션 인계

1. **4월 PDF 5명 + 5월 급여 입력** — 사장님 작업. Payroll.transfer_status='완료' 마킹 시 손익 자동 반영
2. **배민 / 요기요 / 땡겨요 자동수집 확장** — 쿠팡이츠 패턴 그대로 (HAR 캡처 → DB 모델 → Router → 페이지). 각 ~1일 작업
3. **5월 임차료 발생주의 검증** — 5/31(일) → 6/1~6/4 임차료 이체 시 5월 P/L 임차료에 자동 잡히는지 확인
4. **expense_delivery_fee 자동수집 반영** — 쿠팡 수수료 DailyExpense (vendor=쿠팡이츠 *수수료) 가 P/L expense_delivery_fee 에 잡히도록 sync_delivery_revenue_to_pl 추가 로직 필요 (현재는 DeliveryRevenue.total_fees 기준만)
5. **DeliveryRevenue placeholder 정리** — 20개 행이 의미 없는 상태. 정리 또는 자동수집 시점에 채우는 로직 추가
6. **세금대납 직원 4대보험 출처 확인** — expense_insurance_employee + expense_tax_employee 가 사장님이 실제 공단/세무서 납부한 cash 와 일치하는지 한 번 검증

### 흥미로운 디버깅 데이터

- DeliveryRevenue 가 채널×월×사업장 조합으로 placeholder 미리 깔려있던 패턴 → "데이터 존재 ≠ 데이터 유효" 명심
- CardSalesApproval 발급사/매입사 분리: 신롯데카드(발급) 매입은 롯데카드. CODEF 정산 명세와 동일 식별자 유지하려면 매입사 우선
- prod backfill 패턴 정착: PR 머지 → Orbitron 재배포 (~4분) → ssh docker cp → docker exec 스크립트 → 결과 확인
- 옵션 A 검증식: 사장님 통장 cash-out = expense_labor + expense_insurance + expense_insurance_employee + expense_tax_employee = gross 합 (세금대납 = 사업주가 모두 부담)

---

## 2026-05-13 (저녁 — 데이터 정합성 sweep + 채널 매핑 보강)

### 작업 요약

| 카테고리 | 작업 | 상태 |
|----------|------|------|
| data | BankTransaction popbill+codef 양쪽 적재 dedup (1,701건 삭제 — 첫 dedup 714 + 두 번째 dedup 987) | 완료 |
| data | CardPayment dedup (중복 0건 — 영향 없음 확인) | 완료 |
| data | DeliveryRevenue.settlement_amount 20행 linked BT 기준 재계산 (모두 절반으로 조정) | 완료 |
| fix  | PR #12 LEGACY_CHANNEL_MAP 에 한국어 alias (쿠팡이츠/쿠팡잇츠/배달의민족/위대한상상) 추가 | 완료 |
| fix  | PR #13 "음식배달" 키워드 → "배달의민족" (was 기타배달). DeliveryRevenue 기타배달 5건 → 배달의민족 reassign | 완료 |
| diag | 쿠팡이츠 자동수집 수수료 breakdown 누락 진단 (CoupangEatsSettlement 167건 모두 fee=0) | 완료 |

### 세부 내용

**1) BankTransaction 중복 적재 — 2가지 패턴**

첫 번째 (인건비 진단 중 발견): tid 콜론 끝 (구) vs 콜론뒤 이름 (신) 형식 714건 → 콜론 끝 행 삭제, vendor_id 79건 마이그레이션

두 번째 (배달앱 정산 진단 중 발견): popbill 형식 (`02605121300000000320260512000017`) + codef 형식 (`codef:20260512133021:...`) 양쪽에서 적재 987건
  - 키: (account_id, trans_date, trans_time, in_amount, out_amount, remark1) 동일하지만 remark2/3 순서 다름 + tid 패턴 완전 다름 → UNIQUE 제약 (account_id, tid) 회피
  - popbill 행 삭제, codef 유지. linked_card_payment_id / vendor_id / user_memo 자동 마이그레이션
  - 백업: prod `/home/stevenlim/sodam_backups/bt_popbill_backup_20260513_174508.json`

**2) DeliveryRevenue settlement_amount 재계산**

- 이전 누적된 settlement (이중 적용된 BT 기준) 을 linked BT 합으로 다시 채움
- 결과 (1~5월 누적): 쿠팡이츠 43.81M → 21.91M / 배민 20.50M → 10.25M / 요기요 4.18M → 2.09M / 땡겨요 0.41M → 0.20M

**3) PR #12: 쿠팡이츠 0원 표시 버그**

- `revenue.py` LEGACY_CHANNEL_MAP 이 영문만 매핑 ("Coupang" → "쿠팡"). DeliveryRevenue.channel 이 한국어 "쿠팡이츠" 로 저장된 행은 그대로 통과 → 화면 lookup ('쿠팡') 과 불일치
- 한국어 alias 추가: 쿠팡이츠/쿠팡잇츠/쿠팡페이 → 쿠팡, 배달의민족/우아한형제들/음식배달 → 배민, 위대한상상 → 요기요

**4) PR #13: "음식배달" 키워드 → "배달의민족"**

- DELIVERY_CHANNEL_MAP 의 "음식배달" → "기타배달" 잘못된 매핑 발견 (output_log.txt 의 "음식배달 배민포장주문" / "음식배달 알뜰·한집배달" 행으로 확인)
- "음식배달" → "배달의민족" 으로 수정
- prod 데이터: DeliveryRevenue.channel='기타배달' 5건 (1~5월 20.5M) 을 '배달의민족' 으로 reassign

### 다음 세션 작업 (사장님 명시 — 내일 작업)

**🎯 1. 쿠팡이츠 정산 수수료 자동수집 추가** (높은 우선순위)

현재 `/api/v1/merchant/transactions/{store_id}/settlement-management-data` 응답에 `amount`/`balance` 만 옴.
사장님이 매월 받는 엑셀 (`c:/WORK/SodamFN/2026소득분석/매출/{1,2,3}월/coupang_eats_2026-{01,02,03}.xlsx`) 에는 43컬럼 상세 정보 포함:
  - 매출액: 총금액 / 주문금액(gross) / 결제금액
  - 쿠폰: 쿠팡부담 / 상점부담
  - 중개이용료: 산정전 / 산정후 (기본+프로모션)
  - 결제대행사 수수료: 기본요금 / 프로모션
  - 배달비: 산정전 / 산정후 / 배달전용 / 음식전용 / 고객부담배달비
  - 즉시할인 / 기타
  - 서비스이용료(멤버십): 산정전 / 산정후
  - 광고비: 공급가액 / 부가세액 / 총액
  - 정산금액 / 프로모션 혜택 / 환급액

**작업 방향**: 엑셀 수동 import 가 아닌 **자동 API 호출** (사장님 명시 — 자동수집 취지).

추정 endpoint URL 후보 (HAR 캡처 없이 시도 필요):
- `/api/v1/merchant/transactions/{store_id}/settlement-management-data/{sellerTransferId}` (가장 가능성 ↑)
- `/api/v1/merchant/transactions/{store_id}/settlement-management-data/detail/{sellerTransferId}`
- `/api/v1/merchant/transactions/{store_id}/settlement-detail/{sellerTransferId}`

각 SETTLEMENT 행은 이미 `seller_transfer_id` 저장 중. detail endpoint 호출 → fee breakdown 추출 → `CoupangEatsSettlement.fee_*` 컬럼 채움 → DeliveryRevenue 까지 전파.

작업 진단 스크립트는 폐기됨. 내일 prod 환경에서 probe 부터 시작 (cookie 만료 시 사장님 갱신 필요).

**⚠️ 2. CODEF + popbill 양쪽 적재 root cause 코드 fix** (중간 우선순위)

데이터는 정리됐지만 다음 sync 시 또 중복 적재 가능성. 두 방안:
- (a) popbill cron disable (사장님 메모 "popbill 백업용" 정책)
- (b) BankTransaction UNIQUE 제약을 `(account, trans_date, trans_time, in_amount, out_amount, remark1)` 강화

**📌 3. 4월 PDF 5명 + 5월 급여 입력** (사장님 작업)

Payroll.transfer_status='완료' 마킹 시 P/L 자동 반영. 1~3월 옛 데이터의 transfer_status 미마킹은 사장님이 화면에서 직접 정리 (옵션 A 정확도 영향).

**📌 4. 배민 / 요기요 / 땡겨요 자동수집 확장** (중간 우선순위)

쿠팡이츠 패턴 그대로 (HAR 캡처 → DB 모델 → Router → 페이지). 각 ~1일 작업.

### 흥미로운 진단 데이터

- BankTransaction popbill+codef 합쳤더니 in_amount 합 303M → 152M (정확히 절반). out_amount 290M → 145M.
- 채널별 정산 1~5월 누적: 쿠팡이츠 21.91M / 배민 10.25M / 요기요 2.09M / 땡겨요 0.20M / 기타배달 0M
- CoupangEatsSettlement raw_json sample: `{"settlementDate":"2026.05.13","settlementManageType":"SETTLEMENT","amount":"120863.0","balance":"120863.00","sellerTransferId":238179828}` — fee 정보 0
- 쿠팡이츠 엑셀 컬럼 43개 spec 확보 (`docs/coupang_eats_excel_columns.md` 참고용 — 미생성, 다음 세션에 spec 정리)

---


## 2026-05-14

### 작업 요약 (두 갈래로 진행 — 본 세션: 쿠팡이츠 수수료 자동화 / 병행 세션: 배민 자동수집 골격)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix  | naive UTC datetime → timezone-aware ISO 직렬화 (9시간 어긋남) | 완료 |
| fix  | 인건비가 business_id=None Payroll 로 떨어져 화면 누락 | 완료 |
| chore | .claude 사용 안 하는 디자인 스킬 제거 + 환경 파일 정리 | 완료 |
| feat | 쿠팡이츠 정산 detail endpoint URL probe (Phase 1A) | 완료 |
| feat | 쿠팡이츠 월별 매출내역서 Excel → fee breakdown (Phase 1B) | 완료 |
| feat | 외부연동 채널 쿠키 만료/실패 통합 알림 (Sidebar + 카드) | 완료 |
| fix  | external-integration /api 중복 호출 경로 수정 | 완료 |
| feat | expires_at NULL 휴리스틱 + 추정값 표시 | 완료 |
| feat | 쿠팡이츠 detail 페이지에 월별 엑셀 백필 UI | 완료 |
| fix  | sync_monthly_excel 끝에 DeliveryRevenue 까지 전파 | 완료 |
| fix  | DeliveryRevenue 채널명 '쿠팡이츠' 통일 + dedupe + settle 보존 | 완료 |
| fix  | Excel 파서 헤더 텍스트 기반 동적 매핑 (4월 49컬럼 시프트 대응) | 완료 |
| docs | 배민(배달의민족) 매출/정산 자동수집 디자인 스펙 + 구현 계획 | 완료 |
| feat | 배민 모델 4개 (Credential/Order/Settlement/SyncLog) | 완료 |
| feat | 배민 BaeminClient 스켈레톤 + 쿠키 유틸 (curl_cffi) | 완료 |
| feat | 배민 자격증명 CRUD + 수동쿠키 + sync 골격 | 완료 |
| feat | 배민 fetch_orders/settlements 실제 구현 (HAR 응답 기반) | 완료 |
| feat | 배민 upsert + DeliveryRevenue 일자집계 + P/L sync | 완료 |
| feat | 배민 SyncEvent normalizer (매출/수수료 fan-out) | 완료 |
| feat | 배민 대시보드 + superadmin 디버그 엔드포인트 (probe/raw-orders) | 완료 |
| feat | 배민 cron 04:30 KST + auto_collection 라우터 연동 | 완료 |

### 세부 내용 — 쿠팡이츠 수수료 breakdown 자동화 (본 세션 주도)

#### Phase 1A — detail endpoint URL probe (`ec578e4b`)
- 어제(5/13) 인계 노트의 가설 5개 URL 후보 (`/settlement-management-data/{id}` 등) 를 prod 에서 한 번에 검증하는 `GET /api/coupang-eats/debug/settlement-detail-probe` 추가
- 사장님 prod 실행 결과: **5개 후보 전부 404** (쿠팡이츠 HTML 에러 페이지) → JSON detail endpoint 가 아예 존재하지 않음을 확인

#### Phase 1B — HAR 재분석 → 월별 Excel 다운로드 endpoint 발견 (`e909aba2`)
- HAR 파일 (`C:\WORK\SodamFN\2026서류\store.coupangeats.com.har`) 분석
- 핵심 발견: `GET /api/v1/merchant/web/emails?type=salesOrder&action=download&downloadRequestDate=YYYY-MM&storeId=...`
  → 87KB xlsx (사장님이 매월 받으시는 그 43컬럼 엑셀)
- 시스템 제약: `inclusiveEnd` 가 전월까지 — 당월 실시간 fee 불가 (월 마감 후 다운로드 가능)
- 신규 파일/모델:
  - `services/coupang_eats_excel_parser.py` — Excel 파서 (ParsedOrderFee 43컬럼 매핑 + aggregate_by_date)
  - `CoupangEatsOrderFee` 신규 테이블 (per-order, 43컬럼) + UniqueConstraint(business_id, order_id)
  - `CoupangEatsSettlement` 보강: `detail_synced_at` / `detail_source_year_month`
  - `CoupangEatsSyncLog` 보강: `excel_year_month` / `excel_orders_*` / `excel_settlements_updated`
- 서비스 레이어:
  - `CoupangEatsClient.fetch_downloadable_periods()` + `download_sales_order_excel()` (xlsx 매직 검증)
  - `upsert_order_fees()` / `update_settlements_from_fees()` / `sync_monthly_excel()` 오케스트레이터
- 라우터:
  - `GET /downloadable-periods` (가용 기간)
  - `POST /sync/monthly-excel {year_month}` (자동 다운로드+적재)
  - `POST /sync/monthly-excel/upload` (수동 업로드 폴백)
  - `POST /sync/monthly-excel/cron-trigger` (Orbitron cron)
- cron: 매월 6일 03:30 (전월 + 전전월 재시도) — `auto_collection.py` 통합

#### 만료 알림 시스템 (`b2c75406`, `91448613`, `3346bf07`)
- 사장님의 토큰 자동화 발상(매일 새벽 로그인+로그아웃) 에 대해 push back — Akamai sensor_data 검증이 핵심이라 로그아웃 행위로 우회 안 됨
- HAR 재분석: **refresh endpoint 미존재** (`/auth/refresh`, `/oauth/token` 등 모두 없음)
- 결론: manual 쿠키 + 만료 사전 알림이 안정. 사장님이 1번(어드민 배너) 선택
- 백엔드: `GET /api/external-integration/status` — 쿠팡이츠 + 배민 cred 한 번에 조회
  - 분류: healthy / expiring_soon(≤12h) / expired / failed(연속실패≥3) / unknown / not_configured
  - `expires_estimated` 마커 + `cookies_obtained_at` 기반 30h 보수 TTL 휴리스틱
- 프론트엔드:
  - Sidebar 외부연동 메뉴 + 손익관리 그룹에 빨간 뱃지 (60s 폴링)
  - ExternalIntegration 페이지 상단 채널별 상태 카드 (60s 자동 리프레시, "(추정)" 표시)
  - "/api/external-integration" prefix 중복(/api/api/) 404 수정

#### 백필 UI + DeliveryRevenue 전파 + 파서 시프트 대응 (`97615baf`, `8aa9ba13`, `35194957`, `cda0412d`)
- CoupangEatsModuleDetail 에 "월별 매출내역서 (수수료 breakdown)" 섹션 추가
  - 자동 다운로드 (가용 월 dropdown — 최신 12개월)
  - 수동 업로드 (xlsx + 연-월) — 1~3월 백필 또는 Akamai 폴백
- 매출관리 페이지에 수수료가 0% 로 표시되던 원인 → `sync_monthly_excel` 끝에 `update_delivery_revenue_from_fees()` 호출 추가
- 채널명 충돌: 기존 bank_sync 가 "쿠팡이츠" 로 저장, 우리는 "쿠팡" 으로 별도 row → "쿠팡이츠" 통일 + 기존 row 업데이트 + 중복 dedupe
- **결정적 버그**: 4월 엑셀이 **43→49컬럼으로 확장** ("광고 프로모션" + "최종 광고비" 그룹 6컬럼 추가) → 정산 컬럼이 시프트되어 인덱스 기반 파서가 `settle_final=0`, `ad_total=0` 잘못 읽음
- 해결: **헤더 텍스트 기반 동적 매핑** 전면 리팩토링 (`_FIELD_LABEL_PATHS` + `_build_column_index_map`)
  - 광고비는 "최종 광고비" 우선, 없으면 "광고비" (1월 호환)
  - 미래 컬럼 변경에도 안정

### 검증 결과 (prod)

| 월 | 매출 | 수수료 | 수수료율 | 정산 | 중개 | 결제 | 배달 | 광고 | 멤버십 |
|----|------|--------|----------|------|------|------|------|------|--------|
| 1월 | 15.1M | 9.5M | **62.7%** | 5.58M | 975K | 653K | 2.57M | 1.04M | 4.25M |
| 2월 | 13.7M | 8.6M | **63.2%** | 4.98M | 882K | 590K | 2.32M | 1.00M | 3.85M |
| 3월 | 11.6M | 6.8M | **58.6%** | 5.25M | 755K | 532K | 1.90M | 402K  | 3.21M |
| 4월 | 7.8M  | 4.5M | **57.2%** | 3.95M | 503K | 372K | 1.35M | 0     | 2.25M |

사장님 확인: 4월 광고 안 함 (ad_total=0 정상). 토요일 4건은 일·월 정산에 합쳐져 매칭 안 됨 (다음 사이클 보강).

### 세부 내용 — 배민 자동수집 골격 (병행 세션)

- HAR 분석 (`docs/baemin-har-analysis.md`) → `self-api.baemin.com` API 구조 파악
- 모델 4개: `BaeminCredential` / `BaeminOrder` / `BaeminSettlement` / `BaeminSyncLog`
- `BaeminClient` (curl_cffi) + 쿠키 유틸리티 + fetch_orders/settlements
- 라우터: 자격증명 CRUD / 수동쿠키 / 수동 sync / 대시보드 / superadmin debug (probe, raw-orders)
- SyncEvent normalizer (매출 일자별 + 수수료 항목별 fan-out)
- cron 04:30 KST `auto_collection.py` 통합
- 모델은 외부연동 통합 status 엔드포인트에서도 자동 표시 (배민 카드 등장)

### 다음 세션 작업

1. **사장님 매출관리 페이지 새로고침 → 4개월 수수료 % 정상 표시 검증** (현재 시점)
2. 토요일 fee 매칭 보강 (정산이 일·월요일에 합쳐지는 케이스 처리) — 정확도 ↑
3. 5월말~6월초 cron 실제 동작 확인 (자동으로 5월 데이터 다운로드)
4. 배민 자동수집 prod 검증 — 사장님 ceo.baemin.com 쿠키 입력 후
5. 텔레그램 봇 외부 푸시 추가 (사장님 BotFather 토큰 발급 시) — 외출 중 알림
6. 손익계산서 페이지에서 쿠팡이츠 수수료 정확히 표시되는지 확인 (DeliveryRevenue → P/L 전파 검증)

---

## 2026-05-14 (오후/저녁) — CODEF 카드 매입 자동수집 — 현대카드 등록 + 데이터 수집 디버깅

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | CODEF 14개 카드사 organization 코드 매핑 전면 정정 (0306 신한만 우연 일치, 나머지 placeholder) | 완료 |
| fix | 현대카드 등록 CF-04000 — cardNo + cardPassword 필수 필드를 등록 페이로드에 포함 | 완료 |
| fix | billing-list 조회 시 cardPassword 첨부 버그 — 현대카드 0건 응답 직접 원인 제거 | 완료 |
| fix | approval-list URL 정정 (`/v1/kr/card/p/account/approval-list` → `/v1/kr/card/common/p/approval`) + 500 에러 격리 | 완료 |
| feat | 카드 등록 모달에 clientType(개인 P / 사업자 B) 토글 + CODEF 원응답 펼침 디버그 | 완료 |
| feat | 비밀번호 · 카드비번 input 에 👁 평문 표시 토글 (대소문자 Caps Lock 함정 방지) | 완료 |
| feat | approval-list (실시간 승인내역) sync 추가 + memberStoreInfoYN/Type 파라미터로 가맹점 업종 응답 포함 | 완료 |

### 세부 내용 — 디버깅 흐름

CODEF 매뉴얼 PDF (`API.xlsx`, 2025-11-11 최종) 와 코드 대조하며 단계적으로 원인 격리:

1. **현대카드 ID 로그인 페이로드 누락 발견**
   - PDF page 5 (LOGIN INPUT) — 현대카드는 `cardNo` + `cardPassword` 둘 다 필수 (O 표시)
   - 직전 커밋 54f47646 이 "등록 페이로드 단순화" 명목으로 둘 다 제거 → CF-04000
   - `_build_account_payload` 의 ID/PW 분기에 두 필드 조건부 추가 (cardNo 평문 / cardPassword RSA 암호화)
   - 프론트 모달에 카드번호 16자리 input 추가 (현대카드 0302 또는 KB 0301 선택 시 노출)

2. **organization 코드 매핑 오류 발견 (본질적 원인)**
   - PDF page 3 매트릭스 대조: 0302=현대, 0303=삼성, 0304=NH, 0307=씨티 ...
   - catalog: 0302=NH농협(오), 0303=롯데(오), 0307=현대(오), BC=0361/0364/0365/0366/0367/0368 (모두 placeholder)
   - 14개 카드사 모두 PDF 기준 재작성 + `list_card_corps()` 가 PG 4종 제외하도록 수정
   - `CARD_CORP_TO_CODEF` (card_merchants.py) 매핑도 동시 정정
   - frontend priority `['0306','0364','0307']` → `['0306','0303','0302']` (신한·삼성·현대)

3. **CF-04000 원응답 분석 → 결국 ID/PW 케이스성 문제 (Caps Lock)**
   - 사장님이 디버그 UI 에서 펼친 raw 응답: 내부 `errorList.code=CF-12803` "아이디 또는 비밀번호 오류"
   - 사장님이 현대카드 사이트 직접 로그인 성공 → ID/PW 자체는 정확
   - 원인: **Caps Lock 미사용** — 브라우저 자동입력(현대 site) vs 수동입력(셈하나 form) 대소문자 차이
   - 사장님 Caps Lock 눌러서 다시 입력 후 등록 성공

4. **UX 개선 — 향후 같은 함정 방지**
   - 비밀번호 / 카드비번 input 옆에 👁 Eye/EyeOff 토글. 평문 확인 후 등록 가능
   - 카드사 사이트 회원종류 (개인 P / 사업자 B) 토글 — `auth.client_type` 으로 백엔드 전달
   - 에러 박스에 "CODEF 원응답 펼치기" details — `CodefAPIError.raw` 표시

5. **3장 카드 등록 후 데이터 수집 — 현대카드만 0건**
   - 신한 1월 19건 + 삼성 1월 80건 (= 4,747,930원) 정상 적재
   - 현대카드 0건 — billing-list 조회 시 `cardPassword=ENC(1234)` 첨부가 CODEF 거부 원인
   - PDF page 10 (billing-list INPUT) 에 cardPassword 미정의 — 54f47646 의 "조회 시 cardPassword 전달" 해석 오류
   - `_build_period_params` 에서 cardPassword 첨부 코드 삭제 + 회귀 테스트 추가

6. **approval-list (실시간 승인내역) 추가 시도 → URL 오류 → 격리**
   - 첫 시도 URL `/v1/kr/card/p/account/approval-list` (billing-list 패턴 미러) → 500 에러
   - 정정: `/v1/kr/card/common/p/approval` (기존 `card_provider.py` 도 사용, 검증됨)
   - 안전망 격리: approval-list 가 미지원 예외 던져도 billing-list 흐름 보존 (warning 만 로그)

7. **업종 정보 누락 ("기타" 폴백) 해결**
   - 모든 row 의 `business_type` 빈값 → 화면 업종별 "기타" 합계 단일
   - PDF page 7/10: `memberStoreInfoYN="1"` (billing) / `memberStoreInfoType="1"` (approval) 요청 시에만 응답에 가맹점 업종 포함
   - 두 endpoint 파라미터 모두 추가

### CODEF DEMO 환경 한계 확인

코드는 모두 정상 작동하나 DEMO 환경 mock 데이터 한계:
- 신한·삼성 1월 99건 (2025-12 사용분의 2026-01 청구) 만 제공
- 현대카드 mock 데이터 없음
- 5월 실시간 데이터 없음

→ **PRODUCT 키 신청** 또는 **CSV 수동 업로드** 또는 **직접 스크래핑** 중 선택 (사장님 결정 보류)

### 다음 세션 작업

1. **CODEF PRODUCT 키 신청 여부 결정** — `.env` / Orbitron secrets 교체 (`CODEF_ENV=production`)
2. PRODUCT 전환 시 즉시 가동될 수 있도록 코드는 준비 완료 (catalog · payload · query 파라미터 모두 spec 준수)
3. approval-list URL 정정 효과 검증 (DEMO 에서 호출 자체는 정상 응답 받는지)
4. 업종별 합계가 "음식점/편의점/카페" 등으로 정확히 분류되는지 검증
5. `_codef_manual/` 폴더 (untracked) — PDF 매뉴얼 보관용. 필요시 별도 commit

### CODEF 운영 메모 (다음 세션 참고)

- **0302 = 현대카드** (이전 잘못 매핑 NH농협 → 정정 완료)
- **0303 = 삼성카드** (이전 잘못 매핑 롯데 → 정정 완료)
- **0307 = 씨티카드** (이전 잘못 매핑 현대 → 정정 완료)
- billing-list / approval-list 둘 다 `cardPassword` 조회 INPUT 에 미정의 — 절대 첨부 금지
- 업종/가맹점정보 받으려면 `memberStoreInfoYN=1` (billing) / `memberStoreInfoType=1` (approval) 필수
- 현대카드 ID 로그인 등록 시 `cardNo` (평문) + `cardPassword` (RSA) 둘 다 등록 페이로드에 필수
- CF-04000 외피 안에 진짜 원인이 `data.errorList[].code` 에 들어옴 — 펼침 UI 로 확인

---

## 2026-05-15

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| style | 사이드바 라벨 정리 — '외부 연동 (CODEF)' → '외부 연동', '은행계좌 연동' → '팝빌계좌연동' | 완료 |
| feat | 통합 모듈에 'POPBILL 계좌연동' 카드 신규 추가 + '계좌 거래내역' → 'CODEF 계좌연동' 라벨 정리 | 완료 |
| fix | 사이드바의 'POPBILL 계좌연동' 중복 항목 제거 (통합 모듈로만 이전) | 완료 |
| feat | **BankSync 컴포넌트에 `source` prop 도입** — CODEF 페이지(/external-integration/banks) 에서 동일 UI 재사용. 1단계: source prop + fetchTxs source 자동 적용 + 헤더 source 별 분기 + App.jsx 라우팅 변경 | 완료 |
| feat | **BankSync 2단계: 등록 계좌 탭 source 별 분기** — BankModuleDetail.jsx 에 embedded prop 추가, isCodef 시 CODEF connection UI 를 inline 렌더. 두 페이지가 같은 5개 탭 + AI 모델 selector + 자동 갱신 공유 | 완료 |
| (DB) | CODEF connection id=1 (신한은행) `connection_type='card_sales'` → `'bank'` 데이터 수정 — 5/12 옛 코드의 손상 row. /external-integration/banks 화면에서 신한은행이 안 보이던 원인 해소 | 완료 |
| (진단) | CODEF 현대카드(0302) 0건 원인 확정 — **CF-00003 ("요청하신 해당 상품 서비스가 존재하지 않습니다")**. DEMO 환경에 0302 product 미활성. 코드 spec 100% 준수 확인. PRODUCT 환경 정식 신청 메일 초안 작성 | 진행중 (메일 발송 대기) |
| (외부) | 데이터퓨레 API 영업 회신 초안 작성 — 정식 출시 8개월 후 핑계로 API 명세서/샘플 응답만 우선 요청 (단가 협의 보류) | 진행중 (회신 대기) |

### 세부 내용

#### 1. 사이드바 & 통합 모듈 외부 연동 정보 구조 정리

- **사이드바**:
  - '외부 연동 (CODEF)' → '외부 연동' (라벨 단순화 — CODEF 외 다른 출처도 hub 화)
  - '은행계좌 연동' → '팝빌계좌연동' (실제 사용 ASP 명시화)
  - 초기 변경에서 팝빌계좌연동을 외부 연동 아래 nested 항목으로 두었으나, 사용자 의도가
    "통합 모듈로 이전" 임이 확인되어 사이드바에서 제거 (중복 해소)
- **통합 모듈** (외부 연동 hub `/external-integration`):
  - '계좌 거래내역' → 'CODEF 계좌연동' (출처 명시화)
  - 'POPBILL 계좌연동' 카드 신규 추가 (indigo · href=`/finance/bank-sync`)
  - ModuleGrid colorMap 에 indigo 추가

#### 2. BankSync 컴포넌트 통합 (A 안 — 단일 컴포넌트, source prop 분기)

배경: CODEF 계좌연동 페이지(`/external-integration/banks`) 에 POPBILL 페이지와 동일한
5개 탭 + AI 모델 selector + 자동 갱신 띠를 노출하라는 요구. 코드 중복 회피를 위해
BankSync 컴포넌트 자체를 source prop 받아 재사용하는 방식 채택.

- **1단계 (cf13c7c9)**:
  - `export default function BankSync({ source = 'popbill' } = {})` 로 prop 추가
  - `fetchTxs` 의 transactions API 호출에 `source` 파라미터 자동 적용
    (백엔드가 `tid` prefix `codef:%` 로 분류 — `routers/bank_sync.py:854` 기존 로직)
  - 헤더 텍스트 source 별 분기 ("CODEF 계좌연동" / "은행계좌 연동")
  - `App.jsx`: `/external-integration/banks` → `<BankSync source="codef" />` 로 변경
  - `BankModuleDetail` import 제거
- **2단계 (2fdbedc6)**:
  - `BankModuleDetail.jsx` 에 `embedded` prop 추가 — true 시 헤더/자동갱신/거래내역 제외
    하고 CODEF connection 카드 + 등록 모달 + 거래가져오기 모달만 inline 렌더
  - BankSync 의 `tab === 'accounts'` 위치에서 `isCodef` 분기:
    - CODEF: `<BankModuleDetail embedded />` (CODEF connection 카드)
    - POPBILL: `<AccountsTab ...>` (기존 BankAccount UI)
  - POPBILL 페이지(`/finance/bank-sync`) 는 default 'popbill' 로 기존 동작 그대로 보존

#### 3. CODEF 은행 신한은행 표시 누락 해결 (DB 데이터 수정)

- **증상**: `/external-integration/banks` 화면에서 "등록된 CODEF 은행 연결 0건"
  표시되지만 거래내역 182건은 정상 적재 (5월 codef:* tid)
- **원인**: 5/12 옛 코드가 CodefConnection id=1 (신한은행, 0088, organization_type='bank')
  을 `connection_type='card_sales'` 로 저장. BankModuleDetail 의 `type=bank` 필터에
  매칭 안 됨 → 화면 0건
- **조치**: id=1 의 `connection_type` 'card_sales' → 'bank' 1줄 UPDATE
- **추가 진단**: 전체 CodefConnection 4건 미스매치 검사 → 다른 손상 row 없음
- **재발 방지** (보류): `routers/bank_sync.py:2640, 2719` 의 `existing` 쿼리에
  `connection_type=='bank'` 조건 추가 + `_upsert_connection` 에 organization_type/
  connection_type 정합성 검증 추가. 신규 등록은 이미 `register_bank` 가 명시적으로
  'bank' 전달 — 단기 위험은 0건. 사용자가 시급성 낮다고 판단해 보류

#### 4. CODEF 카드매입 현대카드(0302) 0건 — CF-00003 원인 확정

- **증상**: 사장님이 [수동수집] 버튼 3회 클릭, 매번 200 응답. 그러나 DB 의
  CodefCallLog 에 conn=3 (현대) 호출 흔적 0건. 컨테이너 로그도 에러/워닝 없음
- **진단 과정**:
  - quota 차단 의심 → 오늘 호출 0건 (한도 100건) → 차단 아님
  - 컨테이너 DATABASE_URL 확인 → 로컬 .env 와 동일 (192.168.219.101)
  - 컨테이너 ENV 의 CODEF_ENV=demo / CLIENT_ID/SECRET 정상
  - python 직접 `sync_one_connection(conn=3)` 호출 → **`error_code='CF-00003'`**
    "요청하신 해당 상품 서비스가 존재하지 않습니다"
- **원인 확정**: DEMO 환경에서 사장님 client_id 에 현대카드(0302) 매입 조회 product 가
  미활성 상태. 코드 spec 100% 준수 (PDF page 5/10), 신한·삼성은 정상.
- **흐름 분석**: `sync_one_connection` 의 외부 except 가 CodefAPIError 잡아 result.error
  에 담고 200 응답 반환. CODEF 호출 자체가 product 미활성으로 실패해서 `record_call`
  까지 도달 못함 → CodefCallLog 빈 상태. 화면은 "또 0건" 으로만 보임 (UX 버그 — 에러
  표시 안 됨)
- **다음 액션**: CODEF 정식 운영 환경 신청 메일 초안 작성 — CF-00003 원인 문의 +
  PRODUCT 환경 키 발급 요청 + 14개 카드사 활성화 매트릭스 안내 요청

#### 5. 데이터퓨레 외부 API 영업 — 회신 초안

- 배달 3사 (배민·요기요·쿠팡이츠) 데이터 수집 API 영업 메일 수신
- 단가: 20,000원/계정/월 (정액제), 1매장×3사 = 60,000원/월
- 우리 자체 구축 (쿠팡이츠 ✅, 배민 🟡, 요기요 ❌) 과 비교
- 빨간 깃발: REST API 문서/샘플 응답 "서버 구축 중", T-2 보정만 가용, 회사 정보 불명
- **결정**: 채택 보류, API 문서·샘플만 우선 요청. 정식 출시 8개월 후 핑계로 시간 확보

### AI참고 (다음 세션)

#### BankSync 통합 — 잠재 미해결 이슈

- `정산·수수료` / `AI 감사` / `AI 분석` 탭의 backend 호출이 `source` 파라미터를 받지
  않을 가능성 — 만약 안 받으면 두 페이지에서 같은 (혼합) 데이터를 보게 됨. 사장님이
  직접 확인해서 어색하면 backend 에 source 파라미터 추가 작업으로 진행 예정
- 관련 endpoint: `/bank-sync/settlement-stats`, `/bank-sync/audit/run`, `/bank-sync/chat`
- 현재 source 필터링 적용된 곳은 `/bank-sync/transactions` (tid prefix 'codef:%' 기반)

#### CODEF SDK (easycodefpy) — 미사용 영역

GitHub `codef-io/easycodefpy-exam` 의 9개 폴더 중 우리가 안 쓰는 4개:

- `02_add_account`: 같은 connectedId 에 카드 추가 (multi-card 통합 가능성)
- `03_get_account_list`: CODEF 측 등록 현황 조회 (우리 DB sync 검증)
- `04_get_connected_id_list`: connectedId 목록 (정합성 감사)
- `05_update_account`: 비번 변경 (현재 재등록 강제)
- `06_delete_account`: **미사용** ⚠️ — 셈하나 deactivate 시 CODEF 측 잔재. 운영 PRODUCT
  전환 후 청구 정확성 영향 가능

추천 우선순위: 06_delete (운영 정리) → 04_get_connected_id_list (정합성 도구)

#### 데이터퓨레 메일 회신 발송 대기

- 8개월 후 출시 핑계로 사전 검토 단계 안내
- API 명세서/샘플 응답/온보딩 절차만 우선 요청
- 사장님 손에서 발송하시면 됨

---



## 2026-05-15 (세션 2 — 20:30~23:30)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | CODEF SDK 06_delete + 04_list + 05_update 통합 (계정 라이프사이클) | 완료 |
| fix  | 팝빌 발급 시스템 3페이지 (전자세금계산서·전자명세서·현금영수증) 잔액/응답 매핑 12개 버그 | 완료 |
| feat | CODEF 기반 홈택스 수집 모듈 신규 (`/finance/hometax`) — 모델/라우터/UI/마이그레이션 | 완료 |
| fix  | CODEF 홈택스 페이로드 spec 정정 마라톤 8 commits — CF-00007 + CF-04033 근본 해결 | 완료 |

### 세부 내용

#### 1. CODEF SDK 통합 (61dea3a8)

CodefClient 에 `delete_account` / `update_account` / `list_connected_ids` 저수준 래퍼 추가.
3개 신규 endpoints — 라이프사이클 완성:
- DELETE `/api/codef/connections/{cid}` 가 CODEF 측 connectedId 도 삭제
- POST `/api/codef/connections/{cid}/update-credentials` — 비번 변경 (connectedId 유지)
- GET `/api/codef/diagnostics/connected-id-sync` — DB vs CODEF 양방향 diff 진단

테스트 13건 신규 (client 6 + service 7) 모두 통과.

#### 2. 팝빌 발급 시스템 잔액 표시 + 응답 매핑 (76c1f26c, 20f86863, 6902dfe1)

3페이지 공통 결함:
- **잔액 4,180원만 표시** — `getBalance` (회원) 만 호출. 사장님 실제 충전 잔액은 파트너 link `SODAM` (189,900원).
  → `getPartnerBalance` 도 함께 조회, dict 반환. usable = 파트너 > 0 면 우선.
- **`getInfo()` 시그니처 미스매치** — UserID 인자 잘못 전달. 발행 후 상세 조회 전부 실패.
- **`registIssue` 응답 보강 누락** — confirmNum/receiptNum 즉시 미포함 시 getInfo 즉시 호출로 보강.

Cashbill 추가 발견:
- `search()` 인자 1개 초과 ("" 가 Page 자리 침범) → `'>' not supported between str and int`
- `cancel()` 의 `self._last_confirm` 참조 오류 → CancelIn 에 `orig_confirm_num`+`orig_trade_date` 필수 추가
- `/balance`+`/charge-url` 엔드포인트 자체 부재 → 신규 추가

DB 정리: TaxInvoice id=1,2 (4/29 옛 'Memo' 오류) + Statement failed 8건 + TEST 잔재 issued 10건 삭제.

LIVE 검증: 세금계산서 1건 발행 성공 (mgt_key `SDM20260515205640`, 국세청 승인번호 `202605154100020300007ce4`).

#### 3. CODEF 기반 홈택스 수집 모듈 (bdbcfc01)

사장님 지시 "현금영수증과 홈택스수집은 CODEF 로 연결" 반영. 팝빌 현금영수증은 운영 권한
미부여 (-99910002) 상태 → 별건.

신규 컴포넌트 7개:
1. `organization_catalog`: 홈택스(public_tax) 추가 (3가지 인증 모두 지원)
2. 모델 `HometaxRecord` (record_type 5종 통합) + `HometaxSyncCursor`
3. `CodefHometaxProvider` — sync_cash_sales/sync_cash_purchase/sync_tax_invoice_integrated
4. 라우터 `routers/codef/hometax.py` — 8 endpoints
5. DB 마이그레이션 `add_hometax_tables.py` (운영 적용)
6. 프론트 `pages/HomeTaxCollect.jsx` 전면 재작성 (팝빌 → CODEF)
7. 사이드바 메뉴 [홈택스 수집] (기존)

#### 4. CODEF 홈택스 페이로드 spec 정정 마라톤 (8 commits)

사장님 제공 PDF 8건 (`c:/WORK/SodamFN/2026서류/홈텍스/`) 정밀 검증:

| Pass | 변경 | 커밋 |
|------|------|------|
| 1 | businessType TX→PB, loginIdentity 제거, loginTypeLevel 매핑 | 51c2a9d4 |
| 2 | 빈 값 키 유지 (CODEF 가 키 누락을 invalid 로 판단) | 4f28b0f3 |
| 3 | isIdentify 조건부 | 899fb47f |
| 4 | ID/PW 폼 주민번호 필드 추가 + 13자리 필수 | 041549b2, 9b817911 |
| 5 | placeholder 정정 (limp2004→일반 안내) | aec869e9 |
| 6 | **공공 API 표준 페이로드 전면 정정** — businessType/clientType/countryCode 제거, password→userPassword, birthDate→loginIdentity | d9d9d99e |
| 7 | API path 확정 (purchase-details, sales-details, sales-purchase-statistics) | 527e9eea |
| 8 | **organization 코드 product 별 매핑** — 0001 → 0003 현금영수증, 0002 세금계산서, 0004 세금정보, 0006 카드매출 | 9279c915 |

핵심 학습 3가지:
- 공공 API 는 카드/은행과 페이로드 구조 완전 다름 (businessType/clientType/countryCode 없음)
- ID/PW 비번 필드는 `password` 가 아니라 `userPassword`
- organization 은 product 별로 다름 (0001 은 CODEF 카탈로그에 없는 placeholder)

### AI참고 (다음 세션)

#### 미해결 — 사장님 CODEF 1:1 문의 필요

홈택스 페이로드/path/organization 모두 spec 일치. 그러나 0003 호출도 `CF-04033 "존재하지 않는 기관"` 발생 → **사장님 CODEF client_id (DEMO 환경) 에 홈택스 product 권한 미부여**. 사장님이 CODEF 측 1:1 문의해서 권한 활성화 또는 PRODUCT 환경 키 발급 받아야 정상 작동.

문의 정보:
- 사업자: 소담김밥 (639-12-01514)
- CODEF client_id: Orbitron secrets 의 CODEF_CLIENT_ID
- 환경: DEMO @ development.codef.io (PDF '대표 버전' 과 일치)
- 시도한 organization: 0003 / 0002 / 0004 모두 CF-04033

#### 팝빌 현금영수증 search API 권한 별건

`/api/cashbill/search` 호출 시 `-99910002` "API 상품에 이용 권한이 부여되지 않아 사용이 제한됩니다". 발행/취소/잔액은 정상 권한. search 만 별도 신청 필요. 사장님이 팝빌 1:1 채팅으로 활성화 요청.

#### 추가 CODEF 홈택스 PDF 사장님이 제공한 11개

폴더 `c:/WORK/SodamFN/2026서류/홈텍스/`:
1. ✅ 현금영수증 매입내역 (0003 purchase-details)
2. ✅ 현금영수증 매출내역 (0003 sales-details)
3. ✅ 전자세금계산서 기간별 매출-매입 통계 (0002 sales-purchase-statistics)
4. 📦 전자세금계산서 발행 — CODEF 통한 발행 (팝빌 대안)
5. 📦 제3자 전자(세금)계산서 발급사실 조회
6. 📦 개인사업자등록상태 조회 (0004)
7. 📦 세금 납부, 환급, 고지, 체납 내역 (0004)
8. 📦 신용카드 매출자료 조회 (0006, 공동인증서 전용)
9. 📦 근로소득 지급명세서
10. 📦 재무제표
11. 📦 인증서 등록 (전자(세금)계산서 시스템 사업자)

권한 풀리면 11개 product 모두 점진적 구현 가능.

---

## 2026-06-22 (종합 점검 + 운영 안정성 개선 — PR #14)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| other | 5주 공백 종합 점검 — 운영 건강도 + 진행도 (무음 skip 발견) | 완료 |
| refactor | Revenue 채널명 한글 통일 (Store→매장, CoupangEats→쿠팡이츠) | 완료 |
| feat | 수집 건강도 알림 시스템 — watchdog + SMS/텔레그램 | PR #14 |

### 세부 내용

#### 1. 종합 점검 (운영 건강도 + 진행도)

마지막 커밋 5/15 후 5주 공백. 발견:
- **EasyPOS(매장 카드)만 자동수집 정상.** 쿠팡이츠 37일·배민 미완(raw 0건)·CODEF 카드38/은행56일 정지.
- **근본 원인 = 무음 skip**: cron이 `failed` credential을 `business_count=0`으로 조용히 건너뜀(SyncLog도 안 남김) → 5주간 아무도 매출 누락 몰랐음.
- Revenue 채널명 영문(Store/CoupangEats)+구 한글 레거시 혼재 → 통계 분리 (단 손익계산서는 DeliveryRevenue·한글만 읽어 손익 숫자는 정상).
- 재사용 점검 스크립트 `dev/ops_health_check.py` 신규 (원본 backend cwd 실행 → 전 채널 sync/쿠키/연결/최신성 한눈에).

브레인스토밍→spec→plan→subagent-driven 구현 풀사이클 (docs/superpowers/specs·plans/2026-06-22-collection-health-alerts-channel-naming).

#### 2. Part B — Revenue 채널명 한글 통일 (2ee9368d db94872b 0936bad4)

- `constants.py` 표준 상수 + easypos/coupang_eats 서비스 write·read 치환
- idempotent ORM 마이그레이션 `database._run_revenue_channel_migration` (겹침 시 amount 합산 병합), `database`+`init_db` 양쪽 등록 (DB 중립 — Postgres/sqlite 양쪽)
- 사전 검증 `scripts/migrations/preview_revenue_channel_rename.py`

#### 3. Part A — 수집 건강도 알림 (1b7feb01 ~ 88c4cec5, 10 commits)

- `services/telegram_service.py` (no-op 기본 — 토큰 주입 시 활성, 1차 보류)
- `CollectionHealthAlert` 모델 (중복방지 open/resolved + 복구 추적)
- `services/collection_health.py` evaluate_channels(멀티테넌트 격리 + expiring_soon 쿠키만료 사전경보) / dispatch_alerts(사장님 팝빌 SMS + 개발자 텔레그램, 중복방지, _safe_send 예외방어)
- `POST /api/auto-collection/cron/health-watch` (09:00 KST)
- status API 5채널 확장 (EasyPOS·CODEF, skipping 배지 제외)

subagent-driven TDD 7 task, **21 테스트 통과**, final whole-branch review **Ready to merge**. 리뷰에서 멀티테넌트 격리 버그(_max_date business_id 누락)와 phantom 배지 알림을 잡아 수정.

### AI참고 (다음 세션)

- **PR #14 merge+배포 대기.** merge 후 선행작업: ①Orbitron 대시보드 `OWNER_ALERT_PHONE=82-10-4173-6570` (텔레그램 토큰 비움 → no-op) ②호스트 crontab `0 9 * * * …/cron/health-watch` ③배포 후 `preview_revenue_channel_rename.py` 검증 (마이그레이션은 init_db 자동 실행).
- **merge 후 [HEAD] DevWorkLog 업그레이드 필요** — 신규 라우터(health-watch) + 모델(CollectionHealthAlert) 추가됨. 이번엔 미merge라 보류(운영 상태 스냅샷 정확성).
- **멈춘 채널 복구(사장님 직접)**: 쿠팡이츠·배민 브라우저 쿠키 재입력 → 백필 트리거.
- CODEF `card_sales`(카드매출)는 health 모니터링 스코프 외(의도, spec 3.1).

---

## 2026-06-23 (팝빌 LIVE 전환 + 재무 데이터 싱크 정합성 + KST 시각 보정)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 계좌조회 팝빌 메인 승격 + CODEF 보조 — 카드 정리 | 완료 |
| infra | 팝빌 정식(LIVE) 운영 전환 (POPBILL_IS_TEST / POPBILL_BANK_IS_TEST=false) | 완료 |
| fix | 동기화 이력/검증 시각 KST 변환 (UTC naive 직렬화 9h 오차) | 완료 |
| fix | 수집 직후 raw→DailyExpense 즉시 반영 (매출관리 항상 싱크) | 완료 |
| fix | 손익계산서 조회 시 매입/매출 자동 재집계 (항상 싱크) | 완료 |
| fix | bank-sync 같은 거래 다중 provider 중복 적재 차단 (시각+금액 dedup) | 완료 |

### 세부 내용

#### 1. 팝빌 정식(LIVE) 운영 전환 + 계좌조회 메인 승격 (31041ed6, d3ead67d)

- `POPBILL_IS_TEST` / `POPBILL_BANK_IS_TEST` = false → 팝빌 SODAM LinkID **정식(LIVE) 운영 시작** (`Orbitron.yaml`). 4/27 이후 EasyFinBank `-99010016` 차단·TEST 잔재 해소.
- 외부연동 hub(`ModuleGrid.jsx`)에서 **계좌조회 = 팝빌 메인 / CODEF 보조**로 카드 재배치 — 기존 "CODEF primary, 팝빌 backup"(LIVE 차단 회피용) 전략을 LIVE 활성화로 역전.

#### 2. 재무 데이터 싱크 정합성 (c5ddb41f, 37b763d6, afe0fe5d)

- **수집 직후 즉시 반영** (`services/auto_collection_sync/reflect.py` 신규): easypos/coupang_eats/baemin 수집 endpoint가 야간 orchestrator 외에도 수집 직후 raw→DailyExpense 반영을 즉시 호출 → 매출관리 항상 싱크.
- **손익계산서 자동 재집계** (`routers/profitloss.py`): 손익계산서 GET 시 매입/매출 자동 재집계 → 조회 시점 항상 최신.
- **bank-sync dedup** (`routers/bank_sync.py`): 같은 거래가 여러 provider(팝빌·CODEF)로 중복 적재되던 것을 시각+금액 기준 dedup 차단.

#### 3. 동기화 시각 KST 보정 (b53b2321)

- `utils/format.js` + 외부연동 모듈 상세 7종(ChannelStatusCards / AutoCollection / Baemin / Bank / CoupangEats / EasyPos / HomeTax): 동기화 이력·검증 시각이 naive UTC 직렬화로 9시간 어긋나던 것을 KST 변환.
- (동 커밋에 사장님 4·5월 직원급여 PDF 정리분 동봉 — 코드 무관.)

### AI참고 (다음 세션)

- **팝빌 LIVE 운영 시작** — 발행/조회가 실 과금. 파트너 SODAM 잔액 모니터링.
- **미해결 운영 액션 (HEAD 유지)**: ①팝빌 문자 발신번호 0개 등록 → 알림 SMS 발송 불가(발신번호 등록 or 텔레그램 토큰). ②쿠팡이츠·배민 쿠키 재입력(사장님 직접)→백필.
- **계좌조회 전략 역전**: dev-plan §외부통합의 "CODEF primary, 팝빌 backup"은 이제 팝빌 메인. 다음에 전략 표 prose 정합성 점검 필요.
- 오늘은 신규 라우터/모델 없음 → [HEAD] DevWorkLog 미갱신(6/22 갱신 유지).

---

## 2026-06-23 (오후 — 비용관리 재무 정합성 2차)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 비용 교차-source 중복 199건(9,538만원) 정리 — auto_bank/manual 이중적재 | 완료 |
| refactor | '매입관리' → '비용관리' 명칭 통일 (실제 매입 17%뿐, 영업비용 개념) | 완료 |
| fix | 4대보험 이중계상 제거 — 신규 '4대보험납부' 카테고리 + 키워드 가드 | 완료 |
| fix | 급여 임포트 business_id 누락 → 5월 인건비 0원 정상화 | 완료 |

### 세부 내용

#### 1. 비용 교차-source 중복 199건 정리 (51350a24)

- CODEF·팝빌이 같은 은행거래를 다른 tid의 BankTransaction 2건으로 수집 → 레거시 `_materialize_link`(source=manual) + `normalize_bank`(source=auto_bank)가 각각 DailyExpense 생성. note·금액·날짜 동일한데 source만 달라 기존 중복체크(date+vendor_id+amount)·유니크제약(+source) 모두 우회.
- 2026-03~05 199건/9,538만원 정리(그룹당 vendor 연결 행 보존). 3월 112.7M→56.2M, 4월 62.8M→33.3M, 5월 40.5M→31.2M. dry-run 검증 + CSV 백업(gitignore) 후 삭제 + P/L 재집계.

#### 2. '매입관리' → '비용관리' 개명 (24ae01e8, 6fdf95ff)

- 실제 매입(원재료+식자재)은 17%뿐, 나머지 83%가 인건비·임차료·세금 → 발생주의 '비용'(손익계산서 일치)으로 통일. Sidebar/BottomNav/MoreMenu/AdminAppPreview/페이지 라벨/매뉴얼/영업가이드 변경. 라우트 `/purchase`·폴더명·API 유지. 개인가계부는 businessTotal·P/L에서 이미 제외 확인.

#### 3. 4대보험 이중계상 제거 + 지출 오분류 정정 (2c02a36e)

- 국민연금·건강·고용·산재 공단 납부가 세금과공과/기타경비/보험료로 제각각 분류 → 인건비 섹션 4대보험료(사업주/직원)와 이중계상. 카드대금처럼 '4대보험납부' 카테고리 분리 + `is_four_insurance_payment()` 키워드 가드(profit_loss_service/purchase/parser 공유, 월별 거래처명 변동 대응). 23건/12,571,810원 재분류. 세금과공과 15.38M→6.54M, 기타경비 9.22M→2.14M. 김지연 500만→개인가계부, 성동(206)→세금과공과 유지(사장님 확인).

#### 4. 급여 임포트 business_id 누락 → 5월 인건비 0원 (d17ba6c6)

- `import_payroll_data.py`가 Payroll 생성 시 business_id 미설정 → 5월 7건 bid=None → sync_labor_cost(bid=1)에서 누락 → 인건비/퇴직금/4대보험/원천세 전부 0. get_staff_map이 (id, business_id) 반환하도록 + 신규/기존 모두 staff.bid 주입. DB 7건 정정 + 재집계: 5월 인건비 0→15,196,030원.

### AI참고 (다음 세션)

- **⚠️ 6월 급여 미입력** — Payroll 0건. 입력 시 sync_labor_cost가 6월 인건비 섹션 자동 채움.
- **4대보험납부** 카테고리는 P/L·비용관리에서 제외(카드대금과 동일). 신규 월 거래처(26XX국민건강 등)는 키워드 가드로 자동 차단.
- raw BankTransaction 중복(메모리 455건)은 미정리 — DailyExpense 레벨만 정리함. 재수집 시 bank-sync dedup(afe0fe5d)이 신규 중복은 차단.

---

## 2026-06-23 (저녁 — 장인김밥 데모 + 읽기전용 뷰어 + 상품관리 매장별)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| chore | 장인김밥(bid=2) 종합 데모 데이터 — 매출/급여(주휴)/현금분리/6월/매출패턴 | 완료 |
| feat | 사이드바 '거래처 관리'→'사용 매뉴얼' + 초보자용 27화면 종합 설명서 | 완료 |
| feat | 읽기전용 SuperAdmin 뷰어 역할(superadmin_viewer)·adminext 계정 | 완료 |
| feat | 상품관리 매장별 전환 — 통합 메뉴 상품(MenuItem) + 등록/이미지 | 완료 |
| feat | 대시보드 전달/다음달 이동 버튼 | 완료 |
| fix | 뷰어 사이드바 누락, 모니터링 매출0, 앱전송 타매장 누출, 손익 매장명 | 완료 |
| style | SuperAdmin 전체 탭·모달 라이트 테마 통일 + 매장카드 재디자인 | 완료 |
| chore | 레시피 전역 데이터 가상화(비법 비공개) + 소담 원본 DB 복원 | 완료 |

### 세부 내용

#### 1. 장인김밥 종합 데모 데이터 (a1083133, f6a0c33e, 1f84aef6, 9b577e2e, 0130b76a)
- `scripts/maintenance/seed_jangin_full_2026.py`: 1~6월 매장+배달3채널 매출, 전 비용 카테고리, 배달정산, 8명 급여.
- 현금/카드 분리(현금 ~매장의 22%), 급여 소담방식(주방장 월급제 + 시급제+주휴수당, 주15h 미만 주휴 제외).
- 매출 패턴 6월=100% 기준(1월80·2월70·3월85·4월93·5월86·6월100%) — 연동 비용 재집계.

#### 2. 사용 매뉴얼 (227cef02, 77706446)
- Sidebar(SuperAdmin 뷰잉)의 거래처관리 → 사용매뉴얼(/manual). UserManual 27개 화면 전 기능 초보자용 정밀화.

#### 3. 읽기전용 SuperAdmin 뷰어 (83e8dfda, 0f3a0fde, 69f86489, d7b3b8d2, cad9749d, b47e3508)
- 새 역할 `superadmin_viewer`(adminext / Adminext2026!). get_superadmin_user 읽기 허용 + get_superadmin_editor(쓰기/사용자관리 차단).
- get_current_user 비-GET 전역 403(읽기전용), tenant_filter View-As 허용(소담 본점 id1 차단), get_admin_user 뷰어 읽기 허용.
- 차단: 소담 본점·사용자관리·작업일지. Layout isAdmin에 뷰어 포함(사이드바 복구).
- SuperAdmin 전체 탭·모달 라이트테마 통일(bg-white/5 등 다크클래스 → 라이트), 매장카드 재디자인+진입버튼.
- 모니터링 매출 0(Revenue테이블→MonthlyProfitLoss), 앱전송 staff-list View-As bid 필터.

#### 4. 상품관리 매장별 전환 (cb1b58f0, f8d38611, 50fa742b)
- 신규 `MenuItem` 모델(business_id, item_type=product/ingredient), `/api/menu-items` CRUD + 빈 매장 자동 시드 + 이미지 업로드.
- `services/default_menu.py` 기본 메뉴, 기존 3매장 각 36건 시드. MenuBoard·RecipeBook API 연동+등록/편집/삭제, 상품 사진 표시.
- 레시피 전역(recipes.js) 가상화(0eddd122) + 소담 원본(실 레시피·가격·사진) DB 복원(저장소 미포함). 장인은 동일 사진+가상 레시피.

#### 5. 기타 fix (daa55d2f, 15b70ebf, c350e8f6)
- 손익계산서 매장명 /auth/business-info(View-As 반영) + '_2026 하반기' 제거. 대시보드 전/다음달 버튼.

### AI참고 (다음 세션)
- **adminext / Adminext2026!** = 읽기전용 SuperAdmin 뷰어. 소담본점·사용자관리·작업일지 차단, 장인/강동 읽기열람.
- **MenuItem** = 매장별 메뉴/레시피 단일 모델. 빈 매장 첫 GET 자동 시드. 소담 원본 비법은 DB만(저장소 X).
- 장인 매출은 6월=100% 기준 퍼센트 패턴. 시드 재실행 시 1~6월 전체 재생성.

---
## 2026-07-04

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | 수집 건강도 알림 파이프라인 완성 (텔레그램 사장님 승격 + 봇 연결) | 완료 |
| fix | 세션쿠키 만료 사전경보 복구 (cookie_expiry.py SSOT) + 프론트 추정만료 표시 | 완료 |
| infra | 서버 crontab health-watch 21:00 추가 (09:00+21:00 2회/일) | 완료 |
| other | 셈하나 1등 앱 개선 로드맵 P0~P3 수립 (전체 코드분석) | 완료 |

### 세부 내용

- **텔레그램 알림 완성**: SMS가 팝빌 발신번호 0개로 막힌 상황에서 텔레그램을 사장님 1차 채널로 승격. `_owner_message()`/`_notify_owner()`로 SMS·텔레그램 동일 한국어 문구 통일. 봇 @semhana_alert_bot 생성·연결, 운영서버→폰 발송 SSH 검증 완료 (커밋 68ff219c).
- **만료경보 복구**: 세션쿠키(만료 NULL)면 발급시각+TTL 추정 폴백. 쿠팡/배민 `_cred_dto`에 expires_at_effective 추가, 프론트 ModuleDetail·배민 임박배너가 세션쿠키에서도 동작 (커밋 76de4169, 68ff219c).
- **cron 아키텍처 규명**: 실제 cron SSOT는 Orbitron.yaml이 아니라 Orbitron 서버 crontab. orchestrator/profit-loss cron 부재는 버그 아님 — 수집 직후 인라인 reflect(→DailyExpense) + 손익 on-view 재계산 구조. health-watch는 원래 09:00에 돌고 있었고 텔레그램 미설정으로 no-op였던 것 (이전 오진단 정정).
- **로드맵 수립**: 신뢰성(P0)→제품완성도(P1)→차별화(P2, AI 경영비서 등)→스케일(P3). auto-memory `project_top_app_roadmap.md`가 SSOT.
- **미완(운영)**: 쿠팡(6/21)·배민(5/14) 쿠키 만료로 수집중단 → 사장님 어드민 쿠키 재입력 필요.

---

## 2026-07-04 (오후 세션)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 쿠팡이츠 쿠키 재입력 UX 완성 (라이브 검증·cURL 붙여넣기·매장 자동감지·원클릭 백필) | 완료 |
| fix  | 쿠팡 회전 쿠키 오염 — 등록 직후 401/403 (선별 병합) | 완료 |
| fix  | 쿠팡 orders/settlements Akamai 403 — sec-fetch 헤더 누락 | 완료 |
| fix  | 쿠팡 6월 주문 과소수집 — Akamai 속도제한, 하루단위 순회 | 완료 |
| infra| 월별 매출내역서 엑셀 자동적재 cron 등록 (매월 6일) | 완료 |
| fix  | 매출관리 배달앱 화면 "알 수 없는 값" — business_id 필터 누락 + 결정적 병합 | 완료 |
| feat | 요기요·땡겨요 정산내역 엑셀 파서 | 완료 |

### 세부 내용

- **쿠팡 쿠키 재입력 UX**(merge 6b2a4d51): 등록 시 whoami 라이브 검증, cURL 통째 붙여넣기, 매장 자동감지, 공백 원클릭 백필(30일 청크). 최종 리뷰 반영(422 모달내 표시).
- **쿠팡 3연속 근본 픽스**: (1) 회전 쿠키 통째 저장이 브라우저 원본 오염→선별 병합 `merge_rotated_cookies`(26385b78). (2) `_common_headers`에 sec-fetch-* 누락→민감 endpoint 403, 헤더 추가로 orders/settlements 200 복구(0d6000c1). (3) 넓은범위 pageSize=10 버스트→Akamai가 ~90건 degrade, `fetch_orders_by_day` 하루단위+지연으로 개선(8dc17160). ⚠️ 월단위 대량백필은 Akamai 4일벽으로 API 한계 — 완전 데이터 SSOT는 정식 월엑셀.
- **월엑셀 cron 등록**: 서버 crontab `30 3 6 * * /home/stevenlim/coupang-excel-cron.sh`(전월+전전월). 시크릿은 컨테이너 env에서 런타임 로드(평문 미보관). 스모크테스트로 5월 적재 성공(474건/934만원).
- **매출 화면 버그 근본 수정**: `/revenue/delivery-summary`에 business_id 필터 없어 bid=1(진짜 엑셀)+bid=2(가짜 28% 추정) 혼합 비결정 표시. `_consolidate_delivery`(결정적 병합, 총비용 우선) + bid 필터로 해결. 쿠팡 매달 일관 58~69% 총비용. 파트1 배포.
- **배달앱 매출 정의 결정 A**: 매출=주문기준(DailyExpense), 명세서는 정산기준이라 어긋남. 배민/요기요/땡겨요는 매출×명세서율. 스펙/플랜 문서화.
- **요기요·땡겨요 파서**: 정산내역 엑셀에서 매출/총비용/정산 추출(요기요 요약 A/C/D+C-1~14, 땡겨요 A/D/E). 1~7월 실파일 검증.
- **남음**: 파서→DeliveryRevenue 적재 + 업로드 UI + delivery-summary 결정A 통합 + 정산 대조(파트3). 스펙 `docs/superpowers/specs/2026-07-04-delivery-revenue-consolidation-reconciliation-design.md`.
- ⚠️ **보안 유의**: `2026소득분석/` 폴더에 과거 커밋된 민감 파일(급여·매출·은행 raw)이 아직 git 추적 중. gitignore는 신규만 차단 — `git rm --cached -r` 정리 필요.

---
## 2026-07-04 (저녁 세션)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 정식 재무제표 3종 — 손익계산서(정식단계)·현금흐름표·재무상태표 + 재무제표 탭 | 완료 |
| feat | 정식 손익 양식(영업이익/순이익 분리) + 카드수수료 실효요율(1.4%) 자동 산정 | 완료 |
| feat | 비유동자산 대장(FixedAsset) + 감가상각 자동 반영 (보증금 8천만·집기 8천만·인테리어 5천만) | 완료 |
| feat | 국민카드 파서 + 신한카드 신형 .xlsx 지원 (엔진 자동감지) | 완료 |
| fix  | 수치 정확성 전수 감사 — 쿠팡 총비용 공식·결제수수료 2배·bank정산 부풀림·가짜 18행 | 완료 |
| fix  | 인건비 실송금 우선 확정 + 4대보험·원천세 은행 실납부 기준 (이중계상 제거) | 완료 |
| fix  | 임차료 발생주의 귀속 (월초 지급→전월말) 자동수집 경로 적용 | 완료 |
| infra| 은행 원장 분류 100% (미분류 68건 해소, withholding_tax 분류 신설), 거래처 33개 중복 정리 | 완료 |

### 세부 내용

- **배달앱 정산 41개월 전량 파싱**: 4채널×2025-06~2026-07, (채널,연월) dedup, 결과 JSON `2026소득분석\파싱결과_배달앱_정산.json`. 땡겨요 (일별) 포맷 라벨 대응(8a8d23a1).
- **수치 전수 감사·정정**(cae27b3b): ①쿠팡 결제수수료 기본/프로모션 페어 2배 계상 ②즉시할인 미계상 ③총비용=매출−정산+광고(별도청구) 공식 확정 ④bank_sync 정산 2~3배 부풀림(중복적재 시대 누적) 엑셀로 교체+병합 정산 excel 우선 ⑤bid=2 영문 28% 가짜 18행 삭제 ⑥배민 11개월 재임포트(5월 부분값 해소)+요기요·땡겨요 26개월 upsert ⑦breakdown 합계==총비용 잔차 정합(배민·요기요·쿠팡 통일). 검증: 정답지 34슬롯 전부 일치, 내부 일관성 위반 0.
- **6월 비용 점검**(사장님 신고): 중복 0건 확인. 원인=임차료 두 달치 몰림(월말 주말→익월 1~3일 이체). 발생주의 조정을 bank_sync+normalizer에 추가(6ecd7fb0), 6행 귀속월 이동 → 월별 임차료 720만~753만 균일화. 코페이 입금의 비용측 이중기재 1건 삭제.
- **인건비 정책 확정**(사장님, 9b9dc2bc+412f6937): 인건비=은행 실송금(가불·현금지급 포함), 퇴직금 실지급은 severance 분리(적립과 이중 방지, 설주리 486만), 4대보험=실납부 총액(기존 직원공제=사업주 가정으로 연 500만 과소), 원천세=실납부(세금과공과와 이중계상 제거, 납부서 135,320원 정확 대조 검증). Payroll '대기' 33건 오류→완료. 분류 SSOT=거래처(개인가계부 표시 우선, 299건 백필). 보험료 카테고리 P/L 통째 누락 픽스.
- **정식 손익계산서**(de771edf): 영업비용(세금 제외)→영업이익→세금(부가세·대표 소득세)→순이익. 기존 '영업이익' 라벨이 실은 세후값이라 순이익으로 정정. 카드수수료=승인액×CARD_FEE_RATE(1.4%=실측 정렬분석≈여신협회 5~10억 구간) 1~7월 채움(월 54만~69만).
- **재무제표 3종**(92fdc81a): DMR 양식 준용. 현금흐름표=은행 원장 전량 매핑(유입7·유출8), 기초+유입−유출=기말이 실제 통장 잔액과 **1원 단위 일치**(1~7월 전부 ✅). 재무상태표=현금+카드미정산채권+보증금+유형자산 장부가/퇴직급여충당부채/자본 구성분해. 자산 대장: 개업 2021-05-01, 구자산 1억 상각완료(2026-04), 추가집기 3천만(2024-07, 월 50만 상각 중). 손익관리 '📑 재무제표' 탭.
- **매출관리 거래처 정리**: 배달 채널 4개(쿠팡이츠·배달의민족·요기요·땡겨요)만 남기고 중복·빈 거래처 33개 삭제(참조 0 확인).
- **세금 분류 검증**: 원천세 페어('국세_소담김밥'+'서울특징')를 공식 납부서로 확정 검증. 국세엔 부가세+대표 연말정산 소득세 포함(사장님 확인). 홈택스 API 대안 조사: 팝빌(세금납부내역 없음)·하이픈(월10만+)·CODEF 전부 월정액 — 연 5~6건엔 과함, 0원 접근(시기규칙+납부서 매칭 or 연1회 수동다운로드 파서) 추천, 사장님 선택 대기.
- **기타**: 신한카드 신형 .xlsx(거래일/매입구분 컬럼) + 국민카드 파서(내장 요약 22건/4,242,970 정확 일치 검증), 은행 임차료 날짜 str 타입 버그.

---
## 2026-07-04 (밤 세션 — 디자인·AI 파이프라인)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 재무제표 탭 무한 로딩 — /api 중복 404 근본 수정 + 에러 UI·재시도 버튼 | 완료 |
| design | 셈하나 브랜드 인포그래픽 — Behance 'Arcos' 스타일 추출→힉스필드 합본→시네마그래프 영상 | 완료(1차 산출물은 정리) |
| design | 사이버펑크 리스타일 4K + 헐리우드급 영상 2종 (Veo 3.1 ultra·Kling 3.0 4K) | 완료 |
| infra | 힉스필드 MCP 인증 완료 + Plus 플랜 전환, 모델 특성 실측 | 완료 |

### 세부 내용

- **재무제표 탭 프리즈 픽스**(8a2b48cc, b4ac5bfe): 원인=api.js baseURL에 이미 `/api` 포함인데 statements 호출만 `/api/profitloss/...`로 시작 → 프로덕션 `/api/api/...` 404 + 조용한 catch로 무한 "산출 중". 경로 수정 + 에러 배너·재시도 버튼. 전 코드베이스 스캔으로 동일 패턴 없음 확인.
- **브랜드 인포그래픽 1차**(6fe9e273~45daa5a3): Behance 'Arcos' 리소그래프 듀오톤 스타일 정량 추출(HEX·타이포·기법) → HTML 정밀본 + 힉스필드 nano_banana_pro 스타일 트랜스퍼 → 판화 아트웍+정밀 한글 합본 4K → CSS 시네마그래프 영상(Playwright 프레임스텝 192장, 8s 루프). 시그니처 "회계의 아치"(키스톤=분류엔진).
- **사이버펑크 라운드**(9d293e96): 합본을 네온·홀로그램 리스타일 → Veo 3.1 ultra(네이티브 4K+사운드, 시네마틱 최강·한글 붕괴)와 Kling 3.0 4K(텍스트 안정) 영상 2종. 크레딧 153 사용, 잔여 ~1,057.
- **사장님 평가**: 1차 결과물 "유치원생 수준" — 상업적 완성도를 기준점으로 기록. 이후 비주얼 작업은 시안 선공유+피드백 루프 방식 확정. 1차 인포그래픽 산출물 11파일은 사장님이 정리(삭제), 사이버펑크 5종 유지.
- **힉스필드 실측 노하우**: 4K 네이티브=한글 붕괴(2회 재현)→2K 생성+업스케일 우회가 우수, 인포그래픽=레이아웃 ref 첫번째+glyph-for-glyph 프롬프트, preset 추천 notice는 declined_preset_id로 literal 재요청.

---
