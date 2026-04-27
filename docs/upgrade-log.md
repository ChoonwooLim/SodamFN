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
| 2026-04-25 | 연말정산 Phase 1 — pytest 인프라 + 4 신규 모델 (YearEndReport/Document/Simplified/AuditLog) | feat | requirements.txt, pytest.ini, tests/conftest.py, models.py |
| 2026-04-25 | 연말정산 Phase 1 — services/yearend/ 패키지 6 모듈 (aggregator/parser/reconciler/tax_calculator/audit/generator) + 23 unit tests | feat | services/yearend/*.py, tests/yearend/test_*.py |
| 2026-04-25 | 연말정산 Phase 1 — 별지24/23호 Jinja2 템플릿 + WeasyPrint HTML→PDF (tax_calculator Stub 어댑터로 Phase A 업그레이드 가능) | feat | templates/yearend/*.html.j2, services/yearend/generator.py |
| 2026-04-25 | 연말정산 Phase 1 — admin 라우터 16 엔드포인트 (요약/집계/문서업로드+파싱/대조/PDF/배포/감사) + Orbitron WeasyPrint OS 의존성 | feat | routers/yearend.py, main.py, Orbitron.yaml |
| 2026-04-25 | 연말정산 Phase 1 — staff_yearend 라우터 5 엔드포인트 (직원본인 조회+다운로드+감사로그 자동 기록) | feat | routers/staff_yearend.py, main.py |
| 2026-04-25 | 연말정산 Phase 1 — 어드민 YearEnd 페이지 + EmployeeDetailModal + 5 서브 컴포넌트 (대조 banner/간소화 13카테고리 표/문서 업로드/감사 로그) | feat | pages/YearEnd.jsx, components/yearend/*.jsx, Sidebar.jsx, App.jsx |
| 2026-04-25 | 연말정산 Phase 1 — 직원앱 MyYearEnd 페이지 + 홈 진입 카드 (distributed years 있을 때만 노출, 본인 PDF blob 다운로드) | feat | staff-app/src/pages/MyYearEnd.jsx, App.jsx, Home.jsx |
| 2026-04-25 | 연말정산 Phase 1 — DevelopmentRoadmap 4개 항목 done 표시 (Phase 1 완료, Phase 4 자체 세법 계산은 planned 유지) | feat | DevelopmentRoadmap.jsx |
| 2026-04-25 | 영업관리 V1 — 설계 명세 작성 (브레인스토밍 7라운드 합의: 6 카테고리/L3 인터랙션/SYNC-LINK 5개/MERGE-DOCS 5종/외국인고용 이주) | docs | docs/superpowers/specs/2026-04-25-sales-guide-design.md (603줄) |
| 2026-04-25 | 영업관리 V1 — 구현 계획서 작성 (22 task: 백엔드 5 + 콘텐츠 6 + 프론트 11) | docs | docs/superpowers/plans/2026-04-25-sales-guide.md (3923줄) |
| 2026-04-25 | 영업관리 V1 — SalesGuideProgress 모델 (1 사업장 × 1 item_key UniqueConstraint, completed_at/expires_at/notes/updated_by) | feat | models.py, tests/sales_guide/test_models.py (4 tests PASS) |
| 2026-04-25 | 영업관리 V1 — sync-status 4개 자동 카운트 (보건증·4대보험·근로계약·사업자번호. 위생교육은 사업장 단위 모델 부재로 V1 제외) | feat | services/sales_guide.py compute_sync_status, tests/sales_guide/test_sync_status.py (7 tests PASS) |
| 2026-04-25 | 영업관리 V1 — compute_stats 카테고리별 진행률 (필수 항목만 카운트, sync 100% 자동완료, 만료 다운그레이드, 만료 30일 alert) | feat | services/sales_guide.py compute_stats + _evaluate_item, tests/sales_guide/test_stats.py (4 tests PASS) |
| 2026-04-25 | 영업관리 V1 — FastAPI 라우터 4 엔드포인트 (GET /progress, PATCH /progress/{key} upsert, GET /sync-status, GET /stats with CATALOG_FOR_STATS 6 카테고리 38 항목 메타) | feat | routers/sales_guide.py, main.py |
| 2026-04-25 | 영업관리 V1 — 휴게음식점 마스터 데이터 38 항목 6 카테고리 (인허가7/배달8/결제5/세무6/인력5/운영팁7 골격) — gaongn.net 풍 카드+모달 콘텐츠 (steps/documents/tips/deepLinks) | feat | frontend/src/data/sales-guide/index.js + kimbap.js (1226줄) |
| 2026-04-25 | 영업관리 V1 — useSalesGuide 훅 + 5 컴포넌트 (DeepLinkButton/ProgressCard/ItemCard/DateInputDrawer/ItemDetailModal — gaongn.net /certifications 풍 5섹션 모달, business_docs 통합 업로드) | feat | frontend/src/hooks/useSalesGuide.js, components/sales-guide/*.jsx (617줄) |
| 2026-04-25 | 영업관리 V1 — SalesGuideHome 랜딩 + CategoryPage (6 카테고리 단일 컴포넌트, 필터 5종, ItemDetailModal) + App.jsx 라우트 (/sales-guide, /sales-guide/:category) + /hr/foreign-worker-guide redirect | feat | pages/sales-guide/SalesGuideHome.jsx + CategoryPage.jsx, App.jsx |
| 2026-04-25 | 영업관리 V1 — 사이드바 새 최상위 그룹 "영업관리" (메인 다음, 7 하위 메뉴) + /sales-guide/stats 페치 → 라벨 빨간 배지 (미완료+만료임박 카운트) + HR 외국인고용 메뉴 제거 + ForeignWorkerGuide.jsx 페이지 삭제 | feat | components/Sidebar.jsx, pages/ForeignWorkerGuide.jsx 삭제 |
| 2026-04-27 | 팝빌 EasyFinBank TEST 환경 검증 진입 — POPBILL_BANK_IS_TEST 토글 + UI 모드 라벨 STUB(amber)/TEST(sky)/LIVE(emerald) 3색 분기 + /status 응답에 is_test 필드 추가 | feat | Orbitron.yaml, routers/bank_sync.py, BankSync.jsx |
| 2026-04-27 | bank-sync 자동분류를 매출관리/매입관리(DailyExpense)와 연동 — _materialize_link 재작성, BankTransaction.linked_daily_id 컬럼 신규(auto-migration), Vendor 자동 매칭/생성, REVENUE_CHANNEL_MAP 31개 키워드, 학습 패턴(80% threshold + manual 2배 가중), 출금 default expense, /pull 끝에 자동분류 즉시 실행 | feat | routers/bank_sync.py, models.py, init_db.py |
| 2026-04-27 | bank-sync 21분 단위 자동 갱신 + 거래내역 탭 타이틀 동적 변경 — _do_pull 헬퍼 추출, /api/bank-sync/refresh-all 신규 엔드포인트(skip_recent_minutes 중복방지), AutoRefreshControl 컴포넌트(localStorage 영속화 + 카운트다운), 단일계좌 시 "{은행명} 거래내역" 표시 | feat | routers/bank_sync.py, BankSync.jsx |
