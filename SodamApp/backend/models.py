from typing import Optional, List
from sqlmodel import Field, Session, SQLModel, create_engine, select, Relationship
from sqlalchemy import Index, UniqueConstraint
import datetime
from datetime import time, date

# --- Multi-Tenant (SaaS) ---

class SubscriptionPlan(SQLModel, table=True):
    """SaaS 요금제"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)  # 무료, 기본, 프리미엄
    price_monthly: int = 0  # 월 이용료 (원)
    price_yearly: int = 0   # 연 이용료 (원)
    max_staff: int = 5       # 최대 직원 수
    max_revenue_entries: int = 1000  # 월 최대 매출 건수
    features_json: Optional[str] = None  # 포함 기능 (급여, 재무, POS 등)
    is_active: bool = True

    # 자동수집 파이프라인 — 요금제별 기능 플래그
    feature_auto_collection: bool = Field(default=False)
    feature_fee_auto_estimate: bool = Field(default=False)

class Business(SQLModel, table=True):
    """사업장 (테넌트)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)  # 사업장명 (예: 소담김밥)
    business_number: Optional[str] = None  # 사업자등록번호
    business_type: str = Field(default="음식점")  # 음식점, 소매, 서비스업
    owner_name: Optional[str] = None  # 대표자명
    phone: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None  # 지역 (서울, 경기, 부산 등)
    
    # 요금제
    plan_id: Optional[int] = Field(default=None, foreign_key="subscriptionplan.id")
    plan: Optional[SubscriptionPlan] = Relationship()
    subscription_status: str = Field(default="active")  # active, suspended, cancelled
    subscription_start: Optional[datetime.date] = None
    subscription_end: Optional[datetime.date] = None
    
    # 사업장 규모 모드
    employee_scale: str = Field(default="over5")  # "under5" = 5인 미만 (간편모드), "over5" = 5인 이상 (전체기능)

    # 메타
    is_active: bool = True
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    settings_json: Optional[str] = None  # 업종별 맞춤 설정 (JSON)
    logo_url: Optional[str] = None  # 회사 로고 이미지 URL
    
    # Relationships
    users: List["User"] = Relationship(back_populates="business")
    staff_members: List["Staff"] = Relationship(back_populates="business")
    vendors: List["Vendor"] = Relationship(back_populates="business")
    stores: List["BusinessStore"] = Relationship(back_populates="business")


class BusinessStore(SQLModel, table=True):
    """사업장 산하 매장 (다중매장 보유 업체 지원).

    예) 소담김밥(business) → 건대본점/강남점/신촌점(stores).
    단일매장 업체도 default store 1개를 보유하도록 마이그레이션에서 자동 생성.
    계약서 {work_location} 변수가 선택된 store.name 으로 치환됨.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    name: str  # 매장명 (예: "소담김밥 건대본점 매장")
    address: Optional[str] = None  # 매장 주소 (사업장 주소와 다를 수 있음)
    phone: Optional[str] = None
    is_default: bool = Field(default=False)  # 신규 직원 등록 시 기본 매장
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

    business: Optional[Business] = Relationship(back_populates="stores")


# --- Financials ---

class Vendor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    category: Optional[str] = None  # 세부 카테고리 (식자재, 소모품, 비품 등)
    vendor_type: str = Field(default="expense")  # "revenue" or "expense"
    order_index: int = Field(default=0)  # 표시 순서
    contact_info: Optional[str] = None
    item: Optional[str] = None  # 취급 품목
    phone: Optional[str] = None  # 전화번호
    address: Optional[str] = None  # 주소
    business_reg_number: Optional[str] = None  # 사업자등록번호
    
    created_by_upload_id: Optional[int] = Field(default=None) # No FK constraint for simplicity or nullable FK
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    business: Optional[Business] = Relationship(back_populates="vendors")
    
    products: List["Product"] = Relationship(back_populates="vendor")
    expenses: List["Expense"] = Relationship(back_populates="vendor")
    daily_expenses: List["DailyExpense"] = Relationship(back_populates="vendor")

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    product_code: Optional[str] = None  # 업체별 제품코드 (예: MRS01, KST02)
    name: str
    category: Optional[str] = None
    spec: Optional[str] = None  # 규격 (용량, 단위 등)
    unit_price: int = 0
    tax_type: str = Field(default="taxable")  # taxable(과세), tax_free(면세), zero_rated(영세)
    manufacturer: Optional[str] = None  # 제조사
    note: Optional[str] = None  # 비고
    image_url: Optional[str] = None  # 제품 이미지 URL
    
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    vendor: Optional[Vendor] = Relationship(back_populates="products")
    
    inventory: Optional["Inventory"] = Relationship(back_populates="product")

class DeliveryImage(SQLModel, table=True):
    """배달앱/상품관리용 이미지"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    name: str  # 상품명
    category: str = "김밥류"  # 김밥류, 분식류, 주먹밥류, 음료류
    image_url: str  # 이미지 URL (R2 or local)
    storage_key: Optional[str] = None  # storage key for deletion
    source: str = "upload"  # upload, ai_generated, static
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

class MenuItem(SQLModel, table=True):
    """매장별 통합 메뉴 상품 — 메뉴판/가격표 + 레시피관리 공용.
    item_type='product'(판매메뉴, 가격O) / 'ingredient'(재료 레시피, 가격X)."""
    __table_args__ = (
        Index("ix_menuitem_business_type", "business_id", "item_type"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    item_type: str = Field(default="product", index=True)  # product | ingredient
    name: str
    category: Optional[str] = None  # product: gimbap/bunsik/onigiri/ramen/drinks · ingredient: banchan/tuna/...
    price: int = 0                  # 판매가 (product)
    emoji: Optional[str] = None
    spec: Optional[str] = None      # 규격/수율 (예: "1인분", "10개")
    ingredients: Optional[str] = None  # JSON 배열 문자열
    steps: Optional[str] = None        # JSON 배열 문자열
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

class FoodTranslation(SQLModel, table=True):
    """음식명 한→영 번역 사전 (AI 이미지 생성 프롬프트용)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    korean: str = Field(index=True, sa_column_kwargs={"unique": True})
    english: str
    category: str = "기타"
    is_active: bool = True
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

class PromoContent(SQLModel, table=True):
    """AI 홍보물 제작 결과물 (이미지/나레이션/음악)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    category: str = "poster"  # poster, sns, delivery, tts, music
    preset_id: str = ""
    preset_name: str = ""
    content_type: str = "image"  # image, audio
    file_url: str = ""
    storage_key: Optional[str] = None
    file_format: str = "png"  # png, mp3, wav
    file_size: int = 0
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    date: datetime.date
    amount: int
    category: str  # e.g., "식자재", "월세"
    payment_method: str = "Card"
    description: Optional[str] = None
    
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id", index=True)
    vendor: Optional[Vendor] = Relationship(back_populates="expenses")

class Revenue(SQLModel, table=True):
    __table_args__ = (
        Index("ix_revenue_business_date", "business_id", "date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True)
    channel: str  # 매장 / 쿠팡이츠 / 배달의민족 (한글 표준 — constants.py)
    amount: int
    description: Optional[str] = None
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)

class CompanyHoliday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True, unique=True)
    description: Optional[str] = None
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)

# --- Operations (Inventory) ---

class Inventory(SQLModel, table=True):
    product_id: Optional[int] = Field(default=None, foreign_key="product.id", primary_key=True)
    product: Optional[Product] = Relationship(back_populates="inventory")
    
    current_stock: float = 0.0
    safety_stock: float = 0.0
    last_checked_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

# --- HR & Payroll ---

class Staff(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str # e.g., "Manager", "Part-time"
    hourly_wage: int
    start_date: datetime.date
    bank_account: Optional[str] = None  # Legacy field (combined)
    bank_name: Optional[str] = None  # 은행명
    account_number: Optional[str] = None  # 계좌번호
    account_holder: Optional[str] = None  # 예금주
    status: str = Field(default="재직") # 재직 / 퇴사
    
    # HR Details
    nationality: str = Field(default="South Korea") # 국적
    visa_type: Optional[str] = None # 비자 종류 (e.g. H-2, E-9, F-4...)
    name_eng: Optional[str] = None # 영문 이름 (외국인 직원의 증명서/계약서용. 예: "DAO KIM HONG NGOC")
    phone: Optional[str] = None
    email: Optional[str] = None # 이메일 주소
    address: Optional[str] = None # Added for contract
    resident_number: Optional[str] = None # Added for contract
    birth_date: Optional[date] = None # 생년월일 (국민연금 자동 면제 등)
    contract_type: str = Field(default="아르바이트") # 정규직, 아르바이트, 일용직
    insurance_4major: bool = Field(default=False) # 4대보험 가입여부
    insurance_base_salary: int = Field(default=0) # 보수월액 (4대보험 산정 기준 신고 월 보수액)
    np_exempt: bool = Field(default=False) # 국민연금 면제 (60세 이상 등)
    durunnuri_support: bool = Field(default=False) # 두루누리 사회보험 지원 (NP/EI 80% 감면)
    tax_support_enabled: bool = Field(default=False) # 사업주 세금 대납 (공제액을 사업주가 대신 부담)
    monthly_salary: int = Field(default=0) # 월급 (if applicable)
    work_schedule: Optional[str] = None # 근무시간 (e.g. "09:00~18:00") - KEEPING FOR BACKWARD COMPAT, but using new fields below
    
    # Tax Details
    dependents_count: int = Field(default=1) # 부양가족 수 (본인 포함)
    children_count: int = Field(default=0) # 8세~20세 자녀 수
    
    # Contract Specific Details (New)
    contract_start_date: Optional[datetime.date] = None
    contract_end_date: Optional[datetime.date] = None
    
    work_start_time: Optional[str] = None # "09:00"
    work_end_time: Optional[str] = None # "18:00"
    rest_start_time: Optional[str] = None # "12:00"
    rest_end_time: Optional[str] = None # "13:00"
    
    working_days: Optional[str] = None # "매주 월~금"
    weekly_holiday: Optional[str] = None # "매주 일요일" (Contract Item 5)
    
    job_description: Optional[str] = None # "주방업무, 홀서빙 등" (Contract Item 3)
    
    bonus_enabled: bool = Field(default=False) # 상여금 유무
    bonus_amount: Optional[str] = None # 상여금 내용 (e.g. "설,추석 각 20만원")
    
    salary_payment_date: Optional[str] = Field(default="매월 말일") # 지급일
    salary_payment_method: Optional[str] = Field(default="근로자 계좌 입금") # 지급 방법
    
    # Document Checklist (Submitted?)
    doc_contract: bool = Field(default=False) # 근로계약서
    doc_health_cert: bool = Field(default=False) # 보건증
    doc_id_copy: bool = Field(default=False) # 신분증 사본
    doc_bank_copy: bool = Field(default=False) # 통장 사본

    # ── 사업주 전용 비공개 지급 정보 (외부 노출 금지) ──
    # `private_` prefix 일관 사용 → 직렬화 필터·외부 출력에서 단일 패턴으로 차단 가능
    private_payment_method: str = Field(default="transfer")
    # 'transfer' = 본인 계좌 이체 (기본) / 'cash' = 현금 / 'other_account' = 타인 명의 계좌
    private_actual_payee_name: Optional[str] = None
    private_actual_payee_relation: Optional[str] = None
    private_actual_payee_account: Optional[str] = None
    private_tax_unreported: bool = Field(default=False)
    private_owner_note: Optional[str] = None

    # Relationships
    attendances: List["Attendance"] = Relationship(back_populates="staff")
    payrolls: List["Payroll"] = Relationship(back_populates="staff")
    documents: List["StaffDocument"] = Relationship(back_populates="staff")
    contracts: List["ElectronicContract"] = Relationship(back_populates="staff")
    leave_requests: List["LeaveRequest"] = Relationship(back_populates="staff")
    user: Optional["User"] = Relationship(back_populates="staff")
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    business: Optional[Business] = Relationship(back_populates="staff_members")

# --- Finance (Card Sales) ---

class CardSalesApproval(SQLModel, table=True):
    __table_args__ = (
        Index("ix_cardsalesapproval_business_date", "business_id", "approval_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    approval_date: datetime.date = Field(index=True) # 승인일자
    approval_time: Optional[str] = None # 승인시간
    card_corp: str = Field(index=True) # 카드사명 (User-entered or parsed)
    card_number: Optional[str] = None # 카드번호 (Allow masking)
    approval_number: Optional[str] = None # 승인번호
    amount: int # 승인금액
    installment: Optional[str] = None # 할부개월
    status: str = Field(default="승인") # 승인 / 취소

    shop_name: Optional[str] = None # 가맹점명 (from Excel)

    # CODEF Phase 1 — 출처 추적
    source: str = Field(default="excel", index=True)  # 'codef' | 'excel' | 'manual' | 'excel_overridden'
    source_meta: Optional[str] = None  # CODEF 응답 원본 JSON (요약)
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
    synced_at: Optional[datetime.datetime] = None

class CardPayment(SQLModel, table=True):
    __table_args__ = (
        Index("ix_cardpayment_business_date", "business_id", "payment_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    payment_date: datetime.date = Field(index=True) # 입금일자
    card_corp: str = Field(index=True) # 카드사명
    sales_amount: int = 0 # 매출금액 (승인금액 합계)
    fees: int = 0 # 수수료
    vat_on_fees: int = 0 # 수수료 부가세 (if applicable separately, often included in fees for stats)
    net_deposit: int = 0 # 입금예정액/실입금액
    bank: Optional[str] = None # 입금은행

    # CODEF Phase 1 — 출처 추적 (CardSalesApproval 과 동일)
    source: str = Field(default="excel", index=True)
    source_meta: Optional[str] = None
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
    synced_at: Optional[datetime.datetime] = None


# --- Auto-Collection Pipeline: 카드 수수료 학습 / 매칭 로그 / 정산 프로파일 ---

class CardFeeRateLearned(SQLModel, table=True):
    """카드사별 학습된 실효 수수료율 (사업장 단위, 카드사 단위 단일 row)."""
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", name="uq_cardfee_business_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    learned_rate: float
    sample_size: int
    sample_period_start: datetime.date
    sample_period_end: datetime.date
    confidence: float
    last_updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    notes: Optional[str] = None


class CardFeeMatchLog(SQLModel, table=True):
    """카드사 입금-승인 매칭 로그 (수수료 역산의 원본 샘플)."""
    __table_args__ = (
        Index("ix_cardfeematchlog_biz_corp", "business_id", "card_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    deposit_date: datetime.date
    approval_dates_start: datetime.date
    approval_dates_end: datetime.date
    sales_amount: int
    deposit_amount: int
    effective_fee: int
    effective_rate: float
    matched_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class CardCorpSettlementProfile(SQLModel, table=True):
    """카드사별 정산 주기 학습 프로파일 (영업일 단위)."""
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp",
                         name="uq_cardcorpsettle_business_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    settlement_days_learned: int = 3  # spec § 8.9 default: D+3 영업일 (학습 전)
    grace_days: int = 3                # spec § 8.9 default: false-positive 방지 3일 유예
    sample_size: int = 0
    last_updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class PayPayment(SQLModel, table=True):
    """간편결제(페이) 정산 입금 — CardPayment 와 동일 구조의 페이 전용 테이블.

    카카오페이/네이버페이/토스/서울페이/제로페이 등의 정산 입금을 분해 저장한다.
    매출 원본은 현재 별도 테이블이 없으므로 bank-sync 자동 분류 시점에는
    sales_amount/fees=0 으로 생성되고, 추후 페이 매출 데이터가 들어오면
    채워지는 구조 (sales_amount - net_deposit = fees, 수수료율 = fees/sales_amount).
    """
    __table_args__ = (
        Index("ix_paypayment_business_date", "business_id", "payment_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    payment_date: datetime.date = Field(index=True)  # 입금일자
    pay_corp: str = Field(index=True)                # 페이사명 (카카오페이/네이버페이/토스/서울페이/제로페이)
    sales_amount: int = 0                             # 매출금액 (이후 채워질 수 있음)
    fees: int = 0                                     # 수수료 (sales_amount - net_deposit)
    vat_on_fees: int = 0
    net_deposit: int = 0                              # 실입금액 (bank-sync 자동 매칭)
    bank: Optional[str] = None

    source: str = Field(default="bank_sync", index=True)  # 'bank_sync' | 'bank_sync_mobile' | 'excel' | 'manual'
    source_meta: Optional[str] = None
    synced_at: Optional[datetime.datetime] = None


class MobilePgConfig(SQLModel, table=True):
    """사업장별 이동식 단말기 PG 설정 (코페이/KSnet/키움페이 등).

    bank-sync 자동 분류 시 입금 적요에 keyword 가 매칭되면 mobile_settlement 로 분류하고
    commission_rate 를 이용해 매출 원본을 역산. 사장님이 UI 에서 직접 CRUD.

    동일 사업장에 여러 PG 등록 가능. is_active=False 면 매칭 제외.
    """
    __table_args__ = (
        Index("ix_mobilepg_business_active", "business_id", "is_active"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    name: str  # 표시명 ('코페이')
    keyword: str  # 적요 매칭 substring ('코페이')
    commission_rate: float = Field(default=0.0275)  # 2.75%
    note: Optional[str] = None  # 메모 (수수료율 출처/명세서 일자 등)
    is_active: bool = Field(default=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: Optional[str] = None # Optional for social logins
    role: str = Field(default="guest") # superadmin, admin, staff, guest
    grade: str = Field(default="정직원") # 정직원, 아르바이트, admin
    
    # Subscription (Admin only)
    subscription_type: Optional[str] = None  # free, basic, premium
    
    # Approval tracking
    approved_at: Optional[datetime.datetime] = None  # SuperAdmin 승인 시점
    approved_by: Optional[int] = None  # 승인한 SuperAdmin user_id
    
    # Social Login Fields
    provider: Optional[str] = None # google, naver, kakao
    provider_id: Optional[str] = None
    email: Optional[str] = None
    real_name: Optional[str] = None
    profile_image: Optional[str] = None
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id")
    staff: Optional[Staff] = Relationship(back_populates="user")
    
    # Multi-tenant
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    business: Optional[Business] = Relationship(back_populates="users")

class ElectronicContract(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str # Can store template text or specific details
    signature_data: Optional[str] = None # Base64 signature image
    status: str = Field(default="pending") # pending, signed
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    signed_at: Optional[datetime.datetime] = None
    
    staff_id: int = Field(foreign_key="staff.id")
    staff: Optional[Staff] = Relationship(back_populates="contracts")
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class StaffDocument(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: int = Field(foreign_key="staff.id")
    doc_type: str # 'contract', 'health_cert', 'id_copy', 'bank_copy'
    file_path: str
    original_filename: str
    upload_date: datetime.datetime = Field(default_factory=datetime.datetime.now)

    staff: Optional[Staff] = Relationship(back_populates="documents")


class BusinessDocument(SQLModel, table=True):
    """사업장(회사) 공식 문서 보관.

    doc_type 예: 'biz_registration'(사업자등록증), 'biz_license'(영업신고증),
    'corp_registry'(법인등기부등본), 'lease'(임대차계약서),
    'bank_copy'(통장사본), 'tax_cert'(납세증명서), 'seal_cert'(인감증명서),
    'vat_return'(부가세신고서), 'insurance'(4대보험가입증), 'permit'(인허가증),
    'other' 등. 프론트에서 타입 리스트 관리.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    doc_type: str = Field(index=True)
    label: Optional[str] = None  # 'other' 등 사용자 지정 라벨
    file_path: str
    original_filename: str
    note: Optional[str] = None
    uploaded_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class FaxTransmission(SQLModel, table=True):
    """팩스 전송 이력.

    source_type: 'certificate'(자동생성 증명서) / 'upload'(직접 업로드) / 'business_doc'(보관함)
    status: 'pending' / 'sending' / 'success' / 'failed'
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    target_number: str = Field(index=True)
    target_name: Optional[str] = None
    subject: Optional[str] = None

    source_type: str = "upload"   # certificate / upload / business_doc
    source_ref: Optional[str] = None  # 예: 'employment:2' 또는 BusinessDocument.id
    file_path: str
    original_filename: str
    page_count: Optional[int] = None
    # 다중 파일 묶음 발송 시 모든 파일을 보존 — JSON 직렬화된 list of {url, name, size}.
    # 단일 발송 시 NULL. 미리보기 모달에서 개별 파일 보기/다운로드 가능하게.
    attachment_files: Optional[str] = None

    status: str = Field(default="pending", index=True)
    provider: Optional[str] = None           # 'stub' / 'phaxio' / ...
    provider_tx_id: Optional[str] = None
    error_message: Optional[str] = None

    created_by_user_id: Optional[int] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now, index=True)
    sent_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None


class NotificationHistory(SQLModel, table=True):
    """카카오 알림톡 / 친구톡 / SMS / LMS / MMS 발송 이력.

    channel: 'alimtalk' / 'friendtalk' / 'sms' / 'lms' / 'mms'
    trigger: 수동('manual') / 자동('attendance_late', 'payroll_sent',
             'leave_approved', 'leave_rejected', 'contract_expiring',
             'probation_ended' 등)
    status: 'pending' / 'sending' / 'success' / 'failed'
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    channel: str = Field(default="sms", index=True)
    trigger: str = Field(default="manual", index=True)

    target_number: str = Field(index=True)
    target_name: Optional[str] = None
    sender_number: Optional[str] = None

    # 알림톡 전용
    template_code: Optional[str] = None
    template_variables: Optional[str] = None   # JSON 직렬화

    # 메시지 본문
    subject: Optional[str] = None              # LMS/MMS 제목
    content: str = Field(default="")

    # 전송 결과
    status: str = Field(default="pending", index=True)
    provider: Optional[str] = None             # 'stub' / 'popbill'
    provider_tx_id: Optional[str] = None
    error_message: Optional[str] = None

    # 관련 엔티티
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    source_ref: Optional[str] = None

    created_by_user_id: Optional[int] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now, index=True)
    sent_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None


class WorkLocation(SQLModel, table=True):
    """매장 위치 및 Geofence 설정"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    name: str = "소담김밥"
    latitude: float = 0.0
    longitude: float = 0.0
    radius_meters: int = 100  # 허용 반경 (기본 100m)
    is_active: bool = True

class Attendance(SQLModel, table=True):
    __table_args__ = (
        Index("ix_attendance_staff_date", "staff_id", "date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True)
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    total_hours: float = 0.0
    status: str = "Normal" # Normal, Late, Absent
    
    # GPS 검증 필드
    check_in_lat: Optional[float] = None
    check_in_lng: Optional[float] = None
    check_out_lat: Optional[float] = None
    check_out_lng: Optional[float] = None
    check_in_verified: bool = False
    check_out_verified: bool = False
    check_in_distance: Optional[float] = None   # 매장과의 거리(m)
    check_out_distance: Optional[float] = None
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    staff: Optional[Staff] = Relationship(back_populates="attendances")
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)

class Payroll(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("staff_id", "month", name="uq_payroll_staff_month"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    month: str # YYYY-MM
    base_pay: int = 0
    bonus: int = 0
    deductions: int = 0
    total_pay: int = 0
    
    # Detailed Bonus (Earnings)
    bonus_special: int = 0 # 특별수당
    bonus_meal: int = 0 # 식비지원
    bonus_tax_support: int = 0 # 제세공과금 지원금 (정규직용 - 회사 부담 세금/보험)
    bonus_holiday: int = 0 # 주휴수당
    
    # Weekly Holiday Allowance
    holiday_w1: int = 0
    holiday_w2: int = 0
    holiday_w3: int = 0
    holiday_w4: int = 0
    holiday_w5: int = 0
    holiday_w6: int = 0
    
    # Detailed Deductions
    deduction_np: int = 0 # 국민연금
    deduction_hi: int = 0 # 건강보험
    deduction_ei: int = 0 # 고용보험
    deduction_lti: int = 0 # 장기요양
    deduction_it: int = 0 # 소득세
    deduction_lit: int = 0 # 지방소득세
    
    details_json: Optional[str] = None # Detailed breakdown in JSON string
    
    # Transfer Tracking
    transfer_status: str = Field(default="대기") # 대기(Pending), 완료(Completed), 실패(Failed)
    transferred_at: Optional[datetime.datetime] = None
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id")
    staff: Optional[Staff] = Relationship(back_populates="payrolls")

class GlobalSetting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    description: Optional[str] = None

# --- Profit/Loss Statement ---

class MonthlyProfitLoss(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "year", "month", name="uq_monthlypl_business_year_month"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    year: int = Field(index=True)
    month: int = Field(index=True)
    
    # 수입 (Revenue)
    revenue_store: int = 0        # 매장매출
    revenue_coupang: int = 0      # 쿠팡 정산금
    revenue_baemin: int = 0       # 배민 정산금
    revenue_yogiyo: int = 0       # 요기요 정산금
    revenue_ddangyo: int = 0      # 땡겨요 정산금
    
    # 지출 (Expenses) - 2026 카테고리 재편
    expense_labor: int = 0        # 인건비 (Payroll 자동)
    expense_ingredient: int = 0   # 원재료비 (식자재·반가공식품)
    expense_material: int = 0     # 소모품비 (포장재·일회용품·주방비품)
    expense_utility: int = 0      # 수도광열비 (전기·가스·수도)
    expense_rent: int = 0         # 임차료 (월세+관리비 통합)
    expense_repair: int = 0       # 수선비 (시설·장비 수리)
    expense_depreciation: int = 0 # 감가상각비 (기계·인테리어 구입)
    expense_tax: int = 0          # 세금과공과 (부가세·소득세·지방세)
    expense_insurance: int = 0    # 보험료 (4대보험 사업주 부담분)
    expense_insurance_employee: int = 0  # 4대보험료 (직원 부담분)
    expense_tax_employee: int = 0        # 원천세 (직원 소득세+지방소득세)
    expense_card_fee: int = 0     # 카드수수료
    expense_delivery_fee: int = 0 # 배달앱수수료 (배민+쿠팡+요기요+땡겨요)
    expense_retirement: int = 0   # 퇴직금적립 (인건비 10% 자동)
    expense_other: int = 0        # 기타경비
    expense_personal: int = 0     # 개인가계부 (P/L 미포함)
    # [LEGACY] 기존 필드 유지 (하위호환)
    expense_rent_fee: int = 0     # [LEGACY] 임대관리비 → 임차료에 통합
    expense_vat: int = 0          # [LEGACY] 부가가치세 → 세금과공과에 통합
    expense_biz_tax: int = 0      # [LEGACY] 사업소득세 → 세금과공과에 통합
    expense_income_tax: int = 0   # [LEGACY] 근로소득세 → 세금과공과에 통합


class DeliveryRevenue(SQLModel, table=True):
    """배달앱 월별 정산 요약"""
    id: Optional[int] = Field(default=None, primary_key=True)
    # 2026-05-12: 다중 사업장 격리 — 기존 컬럼 누락으로 사업장간 데이터 섞임 위험 (자동 마이그레이션으로 추가)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    channel: str = Field(index=True)          # 쿠팡/배민/요기요/땡겨요
    year: int = Field(index=True)
    month: int = Field(index=True)
    total_sales: int = 0                       # 총 주문금액
    total_fees: int = 0                        # 총 수수료 (차감금액)
    settlement_amount: int = 0                 # 정산금액 (실제 입금액)
    order_count: int = 0                       # 주문 건수
    fee_breakdown: Optional[str] = None        # 수수료 세부내역 (JSON)
    # 2026-05-12: bank-sync 자동 생성 vs 사용자 업로드 구분 (수수료 역산 시 신뢰도 판단용)
    source: str = Field(default="excel", index=True)  # 'excel' | 'bank_sync' | 'manual'


class FixedAsset(SQLModel, table=True):
    """비유동자산 대장 — 재무상태표·감가상각비 산출용 (2026-07-04 사장님 제공).

    - useful_life_months 가 None 이면 비상각 자산 (임대보증금 등)
    - 감가상각: 정액법, acquired 월부터 useful_life_months 개월간
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    name: str                                    # 임대보증금 / 주방집기 / 인테리어
    asset_type: str = Field(default="equipment", index=True)  # deposit | equipment | interior
    cost: int = 0                                # 취득원가
    acquired: datetime.date                      # 취득(개업)일
    useful_life_months: Optional[int] = None     # 정액 상각 개월수 (None=비상각)
    note: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class DeliveryFeeRate(SQLModel, table=True):
    """배달 채널별 수수료율 (사업장 단위, effective_from 단위로 버저닝)."""
    __table_args__ = (
        UniqueConstraint(
            "business_id", "channel", "effective_from",
            name="uq_deliveryfeerate_business_channel_from",
        ),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    channel: str = Field(index=True)
    rate: float
    effective_from: datetime.date
    effective_to: Optional[datetime.date] = None
    notes: Optional[str] = None
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class SettlementWatchAlert(SQLModel, table=True):
    """정산 감시 알림 — 카드사/배달채널 미입금 또는 지연 감지."""
    __table_args__ = (
        UniqueConstraint(
            "business_id", "alert_type", "channel_or_corp", "expected_date",
            name="uq_settle_watch_natural",
        ),
        Index("ix_settle_watch_biz_status", "business_id", "status"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    alert_type: str = Field(index=True)
    channel_or_corp: str
    expected_date: datetime.date
    expected_amount: int
    deadline: datetime.date
    status: str = Field(default="open", index=True)
    notified_at: Optional[datetime.datetime] = None
    received_amount: Optional[int] = None
    received_date: Optional[datetime.date] = None
    acknowledged_at: Optional[datetime.datetime] = None
    acknowledged_by: Optional[int] = Field(default=None, foreign_key="user.id")
    notes: Optional[str] = None
    raw_ref: Optional[str] = None  # 원본 식별자 ('card_approval_group:{corp}:{date}' or 'coupang_settle:{id}')


class CollectionHealthAlert(SQLModel, table=True):
    """자동수집 채널 건강 경보 — 중복 발송 방지 + 복구 추적.

    (business_id, channel_key) 당 1행. open→resolved 상태전이.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "channel_key",
                         name="uq_collection_health_alert"),
        Index("ix_collection_health_biz_status", "business_id", "status"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    channel_key: str = Field(max_length=32, index=True,
                             description="easypos / coupang_eats / baemin / codef_card / codef_bank")
    status: str = Field(default="open", index=True, description="open / resolved")
    alert_type: str = Field(max_length=32, description="failed / stale / skipping / expiring_soon")
    opened_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    last_notified_at: Optional[datetime.datetime] = None
    resolved_at: Optional[datetime.datetime] = None
    detail: Optional[str] = Field(default=None, max_length=500)


class DailyExpense(SQLModel, table=True):
    __table_args__ = (
        Index("ix_dailyexpense_business_date", "business_id", "date"),
        Index("ix_dailyexpense_business_vendor", "business_id", "vendor_id"),
        UniqueConstraint(
            "business_id", "date", "vendor_id", "payment_method", "source",
            name="uq_dailyexpense_natural",
        ),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    date: datetime.date = Field(index=True)
    vendor_name: str              # 거래처명
    amount: int                   # 금액
    category: Optional[str] = None  # 비용 카테고리 (재료비, 기타 등)
    payment_method: str = Field(default="Card") # Card, Cash
    note: Optional[str] = None    # 비고

    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    vendor: Optional[Vendor] = Relationship(back_populates="daily_expenses")

    upload_id: Optional[int] = Field(default=None, foreign_key="uploadhistory.id")

    # 자동수집 파이프라인 — 출처 추적 (manual / card_sync / pay_sync / delivery_sync / ...)
    source: str = Field(default="manual", index=True)
    source_meta: Optional[str] = None  # JSON 문자열. 자동수집 시 raw row id/분류 룰 등

class UploadHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    filename: str
    upload_type: str  # 'expense', 'revenue'
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    record_count: int = 0
    status: str = Field(default="active")  # 'active', 'rolled_back'


# --- Retirement Pay Tracking ---

class RetirementPayment(SQLModel, table=True):
    """퇴직금 실지급 기록"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    staff_name: str = ""              # 직원명 (퇴사 후에도 조회용)
    
    start_date: datetime.date = Field(default_factory=datetime.date.today)  # 입사일
    end_date: datetime.date = Field(default_factory=datetime.date.today)    # 퇴사일
    work_days: int = 0                # 근속일수
    
    accrued_amount: int = 0           # 누적 적립액 (P/L에 이미 반영된 금액)
    paid_amount: int = 0              # 실제 지급액
    difference: int = 0              # 차액 (paid - accrued, 양수면 추가비용)
    
    payment_date: Optional[datetime.date] = None  # 지급일
    payment_method: str = "계좌이체"   # 지급방법
    bank_name: Optional[str] = None   # 입금은행
    account_number: Optional[str] = None  # 입금계좌
    note: Optional[str] = None        # 비고
    
    status: str = Field(default="대기")  # 대기, 지급완료
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    
    staff: Optional[Staff] = Relationship()


# --- Leave / Vacation Management (연차/휴가관리) ---

class LeaveBalance(SQLModel, table=True):
    """연차/휴가 잔여 현황 (연도별)"""
    __table_args__ = (
        UniqueConstraint("staff_id", "year", name="uq_leavebalance_staff_year"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int  # 기준 연도

    # 법정 연차
    total_annual: float = 0  # 총 발생 연차 (법정 자동계산)
    used_annual: float = 0   # 사용 연차

    # 기타 휴가
    total_sick: float = 0    # 병가 부여일
    used_sick: float = 0     # 병가 사용
    total_special: float = 0 # 특별휴가 (경조사 등) 부여일
    used_special: float = 0  # 특별휴가 사용

    # 보상
    annual_allowance_paid: bool = False  # 미사용 연차수당 지급 여부

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

    staff: Optional[Staff] = Relationship()


class LeaveRequest(SQLModel, table=True):
    """휴가 신청/승인"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    staff_name: str = ""

    leave_type: str = "연차"  # 연차, 반차(오전), 반차(오후), 병가, 경조사, 출산휴가, 육아휴직, 공가, 특별휴가, 무급휴가
    start_date: datetime.date
    end_date: datetime.date
    days: float = 1.0  # 사용 일수 (반차=0.5)
    reason: Optional[str] = None

    status: str = Field(default="대기")  # 대기, 승인, 반려, 취소
    approved_by: Optional[str] = None  # 승인자 이름
    approved_at: Optional[datetime.datetime] = None
    reject_reason: Optional[str] = None

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)

    staff: Optional[Staff] = Relationship(back_populates="leave_requests")


class StaffChangeLog(SQLModel, table=True):
    """인사변경 이력"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    staff_name: str = ""

    change_type: str = ""  # 입사, 시급변경, 월급변경, 직급변경, 직책변경, 부서변경, 계약변경, 상태변경, 4대보험변경, 퇴사
    field_name: str = ""   # Changed field name
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    note: Optional[str] = None

    changed_by: str = "시스템"  # 관리자 or 시스템
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


# --- Training & Certification (교육/자격증 관리) ---

class StaffTraining(SQLModel, table=True):
    """직원 교육 이수 관리"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)

    training_type: str = ""  # 산업안전보건교육, 성희롱예방교육, 장애인인식개선, 직장내괴롭힘예방, 개인정보보호, 식품위생교육, 소방안전교육, 기타
    training_name: Optional[str] = None  # 교육명 상세
    completed_date: Optional[datetime.date] = None  # 이수일
    expiry_date: Optional[datetime.date] = None  # 만료일 (갱신 필요 시)
    certificate_number: Optional[str] = None  # 수료증 번호
    institution: Optional[str] = None  # 교육기관
    hours: float = 0  # 교육시간
    status: str = "미이수"  # 미이수, 이수, 만료
    note: Optional[str] = None

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class StaffCertification(SQLModel, table=True):
    """직원 자격증 관리"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)

    cert_name: str = ""  # 자격증명 (조리기능사, 위생사, 식품기사 등)
    cert_number: Optional[str] = None  # 자격증 번호
    issued_date: Optional[datetime.date] = None  # 취득일
    expiry_date: Optional[datetime.date] = None  # 만료일
    issuing_body: Optional[str] = None  # 발급기관
    status: str = "유효"  # 유효, 만료, 갱신필요
    note: Optional[str] = None

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


# --- AI Auto-Learning Rules ---

class VendorRule(SQLModel, table=True):
    """사용자 행동으로부터 학습된 매입 분류 규칙"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    original_name: str = Field(index=True)  # 카드 명세서 원본 가맹점명
    mapped_vendor_name: Optional[str] = None  # 사용자가 매핑한 거래처명 (병합 시)
    category: Optional[str] = None  # 학습된 카테고리
    confidence: int = Field(default=1)  # 규칙 적용/확인 횟수
    source: str = Field(default="manual")  # 학습 출처: category_change, vendor_merge, toggle_personal, vendor_patch
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class PurchaseRequest(SQLModel, table=True):
    """직원 재료 구매 요청"""
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    staff_name: str = ""
    items_json: str = "[]"  # JSON: [{name, quantity, note}]
    status: str = Field(default="pending")  # pending, completed, rejected
    admin_note: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class PurchaseOrder(SQLModel, table=True):
    """물품 구매 요청서 — 관리자가 거래처별로 작성·전송 (자재관리 > 구매요청서 작성)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id", index=True)
    vendor_name: str = ""       # 스냅샷 (거래처 삭제/병합 대비)
    vendor_phone: Optional[str] = None
    order_date: datetime.date = Field(default_factory=datetime.date.today, index=True)
    items_json: str = "[]"      # [{product_id, name, spec, quantity, unit_price, amount}]
    item_count: int = 0
    total_amount: int = 0
    memo: Optional[str] = None
    status: str = Field(default="draft")  # draft, sent, completed, canceled
    sent_via: Optional[str] = None        # phone, kakao, copy
    sent_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None  # 구매(입고) 완료 시각
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class Receipt(SQLModel, table=True):
    """영수증 보관함 — 구매 영수증 원본 이미지 + AI 추출/분류 결과 (자재관리 > 영수증 보관함)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    image_url: str
    storage_key: Optional[str] = None
    receipt_date: Optional[datetime.date] = Field(default=None, index=True)
    vendor_name: Optional[str] = Field(default=None, index=True)
    amount: int = 0
    category: Optional[str] = None       # EXPENSE_CATEGORIES id (원재료비 등)
    payment_method: str = "Card"         # Card, Cash
    memo: Optional[str] = None
    status: str = Field(default="pending")  # pending(확인 필요) / classified(매입 반영됨)
    ocr_json: Optional[str] = None       # AI 추출 raw 결과
    purchase_order_id: Optional[int] = Field(default=None, foreign_key="purchaseorder.id", index=True)
    daily_expense_id: Optional[int] = Field(default=None, foreign_key="dailyexpense.id")
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class EmergencyContact(SQLModel, table=True):
    """비상연락처"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # 업체/서비스명 (예: 쿠팡이츠 AS센터)
    phone: str  # 전화번호
    category: str = ""  # 분류 (배달앱, 장비AS, 기타)
    store_id: str = ""  # 매장 아이디
    note: str = ""  # 비고
    display_order: int = Field(default=0)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class Announcement(SQLModel, table=True):
    """회사 공지사항"""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str = ""
    pinned: bool = Field(default=False)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    is_global: bool = Field(default=False)  # SuperAdmin 전체 공지


class Suggestion(SQLModel, table=True):
    """건의사항"""
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    staff_name: str = ""
    title: str
    content: str = ""
    status: str = Field(default="pending")  # pending, reviewed, resolved
    admin_reply: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class StaffChatMessage(SQLModel, table=True):
    """직원소통방 메시지"""
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    staff_name: str = ""
    message: str
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class InventoryItem(SQLModel, table=True):
    """재고 체크 항목 정의 (동적 관리)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str                       # 항목 이름 (예: 어묵, 계란, 스팸)
    emoji: str = "📦"              # 이모지
    unit: str = "개"               # 단위
    category: str = "기타"         # 카테고리 (예: 기본, 주먹밥)
    display_order: int = 0          # 표시 순서
    is_active: bool = True          # 활성 여부
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class InventoryCheck(SQLModel, table=True):
    """오픈 재고 체크"""
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True)
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    staff_name: str = ""

    # 동적 항목 값 (JSON: {"item_id": count, ...})
    items_json: Optional[str] = None

    # 기존 고정 컬럼 (하위 호환)
    fish_cake: int = 0
    egg: int = 0
    riceball_spam: int = 0
    riceball_mild_tuna: int = 0
    riceball_spicy_tuna: int = 0
    riceball_bulgogi: int = 0
    riceball_anchovy: int = 0
    riceball_ham_cheese: int = 0

    note: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)


class StoreApplication(SQLModel, table=True):
    """매장 사용 신청 (Guest → Admin 전환 워크플로우)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    
    # 매장 기본 정보
    business_name: str              # 매장명
    business_type: str = Field(default="음식점")  # 업종
    owner_name: str = ""            # 대표자명
    phone: str = ""                 # 연락처
    address: Optional[str] = None   # 주소
    business_number: Optional[str] = None  # 사업자등록번호
    region: Optional[str] = None    # 지역
    
    # 신청 정보
    plan_type: str = Field(default="free")  # free, basic, premium
    staff_count: int = Field(default=1)     # 예상 직원 수
    message: Optional[str] = None           # 추가 메시지
    
    # 처리 상태
    status: str = Field(default="pending")  # pending, approved, rejected
    admin_note: Optional[str] = None        # SuperAdmin 메모
    reviewed_by: Optional[int] = None       # 검토한 SuperAdmin ID
    
    # 승인 시 생성된 정보
    assigned_username: Optional[str] = None  # 할당된 Admin 아이디
    assigned_business_id: Optional[int] = None  # 생성된 매장 ID
    
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    reviewed_at: Optional[datetime.datetime] = None


class DevWorkLog(SQLModel, table=True):
    """개발 작업일지 (SuperAdmin 전용)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True)  # 작업일
    title: str  # 작업 제목
    content: str = ""  # 상세 내용 (마크다운)
    category: str = Field(default="feature")  # feature, bugfix, refactor, infra, design, other
    files_changed: Optional[str] = None  # 수정된 파일 목록 (줄바꿈 구분)
    ai_summary: Optional[str] = None  # AI 요약 / 다음 작업 참고사항
    status: str = Field(default="completed")  # draft, completed
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class BankAccount(SQLModel, table=True):
    """은행 계좌 (팝빌 이지펀뱅크 연동 대상).

    - 사업장당 여러 계좌 등록 가능
    - 팝빌 계좌조회 정액제에 실제 등록된 계좌만 sync 가능
    - account_number: 외부 표시는 마스킹, 실제 조회는 API 호출시만 사용
    """
    __table_args__ = (
        UniqueConstraint("business_id", "bank_code", "account_number", name="uq_bankacc_biz_bank_num"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    bank_code: str = Field(index=True)          # 팝빌 은행코드 (예: '0088' 신한)
    bank_name: str                               # '신한은행' 등
    account_number: str                          # 전체 계좌번호 (평문, 응답시 마스킹)
    account_type: str = Field(default="P")       # 'P' 개인 / 'C' 법인
    alias: Optional[str] = None                  # 사용자 별칭 (예: '소단신한은행')
    memo: Optional[str] = None

    # 팝빌 사용기간 / 다음 결제일 (정액제)
    popbill_use_start: Optional[datetime.date] = None
    popbill_use_end: Optional[datetime.date] = None
    next_billing_date: Optional[datetime.date] = None
    popbill_state: Optional[str] = None          # 'active' / 'inactive' / 'unregistered'

    last_sync_at: Optional[datetime.datetime] = None
    last_sync_status: Optional[str] = None       # 'success' / 'failed'
    last_sync_error: Optional[str] = None

    is_active: bool = Field(default=True)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class BankTransaction(SQLModel, table=True):
    """은행 거래내역 (팝빌 이지펀뱅크 search 결과 raw 저장).

    - tid 는 팝빌이 발급하는 거래고유번호(거래일시+행번호 조합). UNIQUE 제약으로 중복 적재 방지
    - classified_as 로 매출/매입/지출/이체/미분류 구분
    - 분류 후 linked_revenue_id / linked_expense_id 로 원장과 연결 (양방향 추적)
    """
    __table_args__ = (
        UniqueConstraint("account_id", "tid", name="uq_banktx_account_tid"),
        Index("ix_banktx_account_date", "account_id", "trans_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    account_id: int = Field(foreign_key="bankaccount.id", index=True)

    # 팝빌 거래 식별
    tid: str = Field(index=True)                 # 팝빌 거래고유번호
    trans_date: datetime.date = Field(index=True)
    trans_time: Optional[str] = None             # 'HHMMSS'
    trans_dt: Optional[datetime.datetime] = None # 합성된 datetime

    # 금액
    in_amount: int = Field(default=0)            # 입금액
    out_amount: int = Field(default=0)           # 출금액
    balance: Optional[int] = None                # 거래후 잔액

    # 상대방 / 적요
    remark1: Optional[str] = None                # 거래내역1 (송금자/수취인)
    remark2: Optional[str] = None                # 거래내역2 (은행제공 설명)
    remark3: Optional[str] = None                # 거래내역3 (메모)
    remark4: Optional[str] = None

    # 분류
    classified_as: str = Field(default="unclassified", index=True)
    # 'revenue'(매출) / 'expense'(지출) / 'purchase'(매입) / 'transfer'(이체/내부) / 'excluded'(제외) / 'unclassified'
    classified_by: Optional[str] = None          # 'auto' / 'manual' / 'rule'
    classified_at: Optional[datetime.datetime] = None

    # 레거시: revenue/expense 테이블 링크 (현재는 dailyexpense 통합으로 사용 안 함)
    linked_revenue_id: Optional[int] = Field(default=None, foreign_key="revenue.id", index=True)
    linked_expense_id: Optional[int] = Field(default=None, foreign_key="expense.id", index=True)
    # 신규: 매출관리/매입관리 화면이 읽는 DailyExpense 통합 테이블 링크
    linked_daily_id: Optional[int] = Field(default=None, foreign_key="dailyexpense.id", index=True)
    # 2026-05-12: 카드/페이/배달앱 정산 분류 — 매출 중복 방지 + 수수료 역산
    linked_card_payment_id: Optional[int] = Field(default=None, foreign_key="cardpayment.id", index=True)
    linked_pay_payment_id: Optional[int] = Field(default=None, foreign_key="paypayment.id", index=True)
    linked_delivery_revenue_id: Optional[int] = Field(default=None, foreign_key="deliveryrevenue.id", index=True)
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id", index=True)

    user_memo: Optional[str] = None              # 사용자가 단 메모
    raw_json: Optional[str] = None               # 팝빌 응답 원본 (보관용)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now, index=True)


# --- Year-End Tax Settlement (연말정산 Phase 1) ---

class YearEndReport(SQLModel, table=True):
    """직원·연도별 연말정산 마스터 (자체 집계 + 업로드본 정본 + 대조 결과)."""
    __table_args__ = (UniqueConstraint("staff_id", "year", name="uq_yearend_staff_year"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    income_type: str = Field(default="earned")  # "earned" / "business"

    aggregated_at: Optional[datetime.datetime] = None
    total_pay_year: int = 0
    taxable_pay: int = 0
    nontaxable_pay: int = 0
    taxes_withheld_total: int = 0
    insurance_4major_total: int = 0

    confirmed_doc_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    confirmed_total_pay: Optional[int] = None
    confirmed_taxes_paid: Optional[int] = None
    decided_tax: Optional[int] = None
    refund_amount: Optional[int] = None
    confirmed_at: Optional[datetime.datetime] = None

    reconciliation_status: str = Field(default="pending")  # pending/ok/warning/mismatch
    reconciliation_diff: int = 0

    status: str = Field(default="draft")  # draft/aggregated/uploaded/reconciled/distributed
    distributed_to_staff: bool = Field(default=False)
    distributed_at: Optional[datetime.datetime] = None


class YearEndDocument(SQLModel, table=True):
    """업로드된 PDF 문서 (간소화 자료 / 원천징수영수증)."""
    __table_args__ = (
        UniqueConstraint("staff_id", "year", "kind", "file_hash", name="uq_yedoc_unique"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    kind: str  # "simplified" / "withholding_receipt" / "other"
    file_url: str
    original_filename: str
    file_size: int
    file_hash: str = Field(index=True)
    uploaded_by_user_id: int = Field(foreign_key="user.id")
    uploaded_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    parse_status: str = Field(default="pending")  # pending/parsed/error
    parse_error: Optional[str] = None
    parsed_at: Optional[datetime.datetime] = None


class YearEndSimplified(SQLModel, table=True):
    """홈택스 간소화 자료 13개 카테고리 합계."""
    __table_args__ = (UniqueConstraint("document_id", name="uq_yes_doc"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="yearenddocument.id")
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)

    insurance_amount: int = 0
    medical_amount: int = 0
    education_amount: int = 0
    donation_amount: int = 0
    house_loan_principal: int = 0
    house_loan_interest: int = 0
    pension_amount: int = 0
    irp_amount: int = 0
    credit_card_amount: int = 0
    debit_card_amount: int = 0
    traditional_market: int = 0
    public_transport: int = 0
    cultural_amount: int = 0

    raw_extracted_text: Optional[str] = None
    parsed_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class YearEndAuditLog(SQLModel, table=True):
    """연말정산 다운로드/배포 감사 로그."""
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    staff_id: int = Field(foreign_key="staff.id", index=True)
    year: int = Field(index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="yearenddocument.id")
    action: str  # upload/view/download/regenerate/distribute/revoke/reparse/delete
    actor_user_id: int = Field(foreign_key="user.id")
    actor_role: str  # "admin" / "staff_self"
    actor_ip: Optional[str] = None
    user_agent: Optional[str] = None
    occurred_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    detail: Optional[str] = None


# --- 영업관리 (Sales Guide) ---

class SalesGuideProgress(SQLModel, table=True):
    """영업관리 항목별 사업장 진행상태.
    1 사업장 × 1 항목 = 1 row.
    item_key 는 frontend 정적 콘텐츠 (sales-guide/kimbap.js) 의 항목 ID 와 일치.
    예: "permits.business_registration", "delivery.baemin"
    """
    __tablename__ = "sales_guide_progress"
    __table_args__ = (UniqueConstraint("business_id", "item_key"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    item_key: str = Field(index=True, max_length=100)

    is_completed: bool = Field(default=False)
    completed_at: Optional[datetime.date] = None
    expires_at: Optional[datetime.date] = None
    notes: Optional[str] = None

    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    updated_by: Optional[int] = Field(default=None, foreign_key="user.id")


class Statement(SQLModel, table=True):
    """전자명세서 발행 메타 (팝빌 StatementService 6종 양식).

    item_code: 121=거래명세서 122=청구서 123=견적서 124=발주서 125=입금표 126=영수증
    또는 사업장 등록 양식코드.
    품목 detail 은 저장 안 함 (필요 시 팝빌 getInfo 로 조회).
    """
    __tablename__ = "statement"

    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    item_code: str = Field(index=True, max_length=10)
    mgt_key: str = Field(index=True, max_length=64)
    write_date: str = Field(max_length=8)            # YYYYMMDD
    total_amount: str = Field(default="0", max_length=20)
    receiver_corp_num: str = Field(default="", max_length=20)
    receiver_corp_name: str = Field(default="", max_length=200)
    status: str = Field(default="issued", max_length=20)  # issued / cancelled / failed / pending
    receipt_num: Optional[str] = Field(default=None, max_length=64)
    error_message: Optional[str] = Field(default=None)
    email_sent_at: Optional[datetime.datetime] = Field(default=None)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


class TaxinvoiceRecord(SQLModel, table=True):
    """전자세금계산서 발행 메타 (팝빌 TaxinvoiceService).

    key_type: SELL=매출 / BUY=매입 / TRUSTEE=수탁
    Statement 와 동일 패턴 — 가벼운 메타만 (품목·세부는 팝빌 getInfo 로 조회).
    """
    __tablename__ = "taxinvoicerecord"

    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    key_type: str = Field(default="SELL", index=True, max_length=10)
    mgt_key: str = Field(index=True, max_length=64)
    write_date: str = Field(max_length=8)            # YYYYMMDD
    tax_type: str = Field(default="과세", max_length=10)
    total_amount: str = Field(default="0", max_length=20)
    invoicee_corp_num: str = Field(default="", max_length=20)
    invoicee_corp_name: str = Field(default="", max_length=200)
    status: str = Field(default="issued", max_length=20)  # issued / cancelled / failed / pending
    receipt_num: Optional[str] = Field(default=None, max_length=64)
    invoice_num: Optional[str] = Field(default=None, max_length=64)  # 국세청 승인번호
    error_message: Optional[str] = Field(default=None)
    email_sent_at: Optional[datetime.datetime] = Field(default=None)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


# ─────────────────────────────────────────────────────────
# CODEF Phase 1 — 마이데이터 통합 인프라 (Phase 2~5 공유)
# spec: docs/superpowers/specs/2026-04-29-codef-card-sales-phase1-design.md § 5
# ─────────────────────────────────────────────────────────


class CodefConnection(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_conn_business_org", "business_id", "organization_code"),
        UniqueConstraint("business_id", "organization_code", "organization_type",
                         "connection_type",
                         name="uq_codef_conn_biz_org_type_conntype"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    organization_type: str = Field(index=True)
    organization_code: str = Field(index=True)
    organization_label: str
    connected_id: str
    auth_method: str
    # 같은 카드사라도 매출(가맹점)과 매입(사용카드)는 서로 다른 connectedId.
    # 신규 row 가 매출이면 'card_sales', 매입이면 'card_purchase', 은행이면 'bank'.
    connection_type: str = Field(default="card_sales", max_length=32, index=True,
                                  description="card_sales / card_purchase / bank")
    # 카드비번 RSA 암호화 (조회 API 호출 시 cardPassword 로 사용 — 현대카드 등 필수).
    # connectedId 등록 페이로드와 분리 보관 (등록 단계엔 ID/PW 만 전송).
    card_password_encrypted: Optional[str] = Field(
        default=None,
        description="카드비번 RSA 암호화 (조회 API 호출 시 사용 — 현대카드 등 필수)",
    )
    status: str = Field(default="active", index=True)
    last_verified_at: Optional[datetime.datetime] = None
    last_failed_at: Optional[datetime.datetime] = None
    last_error_code: Optional[str] = None
    last_error_message: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    deactivated_at: Optional[datetime.datetime] = None


class CardMerchant(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", "merchant_id"),
        Index("ix_card_merchant_business_corp", "business_id", "card_corp"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    card_corp: str = Field(index=True)
    merchant_id: str
    merchant_name: Optional[str] = None
    fee_rate: Optional[float] = None
    fee_rate_updated_at: Optional[datetime.datetime] = None
    registered_at: Optional[datetime.date] = None
    status: str = Field(default="active")
    source: str = Field(default="codef")
    last_synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class PendingCodefAuth(SQLModel, table=True):
    """CODEF 간편인증 2-step 의 중간 상태.

    1단계(start) 에서 카카오/네이버앱에 본인인증 요청을 발송한 직후 저장.
    사장님이 모바일에서 본인인증을 완료한 뒤 2단계(complete) 호출 시 사용.

    TTL 2분. expires_at 이후에는 만료 — 사용자가 다시 1단계부터 시도해야 함.

    payload_json 은 1단계에서 SDK 로 전송한 account payload 전체 (RSA 암호화
    비번 포함). 2단계에서 동일 payload 에 extraInfo + is2Way=true 만 덮어쓰면
    재호출 가능하므로 그대로 보관.
    """
    __table_args__ = (
        Index("ix_pending_codef_auth_business", "business_id"),
        Index("ix_pending_codef_auth_expires", "expires_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    organization_code: str
    connection_type: str = Field(default="card_purchase", max_length=32)
    auth_method: str = Field(default="simple_auth", max_length=32,
                              description="simple_kakao / simple_naver / simple_pass 등")
    payload_json: str = Field(description="1단계 SDK payload (RSA 암호화 비번 포함)")
    extra_info_json: Optional[str] = Field(
        default=None, description="CODEF 가 응답한 extraInfo (2단계에서 twoWayInfo 로 재사용)"
    )
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    expires_at: Optional[datetime.datetime] = Field(default=None, index=True)


class CodefCallLog(SQLModel, table=True):
    __table_args__ = (
        Index("ix_codef_log_business_date", "business_id", "called_date"),
        Index("ix_codef_log_path_date", "api_path", "called_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    connection_id: Optional[int] = Field(default=None, foreign_key="codefconnection.id")
    api_path: str = Field(index=True)
    organization_code: Optional[str] = None
    called_date: datetime.date = Field(index=True, default_factory=datetime.date.today)
    called_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    status: str
    result_code: Optional[str] = None
    rows_returned: Optional[int] = None
    estimated_cost_krw: Optional[int] = None
    triggered_by: str
    triggered_user_id: Optional[int] = None


class CodefBudgetSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)
    monthly_budget_krw: int = Field(default=0)
    warning_threshold_pct: int = Field(default=80)
    hard_limit_pct: int = Field(default=100)
    last_warning_sent_at: Optional[datetime.datetime] = None
    last_hardlimit_sent_at: Optional[datetime.datetime] = None
    current_month_first_day: Optional[datetime.date] = None
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


# ──────────────────────────────────────────────────────────────────
# 홈택스 수집 (CODEF organization 0001) — 2026-05-15 추가
# 현금영수증 매출/매입 + 세금계산서 통합 + 부가세 신고결과 자동수집.
# 발행은 팝빌, 조회/수집은 CODEF (외부 통합 전략 SSOT).
# ──────────────────────────────────────────────────────────────────

class HometaxRecord(SQLModel, table=True):
    """홈택스 수집 단건 — 현금영수증 / 세금계산서 / 부가세 자료 통합 테이블.

    record_type 으로 카테고리 구분. 같은 사업장 안에서 unique key 는
    (business_id, record_type, identifier) — identifier 는 자료별 고유 식별자
    (현금영수증: 승인번호, 세금계산서: 국세청승인번호 ntsconfirmNum 등).
    """
    __table_args__ = (
        Index("ix_hometax_biz_type_date", "business_id", "record_type", "tx_date"),
        UniqueConstraint("business_id", "record_type", "identifier",
                         name="uq_hometax_biz_type_identifier"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    record_type: str = Field(
        index=True, max_length=32,
        description=(
            "cash_sales: 현금영수증 매출 / cash_purchase: 현금영수증 매입 / "
            "tax_invoice_sales: 세금계산서 매출 / tax_invoice_purchase: 세금계산서 매입 / "
            "vat_return: 부가세 신고결과"
        ),
    )
    identifier: str = Field(index=True, max_length=64,
                            description="자료별 고유키 (승인번호/ntsconfirmNum 등)")
    tx_date: datetime.date = Field(index=True, description="거래일자")
    counterparty_name: Optional[str] = Field(default=None, max_length=128,
                                             description="거래처명/공급자명")
    counterparty_corp_num: Optional[str] = Field(default=None, max_length=20,
                                                  description="거래처 사업자번호")
    supply_cost: int = Field(default=0, description="공급가액")
    tax: int = Field(default=0, description="세액")
    total_amount: int = Field(default=0, description="총액")
    item_name: Optional[str] = Field(default=None, max_length=200)
    raw_json: Optional[str] = Field(default=None, description="CODEF 원본 응답 row (JSON)")
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class HometaxSyncCursor(SQLModel, table=True):
    """홈택스 sync 진행 상태 — 다음 sync 시 어디부터 가져올지 추적.

    business_id + record_type 별로 마지막 성공 sync 시점과 cursor (last_tx_date 등)
    저장. 정기 cron 호출 시 cursor 기반 증분 sync.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "record_type", name="uq_hometax_cursor_biz_type"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    record_type: str = Field(index=True, max_length=32)
    last_synced_at: Optional[datetime.datetime] = None
    last_tx_date: Optional[datetime.date] = Field(
        default=None, description="마지막 동기화한 거래일자 — 다음 sync 시작점",
    )
    last_status: Optional[str] = Field(default=None, max_length=32,
                                       description="success / failed / partial")
    last_error: Optional[str] = Field(default=None, max_length=500)
    rows_total: int = Field(default=0, description="누적 적재 row 수")


# ──────────────────────────────────────────────────────────────────
# EasyPOS (이지포스 smart.easypos.net) — KICC POS 매출 자동수집
# ──────────────────────────────────────────────────────────────────

class EasyPosCredential(SQLModel, table=True):
    """이지포스 가맹점 로그인 자격증명 — business 당 1건.

    password_encrypted 는 Fernet 대칭 암호화 (services.crypto_util).
    """
    __table_args__ = (
        Index("ix_easypos_cred_business", "business_id"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)
    easypos_id: str = Field(description="이지포스 가맹점 로그인 ID (보통 사업자번호)")
    password_encrypted: str = Field(description="Fernet 암호화 비밀번호")
    shop_name: Optional[str] = None
    erp_shop_code: Optional[str] = None
    head_office_no: Optional[str] = None
    status: str = Field(default="active", index=True)
    last_verified_at: Optional[datetime.datetime] = None
    last_failed_at: Optional[datetime.datetime] = None
    last_error_message: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class EasyPosSaleReceipt(SQLModel, table=True):
    """이지포스 영수증 단위 raw 매출. selectSalePerDayList.do 응답을 그대로 적재.

    (business_id, sale_date, pos_no, receipt_no) 가 유일.
    셈하나 Revenue 일자집계는 별도 cron 또는 view 에서 sum 한다.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "sale_date", "pos_no", "receipt_no",
                         name="uq_easypos_receipt"),
        Index("ix_easypos_receipt_biz_date", "business_id", "sale_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    sale_date: datetime.date = Field(index=True)            # 영업일자
    pos_no: str = Field(max_length=4)                        # POS번호 (01,02)
    receipt_no: str = Field(max_length=16)                   # 영수증번호
    sale_time: Optional[str] = Field(default=None, max_length=8)   # HH:MM
    payment_time: Optional[str] = Field(default=None, max_length=8)
    sale_flag: Optional[str] = Field(default=None, max_length=2)   # Y=매출, C=취소 등

    total_amount: int = 0       # 총매출 (부가세 포함)
    net_amount: int = 0         # 순매출 (부가세 제외)
    net_sales: int = 0          # NET매출 (순매출 - 할인)
    vat: int = 0
    service_charge: int = 0     # 봉사료
    discount: int = 0
    customer_count: int = 0

    # 결제수단별 금액
    cash_amount: int = 0
    card_amount: int = 0
    point_amount: int = 0
    voucher_amount: int = 0
    cashback_amount: int = 0
    prepaid_card_amount: int = 0
    credit_amount: int = 0       # 외상
    exchange_voucher_amount: int = 0
    employee_card_amount: int = 0
    e_money_amount: int = 0

    sale_type: Optional[str] = Field(default=None, max_length=2)
    raw_json: Optional[str] = None   # 원본 SSV row 직렬화 (디버그용)
    synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class EasyPosSyncLog(SQLModel, table=True):
    """이지포스 동기화 이력. 운영/장애 추적용."""
    __table_args__ = (
        Index("ix_easypos_synclog_biz_date", "business_id", "started_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    sync_mode: str = Field(default="daily")          # daily / manual / backfill
    target_date: Optional[datetime.date] = None
    started_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    finished_at: Optional[datetime.datetime] = None
    status: str = Field(default="running")            # running / success / failed
    receipts_fetched: int = 0
    receipts_inserted: int = 0
    receipts_updated: int = 0
    total_sales: int = 0
    error_message: Optional[str] = None
    triggered_by: str = Field(default="cron")         # cron / manual / superadmin


# ──────────────────────────────────────────────────────────────────────────
# 쿠팡이츠 (store.coupangeats.com) — 배달앱 매출 자동수집
# 비공식 가맹점 세션 (Akamai Bot Manager 우회: Playwright + curl_cffi)
# spec: KICC EasyPOS 와 동일한 4-모델 패턴 (Credential / Order / Settlement / SyncLog)
# ──────────────────────────────────────────────────────────────────────────

class CoupangEatsCredential(SQLModel, table=True):
    """쿠팡이츠 사장님 포털 로그인 자격증명 — business 당 1건.

    인증 흐름:
      1) login_id/password 를 Playwright 헤드리스 브라우저에 주입 → Akamai sensor 자동 통과
      2) 인증 쿠키를 cookies_json 에 Fernet 암호화 저장
      3) 이후 매출 API 는 curl_cffi (Chrome TLS fingerprint) 로 쿠키만 사용해 직접 호출
      4) 401 발생 시 자동 재로그인 → 쿠키 갱신

    수동 쿠키 폴백:
      - Playwright 가 차단되거나 자격증명 미등록 시, 사장님이 브라우저 F12 로
        쿠키를 복사해 cookies_json 에 직접 입력 가능 (login_method='manual')
    """
    __table_args__ = (
        Index("ix_ce_cred_business", "business_id"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)

    # 자격증명 (자동 로그인용 — 수동 쿠키 입력만 쓰면 비울 수 있음)
    login_id: Optional[str] = Field(default=None, description="쿠팡이츠 사장님 로그인 ID")
    password_encrypted: Optional[str] = Field(default=None, description="Fernet 암호화 비밀번호")

    # 매장 메타
    store_id: Optional[int] = Field(default=None, index=True,
                                    description="쿠팡이츠 매장 ID (예: 823245)")
    shop_name: Optional[str] = None

    # 세션 쿠키 (Fernet 암호화된 JSON 직렬화 — list[dict])
    cookies_encrypted: Optional[str] = Field(default=None, description="Fernet(json.dumps(cookies))")
    cookies_obtained_at: Optional[datetime.datetime] = None
    cookies_expires_at: Optional[datetime.datetime] = Field(default=None,
                                                            description="가장 빠른 만료 쿠키의 시간 (휴리스틱)")
    login_method: str = Field(default="auto", description="auto=Playwright / manual=사장님 직접 입력")

    # 상태
    status: str = Field(default="active", index=True,
                        description="active / failed / expired / cookie_invalid")
    last_verified_at: Optional[datetime.datetime] = None
    last_failed_at: Optional[datetime.datetime] = None
    last_error_message: Optional[str] = None
    consecutive_failures: int = Field(default=0,
                                      description="연속 실패 횟수 — Akamai 차단 휴리스틱")

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class CoupangEatsOrder(SQLModel, table=True):
    """쿠팡이츠 주문 단위 raw 매출.

    소스: POST /api/v1/merchant/web/order/condition 응답의 orderPageVo.content[]
    중복 키: (business_id, order_id) — order_id 는 쿠팡이츠 전역 unique.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "order_id", name="uq_ce_order"),
        Index("ix_ce_order_biz_date", "business_id", "ordered_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: int = Field(index=True)
    order_id: str = Field(max_length=32, description="쿠팡이츠 주문 ID (정수 문자열)")
    abbr_order_id: Optional[str] = Field(default=None, max_length=16, description="짧은 주문번호 (예: 202KF6)")

    ordered_at: Optional[datetime.datetime] = Field(default=None, index=True,
                                                    description="주문 일시 (KST)")
    delivered_at: Optional[datetime.datetime] = None

    # 금액
    total_sale_price: int = 0                # 총 주문가
    discount_amount: int = 0
    cancelled: bool = Field(default=False)

    # 결제/배달
    payment_method: Optional[str] = Field(default=None, max_length=32,
                                          description="card / cash / coupay 등")
    order_status: Optional[str] = Field(default=None, max_length=32,
                                        description="DELIVERED / CANCELLED 등")
    delivery_type: Optional[str] = Field(default=None, max_length=32,
                                         description="배달 / 포장 / pickup 등")

    # raw (디버그/재처리용)
    items_json: Optional[str] = Field(default=None, description="메뉴/수량/옵션 list")
    raw_json: Optional[str] = Field(default=None, description="전체 응답 row 직렬화")

    synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class CoupangEatsSettlement(SQLModel, table=True):
    """쿠팡이츠 일별 정산 내역.

    소스: GET /api/v1/merchant/transactions/{storeId}/settlement-management-data
    중복 키: (business_id, settlement_date, settlement_type, seller_transfer_id)
      - WITHDRAWAL(출금) 은 seller_transfer_id 가 NULL 이라 동일 날짜 1건만 허용.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "settlement_date", "settlement_type",
                         "seller_transfer_id", name="uq_ce_settlement"),
        Index("ix_ce_settle_biz_date", "business_id", "settlement_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: int = Field(index=True)

    settlement_date: datetime.date = Field(index=True)
    settlement_type: str = Field(max_length=16, description="SETTLEMENT / WITHDRAWAL")
    amount: int = 0                          # 정산액 / 출금액
    balance: int = 0                         # 잔액 (해당 시점)
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    seller_transfer_id: Optional[int] = Field(default=None, index=True,
                                              description="정산 식별자 (WITHDRAWAL은 NULL)")

    # 자동수집 파이프라인 — 분해 컬럼 (총매출/수수료 항목별/공제)
    total_sales: int = 0
    fee_brokerage: int = 0       # 중개수수료
    fee_payment: int = 0         # 결제수수료
    fee_delivery: int = 0        # 배달비
    fee_advertising: int = 0     # 광고비
    fee_membership: int = 0      # 멤버십/구독료
    fee_other: int = 0           # 기타 수수료
    deduction_etc: int = 0       # 기타 공제

    raw_json: Optional[str] = None
    synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    # 월별 매출내역서(엑셀) 에서 detail 채워졌는지 추적
    # 채워지면 fee_* 가 0 이 아닌 실제값 (취소 제외 일자별 합)
    detail_synced_at: Optional[datetime.datetime] = Field(
        default=None,
        description="월별 엑셀로 fee_* 컬럼을 마지막으로 채운 시각"
    )
    detail_source_year_month: Optional[str] = Field(
        default=None, max_length=7,
        description="fee_* 를 채운 엑셀의 연-월 ('YYYY-MM')"
    )


class CoupangEatsOrderFee(SQLModel, table=True):
    """쿠팡이츠 월별 매출내역서(엑셀, 43컬럼) 에서 추출한 주문별 fee breakdown.

    소스: GET /api/v1/merchant/web/emails?type=salesOrder&action=download&...
    주기: 매월 1회 (전월 마감 후) — 쿠팡이츠 시스템 제약.
    중복 키: (business_id, order_id) — 동일 주문은 갱신.

    CoupangEatsOrder (매일 수집) 와 별도 테이블인 이유:
      - sync 주기 다름 (orders=일일, fee=월별)
      - fee 데이터는 월 마감 후에야 확정 → orders 만 갖고 P/L 그려야 할 때 의존성 분리
      - 컬럼 수가 많아 (43개) 분리 보관이 청결
    """
    __table_args__ = (
        UniqueConstraint("business_id", "order_id", name="uq_ce_order_fee"),
        Index("ix_ce_order_fee_biz_date", "business_id", "order_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: int = Field(index=True)

    # 주문정보 (col 0~8)
    order_date: datetime.date = Field(index=True)
    ordered_at: Optional[datetime.datetime] = None
    order_id: str = Field(max_length=32, index=True)
    order_type: Optional[str] = Field(default=None, max_length=16)   # 배달 / 포장
    items_summary: Optional[str] = Field(default=None, max_length=500)
    brand: Optional[str] = Field(default=None, max_length=64)
    shop_name: Optional[str] = Field(default=None, max_length=128)
    payment_method: Optional[str] = Field(default=None, max_length=32)
    transaction_type: Optional[str] = Field(default=None, max_length=16,
                                            description="결제 / 취소")

    # 매출액 (9~11)
    total_amount: int = 0
    order_amount: int = 0
    payment_amount: int = 0

    # 쿠폰 (12~13)
    coupon_coupang: int = 0
    coupon_store: int = 0

    # 중개수수료 (14~16)
    brokerage_before_basic: int = 0
    brokerage_before_promo: int = 0
    brokerage_final: int = 0

    # 결제수수료 (17~18)
    payment_fee_basic: int = 0
    payment_fee_promo: int = 0

    # 배달비 (19~25)
    delivery_before_basic: int = 0
    delivery_before_promo: int = 0
    delivery_final: int = 0
    delivery_only: int = 0
    food_only: int = 0
    customer_delivery_fee: int = 0
    customer_delivery_fee_total: int = 0

    # 서비스이용료 (26~33)
    service_before_disposable_cup: int = 0
    service_before_supply: int = 0
    service_before_vat: int = 0
    service_before_total: int = 0
    service_after_disposable_cup: int = 0
    service_after_supply: int = 0
    service_after_vat: int = 0
    service_after_total: int = 0

    # 광고비 (34~36)
    ad_supply: int = 0
    ad_vat: int = 0
    ad_total: int = 0

    # 정산금액 (37~39)
    settle_before_basic: int = 0
    settle_before_promo: int = 0
    settle_final: int = 0

    # 기타 (40~42)
    extra_col_40: int = 0                # 미상 (헤더 비어있음)
    promotion_benefit: int = 0
    refund_amount: int = 0

    # 메타
    source_year_month: str = Field(max_length=7,
                                   description="이 row 의 출처 엑셀 (YYYY-MM)")
    synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class CoupangEatsSyncLog(SQLModel, table=True):
    """쿠팡이츠 동기화 이력. 운영/장애 추적용."""
    __table_args__ = (
        Index("ix_ce_synclog_biz_date", "business_id", "started_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    sync_mode: str = Field(default="full",
                           description="orders / settlements / full / auth-refresh")
    target_start: Optional[datetime.date] = None
    target_end: Optional[datetime.date] = None

    started_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    finished_at: Optional[datetime.datetime] = None
    status: str = Field(default="running")           # running / success / failed / partial

    # 통계
    orders_fetched: int = 0
    orders_inserted: int = 0
    orders_updated: int = 0
    settlements_fetched: int = 0
    settlements_inserted: int = 0
    settlements_updated: int = 0
    total_sales: int = 0                              # 기간 주문 합계 (취소 제외)

    # 트리거/에러
    error_message: Optional[str] = None
    triggered_by: str = Field(default="cron",
                              description="cron / manual / superadmin / auth-failure")
    auth_refreshed: bool = Field(default=False,
                                 description="이 동기화 중 자동 재로그인 발생 여부")

    # 월별 매출내역서 sync 통계 (sync_mode='monthly_excel' 일 때만 채워짐)
    excel_year_month: Optional[str] = Field(default=None, max_length=7,
                                            description="처리한 엑셀의 연-월 (YYYY-MM)")
    excel_orders_parsed: int = 0
    excel_orders_upserted: int = 0
    excel_orders_skipped: int = 0
    excel_settlements_updated: int = 0    # fee_* 채워진 settlement row 수


# ─────────────────────────────────────────────────────────────
# 배민(배달의민족) 자동수집 — ceo.baemin.com 스크래핑
# spec: docs/superpowers/specs/2026-05-14-baemin-auto-collection-design.md
# ─────────────────────────────────────────────────────────────

class BaeminCredential(SQLModel, table=True):
    """배민 사장님사이트 자격증명 + 쿠키 (business 당 1건, 수동 쿠키 only)."""
    __table_args__ = (Index("ix_baemin_cred_business", "business_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", unique=True, index=True)

    login_id: Optional[str] = Field(default=None, description="표시용 — 인증엔 미사용")
    store_id: Optional[str] = Field(default=None, index=True,
                                    description="배민 가맹점 ID")
    shop_name: Optional[str] = None

    cookies_encrypted: Optional[str] = Field(default=None,
                                             description="Fernet(json.dumps(cookies))")
    cookies_obtained_at: Optional[datetime.datetime] = None
    cookies_expires_at: Optional[datetime.datetime] = None
    last_verified_at: Optional[datetime.datetime] = None

    status: str = Field(default="active")
    last_failed_at: Optional[datetime.datetime] = None
    last_error_message: Optional[str] = None
    consecutive_failures: int = Field(default=0, description="연속 실패 횟수 — 쿠키 만료 휴리스틱")

    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminOrder(SQLModel, table=True):
    """배민 주문 단위 raw."""
    __table_args__ = (
        UniqueConstraint("business_id", "order_id", name="uq_baemin_order"),
        Index("ix_baemin_order_biz_date", "business_id", "ordered_at"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)
    order_id: str = Field(max_length=64)

    ordered_at: Optional[datetime.datetime] = Field(default=None, index=True)
    delivered_at: Optional[datetime.datetime] = None

    total_sale_price: int = 0
    discount_amount: int = 0
    cancelled: bool = Field(default=False)

    payment_method: Optional[str] = Field(default=None, max_length=32)
    order_status: Optional[str] = Field(default=None, max_length=32)
    delivery_type: Optional[str] = Field(default=None, max_length=32)

    raw_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminSettlement(SQLModel, table=True):
    """배민 일별 정산 + 수수료 분해."""
    __table_args__ = (
        # 4-column key (settlement_type 포함): WITHDRAWAL 은 seller_transfer_id=NULL 이므로
        # SETTLEMENT 와 동일 날짜에 공존할 수 있도록 settlement_type 도 키에 포함.
        UniqueConstraint(
            "business_id", "settlement_date", "settlement_type", "seller_transfer_id",
            name="uq_baemin_settlement",
        ),
        Index("ix_baemin_settle_biz_date", "business_id", "settlement_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    store_id: str = Field(index=True)

    settlement_date: datetime.date = Field(index=True)
    settlement_type: str = Field(max_length=16)
    amount: int = 0
    balance: int = 0
    seller_transfer_id: Optional[str] = Field(default=None, max_length=64, index=True)

    total_sales: int = 0
    fee_brokerage: int = 0
    fee_payment: int = 0
    fee_delivery: int = 0
    fee_advertising: int = 0
    fee_coupon_owner: int = 0

    raw_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminSyncLog(SQLModel, table=True):
    """배민 동기화 이력."""
    __table_args__ = (Index("ix_baemin_synclog_biz_date", "business_id", "started_at"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    sync_mode: str = Field(default="full")

    target_start: Optional[datetime.date] = None
    target_end: Optional[datetime.date] = None
    started_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    finished_at: Optional[datetime.datetime] = None
    status: str = Field(default="running")

    orders_fetched: int = 0
    orders_inserted: int = 0
    orders_updated: int = 0
    settlements_fetched: int = 0
    settlements_inserted: int = 0
    settlements_updated: int = 0
    total_sales: int = 0

    error_message: Optional[str] = None
    triggered_by: str = Field(default="cron")
    auth_refreshed: bool = Field(default=False, description="이 동기화 중 쿠키 갱신 발생 여부 (수동 only — 항상 False, 일관성용)")


# ─────────────────────────────────────────────────────────────────
# 배민 정산명세서 엑셀 수동 import (Phase 2a)
# self-api.baemin.com 자동수집이 signature 차단으로 무용 → 사장님 수동 다운로드 + UI 업로드 방식
# ─────────────────────────────────────────────────────────────────


class BaeminSettlementDetail(SQLModel, table=True):
    """배민 정산명세서 [상세] 시트 — 입금 단위 raw 1행 = 1 DB row.

    재import 시 (business_id, year, month) 기준 전체 truncate 후 재삽입.
    """
    __table_args__ = (
        Index("ix_baemin_sdetail_biz_ym", "business_id", "year", "month"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    year: int = Field(index=True)
    month: int = Field(index=True)

    deposit_date: Optional[datetime.date] = None           # 입금일
    settlement_period: Optional[str] = None                # 정산대상기간 (raw text — 2026-02-25 등)
    deposit_amount: int = 0                                # 입금 금액
    service_type: Optional[str] = Field(default=None, max_length=32)  # 음식배달 등
    order_type: Optional[str] = Field(default=None, max_length=64)    # 알뜰·한집배달 / 배민포장주문

    # (A) 주문중개
    order_amount: int = 0                  # 바로결제주문금액
    refund_amount: int = 0                  # 부분환불금액
    brokerage_baemin1: int = 0              # 배민1중개이용료
    brokerage_smart: int = 0                # 알뜰배달 중개이용료
    brokerage_pickup: int = 0               # 픽업중개이용료
    customer_discount: int = 0              # 주문금액 즉시할인

    # (B) 배달
    tip_discount_single: int = 0            # 한집배달 배달팁 즉시할인
    tip_discount_smart: int = 0             # 알뜰배달 배달팁 즉시할인
    club_single_discount: int = 0           # 배민클럽(한집배달) 배달팁 할인
    club_single_subsidy: int = 0            # 배민클럽(한집배달) 배달팁 할인 지원
    club_smart_discount: int = 0            # 배민클럽(알뜰배달) 배달팁 할인
    club_smart_subsidy: int = 0             # 배민클럽(알뜰배달) 배달팁 할인 지원
    delivery_fee_single: int = 0            # 배민1 한집배달 배달비
    delivery_fee_smart: int = 0             # 알뜰배달 배달비

    # (C) 그외 (결제정산수수료)
    payment_fee_base: int = 0               # 기본수수료(정률)
    payment_fee_preferred: int = 0          # 우대수수료

    # (D) 기타 / 조정금액
    etc_amount: int = 0                     # (D) 기타
    adjustment_amount: int = 0              # 조정금액 / 보정금액

    # (E)~(H)
    vat: int = 0                            # (E) 부가세
    ad_amount: int = 0                      # (F) 우리가게클릭 / 우리가게클릭 이용요금
    ad_vat: int = 0                         # 우리가게클릭 부가세 (3월~ 분리)
    baemin_order_amount: int = 0            # (G) 배민오더
    deposit_final: int = 0                  # (H) 입금금액
    status: Optional[str] = Field(default=None, max_length=16)  # 입금완료 / 입금요청

    raw_row_json: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)


class BaeminMonthlySummary(SQLModel, table=True):
    """배민 정산명세서 [요약] 시트 + 합계 — 월 단위 1 row.

    UniqueConstraint (business_id, year, month) — 매 업로드 시 update.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "year", "month", name="uq_baemin_summary"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    year: int = Field(index=True)
    month: int = Field(index=True)

    # [요약] 8 컬럼 (입금 완료건만 더한 값)
    order_brokerage_total: int = 0      # (A) 주문중개
    delivery_total: int = 0             # (B) 배달 (보통 음수)
    etc_total: int = 0                  # (C) 그외 (보통 음수)
    misc_total: int = 0                 # (D) 기타
    vat_total: int = 0                  # (E) 부가세 (보통 음수)
    ad_total: int = 0                   # (F) 우리가게클릭 (보통 음수)
    baemin_order_total: int = 0         # (G) 배민오더
    deposit_total: int = 0              # (H) 입금금액

    # 메타
    source: str = Field(default="excel", max_length=16)  # 'excel' / 'manual'
    file_name: Optional[str] = None
    uploaded_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    detail_rows: int = 0                # 상세 시트 row count


# ──────────────────────────────────────────────────────────────────
# CODEF Card Purchase (카드 매입) — 사장님 결제용 카드 사용내역
# 소스: CODEF /v1/kr/card/common/p/approval (개인 카드 승인내역)
# 의미: 사장님이 결제용으로 쓰는 카드의 사용내역 = 매입(지출).
# 중복 위험: BankTransaction 의 카드사 출금은 card_payment 로 분류되어
# 매입(DailyExpense) 에서 제외되므로, 가맹점 단위 raw 만 별도 적재.
# ──────────────────────────────────────────────────────────────────

class CardPurchase(SQLModel, table=True):
    """사장님 사용 카드 매입(지출) — CODEF 마이데이터 개인 카드 승인내역.

    중복 처리: (business_id, card_corp, approval_date, approval_number) UNIQUE.
    같은 카드사·날짜·승인번호 1건만 허용. 재호출 시 기존 row 갱신.
    """
    __table_args__ = (
        UniqueConstraint("business_id", "card_corp", "approval_date", "approval_number",
                         name="uq_card_purchase"),
        Index("ix_card_purchase_biz_date", "business_id", "approval_date"),
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)

    # 카드 식별
    card_corp: str = Field(max_length=32, index=True,
                            description="신한카드 / 삼성카드 / 현대카드 등")
    card_number_masked: Optional[str] = Field(default=None, max_length=20,
                                              description="카드번호 마지막 4자리 또는 마스킹")

    # 승인 정보
    approval_date: datetime.date = Field(index=True)
    approval_time: Optional[str] = Field(default=None, max_length=8,
                                          description="HHMMSS")
    approval_number: str = Field(max_length=32)

    # 가맹점 정보
    merchant_name: Optional[str] = Field(default=None, max_length=128, index=True,
                                          description="가맹점 이름 (예: GS25 화양점)")
    merchant_no: Optional[str] = Field(default=None, max_length=32)
    business_type: Optional[str] = Field(default=None, max_length=64,
                                          description="가맹점 업종 (예: 편의점)")

    # 금액
    amount: int = 0
    installment: Optional[int] = Field(default=None,
                                        description="할부 개월 (0 또는 NULL=일시불)")
    status: str = Field(default="승인", max_length=8,
                        description="승인 / 취소")

    # 추적
    source: str = Field(default="codef", max_length=16,
                        description="codef / manual / excel")
    source_meta: Optional[str] = Field(default=None, max_length=2000,
                                        description="CODEF 응답 raw JSON (debug)")
    connection_id: Optional[int] = Field(default=None,
                                          foreign_key="codefconnection.id")

    # 매입 연결 (Phase 3 자동 import 에서 채움)
    linked_daily_id: Optional[int] = Field(default=None,
                                            foreign_key="dailyexpense.id", index=True)
    pl_category: Optional[str] = Field(default=None, max_length=32,
                                        description="손익 카테고리 (Phase 3 자동분류)")

    synced_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
