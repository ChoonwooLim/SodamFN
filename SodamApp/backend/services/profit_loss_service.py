from sqlmodel import Session, select, func
from models import MonthlyProfitLoss, DailyExpense, Vendor, Payroll
import datetime

# 거래처 카테고리 → 손익계산서 필드 매핑
# Note: 인건비는 Payroll 데이터에서 동기화됨 (sync_labor_cost)
CATEGORY_TO_PL_FIELD = {
    "임대료": "expense_rent",
    "임대관리비": "expense_rent_fee",
    "재료비": "expense_material",
    "식자재": "expense_material",
    "제세공과금": "expense_utility",
    "카드수수료": "expense_card_fee",
    "부가가치세": "expense_vat",
    "사업소득세": "expense_biz_tax",
    "근로소득세": "expense_income_tax",
    "퇴직금적립": "expense_retirement",
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
    
    # Get all daily expenses for the month with their vendor info
    expenses = session.exec(
        select(DailyExpense)
        .where(DailyExpense.date >= start_date, DailyExpense.date < end_date)
    ).all()
    
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
        
        for field in managed_fields:
            if field in category_totals:
                setattr(pl_record, field, category_totals[field])
            else:
                # If no expenses for this category found, set to 0?
                # Yes, otherwise stale data persists.
                # Be careful not to overwrite if logic is split. Use caution.
                # Assuming this function owns these fields.
                setattr(pl_record, field, 0)

        session.add(pl_record)
    else:
        # Create new record with aggregated values
        pl_record = MonthlyProfitLoss(year=year, month=month, **category_totals)
        session.add(pl_record)
    
    session.commit()
    return category_totals

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
    This includes all staff payroll (base pay + bonuses - deductions = net pay to employees)
    """
    
    month_str = f"{year}-{month:02d}"
    
    # Calculate sum of all payroll total_pay for the month
    total_labor = session.exec(
        select(func.sum(Payroll.total_pay))
        .where(Payroll.month == month_str)
    ).one() or 0
    
    # Find or create MonthlyProfitLoss record
    pl_record = session.exec(
        select(MonthlyProfitLoss)
        .where(MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month)
    ).first()
    
    if pl_record:
        pl_record.expense_labor = int(total_labor)
        session.add(pl_record)
    else:
        # Create a new record if it doesn't exist
        pl_record = MonthlyProfitLoss(
            year=year,
            month=month,
            expense_labor=int(total_labor)
        )
        session.add(pl_record)
    
    session.commit()
    return int(total_labor)
