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
    channel: str # Store, Coupang, Baemin
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
    channel: str = Field(index=True)          # 쿠팡/배민/요기요/땡겨요
    year: int = Field(index=True)
    month: int = Field(index=True)
    total_sales: int = 0                       # 총 주문금액
    total_fees: int = 0                        # 총 수수료 (차감금액)
    settlement_amount: int = 0                 # 정산금액 (실제 입금액)
    order_count: int = 0                       # 주문 건수
    fee_breakdown: Optional[str] = None        # 수수료 세부내역 (JSON)


class DailyExpense(SQLModel, table=True):
    __table_args__ = (
        Index("ix_dailyexpense_business_date", "business_id", "date"),
        Index("ix_dailyexpense_business_vendor", "business_id", "vendor_id"),
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

    linked_revenue_id: Optional[int] = Field(default=None, foreign_key="revenue.id", index=True)
    linked_expense_id: Optional[int] = Field(default=None, foreign_key="expense.id", index=True)
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
