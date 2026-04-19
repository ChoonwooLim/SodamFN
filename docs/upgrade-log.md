# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|---------|----------|
| 2026-04-19 | 서류관리 다중 파일 지원 + 미리보기 모달 추가 | feat | DocumentTab.jsx |
| 2026-04-19 | 직원 등급 체계 변경 (normal/VIP → 정직원/아르바이트) | feat | StaffDetail, BasicInfoTab |
| 2026-04-19 | 급여대장을 인사기록관리 급여대장 탭으로 통합 | feat | PayrollTab.jsx |
| 2026-04-19 | 이체 버튼 복원 + 계좌이체 실행 로직 구현 | feat | StaffDetail/index.jsx |
| 2026-04-19 | 전월 급여 카드, 특별수당 입력, 세금대납 조건부 표시 | feat | PayrollTab.jsx, AttendanceInput.jsx |
| 2026-04-19 | 급여 테이블에 총 보상액 + 실수령액 두 컬럼 분리 표시 | feat | PayrollTab.jsx |
| 2026-04-19 | 근태관리 AttendanceInput 모달→인라인 전환 | refactor | AttendanceInput.jsx, AttendanceTab.jsx |
| 2026-04-19 | 퇴직금 산출을 인사기록카드 탭으로 이관 | feat | RetirementTab.jsx |
| 2026-04-19 | 인사기록카드 전체 데이터 자동 연동 시스템 | feat | StaffDetail/index.jsx, BasicInfoTab.jsx |
| 2026-04-19 | 외국인 고용안내 전용 페이지 + 사이드메뉴 등록 | feat | ForeignWorkerGuide.jsx, Sidebar.jsx |
| 2026-04-19 | 연차/휴가관리 탭 (Phase 1) | feat | LeaveTab.jsx, leave.py, models.py |
| 2026-04-19 | 인사변경이력 자동추적 + 근로시간 모니터링 (Phase 2-3) | feat | ChangeLogTab.jsx, changelog.py, worktime.py |
| 2026-04-19 | 교육/자격증 관리 + HR 알림 시스템 (Phase 4-5) | feat | TrainingTab.jsx, training.py, alerts.py |
| 2026-04-19 | HR 대시보드 (Phase 6) | feat | HRDashboard.jsx |
| 2026-04-19 | 증명서 자동발급 시스템 — 4종 (Phase 7) | feat | certificate.py, DocumentTab.jsx |
| 2026-04-19 | 5인 미만/이상 사업장 규모 모드 구분 (Phase 8) | feat | useBusinessConfig.jsx, Settings.jsx, models.py |
