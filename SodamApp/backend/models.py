from typing import Optional, List
from sqlmodel import Field, Session, SQLModel, create_engine, select, Relationship
import datetime
from datetime import time

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
    
    products: List["Product"] = Relationship(back_populates="vendor")
    expenses: List["Expense"] = Relationship(back_populates="vendor")
    daily_expenses: List["DailyExpense"] = Relationship(back_populates="vendor")

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
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

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date
    amount: int
    category: str  # e.g., "식자재", "월세"
    payment_method: str = "Card"
    description: Optional[str] = None
    
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    vendor: Optional[Vendor] = Relationship(back_populates="expenses")

class Revenue(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date
    channel: str # Store, Coupang, Baemin
    amount: int
    description: Optional[str] = None

class CompanyHoliday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime.date = Field(index=True, unique=True)
    description: Optional[str] = None

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
    contract_type: str = Field(default="아르바이트") # 정규직, 아르바이트, 일용직
    insurance_4major: bool = Field(default=False) # 4대보험 가입여부
    insurance_base_salary: int = Field(default=0) # 보수월액 (4대보험 산정 기준 신고 월 보수액)
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
    user: Optional["User"] = Relationship(back_populates="staff")

# --- Finance (Card Sales) ---

class CardSalesApproval(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
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
    id: Optional[int] = Field(default=None, primary_key=True)
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
    role: str = Field(default="staff") # admin, staff
    grade: str = Field(default="normal") # normal, vip, vvip, admin
    
    # Social Login Fields
    provider: Optional[str] = None # google, naver, kakao
    provider_id: Optional[str] = None
    email: Optional[str] = None
    real_name: Optional[str] = None
    profile_image: Optional[str] = None
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id")
    staff: Optional[Staff] = Relationship(back_populates="user")

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


class StaffDocument(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: int = Field(foreign_key="staff.id")
    doc_type: str # 'contract', 'health_cert', 'id_copy', 'bank_copy'
    file_path: str
    original_filename: str
    upload_date: datetime.datetime = Field(default_factory=datetime.datetime.now)
    
    staff: Optional[Staff] = Relationship(back_populates="documents")

class WorkLocation(SQLModel, table=True):
    """매장 위치 및 Geofence 설정"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "소담김밥"
    latitude: float = 0.0
    longitude: float = 0.0
    radius_meters: int = 100  # 허용 반경 (기본 100m)
    is_active: bool = True

class Attendance(SQLModel, table=True):
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

class Payroll(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    month: str # YYYY-MM
    base_pay: int = 0
    bonus: int = 0
    deductions: int = 0
    total_pay: int = 0
    
    # Detailed Bonus (Earnings)
    bonus_meal: int = 0 # 식비지원
    bonus_tax_support: int = 0 # 제세공과금 지원금 (정규직용 - 회사 부담 세금/보험)
    bonus_holiday: int = 0 # 주휴수당
    
    # Weekly Holiday Allowance
    holiday_w1: int = 0
    holiday_w2: int = 0
    holiday_w3: int = 0
    holiday_w4: int = 0
    holiday_w5: int = 0
    
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
    id: Optional[int] = Field(default=None, primary_key=True)
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
    expense_insurance: int = 0    # 보험료 (4대보험·화재보험)
    expense_card_fee: int = 0     # 카드수수료
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
    id: Optional[int] = Field(default=None, primary_key=True)
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
    filename: str
    upload_type: str  # 'expense', 'revenue'
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    record_count: int = 0
    status: str = Field(default="active")  # 'active', 'rolled_back'


# --- AI Auto-Learning Rules ---

class VendorRule(SQLModel, table=True):
    """사용자 행동으로부터 학습된 매입 분류 규칙"""
    id: Optional[int] = Field(default=None, primary_key=True)
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


class EmergencyContact(SQLModel, table=True):
    """비상연락처"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # 업체/서비스명 (예: 쿠팡이츠 AS센터)
    phone: str  # 전화번호
    category: str = ""  # 분류 (배달앱, 장비AS, 기타)
    store_id: str = ""  # 매장 아이디
    note: str = ""  # 비고
    display_order: int = Field(default=0)


class Announcement(SQLModel, table=True):
    """회사 공지사항"""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str = ""
    pinned: bool = Field(default=False)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


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


class StaffChatMessage(SQLModel, table=True):
    """직원소통방 메시지"""
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id", index=True)
    staff_name: str = ""
    message: str
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)


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

