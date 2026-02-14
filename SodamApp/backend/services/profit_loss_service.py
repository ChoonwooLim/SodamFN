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

def sync_all_expenses(year: int, month: int, session: Session):
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
    revenue_vendor_ids = set(
        v.id for v in session.exec(
            select(Vendor).where(Vendor.vendor_type == "revenue")
        ).all()
    )

    # Get all daily expenses for the month with their vendor info
    expenses = session.exec(
        select(DailyExpense)
        .where(DailyExpense.date >= start_date, DailyExpense.date < end_date)
    ).all()
    
    # Filter out revenue vendor expenses
    expenses = [e for e in expenses if e.vendor_id not in revenue_vendor_ids]

    # Build vendor_id → category map
    vendor_ids = [e.vendor_id for e in expenses if e.vendor_id]
    vendor_category_map = {}
    if vendor_ids:
        vendors = session.exec(select(Vendor).where(Vendor.id.in_(vendor_ids))).all()
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
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        # Update fields from aggregated totals
        # Reset mapped fields first to ensure removed categories are cleared?
        # Ideally yes, but current logic just overwrites. If a category total becomes 0, it won't be in dict?
        # Current logic: 
        # for field, total in category_totals.items(): setattr...
        
        # IMPROVEMENT: We should reset all expense fields before setting new totals
        # to handle cases where all expenses of a certain category were removed or re-categorized.
        for field in CATEGORY_TO_PL_FIELD.values():
            # Don't reset fields not managed by this sync if any? 
            # All fields in map are managed here.
            # But wait, sync_labor_cost manages expense_labor.
            # sync_summary_material_cost manages expense_material.
            # This function syncs ALL mapped expenses.
            # expense_labor is NOT in CATEGORY_TO_PL_FIELD map normally?
            # Let's check map: '인건비' is not in map.
            # Wait, user added '인건비' in frontend ProfitLoss.jsx map, but 
            # in backend CATEGORY_TO_PL_FIELD (lines 65-76), '인건비' is NOT there.
            # If '인건비' is not there, this function won't touch expense_labor.
            pass

        # We should iterate through all possible PL fields this function is responsible for and set them.
        # But for now, let's stick to existing logic to minimize risk, 
        # but ADD logic to update fields to 0 if they are not in category_totals but ARE in CATEGORY_TO_PL_FIELD values.
        
        # Get all fields that SHOULD be updated by this function
        managed_fields = set(CATEGORY_TO_PL_FIELD.values())
        # expense_labor, expense_retirement은 별도 관리 (sync_labor_cost / 수동입력)
        excluded_fields = {'expense_labor', 'expense_retirement'}
        managed_fields -= excluded_fields
        
        for field in managed_fields:
            if field in category_totals:
                setattr(pl_record, field, category_totals[field])
            else:
                setattr(pl_record, field, 0)

        session.add(pl_record)
    else:
        # Create new record with aggregated values
        pl_record = MonthlyProfitLoss(year=year, month=month, **category_totals)
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


def sync_revenue_to_pl(year: int, month: int, session: Session):
    """
    Unified revenue P/L sync: updates both store and delivery revenue fields.
    Calls sync_delivery_revenue_to_pl internally for delivery channels.
    """
    # sync_delivery_revenue_to_pl handles both delivery fields AND revenue_store
    result = sync_delivery_revenue_to_pl(year, month, session)
    return result


# ── Channel → P/L delivery field mapping ──
CHANNEL_TO_PL_FIELD = {
    "Coupang": "revenue_coupang",
    "Baemin": "revenue_baemin",
    "Yogiyo": "revenue_yogiyo",
    "Ddangyo": "revenue_ddangyo",
}


def sync_delivery_revenue_to_pl(year: int, month: int, session: Session):
    """
    Aggregate DailyExpense (delivery category) by vendor keyword
    and update MonthlyProfitLoss delivery revenue fields.
    Source of truth: DailyExpense table (same as grid view).
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

    # Get all delivery DailyExpense for this month
    records = session.exec(
        select(DailyExpense)
        .where(
            DailyExpense.category == "delivery",
            DailyExpense.date >= start_date,
            DailyExpense.date < end_date,
        )
    ).all()

    # Aggregate by P/L field
    delivery_totals = {}
    for r in records:
        field = None
        for keyword, f in keyword_field_map.items():
            if keyword in (r.vendor_name or ""):
                field = f
                break
        if field:
            delivery_totals[field] = delivery_totals.get(field, 0) + (r.amount or 0)

    # Fallback: if no delivery DailyExpense found, read from DeliveryRevenue table
    if not delivery_totals:
        dr_channel_map = {
            "쿠팡": "revenue_coupang",
            "배민": "revenue_baemin",
            "요기요": "revenue_yogiyo",
            "땡겨요": "revenue_ddangyo",
        }
        dr_records = session.exec(
            select(DeliveryRevenue)
            .where(DeliveryRevenue.year == year, DeliveryRevenue.month == month)
        ).all()
        for dr in dr_records:
            field = dr_channel_map.get(dr.channel)
            if field:
                delivery_totals[field] = delivery_totals.get(field, 0) + (dr.settlement_amount or 0)

    # Also sync revenue_store from store category
    # FIX: Use vendor_id to identify store revenue, not just category label
    # This ensures we catch all records from store vendors even if category is missing/mismatched on the record
    store_vendors = session.exec(
        select(Vendor).where(
            Vendor.vendor_type == "revenue", 
            Vendor.category == "store"
        )
    ).all()
    store_vendor_ids = [v.id for v in store_vendors]

    if store_vendor_ids:
        store_records = session.exec(
            select(DailyExpense)
            .where(
                DailyExpense.vendor_id.in_(store_vendor_ids),
                DailyExpense.date >= start_date,
                DailyExpense.date < end_date,
            )
        ).all()
        store_total = sum(r.amount or 0 for r in store_records)
    else:
        store_total = 0

    # All managed fields
    managed_fields = {"revenue_coupang", "revenue_baemin", "revenue_yogiyo", "revenue_ddangyo"}

    # Find or create P/L record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()

    if pl_record:
        for field in managed_fields:
            setattr(pl_record, field, delivery_totals.get(field, 0))
        pl_record.revenue_store = store_total
        session.add(pl_record)
    else:
        pl_record = MonthlyProfitLoss(year=year, month=month, revenue_store=store_total)
        for field, val in delivery_totals.items():
            setattr(pl_record, field, val)
        session.add(pl_record)

    session.commit()
    delivery_totals["revenue_store"] = store_total
    return delivery_totals


def sync_summary_material_cost(year: int, month: int, session: Session):
    """Aggregate DailyExpense '재료비' for a given month and update MonthlyProfitLoss"""
    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)
    
    # Calculate sum of material expenses from DailyExpense
    total_material = session.exec(
        select(func.sum(DailyExpense.amount))
        .where(
            DailyExpense.date >= start_date, 
            DailyExpense.date < end_date,
            DailyExpense.category == "재료비"
        )
    ).one() or 0
    
    # Find or create summary record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        pl_record.expense_material = int(total_material)
        session.add(pl_record)
    else:
        pass
    
    session.commit()


def sync_labor_cost(year: int, month: int, session: Session):
    """
    Aggregate all Payroll total_pay for a given month and update MonthlyProfitLoss.expense_labor
    Also calculates expense_retirement as 10% of labor cost.
    """
    
    month_str = f"{year}-{month:02d}"
    
    # Calculate sum of all payroll total_pay for the month
    total_labor = session.exec(
        select(func.sum(Payroll.total_pay))
        .where(Payroll.month == month_str)
    ).one() or 0
    
    # Calculate retirement fund as 10% of labor cost
    retirement_fund = int(int(total_labor) * 0.1)
    
    # Find or create MonthlyProfitLoss record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        pl_record.expense_labor = int(total_labor)
        pl_record.expense_retirement = retirement_fund
        session.add(pl_record)
    else:
        # Create a new record if it doesn't exist
        pl_record = MonthlyProfitLoss(
            year=year,
            month=month,
            expense_labor=int(total_labor),
            expense_retirement=retirement_fund
        )
        session.add(pl_record)
    
    session.commit()
    return int(total_labor)
