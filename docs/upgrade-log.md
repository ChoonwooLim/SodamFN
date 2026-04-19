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
| 2026-04-19 | 셈하나 개발 로드맵 전면 업그레이드 (5→6단계 확장) | feat | DevelopmentRoadmap.jsx |
| 2026-04-19 | HR 대시보드에 사업장 규모 모드 즉시 전환 버튼 추가 | feat | HRDashboard.jsx |
| 2026-04-19 | 사업장 규모(under5) 라우팅 가드 + StaffDetail 탭 이중 방어 | feat | useBusinessConfig.jsx, StaffDetail/index.jsx, App.jsx |
| 2026-04-19 | 직원앱 연차/휴가 자가 신청 기능 (staff-app Leave 페이지 + Home/Profile 진입점) | feat | staff-app/Leave.jsx, Home.jsx, Profile.jsx, App.jsx |
| 2026-04-19 | 5인 미만 사업장도 무급/병가/경조사 휴가 신청 허용 + HR 대시보드 대기 알림 | feat | leave.py, staff-app/Leave.jsx, HRDashboard.jsx |
| 2026-04-19 | HR 대시보드 알림/연차 카드 h-[440px] 통일 + 5인 미만용 휴가 신청 현황 카드 + 노동법 핵심 안내 패널 | feat | HRDashboard.jsx |
| 2026-04-19 | 직원관리 > 구인등록 서브메뉴 — 국내 구인 플랫폼 15곳 비교 가이드 | feat | JobPosting.jsx, Sidebar.jsx, App.jsx |
