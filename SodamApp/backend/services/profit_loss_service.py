from sqlmodel import Session, select, func
from models import MonthlyProfitLoss, DailyExpense, Vendor, Payroll, DeliveryRevenue
import datetime
import calendar as _calendar
from services.auto_collection_sync.calendar import is_business_day


# 발생주의 귀속 — 임차료 등은 익월 1~4일에 휴일 사유로 미뤄 이체된 경우 전월로 귀속.
# 사장님 정책 (2026-05-13): "휴일 문제로 익월 1~4일 중에 지급되는 경우 실제 지급된 이전달로 계상".
ACCRUAL_CATEGORIES = {"임차료", "임대료", "임대관리비"}


def _accrual_year_month(expense_date: datetime.date, category: str | None) -> tuple[int, int]:
    """발생주의 카테고리는 휴일 미뤄짐 케이스에 한해 전월로 귀속.

    조건: 카테고리가 ACCRUAL_CATEGORIES + expense_date 가 1~4일 + 전월 말일이 비영업일.
    그 외는 expense_date.year / expense_date.month 그대로.
    """
    if category not in ACCRUAL_CATEGORIES or expense_date.day > 4:
        return (expense_date.year, expense_date.month)
    prev_year = expense_date.year - 1 if expense_date.month == 1 else expense_date.year
    prev_month = 12 if expense_date.month == 1 else expense_date.month - 1
    last_day = _calendar.monthrange(prev_year, prev_month)[1]
    last_date = datetime.date(prev_year, prev_month, last_day)
    if is_business_day(last_date):
        return (expense_date.year, expense_date.month)
    return (prev_year, prev_month)

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
    "배달앱수수료": "expense_delivery_fee",
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

# 4대보험(국민연금·건강보험·고용보험·산재보험) 공단 납부 출금은 인건비 섹션의
# "4대보험료(사업주)+(직원)" 줄(Payroll 파생)에 이미 반영됨. 은행 출금을 세금과공과/
# 기타경비로 또 잡으면 이중계상 → 카드대금과 동일하게 P/L 집계에서 제외한다.
# (category '4대보험납부' 는 CATEGORY_TO_PL_FIELD 에 없어 자동 제외되지만, 월별로
#  거래처명이 바뀌는 신규 은행 거래처가 오분류돼도 걸러지도록 거래처명 키워드로도 차단.)
FOUR_INSURANCE_CATEGORY = "4대보험납부"
FOUR_INSURANCE_KEYWORDS = ("국민건강", "건강보험", "국민연금", "고용보험", "산재보험")

def is_four_insurance_payment(vendor_name: str, category: str = None) -> bool:
    if category == FOUR_INSURANCE_CATEGORY:
        return True
    n = vendor_name or ""
    return any(k in n for k in FOUR_INSURANCE_KEYWORDS)

def sync_all_expenses(year: int, month: int, session: Session, business_id: int = None):
    """Aggregate DailyExpense by vendor category and update MonthlyProfitLoss.

    발생주의 (사장님 정책 2026-05-13): 임차료 등 ACCRUAL_CATEGORIES 는
    익월 1~4일 + 전월 말일이 비영업일이면 전월로 귀속.
    → 이번 달 sync 시 (a) 이번 달 expense 중 다른 달로 귀속될 것 제외 +
        (b) 다음 달 1~4일 expense 중 이번 달로 귀속될 것 포함.
    """
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)

    # 다음 달 1~4일 (발생주의 캐리오버 후보)
    accrual_lookahead_end = end_date + datetime.timedelta(days=4)

    rev_vendor_stmt = select(Vendor).where(Vendor.vendor_type == "revenue")
    if business_id is not None:
        rev_vendor_stmt = rev_vendor_stmt.where(Vendor.business_id == business_id)
    revenue_vendor_ids = set(v.id for v in session.exec(rev_vendor_stmt).all())

    # 이번 달 + 다음 달 1~4일 expense 조회 (발생주의 룩어헤드 포함)
    exp_stmt = select(DailyExpense).where(
        DailyExpense.date >= start_date,
        DailyExpense.date < accrual_lookahead_end,
    )
    if business_id is not None:
        exp_stmt = exp_stmt.where(DailyExpense.business_id == business_id)
    expenses = session.exec(exp_stmt).all()
    expenses = [e for e in expenses if e.vendor_id not in revenue_vendor_ids]

    vendor_ids = [e.vendor_id for e in expenses if e.vendor_id]
    vendor_category_map = {}
    if vendor_ids:
        vend_stmt = select(Vendor).where(Vendor.id.in_(vendor_ids))
        if business_id is not None:
            vend_stmt = vend_stmt.where(Vendor.business_id == business_id)
        vendors = session.exec(vend_stmt).all()
        vendor_category_map = {v.id: v.category for v in vendors}

    category_totals = {}
    for expense in expenses:
        category = None
        if expense.vendor_id and vendor_category_map.get(expense.vendor_id):
            category = vendor_category_map[expense.vendor_id]
        elif expense.category:
            category = expense.category
        if not category:
            continue

        # 4대보험 공단 납부는 인건비 섹션에 이미 반영 → 이중계상 방지로 제외
        if is_four_insurance_payment(expense.vendor_name, category):
            continue

        # 발생주의 귀속 판정 — 이 expense 가 (year, month) 에 귀속되는지
        ay, am = _accrual_year_month(expense.date, category)
        if (ay, am) != (year, month):
            continue

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
        # 별도 관리되는 필드 — sync_all_expenses에서 건드리지 않음:
        #  - expense_labor/retirement/insurance*/tax_employee: sync_labor_cost (급여대장)
        #  - expense_delivery_fee: sync_delivery_revenue_to_pl (DeliveryRevenue.total_fees)
        #  - expense_card_fee: 은행 입금내역 업로드 시 (card_sales - card_deposit)
        excluded_fields = {
            'expense_labor', 'expense_retirement',
            'expense_insurance', 'expense_insurance_employee', 'expense_tax_employee',
            'expense_delivery_fee', 'expense_card_fee',
        }
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
    # Korean variants stored in DB
    "쿠팡": "revenue_coupang",
    "쿠팡이츠": "revenue_coupang",
    "배민": "revenue_baemin",
    "배달의민족": "revenue_baemin",
    "요기요": "revenue_yogiyo",
    "땡겨요": "revenue_ddangyo",
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

    # ── Override delivery revenue with total_sales from DeliveryRevenue ──
    # DeliveryRevenue stores both total_sales (주문금액) and settlement (정산금).
    # P/L should show total_sales as revenue, with fees as separate expense.
    #
    # 단, total_sales=0 인 placeholder 행은 DailyExpense 의 자동수집 매출을
    # 0 으로 덮어쓰지 않도록 무시. (사장님이 정산서 직접 업로드한 경우만 override.)
    from models import DeliveryRevenue
    dr_stmt = select(DeliveryRevenue).where(DeliveryRevenue.year == year, DeliveryRevenue.month == month)
    if business_id is not None:
        dr_stmt = dr_stmt.where(DeliveryRevenue.business_id == business_id)
    dr_records = session.exec(dr_stmt).all()

    # total_sales > 0 인 행만 override 대상. 나머지 (placeholder) 는 무시.
    dr_active = [dr for dr in dr_records if (dr.total_sales or 0) > 0]
    for dr in dr_active:
        pl_field = CHANNEL_TO_PL_FIELD.get(dr.channel)
        if pl_field:
            delivery_totals[pl_field] = dr.total_sales  # 총매출 (수수료 차감 전)

    # Also recalculate delivery fee from DeliveryRevenue (active rows only)
    total_delivery_fees = sum(dr.total_fees or 0 for dr in dr_active)

    # Find or create P/L record
    pl_stmt = select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    if business_id is not None:
        pl_stmt = pl_stmt.where(MonthlyProfitLoss.business_id == business_id)
        
    pl_record = session.exec(pl_stmt).first()

    if pl_record:
        for field in managed_fields:
            setattr(pl_record, field, delivery_totals.get(field, 0))
        pl_record.revenue_store = store_total
        pl_record.expense_delivery_fee = total_delivery_fees
        session.add(pl_record)
    else:
        pl_record = MonthlyProfitLoss(year=year, month=month, business_id=business_id, revenue_store=store_total,
                                       expense_delivery_fee=total_delivery_fees)
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
    """Aggregate Payroll into MonthlyProfitLoss — 옵션 A (사장님 정책 2026-05-13).

    인건비 = "직원 통장에 실제 송금된 금액". 즉:
      - 세금대납 직원 (bonus_tax_support > 0): gross (공제 안 함)
      - 일반 직원: gross - 4대보험·세금 공제
    transfer_status == "완료" 인 Payroll 만 카운트 (미지급 직원 미반영).

    세금대납액 + 4대보험·세금 (사업주 대납분) 은 별도 expense_insurance / expense_tax_employee
    행에 표시되므로 인건비에 중복 합산하지 않음.
    """
    month_str = f"{year}-{month:02d}"

    pay_stmt = select(Payroll).where(
        Payroll.month == month_str,
        Payroll.transfer_status == "완료",
    )
    if business_id is not None:
        pay_stmt = pay_stmt.where(Payroll.business_id == business_id)

    payrolls = session.exec(pay_stmt).all()

    employee_insurance = sum(
        (p.deduction_np or 0) + (p.deduction_hi or 0) +
        (p.deduction_lti or 0) + (p.deduction_ei or 0)
        for p in payrolls
    )
    employee_tax = sum(
        (p.deduction_it or 0) + (p.deduction_lit or 0)
        for p in payrolls
    )
    gross_pay_sum = sum((p.base_pay or 0) + (p.bonus_holiday or 0) for p in payrolls)

    # 옵션 A: 실제 직원 통장 송금액
    # 세금대납 직원 (bonus_tax_support > 0) 은 공제 안 함 (CLAUDE.md 급여규칙).
    transfer_total = 0
    for p in payrolls:
        p_gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        p_deduct = (
            (p.deduction_np or 0) + (p.deduction_hi or 0)
            + (p.deduction_lti or 0) + (p.deduction_ei or 0)
            + (p.deduction_it or 0) + (p.deduction_lit or 0)
        )
        if (p.bonus_tax_support or 0) > 0:
            transfer_total += p_gross
        else:
            transfer_total += p_gross - p_deduct
    total_labor_net = transfer_total

    retirement_fund = int(gross_pay_sum * 0.1)
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


# ========== Task 10: Cron 손익 재계산 진입점 ==========

def recalc_all_businesses(session: Session) -> dict:
    """모든 활성 사업장의 이번달 + 지난달 P/L 재계산.

    기존 per-business helper 들 (sync_revenue_to_pl + sync_all_expenses) 을
    wrap. 자동수집 03:40 cron `/cron/profit-loss` 진입점.

    Returns:
        dict with keys:
          - business_count: 활성 사업장 수
          - months_recomputed: 정상 처리된 (business, month) 조합 수
          - errors: 실패한 (business, month) 조합 수 (로그만 남기고 continue)
    """
    from models import Business

    today = datetime.date.today()
    this_year, this_month = today.year, today.month
    if this_month == 1:
        prev_year, prev_month = this_year - 1, 12
    else:
        prev_year, prev_month = this_year, this_month - 1

    bizs = session.exec(
        select(Business).where(Business.subscription_status == "active")
    ).all()

    counts = {"business_count": len(bizs), "months_recomputed": 0, "errors": 0}
    for biz in bizs:
        for (yr, mo) in [(prev_year, prev_month), (this_year, this_month)]:
            try:
                # 기존 sync 함수 호출 — 같은 패턴 (year, month, session, biz_id) 시그니처.
                # sync_revenue_to_pl 은 내부에서 sync_delivery_revenue_to_pl 도 호출.
                sync_revenue_to_pl(yr, mo, session, biz.id)
                sync_all_expenses(yr, mo, session, biz.id)
                counts["months_recomputed"] += 1
            except Exception as e:  # noqa: BLE001
                counts["errors"] += 1
                import logging
                logging.getLogger("profit_loss.recalc").warning(
                    "recalc failed business=%s %d-%02d: %s", biz.id, yr, mo, e
                )
    return counts
