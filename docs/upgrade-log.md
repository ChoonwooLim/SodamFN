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
| 2026-04-19 | 회사직인 관리 메뉴 + 10종 SVG 직인 샘플 선택 시스템 (settings_json 저장) | feat | CompanySeal.jsx, Settings.jsx, auth.py |
| 2026-04-19 | 셈하나 개발 로드맵 Phase 2 최신화 — 회사직인·구인등록·휴가 자가 신청 등 반영 | feat | DevelopmentRoadmap.jsx |
| 2026-04-19 | [HEAD] DevWorkLog 고정 엔트리 전면 재작성 (14섹션, ai_summary 16개) | infra | DevWorkLog(id=4) |
| 2026-04-19 | /end 스킬에 [HEAD] DevWorkLog 고정 콘텐츠 업그레이드 단계(3-8) 추가 | infra | ~/.claude/skills/end/SKILL.md |
| 2026-04-24 | 환경설정 '회사정보 관리' 탭 신설 (15개 회사 기본정보 + 12유형 공식문서 보관함 + 직인 이미지 업로드) | feat | CompanyInfoSettings.jsx, business_docs.py, models.py, auth.py |
| 2026-04-24 | 증명서 직인 렌더링 개선 (SVG seal-11 "English Traditional" 추가 + 4종 증명서 placeholder → 실제 직인 자동 삽입) | feat | CompanySeal.jsx, certificate.py |
| 2026-04-24 | /hr/fax 팩스 전송 메뉴 신설 (증명서 자동생성·회사 보관함·직접 업로드 3종 소스 + 전송 이력 관리 + URL 딥링크) | feat | FaxTransmission.jsx, fax.py, fax_service.py, models.py, Sidebar.jsx, App.jsx, DocumentTab.jsx |
| 2026-04-24 | FAX 프로바이더 추상화 + PopbillProvider 구현 (팝빌 SDK 래핑, 한글 E.164 변환, getBalance/get_result 헬퍼) | feat | fax_service.py, requirements.txt |
| 2026-04-24 | Orbitron.yaml에 Popbill FAX env 6개 키 선언 추가 (값은 Orbitron 대시보드/Secrets) | infra | Orbitron.yaml |
| 2026-04-24 | 서버사이드 PDF 렌더링 전환 (WeasyPrint + Dockerfile에 libpango/fonts-nanum 등 시스템 의존성 추가) | infra | Dockerfile, requirements.txt, certificate.py, FaxTransmission.jsx |
| 2026-04-25 | 팝빌 알림톡/SMS 발송 기반 (KakaoService+MessageService 래핑, stub/popbill 프로바이더, 11 엔드포인트, NotificationHistory 모델) | feat | notification_service.py, notifications.py, models.py |
| 2026-04-25 | 팝빌 사업자등록상태 조회 (ClosedownService 래핑, 거래처 등록 시 "자동확인" 버튼 + 결과 배너) | feat | biz_check_service.py, biz_check.py, VendorInfoManagement.jsx |
| 2026-04-25 | 팝빌 이지펀뱅크 계좌조회 자동 수집 기반 (EasyFinBankService 래핑, 30+ 엔드포인트, 7섹션 UI) — live -99010016 차단 확인 | feat | bank_sync_service.py, bank_sync.py, BankSync.jsx, models.py |
| 2026-04-25 | bank-sync 진단 인프라 (live/test 비교 + JobID 1회 테스트 + 계좌 수동 추가 우회 + 진단 UI 강화) | feat | bank_sync.py, BankSync.jsx |
| 2026-04-25 | 예금주조회 (AccountCheckService 래핑, 23개 은행 드롭다운, 급여계좌 입력 시 "예금주 자동확인" + 불일치 경고) | feat | account_check_service.py, account_check.py, ContractTab.jsx |
| 2026-04-25 | 전자세금계산서 발행 (TaxinvoiceService RegistIssue, 공급자 자동 prefill, 품목 동적 추가, VAT 10% 자동 계산, 90일 이력) | feat | taxinvoice_service.py, taxinvoice.py, TaxInvoice.jsx, App.jsx, Sidebar.jsx |
| 2026-04-25 | 기업정보(BizInfoCheck) 자동채움 (상호/대표/업태/종목/주소/규모/설립일 10+ 필드, 거래처 빈 phone/address 자동 입력) | feat | bizinfo_check_service.py, bizinfo_check.py, VendorInfoManagement.jsx |
| 2026-04-25 | 홈택스 전자세금계산서 자동 수집 (HTTaxinvoiceService, 부서사용자 등록 + RequestJob 비동기 폴링 모델, 12 엔드포인트, CSV 다운로드) | feat | hometax_service.py, hometax.py, HomeTaxCollect.jsx, App.jsx, Sidebar.jsx |
| 2026-04-25 | 알림톡 관리 UI 페이지 (잔액/템플릿 검수현황/발송통계 + 팝빌 관리 3종 바로가기 + 빠른 테스트 발송 모달) | feat | notifications.py(/urls/sender-number), KakaoNotifications.jsx, App.jsx, Sidebar.jsx |
| 2026-04-25 | 현금영수증 발행/취소 (CashbillService, 소득공제용/지출증빙용 토글, 식별번호 placeholder 자동 전환, 90일 이력) | feat | cashbill_service.py, cashbill.py, CashBill.jsx, App.jsx, Sidebar.jsx |
