from sqlmodel import Session, select, func
from models import MonthlyProfitLoss, DailyExpense, Vendor, Payroll, Revenue, DeliveryRevenue
import datetime

# 거래처 카테고리 → 손익계산서 필드 매핑
# Note: 인건비(expense_labor)는 Payroll/수동입력에서 관리 → sync_labor_cost 전용
#       sync_all_expenses에서 건드리지 않음
# Note: 퇴직금적립은 인건비의 10%로 자동계산됨 (sync_labor_cost)
# Note: 개인가계부는 P/L에 미포함 (사업외 비용)
CATEGORY_TO_PL_FIELD = {
    # ── 신규 카테고리 (2026 재편) ──
    "원재료비": "expense_ingredient",
    "소모품비": "expense_material",
    "수도광열비": "expense_utility",
    "임차료": "expense_rent",
    "수선비": "expense_repair",
    "감가상각비": "expense_depreciation",
    "세금과공과": "expense_tax",
    "보험료": "expense_insurance",
    # "인건비"는 sync_all_expenses에서 제외 — expense_labor는 급여대장/수동입력으로만 관리
    "카드수수료": "expense_card_fee",
    "기타경비": "expense_other",
    # ── 레거시 호환 (기존 DailyExpense 레코드) ──
    "식자재": "expense_ingredient",
    "재료비": "expense_ingredient",
    "제세공과금": "expense_utility",
    "임대료": "expense_rent",
    "임대관리비": "expense_rent",
    "부가가치세": "expense_tax",
    "사업소득세": "expense_tax",
    "근로소득세": "expense_tax",
    "기타비용": "expense_other",
    "other": "expense_other",
}

def sync_all_expenses(year: int, month: int, session: Session, business_id: int = None):
    """
    Aggregate DailyExpense by vendor category and update MonthlyProfitLoss.
    Uses vendor.category to determine which P/L field to update.
    """
    
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # Get all revenue vendor IDs to exclude from expense aggregation
    rev_vendor_stmt = select(Vendor).where(Vendor.vendor_type == "revenue")
    if business_id is not None:
        rev_vendor_stmt = rev_vendor_stmt.where(Vendor.business_id == business_id)
        
    revenue_vendor_ids = set(
        v.id for v in session.exec(rev_vendor_stmt).all()
    )

    # Get all daily expenses for the month with their vendor info
    exp_stmt = select(DailyExpense).where(DailyExpense.date >= start_date, DailyExpense.date < end_date)
    if business_id is not None:
        exp_stmt = exp_stmt.where(DailyExpense.business_id == business_id)

    expenses = session.exec(exp_stmt).all()
    
    # Filter out revenue vendor expenses
    expenses = [e for e in expenses if e.vendor_id not in revenue_vendor_ids]

    # Build vendor_id → category map
    vendor_ids = [e.vendor_id for e in expenses if e.vendor_id]
    vendor_category_map = {}
    if vendor_ids:
        vend_stmt = select(Vendor).where(Vendor.id.in_(vendor_ids))
        if business_id is not None:
            vend_stmt = vend_stmt.where(Vendor.business_id == business_id)
        vendors = session.exec(vend_stmt).all()
        vendor_category_map = {v.id: v.category for v in vendors}
    
    # Aggregate by category
    category_totals = {}
    for expense in expenses:
        category = None
        # First try vendor category
        if expense.vendor_id and vendor_category_map.get(expense.vendor_id):
            category = vendor_category_map[expense.vendor_id]
        # Fallback to expense's own category
        elif expense.category:
            category = expense.category
        
        if category:
            pl_field = CATEGORY_TO_PL_FIELD.get(category)
            if pl_field:
                category_totals[pl_field] = category_totals.get(pl_field, 0) + expense.amount
    
    # Find or create P/L record
    pl_stmt = select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    if business_id is not None:
        pl_stmt = pl_stmt.where(MonthlyProfitLoss.business_id == business_id)
        
    pl_record = session.exec(pl_stmt).first()
    
    if pl_record:
        # Get all fields that SHOULD be updated by this function
        managed_fields = set(CATEGORY_TO_PL_FIELD.values())
        # expense_labor, expense_retirement, expense_insurance, expense_insurance_employee, expense_tax_employee는 별도 관리 (sync_labor_cost)
        excluded_fields = {'expense_labor', 'expense_retirement', 'expense_insurance', 'expense_insurance_employee', 'expense_tax_employee'}
        managed_fields -= excluded_fields
        
        for field in managed_fields:
            if field in category_totals:
                setattr(pl_record, field, category_totals[field])
            else:
                setattr(pl_record, field, 0)

        session.add(pl_record)
    else:
        # Create new record with aggregated values
        pl_record = MonthlyProfitLoss(year=year, month=month, business_id=business_id, **category_totals)
        session.add(pl_record)
    
    session.commit()
    return category_totals


# ── Revenue vendor name → P/L revenue field mapping ──
# Delivery vendors are matched by keyword in vendor name
DELIVERY_NAME_TO_PL_FIELD = {
    "쿠팡": "revenue_coupang",
    "coupang": "revenue_coupang",
    "배민": "revenue_baemin",
    "배달의민족": "revenue_baemin",
    "baemin": "revenue_baemin",
    "요기요": "revenue_yogiyo",
    "yogiyo": "revenue_yogiyo",
    "땡겨요": "revenue_ddangyo",
    "ddangyo": "revenue_ddangyo",
}

def _match_delivery_pl_field(vendor_name: str) -> str:
    """Match a delivery vendor name to its P/L revenue field."""
    name_lower = vendor_name.lower()
    for keyword, field in DELIVERY_NAME_TO_PL_FIELD.items():
        if keyword.lower() in name_lower:
            return field
    # Fallback: unrecognized delivery vendor goes to store
    return "revenue_store"


def sync_revenue_to_pl(year: int, month: int, session: Session, business_id: int = None):
    """
    Unified revenue P/L sync: updates both store and delivery revenue fields.
    Calls sync_delivery_revenue_to_pl internally for delivery channels.
    """
    # sync_delivery_revenue_to_pl handles both delivery fields AND revenue_store
    result = sync_delivery_revenue_to_pl(year, month, session, business_id)
    return result


# ── Channel → P/L delivery field mapping ──
CHANNEL_TO_PL_FIELD = {
    "Coupang": "revenue_coupang",
    "Baemin": "revenue_baemin",
    "Yogiyo": "revenue_yogiyo",
    "Ddangyo": "revenue_ddangyo",
}


def sync_delivery_revenue_to_pl(year: int, month: int, session: Session, business_id: int = None):
    """
    Aggregate Revenue from DailyExpense using Vendor lookup.
    Updates MonthlyProfitLoss delivery and store revenue fields.
    Source of truth: DailyExpense table via Vendor.vendor_type == "revenue".
    """
    import datetime as dt

    start_date = dt.date(year, month, 1)
    if month == 12:
        end_date = dt.date(year + 1, 1, 1)
    else:
        end_date = dt.date(year, month + 1, 1)

    # Vendor name keyword → P/L field mapping
    keyword_field_map = {
        "쿠팡": "revenue_coupang",
        "배달의민족": "revenue_baemin",
        "배민": "revenue_baemin",
        "요기요": "revenue_yogiyo",
        "땡겨요": "revenue_ddangyo",
    }

    # 1. Get all revenue vendors
    vend_stmt = select(Vendor).where(Vendor.vendor_type == "revenue")
    if business_id is not None:
        vend_stmt = vend_stmt.where(Vendor.business_id == business_id)
        
    revenue_vendors = session.exec(vend_stmt).all()
    vendor_map = {v.id: v for v in revenue_vendors}
    vendor_ids = list(vendor_map.keys())

    delivery_totals = {}
    store_total = 0

    if vendor_ids:
        # 2. Get all DailyExpense records for these vendors
        exp_stmt = select(DailyExpense).where(
            DailyExpense.vendor_id.in_(vendor_ids),
            DailyExpense.date >= start_date,
            DailyExpense.date < end_date,
        )
        if business_id is not None:
            exp_stmt = exp_stmt.where(DailyExpense.business_id == business_id)
            
        records = session.exec(exp_stmt).all()

        for r in records:
            v = vendor_map.get(r.vendor_id)
            cat = v.category if v else (r.category or "store")
            
            if cat == "delivery":
                field = None
                for keyword, f in keyword_field_map.items():
                    if keyword in (v.name or "") or keyword in (r.vendor_name or ""):
                        field = f
                        break
                if field:
                    delivery_totals[field] = delivery_totals.get(field, 0) + (r.amount or 0)
                else:
                    # Fallback to store revenue if unmapped delivery
                    store_total += (r.amount or 0)
            else:
                # store category or others
                store_total += (r.amount or 0)

    # All managed fields
    managed_fields = {"revenue_coupang", "revenue_baemin", "revenue_yogiyo", "revenue_ddangyo"}

    # Find or create P/L record
    pl_stmt = select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    if business_id is not None:
        pl_stmt = pl_stmt.where(MonthlyProfitLoss.business_id == business_id)
        
    pl_record = session.exec(pl_stmt).first()

    if pl_record:
        for field in managed_fields:
            setattr(pl_record, field, delivery_totals.get(field, 0))
        pl_record.revenue_store = store_total
        session.add(pl_record)
    else:
        pl_record = MonthlyProfitLoss(year=year, month=month, business_id=business_id, revenue_store=store_total)
        for field in managed_fields:
            setattr(pl_record, field, delivery_totals.get(field, 0))
        session.add(pl_record)

    session.commit()
    delivery_totals["revenue_store"] = store_total
    return delivery_totals


def sync_summary_material_cost(year: int, month: int, session: Session, business_id: int = None):
    """Aggregate DailyExpense '재료비' for a given month and update MonthlyProfitLoss"""
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # Calculate sum of material expenses from DailyExpense
    exp_stmt = select(func.sum(DailyExpense.amount)).where(
        DailyExpense.date >= start_date, 
        DailyExpense.date < end_date,
        DailyExpense.category == "재료비"
    )
    if business_id is not None:
        exp_stmt = exp_stmt.where(DailyExpense.business_id == business_id)
        
    total_material = session.exec(exp_stmt).one() or 0
    
    # Find or create summary record
    pl_stmt = select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    if business_id is not None:
        pl_stmt = pl_stmt.where(MonthlyProfitLoss.business_id == business_id)
        
    pl_record = session.exec(pl_stmt).first()
    
    if pl_record:
        pl_record.expense_material = int(total_material)
        session.add(pl_record)
    else:
        pass
    
    session.commit()

def sync_labor_cost(year: int, month: int, session: Session, business_id: int = None):
    """
    Aggregate all Payroll total_pay for a given month and update MonthlyProfitLoss.expense_labor
    Also calculates:
      - expense_retirement as 10% of labor cost
      - expense_insurance as employer-side 4대보험 (matches employee deductions)
    """
    
    month_str = f"{year}-{month:02d}"
    
    # Fetch all payroll records for the month
    pay_stmt = select(Payroll).where(Payroll.month == month_str)
    if business_id is not None:
        pay_stmt = pay_stmt.where(Payroll.business_id == business_id)
        
    payrolls = session.exec(pay_stmt).all()
    
    # Calculate employee-side 4대보험 deductions
    employee_insurance = sum(
        (p.deduction_np or 0) + (p.deduction_hi or 0) + 
        (p.deduction_lti or 0) + (p.deduction_ei or 0) 
        for p in payrolls
    )
    
    # Calculate employee-side withholding tax (소득세 + 지방소득세)
    employee_tax = sum(
        (p.deduction_it or 0) + (p.deduction_lit or 0) 
        for p in payrolls
    )
    
    # Calculate net pay (실수령액) = total_pay - all deductions
    total_labor_net = sum(p.total_pay or 0 for p in payrolls) - employee_insurance - employee_tax
    
    # 사업주 세금 대납 (bonus_tax_support): 정규직 등 사업주가 공제액을 대신 부담하는 경우
    # 해당 직원의 인건비는 실수령액이 아니라 총지급액(gross) 기준으로 반영
    tax_support_total = sum(p.bonus_tax_support or 0 for p in payrolls)
    total_labor_net += tax_support_total
    
    # Calculate retirement fund as 10% of gross labor cost (세전 기준 유지)
    total_labor_gross = sum(p.total_pay or 0 for p in payrolls) + tax_support_total
    retirement_fund = int(total_labor_gross * 0.1)
    
    # Employer-side 4대보험료 = employee deductions (노사 반반)
    employer_insurance = employee_insurance
    
    # Find or create MonthlyProfitLoss record
    pl_stmt = select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    if business_id is not None:
        pl_stmt = pl_stmt.where(MonthlyProfitLoss.business_id == business_id)
        
    pl_record = session.exec(pl_stmt).first()
    
    if pl_record:
        pl_record.expense_labor = total_labor_net
        pl_record.expense_retirement = retirement_fund
        pl_record.expense_insurance = employer_insurance
        pl_record.expense_insurance_employee = employee_insurance
        pl_record.expense_tax_employee = employee_tax
        session.add(pl_record)
    else:
        pl_record = MonthlyProfitLoss(
            year=year,
            month=month,
            business_id=business_id,
            expense_labor=total_labor_net,
            expense_retirement=retirement_fund,
            expense_insurance=employer_insurance,
            expense_insurance_employee=employee_insurance,
            expense_tax_employee=employee_tax,
        )
        session.add(pl_record)
    
    session.commit()
    return total_labor_net
