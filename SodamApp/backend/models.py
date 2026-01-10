from typing import Optional, List
from sqlmodel import Field, Session, SQLModel, create_engine, select, Relationship
from datetime import date, time, datetime

# --- Financials ---

class Vendor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    category: Optional[str] = None
    contact_info: Optional[str] = None
    
    products: List["Product"] = Relationship(back_populates="vendor")
    expenses: List["Expense"] = Relationship(back_populates="vendor")

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    unit_price: int = 0
    
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    vendor: Optional[Vendor] = Relationship(back_populates="products")
    
    inventory: Optional["Inventory"] = Relationship(back_populates="product")

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date
    amount: int
    category: str  # e.g., "식자재", "월세"
    payment_method: str = "Card"
    description: Optional[str] = None
    
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    vendor: Optional[Vendor] = Relationship(back_populates="expenses")

class Revenue(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date
    channel: str # Store, Coupang, Baemin
    amount: int
    description: Optional[str] = None

# --- Operations (Inventory) ---

class Inventory(SQLModel, table=True):
    product_id: Optional[int] = Field(default=None, foreign_key="product.id", primary_key=True)
    product: Optional[Product] = Relationship(back_populates="inventory")
    
    current_stock: float = 0.0
    safety_stock: float = 0.0
    last_checked_at: datetime = Field(default_factory=datetime.now)

# --- HR & Payroll ---

class Staff(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str # e.g., "Manager", "Part-time"
    hourly_wage: int
    start_date: date
    bank_account: Optional[str] = None
    status: str = Field(default="재직") # 재직 / 퇴사
    
    # HR Details
    phone: Optional[str] = None
    contract_type: str = Field(default="아르바이트") # 정규직, 아르바이트, 일용직
    insurance_4major: bool = Field(default=False) # 4대보험 가입여부
    monthly_salary: int = Field(default=0) # 월급 (if applicable)
    work_schedule: Optional[str] = None # 근무시간 (e.g. "09:00~18:00")
    
    # Document Checklist (Submitted?)
    doc_contract: bool = Field(default=False) # 근로계약서
    doc_health_cert: bool = Field(default=False) # 보건증
    doc_id_copy: bool = Field(default=False) # 신분증 사본
    doc_bank_copy: bool = Field(default=False) # 통장 사본
    
    attendances: List["Attendance"] = Relationship(back_populates="staff")
    payrolls: List["Payroll"] = Relationship(back_populates="staff")
    documents: List["StaffDocument"] = Relationship(back_populates="staff")

class StaffDocument(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    staff_id: int = Field(foreign_key="staff.id")
    doc_type: str # 'contract', 'health_cert', 'id_copy', 'bank_copy'
    file_path: str
    original_filename: str
    upload_date: datetime = Field(default_factory=datetime.now)
    
    staff: Optional[Staff] = Relationship(back_populates="documents")

class Attendance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    total_hours: float = 0.0
    status: str = "Normal" # Normal, Late, Absent
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id")
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
    
    staff_id: Optional[int] = Field(default=None, foreign_key="staff.id")
    staff: Optional[Staff] = Relationship(back_populates="payrolls")
