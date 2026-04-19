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
