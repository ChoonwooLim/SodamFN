# 개발계획서

프로젝트 비전, 마일스톤, 기능 목록을 기록합니다.

## 마일스톤

| # | 이름 | 상태 | 목표일 |
|---|------|------|--------|
| 1 | HR 인사기록관리 기본 기능 | 완료 | - |
| 2 | 급여 계산 및 세금대납 지원 | 완료 | - |
| 3 | 서류 관리 및 전자계약 | 완료 | - |
| 4 | HR SaaS 전문화 (Phase 1~8) | 완료 | 2026-04-19 |
| 5 | 팝빌 통합 연동 (11개 서비스 단계적 활용) | 진행중 | 2026-05~06 |
| 6 | 연말정산 Phase 1 — 자체 집계 + 업로드본 대조 (경로 C 하이브리드) | 완료 | 2026-04-25 |

## 팝빌 통합 스케줄 (2026-04-24 확립)

LinkID=`SODAM` · SecretKey 발급 완료. 11개 서비스 모두 동일 Key로 호출 가능.
아래 순서대로 단계별 구현.

### Phase A — 카카오 알림톡/문자 (2순위) · **코드완료** / 카카오 검수 대기

- **가치**: 직원 알림용 SMS 대체 → 건당 10원 → 7원. 월 수백건 기준 의미 있음
- **구현 완료 (2026-04-25)**: `services/notification_service.py` 374줄(KakaoService + MessageService 래핑) + `NotificationHistory` 모델 + `/api/notifications` 11엔드포인트 + `pages/KakaoNotifications.jsx` 관리 UI(잔액/템플릿 검수현황/발송통계 + 팝빌 관리 3종 바로가기 + 빠른 테스트 발송 모달). payroll/contract/purchase_requests에서 사용 중.
- **사용자 선행작업**: ①카카오 비즈센터 플러스친구 채널 ②팝빌에 채널 연결 ③발신번호 등록 ④템플릿 검수 (1-3 영업일)
- **활성화**: 검수 통과 후 `NOTIFICATION_PROVIDER=popbill` 전환 → 즉시 사용

### Phase B — 사업자등록상태 조회 (3순위) · **완료**

- **구현 완료 (2026-04-25)**: `services/biz_check_service.py` ClosedownService 래핑(check_one/check_many) + `/api/biz-check` 단건+배치 + `VendorInfoManagement.jsx` "상태확인" 버튼 + 결과 배너
- **요금**: 건당 ~30원 · 즉시 작동 가능

### Phase C — 예금주조회 (4순위) · **완료**

- **구현 완료 (2026-04-25)**: `services/account_check_service.py` AccountCheckService 래핑(BANK_NAMES 23개 + 별칭 매핑) + `/api/account-check` + `ContractTab.jsx` 급여계좌 영역 강화(은행 드롭다운 + "예금주 자동확인" + 불일치 amber 경고)
- **요금**: 건당 ~50원

### Phase D — 전자세금계산서 (5순위) · **완료**

- **구현 완료 (2026-04-25)**: `services/taxinvoice_service.py` TaxinvoiceService 래핑(RegistIssue/getInfo/search/PopbillURL) + `routers/taxinvoice.py` 6엔드포인트(공급자는 현재 Business 자동 prefill) + `pages/TaxInvoice.jsx` 발행 페이지(팝빌 4종 바로가기 + 빠른 발행 폼 + VAT 10% 자동 계산 + 90일 이력)
- **선행작업**: 팝빌 인증서 등록 (CERT 바로가기 사용)
- **요금**: 건당 ~110원

### Phase E — 홈택스 수집 (6순위) · **완료**

- **구현 완료 (2026-04-25)**: `services/hometax_service.py` HTTaxinvoiceService 래핑(부서사용자 인증 + RequestJob/JobState/Search/Summary 비동기 모델) + `routers/hometax.py` 12엔드포인트 + `pages/HomeTaxCollect.jsx` 5단계 워크플로우(인증→수집요청→폴링 3초 주기→요약→리스트+CSV)
- **선행작업**: 홈택스 부서사용자 ID 발급 (마이홈택스 → 부서사용자 관리)
- **현금영수증 수집(HTCashbillService)은 별도 세션**

### Phase F — 계좌조회 (7순위) · **코드완료** / 팝빌 모듈 활성화 차단

- **구현 완료 (2026-04-25)**: `services/bank_sync_service.py` EasyFinBankService 래핑 + 30+ 엔드포인트 + 7섹션 UI(현재 상태/계좌 목록/수동 추가/진단/거래조회/거래목록/엑셀 업로드)
- **현재 상태**: 정액제 결제 완료 (2026-04-24, 신한 110-357-7XXXXX, ~05-24)했지만 live 환경에서 `listBankAccount` / `getBankAccountInfo` / `requestJob` 모두 `Popbill[-99010016] 사용할 수 없는 서비스` 차단. `getBalance` / `getBankAccountMgtURL`만 정상 → API 모듈 활성화 누락 패턴
- **다음 액션**: 팝빌 1:1 문의 답변 대기. 활성화 승인 → 수집/자동분류 검증 / 거부 → Excel 업로드 자동화로 선회

### Phase G — 기타 (8순위) · **부분 완료**

- ✅ **기업정보 조회 (BizInfoCheck)** — `services/bizinfo_check_service.py` + 거래처 "자동채움" 버튼(상호/대표/업태/종목/주소/규모/설립일 등)
- ✅ **현금영수증 발행 (Cashbill)** — `services/cashbill_service.py` + `pages/CashBill.jsx` 빠른 발행 페이지(소득공제용/지출증빙용 + VAT 자동 계산 + 90일 이력)
- ⏸️ 전자명세서 (거래명세서·청구서·견적서·발주서·입금표·영수증) — 미구현
- ⏸️ 카카오 친구톡 (광고성) — 미구현
- ⏸️ 휴대폰본인인증 — 미구현

## 기능 목록

| 기능 | 상태 | 담당 | 메모 |
|------|------|------|------|
| 직원 기본정보 CRUD | 완료 | - | 기본정보 탭 |
| 근태관리 (캘린더 기반) | 완료 | - | 인라인 모드로 전환 완료 |
| 급여 산출 및 명세서 | 완료 | - | 세금대납/총 보상액/실수령액 분리 |
| 계좌이체 실행 | 완료 | - | 세금대납 조건부 이체 금액 |
| 서류 업로드/관리 | 완료 | - | 다중 파일 + 미리보기 |
| 전자계약서 생성/발송 | 완료 | - | 카카오톡 알림톡 연동 |
| 직원 등급 관리 | 완료 | - | 정직원/아르바이트 |
| 퇴직금 산출 (인사기록카드 탭) | 완료 | - | RetirementTab.jsx |
| 외국인 고용안내 페이지 | 완료 | - | 비자별 상세 + 관공서 연락처 |
| 연차/휴가 관리 | 완료 | - | 한국 노동법 자동계산, 신청/승인/반려 |
| 인사변경이력 자동추적 | 완료 | - | PUT 시 StaffChangeLog 자동 기록 |
| 근로시간 모니터링 | 완료 | - | 주 48시간 초과 경고 |
| 교육/자격증 관리 | 완료 | - | 법정교육 5종 이수체크 |
| HR 알림 시스템 | 완료 | - | 계약만료, 서류미비, 수습종료 등 |
| HR 대시보드 | 완료 | - | 인력현황, 연차현황, 알림 통합 |
| 증명서 자동발급 (4종) | 완료 | - | 재직/경력/급여확인/퇴직 HTML |
| 5인 미만/이상 사업장 모드 | 완료 | - | 간편/전체 기능 자동 분리 |
| 팝빌 알림톡 발송 인프라 (Phase A) | 코드완료 | - | 카카오 검수 통과 후 popbill 활성 |
| 팝빌 사업자등록상태 조회 (Phase B) | 완료 | - | 거래처 "상태확인" 버튼 |
| 팝빌 예금주조회 (Phase C) | 완료 | - | 급여계좌 입력 시 "예금주 자동확인" |
| 팝빌 전자세금계산서 발행 (Phase D) | 완료 | - | /finance/tax-invoice |
| 팝빌 홈택스 자동 수집 (Phase E) | 완료 | - | /finance/hometax · 부서사용자 ID 등록 필요 |
| 팝빌 계좌조회 (Phase F) | 코드완료 | - | -99010016 차단, 팝빌 답변 대기 |
| 팝빌 기업정보 자동채움 (Phase G) | 완료 | - | 거래처 "자동채움" 버튼 |
| 팝빌 현금영수증 발행 (Phase G) | 완료 | - | /finance/cashbill |
| 연말정산 직원별 연간 소득·세금 집계 | 완료 | - | Payroll 12개월 자동 합산 (services/yearend/aggregator) |
| 연말정산 원천징수영수증 PDF 생성 (별지24/23) | 완료 | - | WeasyPrint HTML→PDF, /yearend/{year}/employees/{id}/draft-receipt.pdf |
| 연말정산 간소화 자료 PDF 업로드/파싱 | 완료 | - | 13 카테고리 합계 자동 추출 (services/yearend/parser) |
| 연말정산 환급/추가납부 표시 + 대조 검증 | 완료 | - | ±1k OK / ±10k Warning / 초과 Mismatch (services/yearend/reconciler) |
| 연말정산 직원앱 본인 조회/다운로드 + 감사 로그 | 완료 | - | /api/staff/yearend/* + YearEndAuditLog |
| 연말정산 자체 세법 계산 (Phase A 업그레이드) | 미시작 | - | StubTaxCalculator → StandardKoreanTaxCalculator 교체 (Roadmap Phase 4) |
