# 버그 수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
| 2026-04-19 | 서류 업로드 실패 | 로컬 디스크 폴백이 서버 환경에서 불일치 | 로컬 폴백 제거, 미디어 서버 전용 저장 | backend 서류 업로드 로직 |
| 2026-04-19 | 서류 업로드 multipart 오류 | Content-Type 헤더에 boundary 누락 | multipart boundary 자동 설정 + 에러 핸들링 개선 | backend 서류 업로드 로직 |
| 2026-04-19 | 한글 파일명 서류 업로드 500 오류 | 미디어 서버에서 한글 파일명 처리 실패 | 파일명 인코딩 처리 수정 | backend 서류 업로드 로직 |
| 2026-04-19 | 보건증 라벨 오류 | 라벨 텍스트가 구 명칭 사용 | 보건증 → 건강진단서로 변경 | 프론트엔드 UI |
| 2026-04-19 | 급여 실수령액 이중 계산 | PayrollStatement에서 total_pay + deductions로 중복 합산 | total_pay만 사용하도록 수정 | PayrollStatement.jsx |
| 2026-04-19 | 세금대납 급여 계산 오류 | 세금대납 시 실수령액 표기와 이체액 혼동 | 총 보상액/실수령액/계좌이체 3단계 분리 | PayrollTab.jsx, PayrollStatement.jsx, payroll.py, banking_service.py |
| 2026-04-19 | HR 대시보드 직원 데이터 0명 표시 | Axios 응답이 {status, data:[...]} 인데 .data로 한 번만 추출하여 객체를 배열로 취급 | Array.isArray 체크 + rawData?.data 추출 추가 | HRDashboard.jsx |
| 2026-04-19 | 퇴직금 탭 재직 직원 급여 내역 미표시 | contract_end_date(미래)를 calc_end_date로 사용하여 3개월 윈도우가 미래로 밀림 | min(contract_end_date, today)로 제한 | retirement.py |
| 2026-04-19 | 매장관리 매장 목록 사라짐 | SQLModel create_all이 기존 테이블에 컬럼 추가 불가 → employee_scale 누락 → Business 쿼리 전체 500 에러 | ALTER TABLE business ADD COLUMN employee_scale | models.py, PostgreSQL |
| 2026-04-19 | 직원앱 프로필 등급이 DB 변경 후 갱신 안 됨 | JWT payload의 stale grade만 읽어 표시 | /auth/me 재조회로 최신 grade 병합 | staff-app/Profile.jsx |
| 2026-04-19 | 연차 승인 시 잔액 차감이 원자적이지 않고 타 사업장 요청까지 승인 가능 | 승인/차감이 분리된 커밋 + 테넌트 필터 누락 | 단일 트랜잭션 + X-View-As-Business 테넌트 검증 + 잔액 부족 즉시 반려 | leave.py |
| 2026-04-19 | 사업장 규모 설정 API 404 (PUT /api/api/auth/business-settings) | useBusinessConfig가 `/api/...` 경로 사용, 그러나 axios baseURL 이미 `/api` 포함 → 이중 prefix | 경로를 `/auth/...`로 정정 + HR 토글 [현재] 배지 UI | useBusinessConfig.jsx, HRDashboard.jsx |
| 2026-04-19 | 사업장 규모 변경 후 화면에 반영 안 됨 (피드백 없음) | 성공/실패 메시지 미표시 + Context 재조회 누락 | scaleMessage 배너 + refreshBusinessConfig() 호출 | Settings.jsx |
| 2026-04-19 | SuperAdmin의 사업장 규모 변경 시 400 Bad Request | admin.business_id=None 이라 서버가 대상 사업장을 특정 못함 | PUT /auth/business-settings에서 X-View-As-Business 헤더로 bid 결정 | auth.py |
| 2026-04-19 | 5인 미만 사업장 직원이 무급휴가·병가·경조사도 신청 불가 | _resolve_self_staff가 under5 전체를 블록 | 연차(ANNUAL_TYPES)만 차단하고 무급/병가/경조사 허용, 튜플 반환으로 변경 | leave.py |
| 2026-04-24 | 팩스 전송 시 생성된 PDF가 빈 페이지로 나감 | 완전 HTML 문서(`<html>/<body>/<style>`)를 `<div>.innerHTML`에 통째로 넣어 브라우저가 중첩된 html/body 태그를 무시 | DOMParser로 파싱해 `<style>` 태그와 `body.innerHTML`을 분리 추출 후 컨테이너에 각각 별도 주입, `document.fonts.ready` + 250ms 대기로 폰트/이미지 로딩 확보 | FaxTransmission.jsx |
| 2026-04-24 | 소담김밥 Business 레코드가 비어있어 증명서에 대표자 `Admin` / 사업자번호 `-` 로 출력 | 가입 시 디폴트 값만 있고 실제 회사정보 편집 UI가 없었음 | 회사정보 관리 탭 신설 + Business 1 레코드에 실값(639-12-01514 / 홍지연 / 02-452-6570 / 주소) 주입 | CompanyInfoSettings.jsx, auth.py |
| 2026-04-24 | Business.phone 이 `02-452-6510` 로 잘못 저장됨 | 손글씨 이미지 OCR 오판독 (7→1) | DB + `.env` POPBILL_SENDER_NUMBER 모두 `02-452-6570` / `0224526570` 으로 정정 | DB update, backend/.env |
| 2026-04-24 | 팝빌 팩스 전송 성공 코드가 오지만 실제 수신되는 페이지는 빈 용지 | html2pdf.js(html2canvas)가 복잡한 한글 CSS + SVG 필터 + mm 단위 레이아웃을 캡처하지 못해 24byte content stream / 0 XObject 짜리 빈 PDF 생성. DOMParser 분리 방식도 실패 | Dockerfile에 libpango/libharfbuzz/libfribidi + fonts-nanum/noto-cjk 추가 후 WeasyPrint로 서버사이드 HTML→PDF 전환. `GET /hr/certificate/pdf/{cert_type}/{staff_id}` 엔드포인트 신설, 프론트에서 html2pdf.js 완전 제거 | Dockerfile, requirements.txt, certificate.py, FaxTransmission.jsx |
| 2026-04-24 | WeasyPrint PDF에 업로드한 직인 이미지가 `직인` 텍스트로만 표시 | settings_json.seal_image_url이 상대 URL(`/api/media/...`)이라 WeasyPrint가 컨테이너 내부에서 resolve 실패 → `<img>` alt 텍스트로 fallback | `_fetch_image_as_data_uri()` 헬퍼로 FRONTEND_URL 기준 다운받아 base64 data URI embed. 실패 시 SVG fallback | certificate.py |
| 2026-04-24 | 증명서가 2페이지로 분리되어 1페이지에 대표자·직인이 없음 | cert-issuer 블록이 page-break-inside:avoid라 1페이지에 공간 부족 시 2페이지로 통째로 밀림 | @page margin 20→12mm, cert-wrap padding/min-height 제거, 전반 스페이싱 축소로 A4 1페이지 수렴 | certificate.py |
| 2026-04-24 | 환경설정 → 회사정보 관리 탭의 직인 이미지 미리보기가 업로드 후에도 비어 보임 | `get_business_info` 응답에 `seal_image_url` 필드 누락. 실제 DB에는 저장됨(증명서 PDF에는 반영 확인) | auth.py::get_business_info 응답에 settings.seal_image_url 포함 | auth.py |
| 2026-04-25 | bank-sync API 호출 시 500 에러 (팝빌 SDK 메서드명 불일치) | EasyFinBankService 실제 메서드명/시그니처 확인 없이 추측한 이름·인자 순서로 호출 | popbill SDK 소스 참조해 listBankAccount/getBankAccountInfo/requestJob/getJobState/search/summary 시그니처 재구성 | bank_sync_service.py |
| 2026-04-25 | bank-sync 진단 모달의 에러 상세가 작은 글씨/접힘 상태로 출력 | nested error 객체 details가 디폴트 collapsed + 폰트 작음 | 에러 발생 시 자동 펼침, 폰트 12→14, 코드 블록 가독성 개선 | BankSync.jsx |
| 2026-04-25 | bank-sync 진단 결과가 내부 ok=False/skipped여도 UI에 "성공"으로 표시 | 최상위 ok 플래그만 보고 success 분기 → 내부 step 단위 실패 누락 | step별 ok=False or status='skipped' 검사 추가, 하나라도 실패면 전체 실패 | BankSync.jsx |
