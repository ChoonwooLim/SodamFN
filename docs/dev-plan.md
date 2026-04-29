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
| 7 | 외부 통합 전략 — 팝빌+CODEF 하이브리드 (조회/수집=CODEF 점진 도입) | 시작 | 2026-05~07 |
| 8 | 영업관리 V1 — 처음 사업 시작하는 사장님용 가이드 (휴게음식점 38항목) | 완료 | 2026-04-25 |

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

### Phase F — 계좌조회 (7순위) · **TEST 검증 진행 중** (2026-04-27 업데이트)

- **구현 완료 (2026-04-25)**: `services/bank_sync_service.py` EasyFinBankService 래핑 + 30+ 엔드포인트 + 7섹션 UI
- **2026-04-27 진전**:
  - LIVE `-99010016` 차단 지속 → 팝빌 1:1 답변 권고대로 TEST 환경에서 검증 진행
  - test.popbill.com 에 신한 110-357-7***** 등록(사용기간 ~2026-06-04), 시뮬레이션 거래 411건 적재 검증 완료
  - `POPBILL_BANK_IS_TEST` toggle + `POPBILL_IS_TEST` fallback → Orbitron 재배포만으로 TEST 모드 자동 진입
  - 헤더 배지·안내 박스에 STUB/TEST/LIVE 3색 분기
  - `_materialize_link` 를 `DailyExpense` 기반으로 재작성 → 매출관리/매입관리와 자동분류 결과 연동
  - `linked_daily_id` 컬럼 신규 + auto-migration, `REVENUE_CHANNEL_MAP` 31개 키워드, 학습 패턴(80% threshold + manual 2배 가중), 출금 default expense
  - `/pull` 끝에 자동분류 즉시 실행, `/api/bank-sync/refresh-all` 신규(skip_recent_minutes 중복 방지)
  - 21분 단위 자동 갱신 (`AutoRefreshControl`, localStorage 영속화) + 거래내역 탭 타이틀 동적 변경
- **다음 액션**:
  - 운영 매뉴얼 검증 — 자동분류 결과 + 매출관리/매입관리 노출 확인
  - LIVE 활성화 후 `POPBILL_BANK_IS_TEST=false` 토글 + 계좌 재등록
  - 24/7 백그라운드 자동 갱신 (Orbitron cron 으로 `/refresh-all` 호출, 현재는 페이지 열려있을 때만)

### Phase G — 기타 (8순위) · **부분 완료**

- ✅ **기업정보 조회 (BizInfoCheck)** — `services/bizinfo_check_service.py` + 거래처 "자동채움" 버튼(상호/대표/업태/종목/주소/규모/설립일 등)
- ✅ **현금영수증 발행 (Cashbill)** — `services/cashbill_service.py` + `pages/CashBill.jsx` 빠른 발행 페이지(소득공제용/지출증빙용 + VAT 자동 계산 + 90일 이력)
- ⏸️ 전자명세서 (거래명세서·청구서·견적서·발주서·입금표·영수증) — 미구현
- ⏸️ 카카오 친구톡 (광고성) — 미구현
- ⏸️ 휴대폰본인인증 — 미구현

## 외부 통합 전략 — 팝빌 + CODEF 하이브리드 (2026-04-25 결정)

**Why**: 2026-04-25 팝빌 EasyFinBank `-99010016` 차단 사건 → 단일 provider 의존 리스크 회피.

**원칙**: 팝빌 = 발급/전송 ASP, CODEF = 마이데이터 조회/수집. 경쟁자 아니라 보완재.

### 도메인별 채택

| 영역 | 채택 | 비고 |
|---|---|---|
| 팩스·세금계산서·알림톡·현금영수증 발행 | **팝빌** | 발행기관 자격 필요 영역, 팝빌 강점 |
| 사업자등록·기업정보·예금주조회 | 팝빌 | 이미 운영 중 (Phase B/C/G) |
| 홈택스 수집 | 팝빌 → CODEF 마이그레이션 검토 | 데이터 신선도 비교 후 |
| **계좌 거래내역** | **CODEF primary**, 팝빌 backup | 팝빌 차단 보험 |
| **카드 사업자 매출** (CREFIA 우회) | **CODEF only** | 팝빌 미제공, 신규 가치 |
| **4대보험 자격득실/지원금** | **CODEF only** | 인사관리 자동화 |
| 부동산 등기부 | CODEF | 우선순위 낮음 |

### 어댑터 패턴 표준

```
backend/services/{domain}/
├── popbill_provider.py
├── codef_provider.py
└── factory.py    # env BANK_SYNC_PROVIDER=popbill|codef
```

→ 한 채널 차단 시 즉시 전환 가능. 단일 장애점 회피.

### 실행 우선순위

1. CODEF DEMO 가입 (3개월 무료 일 100건)
2. **카드 사업자 매출 통합** (CODEF only, 가장 큰 신규 가치)
3. **EasyFinBank 백업** (CodefProvider, 팝빌 차단 보험)
4. **4대보험 자격득실** (직원 입사 자동 검증)
5. 팝빌 정액제 4종(월 45만원) 사용량 검토 → 활용 빈도 낮은 모듈 해지

### 참조

- 깊이 비교: `C:/WORK/llm-wiki/40-Tools/Popbill-vs-CODEF.md` (10항목 분석)
- 통합 결정 SSOT: `C:/WORK/llm-wiki/60-Projects/SodamFN.md` § 9. 외부 통합 전략

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
| CODEF 가입 + DEMO PoC | 시작 예정 | - | 3개월 무료 일 100건. 팝빌 EasyFinBank 백업 우선 검증 |
| CODEF 카드 사업자 매출 통합 | 미시작 | - | /v1/kr/card/common/b/approval — CREFIA 우회 핵심 |
| CODEF EasyFinBank 백업 (CodefProvider) | 미시작 | - | services/bank_sync/codef_provider.py + factory + env 스위치 |
| CODEF 4대보험 자격득실 자동 검증 | 미시작 | - | Staff 입사 시 자동 토글 |

---

## CODEF 26개 패키지 상품 카탈로그 (2026-04-29 회원가입 후 정리)

> 출처: codef.io 회원 후 전체상품 카탈로그 (개별 API 가 아닌 패키지 단위, 26 종)
> 가격·인증·자세한 도큐먼트는 **C:/WORK/llm-wiki/40-Tools/CODEF.md** SSOT 참조.
> 분류 기준: 셈하나 (휴게음식점 SaaS) 입장에서의 가치 평가.

### A. 高 가치 — 즉시 검토 / 1차 PoC 후보

| # | 상품 | 채택 사유 | 셈하나 적용 영역 |
|---|---|---|---|
| 7 | **빠른계좌 조회** [개인/기업, NEW] | 팝빌 EasyFinBank 차단(-99010016) 백업. CodefProvider 어댑터 패턴 이미 설계됨 | `services/bank_sync/codef_provider.py` 신규 → `BANK_SYNC_PROVIDER=codef` 스위치 |
| 15 | **인사/임금 관리** [개인/기업] | 셈하나 HR 핵심. 4대보험 가입/납부/지급/신고 통합. 임금·세무대행·세무대리인·건강보험공단 데이터 | HR 자동화 — 직원 입사 시 4대보험 자격 자동 검증 + 급여 신고 자동화 |
| 22 | **4대보험 통합 조회** [개인/기업] | 직원 입사 자동 검증. 국민연금·건강보험·고용보험·산재 통합 | Staff 입사 처리 시 자동 토글 |

### B. 中 가치 — 후속 검토

| # | 상품 | 검토 사유 |
|---|---|---|
| 1 | 고용/산재보험 적용요율 조회 [개인/기업, NEW] | 직원 입사 시 보험료 계산 자동화 |
| 2 | 세금 납부 증명 발급 [개인/기업, NEW PICK] | 거래처 제출용 자동 발급 (지방세·납부내역·납부결제) |
| 4 | 세무신고&경정청구 패키지 [개인/기업, BEST PICK] | 종합소득세·경정청구 자동화 (사장님 절세) |
| 8 | 사업자 증빙정보 조회 [개인/기업, BEST PICK] | 거래처 신용평가 (대출심사·사업자대출용) |
| 10 | 개인 소득정보 통합 조회 [개인, BEST PICK] | 직원 소득증명 자동 (입사 시 검증, 비대면 대출 신청 등) |
| 11 | 기업 자금정보 패키지 [개인/기업, BEST] | 다중 금융사 거래현황 통합 (회계 자동화) |
| 13 | 신분증 OCR [개인] | 직원 입사 시 자동 인식 (주민등록증·운전면허증·여권·외국인등록증) |
| 14 | 종합소득세 신고 패키지 [개인/기업, BEST] | 사장님 종소세 신고 자동 |
| 16 | 신분증 진위확인 [개인, BEST] | 신분증 OCR 와 연계, 직원 신원 검증 |
| 21 | 증명서 진위확인 [개인/기업] | 자격증·재직증명·졸업증명 진위 확인 (오프라인/온라인 발급 모두) |

### C. 低 가치 — 셈하나 운영과 거리

| # | 상품 | 비고 |
|---|---|---|
| 3 | 부동산 공시가격 조회 [개인, NEW] | 식당 운영과 무관 |
| 6 | 내보험다보여 [개인, NEW] | 사장님 개인 보험 조회용 |
| 9 | 기업 신용평가 패키지 [개인/기업, BEST PICK] | 거래처 신용평가까지는 식당 단계 X |
| 17 | 운전면허 정보 조회 [개인] | 배달 직원이 있을 때 가치 (현재 X) |
| 18 | 헬스케어 패키지 [개인, BEST PICK] | 셈하나 영역 외 |
| 19 | 부동산 정보 조회 [개인, PICK] | 셈하나 영역 외 |
| 20 | 자녀(영유아) 진료정보 조회 [개인] | 셈하나 영역 외 |
| 23 | 연금 및 노후재무설계 조회 [개인] | 셈하나 영역 외 |
| 24 | 개인 비대면 대출 [개인/기업] | 셈하나 영역 외 |
| 25 | 개인 자산관리 패키지 [개인/기업, BEST PICK] | 사장님 개인 자산이라 셈하나 영역 X |
| 26 | 건설업 증명서 조회/발급 종합 패키지 [기업, BEST] | 식당과 무관 |

### D. 채택 안 함 — 팝빌 중복

| # | 상품 | 사유 |
|---|---|---|
| 5 | 전자세금계산서 발행 [기업, BEST PICK] | 팝빌 TaxinvoiceService 운영 중 (4/29 풀세트 완료). 중복 도입 불필요 |
| 12 | 사업자 등록 상태 증명 [기업, BEST] | 팝빌 ClosedownService 운영 중. 중복 |

### CODEF 도입 단계별 PoC 우선순위

**1차 (DEMO 환경, 무료)**:
1. `7. 빠른계좌 조회` — `services/bank_sync/codef_provider.py` 어댑터 추가 + 환경변수 스위치(`BANK_SYNC_PROVIDER=codef`). 코드 변경 최소.
2. **카드 사업자 매출 통합** — 화면에 직접 안 보이지만 CODEF 카탈로그 별도 영역(개별 API). CREFIA 우회 핵심. wiki CODEF.md 의 카드 매출(b/approval) 영역 확인.

**2차**:
3. `22. 4대보험 통합 조회` + `15. 인사/임금 관리` — HR 자동화 묶음.

**3차** (사용자 가치 따라):
4. `13. 신분증 OCR` + `16. 신분증 진위확인` — 직원 입사 자동화.
5. `1. 고용/산재보험 적용요율 조회` — 보험료 자동 계산.

### CODEF 채택 안 한 영역 — 팝빌 유지

전자세금계산서·전자명세서·현금영수증·홈택스 수집·팩스·SMS·알림톡 = **팝빌 SODAM LinkID 통합 운영**.
CODEF 가 같은 영역도 제공하지만 셈하나는 **발급/전송 ASP = 팝빌, 조회/수집 = CODEF** 분담 원칙
(외부 통합 전략 메모리 `project_external_integration_strategy.md`, 4/25 결정).
