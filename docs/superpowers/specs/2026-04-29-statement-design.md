# 전자명세서(StatementService) 설계 문서

**날짜**: 2026-04-29
**작성**: Claude (brainstorming session)
**상태**: 승인 (자동 진행 권한 부여됨)
**관련 메모리**: `project_popbill_modules.md`
**관련 트랙**: 팝빌 운영전환 신청 → TEST 환경 전체 기능 완성 → LIVE 일괄 전환

---

## 1. 배경

### 1.1 비즈니스 배경

소담FN(셈하나) 은 휴게음식점 SaaS 로, 4/26 팝빌에 7종 모듈 활성화를 1:1 문의로 요청했고, 4/29 기준 TEST 환경에서 9개 모듈 권한이 부여됨(EasyFinBank·Fax·Taxinvoice·Statement·AccountCheck·SMS/LMS/MMS·알림톡 ATS). 그 중 **StatementService(전자명세서)는 권한은 부여됐지만 라우터·서비스·UI 가 모두 미구현** 상태라 라이브 사용 불가. 전체 기능 완성 후 운영전환 일괄 재신청이 사용자 결정 전략(2026-04-29).

사용자가 1:1 문의 본문에 명시한 요구사항:
> "6종 양식 모두 사용 예정: 거래명세서·청구서·견적서·발주서·입금표·영수증, 양식코드 등록 가능하도록 안내 부탁드립니다."

### 1.2 기존 자산

| 자산 | 위치 | 재사용 여부 |
|---|---|---|
| TaxinvoiceService 라우터·서비스 패턴 | `routers/taxinvoice.py`, `services/taxinvoice_service.py` | ★ 거의 그대로 차용 |
| `_build_issuer_from_business` 헬퍼 | `routers/taxinvoice.py` | 동일 로직 재사용 |
| Provider 추상화 (Stub/Popbill) | TaxInvoice·BankSync 등 8개 모듈 표준 | 표준 따름 |
| `popbill==1.64.1` SDK | 이미 설치 | `StatementService` 클래스 사용 |
| 환경변수 (`POPBILL_LINK_ID/SECRET_KEY/CORP_NUM/USER_ID/IS_TEST`) | `.env` + `Orbitron.yaml` 동기화 완료 | 그대로 사용 |

---

## 2. 의사결정 (Q1-Q4)

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 6종 양식 구현 범위 | **A** — 6종 모두 한 번에 구현 |
| Q2 | 양식별 특수 필드 처리 | **B** — 양식 선택 시 conditional 필드 동적 노출 |
| Q3 | 공급받는자 전달 방식 | **B** — 자동 이메일 발송 + 발행 후 팩스/SMS 추가 발송 옵션 |
| Q4 | DB 이력 저장 여부 | **B** — 가벼운 메타 저장(`Statement` 모델 신규) |

### 추가 결정 (자동 진행 권한 행사)

- **사용자 정의 양식코드 등록**: MVP 에서 표준 6종(121~126) 우선. 사용자 정의 양식코드는 `form_code` 필드로 받아 SDK 에 그대로 전달(빈값이면 기본 양식). 별도 UI 없음 — 양식 등록·관리는 팝빌 콘솔 사용.
- **양식별 특수 필드 매핑**: SDK 의 `Statement` 객체가 `**kwargs` 동적 객체라 `propertyBag`/`remark1~3`/직접 attribute 셋 모두 가능. **MVP 에서 `propertyBag` 우선 시도** → 라이브 호출 검증 단계에서 실제 작동하는 매핑으로 확정.
- **사이드바 위치**: "재무·회계" 그룹 안, 전자세금계산서 메뉴 아래에 "전자명세서" 메뉴 추가.
- **라우트**: `/finance/statement`.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React + Vite, port 5173)                           │
│  pages/Statement.jsx (단일 페이지)                          │
│   ├─ FormCodeSelect (6종 셀렉트)                             │
│   ├─ StatementForm (공통 + 양식별 conditional)               │
│   ├─ StatementHistory (DB+팝빌 search 병합)                  │
│   └─ StatementDetailModal (상세+팩스/SMS 추가 발송)          │
└─────────────────────────────────────────────────────────────┘
                            ▼ /api/statement/*
┌─────────────────────────────────────────────────────────────┐
│ Backend (FastAPI, port 8000)                                 │
│  routers/statement.py — 8 엔드포인트                         │
│  services/statement_service.py — Provider 추상화             │
│  models.py::Statement — 가벼운 메타 모델                     │
│  init_db._run_migrations — ALTER TABLE 자동                  │
└─────────────────────────────────────────────────────────────┘
                            ▼ popbill SDK 1.64.1
┌─────────────────────────────────────────────────────────────┐
│ Popbill StatementService (TEST 환경, 50원/건)               │
│  ItemCode: 121(거래명세서) 122(청구서) 123(견적서)           │
│            124(발주서) 125(입금표) 126(영수증)               │
│  핵심 메서드: registIssue · search · getInfo · sendFAX       │
│              · sendSMS · cancel · attachStatement            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Backend 설계

### 4.1 `services/statement_service.py`

`taxinvoice_service.py` 패턴 그대로 차용. 차이점만 명시:

#### Dataclasses

```python
@dataclass
class StatementDetail:
    serialNum: int          # 1부터
    purchaseDT: str         # YYYYMMDD
    itemName: str
    qty: str = "1"
    unitCost: str = "0"
    supplyCost: str = "0"
    tax: str = "0"
    spec: str = ""
    remark: str = ""

@dataclass
class StatementDraft:
    item_code: str          # ★ "121"~"126" 또는 사업장 등록 코드
    mgt_key: str
    write_date: str         # YYYYMMDD
    form_code: str = ""     # ★ 사업장 등록 양식코드 (선택, 빈값=기본)
    tax_type: str = "과세"
    purpose_type: str = "영수"
    # 공급자 (sender)
    sender_corp_num: str
    sender_corp_name: str
    sender_ceo_name: str = ""
    sender_addr: str = ""
    sender_biz_class: str = ""
    sender_biz_type: str = ""
    sender_contact_name: str = ""
    sender_email: str = ""
    sender_tel: str = ""
    # 공급받는자 (receiver)
    receiver_corp_num: str = ""
    receiver_corp_name: str = ""
    receiver_ceo_name: str = ""
    receiver_addr: str = ""
    receiver_email: str = ""
    receiver_tel: str = ""
    # 금액
    supply_cost_total: str = "0"
    tax_total: str = "0"
    total_amount: str = "0"
    # 양식별 특수 필드
    property_bag: dict = field(default_factory=dict)
    remark1: str = ""
    remark2: str = ""
    remark3: str = ""
    detail_list: list[StatementDetail] = field(default_factory=list)
    email_subject: str = ""

@dataclass
class StatementResult:
    ok: bool
    item_code: Optional[str] = None
    mgt_key: Optional[str] = None
    receipt_num: Optional[str] = None
    issue_dt: Optional[str] = None
    error: Optional[str] = None
```

#### Provider

```python
class BaseStatementProvider:
    name = "base"
    def issue(self, draft: StatementDraft) -> StatementResult: ...
    def get_info(self, item_code: str, mgt_key: str) -> dict: ...
    def search(self, *, item_code: str, s_date: str, e_date: str,
               state: list, page: int, per_page: int) -> dict: ...
    def send_fax(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str) -> dict: ...
    def send_sms(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str, content: str) -> dict: ...
    def get_popbill_url(self, togo: str = "BOX",
                        user_id: Optional[str] = None) -> str: ...

class DevStubProvider(BaseStatementProvider):
    name = "stub"
    # 모든 메서드 stub 응답

class PopbillStatementProvider(BaseStatementProvider):
    name = "popbill"
    # POPBILL_LINK_ID/SECRET_KEY 사용, IsTest 토글, _build_statement 헬퍼
```

#### `_build_statement` 헬퍼

```python
def _build_statement(self, draft: StatementDraft):
    from popbill.statementService import Statement, StatementDetail as SDKDetail

    details = [SDKDetail(...) for d in draft.detail_list]

    s = Statement(
        writeDate=draft.write_date,
        formCode=draft.form_code or "",
        taxType=draft.tax_type,
        purposeType=draft.purpose_type,
        # 공급자
        senderCorpNum=draft.sender_corp_num,
        senderMgtKey=draft.mgt_key,
        senderCorpName=draft.sender_corp_name,
        senderCEOName=draft.sender_ceo_name,
        senderAddr=draft.sender_addr,
        senderBizClass=draft.sender_biz_class,
        senderBizType=draft.sender_biz_type,
        senderContactName=draft.sender_contact_name,
        senderEmail=draft.sender_email,
        senderTEL=draft.sender_tel,
        # 공급받는자
        receiverCorpNum=draft.receiver_corp_num,
        receiverCorpName=draft.receiver_corp_name,
        receiverCEOName=draft.receiver_ceo_name,
        receiverAddr=draft.receiver_addr,
        receiverEmail=draft.receiver_email,
        receiverTEL=draft.receiver_tel,
        # 금액
        supplyCostTotal=str(draft.supply_cost_total),
        taxTotal=str(draft.tax_total),
        totalAmount=str(draft.total_amount),
        # 비고
        remark1=draft.remark1,
        remark2=draft.remark2,
        remark3=draft.remark3,
        detailList=details,
    )
    # 양식별 특수 필드 (property_bag → SDK 추가 attribute)
    for k, v in (draft.property_bag or {}).items():
        setattr(s, k, v)
    return s
```

#### `get_provider()`

env `STATEMENT_PROVIDER` override → 자동 detection (`POPBILL_LINK_ID`+`SECRET_KEY` 있으면 popbill, 없으면 stub).

### 4.2 `routers/statement.py`

`prefix = "/statement"`. 모든 엔드포인트 `Depends(get_admin_user)` + `Depends(get_bid_from_token)`.

```python
GET  /status                      # provider 활성/stub
GET  /issuer                      # 사업장 prefill (TaxInvoice 와 동일 로직)
GET  /form-codes                  # 양식 6종 메타 (코드/이름/기본 taxType/conditional 필드 명세)
POST /issue                       # DB INSERT → 팝빌 registIssue → DB UPDATE
GET  /search                      # ?item_code=121&s_date=&e_date=&page=1
GET  /info/{mgt_key}              # ?item_code=121
POST /{mgt_key}/send-fax          # ?item_code=121 + body: receiver_fax
POST /{mgt_key}/send-sms          # ?item_code=121 + body: receiver_phone, content
GET  /popbill-url                 # ?togo=BOX
```

#### `/form-codes` 응답 (frontend conditional 필드 동적 렌더링용)

```json
[
  {
    "code": "121",
    "name": "거래명세서",
    "default_tax_type": "과세",
    "default_purpose_type": "영수",
    "extra_fields": []
  },
  {
    "code": "122",
    "name": "청구서",
    "default_tax_type": "과세",
    "default_purpose_type": "청구",
    "extra_fields": [
      {"key": "deadline_date", "label": "납기일", "type": "date"},
      {"key": "deposit_account", "label": "입금계좌", "type": "text"}
    ]
  },
  {
    "code": "123",
    "name": "견적서",
    "default_tax_type": "과세",
    "default_purpose_type": "청구",
    "extra_fields": [
      {"key": "validity_date", "label": "견적유효기간", "type": "date"}
    ]
  },
  {
    "code": "124",
    "name": "발주서",
    "default_tax_type": "과세",
    "default_purpose_type": "청구",
    "extra_fields": [
      {"key": "delivery_date", "label": "납기일", "type": "date"},
      {"key": "delivery_place", "label": "납품장소", "type": "text"}
    ]
  },
  {
    "code": "125",
    "name": "입금표",
    "default_tax_type": "면세",
    "default_purpose_type": "영수",
    "extra_fields": [
      {"key": "deposit_date", "label": "입금일", "type": "date"},
      {"key": "depositor", "label": "입금자", "type": "text"}
    ]
  },
  {
    "code": "126",
    "name": "영수증",
    "default_tax_type": "면세",
    "default_purpose_type": "영수",
    "extra_fields": [
      {"key": "receiver_name", "label": "영수자", "type": "text"}
    ]
  }
]
```

### 4.3 `models.py::Statement` 신규

```python
class Statement(SQLModel, table=True):
    __tablename__ = "statement"
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    item_code: str = Field(index=True, max_length=10)
    mgt_key: str = Field(index=True, max_length=64)
    write_date: str = Field(max_length=8)            # YYYYMMDD
    total_amount: str = Field(default="0", max_length=20)
    receiver_corp_num: str = Field(default="", max_length=20)
    receiver_corp_name: str = Field(default="", max_length=200)
    status: str = Field(default="issued", max_length=20)  # issued/cancelled/failed/pending
    receipt_num: Optional[str] = Field(default=None, max_length=64)
    error_message: Optional[str] = Field(default=None)
    email_sent_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
```

#### 마이그레이션

`init_db._run_migrations` 끝에 추가:

```python
# Statement 테이블 자동 생성 (sqlmodel.SQLModel.metadata.create_all 가 처리하지만,
# 인덱스 보강은 별도)
try:
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_statement_bid_item_date "
                          "ON statement (business_id, item_code, write_date)"))
except Exception:
    pass
```

#### 인덱스

- `(business_id, item_code, write_date DESC)` — 사업장별 양식별 시간순 정렬
- `(business_id, mgt_key)` — 단건 조회

---

## 5. Frontend 설계

### 5.1 `pages/Statement.jsx` (단일 페이지, ~600줄)

`pages/TaxInvoice.jsx` 패턴 차용. 주요 컴포넌트:

#### 상단 영역
- 양식 셀렉트 `<FormCodeSelect/>` (6종) — `useEffect` 로 `/api/statement/form-codes` 페치 → 셀렉트 옵션
- 발행 버튼 / 새로고침 / 팝빌 콘솔 진입

#### `<StatementForm/>` (탭 1)

**공통 필드** (모든 양식):
- 작성일자(YYYYMMDD)
- 공급자 (자동 prefill — `/api/statement/issuer` 사업장 정보)
- 공급받는자 (사업자번호·상호·대표자·주소·이메일·전화)
- 품목 리스트 (purchaseDT·itemName·qty·unitCost·supplyCost·tax·spec·remark)
- 금액 합계 (자동 계산)
- 비고 (remark1)
- 자동 발송 이메일 제목 (비어있으면 자동 발송 안 함)

**양식별 conditional 필드** (양식 선택 시 동적 렌더링):
- `formCodeMeta.extra_fields` 순회 → 각 필드 `<input>` 생성
- 입력값 → `property_bag` 객체에 누적

#### `<StatementHistory/>` (탭 2)

DB+팝빌 병합 결과 테이블:
- 컬럼: 양식·작성일·공급받는자·금액·상태·발송여부·작업
- 양식 필터·기간 필터·검색
- 페이지네이션
- 행 클릭 → `<StatementDetailModal/>`

#### `<StatementDetailModal/>`

- 발행 정보 (양식·작성일·금액·상태·receipt_num)
- 공급자/공급받는자 정보
- 품목 리스트
- 액션 버튼:
  - "팩스 발송" → 받는자 팩스번호 입력 → `POST /{mgt_key}/send-fax`
  - "SMS 발송" → 받는자 전화·내용 → `POST /{mgt_key}/send-sms`
  - "팝빌 콘솔 열기" → `GET /popbill-url?togo=BOX` 응답 URL 새 탭

### 5.2 라우트 + 사이드바

#### `App.jsx`

```jsx
const Statement = React.lazy(() => import('./pages/Statement'));
// ...
<Route path="/finance/statement" element={<ProtectedRoute adminOnly><Statement /></ProtectedRoute>} />
```

#### `Sidebar.jsx`

"재무·회계" 그룹 메뉴 배열에 한 줄 추가:
```jsx
{ icon: FileText, label: '전자명세서', path: '/finance/statement', color: 'text-amber-400' },
```
(전자세금계산서 바로 아래)

또한 `plPaths` 배열에 `'/finance/statement'` 추가 (P&L 그룹 활성 표시용).

---

## 6. Data Flow

### 6.1 발행 (가장 복잡한 흐름)

```
[Frontend]
StatementForm 입력 → 검증 → POST /api/statement/issue { item_code, ..., property_bag, ... }

[Backend routers/statement.py::issue_statement]
1. 사업장 컨텍스트 검증 (bid 필수)
2. 공급자 정보 자동 채움 (_build_issuer_from_business)
3. mgt_key 생성 (없으면 `SDM{itemCode}{YYYYMMDDHHMMSS}`)
4. DB INSERT (status=pending)
5. provider.issue(draft) 호출
   ├─ provider 가 _build_statement(draft) 로 SDK Statement 객체 빌드
   ├─ property_bag → setattr 로 SDK 객체에 추가 attribute
   ├─ svc.registIssue(corp, statement, Memo=remark, UserID=user_id, EmailSubject=email_subject)
   └─ 응답 받아 StatementResult 빌드
6. 결과에 따라 DB UPDATE
   ├─ ok=True: status=issued, receipt_num, email_sent_at(이메일 발송한 경우)
   └─ ok=False: status=failed, error_message
7. 200 응답

[Frontend]
응답 → toast (성공/실패) → StatementHistory 새로고침 트리거
```

### 6.2 검색 (DB+팝빌 병합)

```
GET /api/statement/search?item_code=121&s_date=20260101&e_date=20260429

1. DB query: SELECT * FROM statement
   WHERE business_id = bid AND item_code = '121'
     AND write_date BETWEEN s_date AND e_date
   ORDER BY write_date DESC, id DESC
   LIMIT per_page OFFSET (page-1)*per_page

2. 팝빌 search 병렬 호출 (status 동기화 목적)
   svc.search(corp, "W", s_date, e_date, [], "121", page, per_page, "D", user_id)

3. 병합:
   - DB 행이 우선 (sodam 측 메타 + receipt_num)
   - 팝빌 행 중 DB 에 없는 항목은 별도 표시 ("외부 발행" — 다른 시스템에서 발행한 것)

4. 응답: { total, list, page, per_page }
```

### 6.3 자동 prefill

```
GET /api/statement/issuer
→ session.get(Business, bid) → settings_json 파싱 → 공급자 dict 반환
  {corp_num, corp_name, ceo_name, addr, biz_class, biz_type, contact_name, email, tel}
```

`pages/Statement.jsx` 마운트 시 1회 페치 → 공급자 필드 자동 채움.

### 6.4 추가 발송 (팩스/SMS)

```
POST /api/statement/{mgt_key}/send-fax?item_code=121
body: { sender_fax, receiver_fax }

provider.send_fax(item_code, mgt_key, sender_fax, receiver_fax)
→ svc.sendFAX(corp, item_code, mgt_key, sender_fax, receiver_fax, user_id)
→ receipt_num 응답
```

SMS 도 동일 패턴 (sender_phone, receiver_phone, content).

---

## 7. Error Handling

| 시나리오 | HTTP | 응답 | UI 동작 |
|---|---|---|---|
| 사업장 정보 누락 | 400 | "사업장 정보가 없습니다" | 환경설정 안내 |
| 공급자 사업자번호 미설정 | 400 | "사업자등록번호가 설정되지 않았습니다 (환경설정 > 회사정보 관리)" | 설정 페이지 링크 |
| `mgt_key` 충돌 | (자동 재생성) | - | 투명 |
| 팝빌 `-99910002` (TEST 권한 미부여) | 200 + ok:false | "팝빌 운영전환 신청 또는 1:1 추가 활성화 필요" | 토스트 + 운영전환 URL 안내 |
| 팝빌 `-99010016` (LIVE 미활성) | 200 + ok:false | "운영전환 신청 폼 제출 필요" | URL 안내 |
| 팝빌 `-10000038` (UserID 누락) | 200 + ok:false | "POPBILL_USER_ID env 점검 필요" | 관리자에게 보고 |
| 발행 성공 + 자동 이메일 실패 | 200 + ok:true + email_warn | "발행은 성공했지만 자동 이메일 발송 실패" | 토스트 (warning) |
| `Statement` 모델 마이그레이션 실패 | (서버 시작 실패) | - | 로그 확인 |
| 팩스 추가 발송 실패 (발신번호 미인증) | 200 + ok:false | "발신번호 사전등록 필요" | 안내 |

---

## 8. Testing & 라이브 검증

### 8.1 라이브 검증 시나리오

**`scratch_popbill_routers.py` 에 추가**:

```python
print("\n=== 5) 전자명세서 라이브 검증 (TEST 환경) ===")

# /status
show("/api/statement/status",
     httpx.get(f"{BASE}/api/statement/status", headers=H, timeout=15))

# /form-codes
show("/api/statement/form-codes",
     httpx.get(f"{BASE}/api/statement/form-codes", headers=H, timeout=15))

# /issuer
show("/api/statement/issuer",
     httpx.get(f"{BASE}/api/statement/issuer", headers=H, timeout=15))

# 거래명세서(121) 발행 시도 (자기 사업자번호 → 자기 사업자번호)
issue_body = {
    "item_code": "121",
    "write_date": date.today().strftime("%Y%m%d"),
    "tax_type": "과세",
    "purpose_type": "영수",
    "receiver_corp_num": SELF_CORP,
    "receiver_corp_name": "소담FN(테스트)",
    "receiver_email": "test@sodam.example",
    "supply_cost_total": "10000",
    "tax_total": "1000",
    "total_amount": "11000",
    "remark1": "라이브 검증 테스트",
    "details": [{
        "purchaseDT": date.today().strftime("%Y%m%d"),
        "itemName": "테스트 항목",
        "qty": "1", "unitCost": "10000",
        "supplyCost": "10000", "tax": "1000"
    }],
    "property_bag": {},
    "email_subject": ""  # 자동 이메일 발송 안 함
}
show("POST /api/statement/issue (거래명세서)",
     httpx.post(f"{BASE}/api/statement/issue",
                headers={**H, "Content-Type": "application/json"},
                json=issue_body, timeout=20))

# 검색
show("/api/statement/search?item_code=121",
     httpx.get(f"{BASE}/api/statement/search?item_code=121", headers=H, timeout=15))
```

### 8.2 검증 통과 기준

- `/status` → `{"active": "popbill", "is_stub": false}`
- `/form-codes` → 6개 양식 메타 정상 반환
- `/issuer` → 사업장 정보 정상 prefill
- `POST /issue` → 200 + ok:true + receipt_num 받음 (또는 ok:false + 명확한 에러)
- `/search` → 위 발행 항목이 list 에 포함됨

### 8.3 메모리 갱신

검증 통과 후 `project_popbill_modules.md` 의 `StatementService` 행:
- 기존: "✅ 권한 부여 (4/29) — 단가 50원/건 양식코드 121. **라우터 미구현이라 사용 불가**"
- 정정: "✅ 활성 + 라우터 구현 완료 (4/29) — 6종 양식 발행/검색/추가발송 모두 구현"

### 8.4 Unit test 미포함 이유

- 기존 taxinvoice/cashbill/notifications 등 8개 모듈 모두 unit test 없이 운영 중
- 라이브 검증(scratch_popbill_routers.py) 으로 회귀 방지 패턴 정착됨
- Unit test 도입은 별도 트랙 (전체 모듈 일괄 표준화 시점에 진행)

---

## 9. Out of Scope (이번 트랙 제외)

- **사용자 정의 양식코드 등록 UI** — 팝빌 콘솔에서 직접 등록 가정. `form_code` 필드만 받아서 SDK 에 전달.
- **양식 PDF 미리보기** — 별도 트랙 (WeasyPrint 또는 팝빌 viewer URL 활용).
- **자동 청구 (월말 자동 발행)** — 별도 트랙. 현 모델로 가능한 구조.
- **`attachStatement`** (다른 양식 묶기) — 별도 트랙. 현재 단일 양식 발행만.
- **매출/매입관리 자동 연동** — 별도 트랙. 거래명세서 발행 ≠ 매출 인식 시점이라 직접 연동 안 함.
- **`StatementDetail` 별도 테이블** — 품목 단위 검색·통계가 필요해질 때 후속 트랙.

---

## 10. Implementation 순서

1. **Backend 모델·마이그레이션** (`models.py::Statement` + `init_db`)
2. **Backend service** (`services/statement_service.py` — 전체 Provider + dataclass + `_build_statement`)
3. **Backend router** (`routers/statement.py` — 8 엔드포인트)
4. **Backend `main.py` include**
5. **백엔드 재시작 + 라이브 검증 1차** (`scratch_popbill_routers.py` 시나리오 5)
6. **Frontend page** (`pages/Statement.jsx` — Form + History + DetailModal)
7. **Frontend route + sidebar** (`App.jsx` + `Sidebar.jsx`)
8. **Frontend dev 검증** (vite 띄워서 화면 확인)
9. **메모리 갱신** (`project_popbill_modules.md`)
10. **커밋 + 푸시** (가능하면 Backend / Frontend 두 commit 분리)

---

## 11. 변경 영향 (체크리스트)

- [x] 환경변수 추가 없음 (기존 `POPBILL_*` 재사용, `Orbitron.yaml` 동기화 불필요)
- [x] 신규 DB 테이블 1개 (`statement`)
- [x] 신규 백엔드 라우터 1개 (`/api/statement/*`)
- [x] 신규 프론트엔드 페이지 1개 (`/finance/statement`)
- [x] 사이드바 메뉴 1개 추가 (재무·회계 그룹)
- [x] 기존 코드 변경 거의 없음 (`main.py` 라우터 등록 1줄, `App.jsx` 라우트 1줄, `Sidebar.jsx` 메뉴 1줄)
- [x] [HEAD] DevWorkLog 업그레이드 필요 (신규 라우터·모델·페이지·사이드바 변경)
