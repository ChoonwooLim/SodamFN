"""Compare P/L data with actual DailyExpense sums for Jan 2026"""
import sys, os, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor, MonthlyProfitLoss, Revenue

with Session(engine) as s:
    yr, mn = 2026, 1
    start = datetime.date(yr, mn, 1)
    end = datetime.date(yr, mn+1, 1)

    # 1. Revenue vendors
    rvs = s.exec(select(Vendor).where(Vendor.vendor_type == "revenue")).all()
    rv_ids = [v.id for v in rvs]
    rev_de = s.exec(select(DailyExpense).where(
        DailyExpense.vendor_id.in_(rv_ids),
        DailyExpense.date >= start, DailyExpense.date < end
    )).all()
    
    store_total = sum(e.amount for e in rev_de if any(v.id == e.vendor_id and v.category == 'store' for v in rvs))
    
    delivery_by_vendor = {}
    for e in rev_de:
        v = next((v for v in rvs if v.id == e.vendor_id), None)
        if v and v.category == 'delivery':
            delivery_by_vendor[v.name] = delivery_by_vendor.get(v.name, 0) + e.amount

    # 2. Expense vendors
    evs = s.exec(select(Vendor).where(Vendor.vendor_type == "expense")).all()
    ev_ids = [v.id for v in evs]
    exp_de = s.exec(select(DailyExpense).where(
        DailyExpense.vendor_id.in_(ev_ids),
        DailyExpense.date >= start, DailyExpense.date < end
    )).all()
    
    exp_by_cat = {}
    for e in exp_de:
        v = next((v for v in evs if v.id == e.vendor_id), None)
        cat = v.category if v else e.category
        exp_by_cat[cat] = exp_by_cat.get(cat, 0) + e.amount

    # 3. Revenue table
    revs = s.exec(select(Revenue).where(Revenue.date >= start, Revenue.date < end)).all()
    rev_by_channel = {}
    for r in revs:
        rev_by_channel[r.channel] = rev_by_channel.get(r.channel, 0) + r.amount

    # 4. P/L
    pl = s.exec(select(MonthlyProfitLoss).where(
        MonthlyProfitLoss.year == yr, MonthlyProfitLoss.month == mn
    )).first()

    print("=" * 70)
    print(f"  P/L 데이터 불일치 분석 — {yr}년 {mn}월")
    print("=" * 70)

    print("\n📊 매출 (Revenue) 비교:")
    print(f"  {'항목':<20} {'매출관리(실제)':>15} {'손익계산서':>15} {'차이':>15}")
    print("-" * 70)
    
    pl_store = pl.revenue_store if pl else 0
    print(f"  {'매장매출':<20} {store_total:>15,} {pl_store:>15,} {store_total - pl_store:>15,}")
    
    delivery_fields = [
        ("쿠팡이츠", "쿠팡", "revenue_coupang"),
        ("배달의민족", "배달의민족", "revenue_baemin"),
        ("요기요", "요기요", "revenue_yogiyo"),
        ("땡겨요", "땡겨요", "revenue_ddangyo"),
    ]
    
    total_actual_del = 0
    total_pl_del = 0
    for label, keyword, field in delivery_fields:
        actual = sum(v for k, v in delivery_by_vendor.items() if keyword in k)
        pl_val = getattr(pl, field, 0) if pl else 0
        total_actual_del += actual
        total_pl_del += pl_val
        print(f"  {label:<20} {actual:>15,} {pl_val:>15,} {actual - pl_val:>15,}")
    
    print("-" * 70)
    total_actual = store_total + total_actual_del
    total_pl = pl_store + total_pl_del
    print(f"  {'매출합계':<20} {total_actual:>15,} {total_pl:>15,} {total_actual - total_pl:>15,}")

    print("\n📊 매입 (Expense) 비교:")
    print(f"  {'카테고리':<20} {'매입관리(실제)':>15} {'손익계산서':>15} {'차이':>15}")
    print("-" * 70)

    from services.profit_loss_service import CATEGORY_TO_PL_FIELD
    
    # Group actual expenses by PL field
    actual_by_field = {}
    for cat, amt in exp_by_cat.items():
        field = CATEGORY_TO_PL_FIELD.get(cat)
        if field:
            actual_by_field[field] = actual_by_field.get(field, 0) + amt
        else:
            actual_by_field[f"(unmapped:{cat})"] = actual_by_field.get(f"(unmapped:{cat})", 0) + amt
    
    exp_fields = [
        ("원재료비", "expense_ingredient"),
        ("소모품비", "expense_material"),
        ("수도광열비", "expense_utility"),
        ("임차료", "expense_rent"),
        ("세금과공과", "expense_tax"),
        ("기타경비", "expense_other"),
        ("인건비", "expense_labor"),
        ("퇴직금적립", "expense_retirement"),
    ]
    
    total_actual_exp = 0
    total_pl_exp = 0
    for label, field in exp_fields:
        actual = actual_by_field.get(field, 0)
        pl_val = getattr(pl, field, 0) if pl else 0
        total_actual_exp += actual
        total_pl_exp += pl_val
        diff = actual - pl_val
        marker = " ⚠️" if diff != 0 else " ✅"
        print(f"  {label:<20} {actual:>15,} {pl_val:>15,} {diff:>15,}{marker}")
    
    # Show unmapped categories
    for key, amt in actual_by_field.items():
        if key.startswith("(unmapped:"):
            print(f"  {key:<20} {amt:>15,} {'N/A':>15} {'N/A':>15} ⚠️")
    
    print("-" * 70)
    print(f"  {'비용합계':<20} {total_actual_exp:>15,} {total_pl_exp:>15,} {total_actual_exp - total_pl_exp:>15,}")

    print("\n📊 Revenue 테이블 잔여 데이터:")
    if rev_by_channel:
        for ch, amt in rev_by_channel.items():
            print(f"  {ch}: {amt:,}")
    else:
        print("  (비어있음 ✅)")

    print("\n" + "=" * 70)
