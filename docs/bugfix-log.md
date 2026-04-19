# 버그 수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
| 2026-04-19 | 서류 업로드 실패 | 로컬 디스크 폴백이 서버 환경에서 불일치 | 로컬 폴백 제거, 미디어 서버 전용 저장 | backend 서류 업로드 로직 |
| 2026-04-19 | 서류 업로드 multipart 오류 | Content-Type 헤더에 boundary 누락 | multipart boundary 자동 설정 + 에러 핸들링 개선 | backend 서류 업로드 로직 |
| 2026-04-19 | 한글 파일명 서류 업로드 500 오류 | 미디어 서버에서 한글 파일명 처리 실패 | 파일명 인코딩 처리 수정 | backend 서류 업로드 로직 |
| 2026-04-19 | 보건증 라벨 오류 | 라벨 텍스트가 구 명칭 사용 | 보건증 → 건강진단서로 변경 | 프론트엔드 UI |
| 2026-04-19 | 급여 실수령액 이중 계산 | PayrollStatement에서 total_pay + deductions로 중복 합산 | total_pay만 사용하도록 수정 | PayrollStatement.jsx |
| 2026-04-19 | 세금대납 급여 계산 오류 | 세금대납 시 실수령액 표기와 이체액 혼동 | 총 보상액/실수령액/계좌이체 3단계 분리 | PayrollTab.jsx, PayrollStatement.jsx, payroll.py, banking_service.py |
