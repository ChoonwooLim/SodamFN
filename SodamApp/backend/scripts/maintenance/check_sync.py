"""Check purchase → P/L data sync accuracy"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, text

s = Session(engine)

# 1) DailyExpense category-based totals (what purchase page shows)
print("=== DailyExpense category 기준 (1월) ===")
r = s.exec(text(
    "SELECT category, count(id), sum(amount) "
    "FROM dailyexpense "
    "WHERE date >= '2026-01-01' AND date < '2026-02-01' "
    "GROUP BY category ORDER BY sum(amount) DESC"
))
de_totals = {}
for row in r:
    print(f"  {row[0]}: {row[1]}건, {row[2]:,}원")
    de_totals[row[0]] = row[2]

# 2) Vendor category-based totals (what sync_all_expenses uses)
print()
print("=== Vendor category 기준 (sync_all_expenses 사용) ===")
r = s.exec(text(
    "SELECT v.category, count(de.id), sum(de.amount) "
    "FROM dailyexpense de "
    "JOIN vendor v ON de.vendor_id = v.id "
    "WHERE de.date >= '2026-01-01' AND de.date < '2026-02-01' "
    "AND v.vendor_type != 'revenue' "
    "GROUP BY v.category ORDER BY sum(de.amount) DESC"
))
vendor_totals = {}
for row in r:
    print(f"  {row[0]}: {row[1]}건, {row[2]:,}원")
    vendor_totals[row[0]] = row[2]

# 3) Category mismatch check
print()
print("=== 카테고리 불일치 건 (expense.category != vendor.category) ===")
r = s.exec(text(
    "SELECT de.vendor_name, de.category as de_cat, v.category as v_cat, de.amount "
    "FROM dailyexpense de "
    "JOIN vendor v ON de.vendor_id = v.id "
    "WHERE de.date >= '2026-01-01' AND de.date < '2026-02-01' "
    "AND de.category != v.category "
    "AND v.vendor_type != 'revenue' "
    "ORDER BY de.amount DESC "
    "LIMIT 20"
))
rows = list(r)
if rows:
    for row in rows:
        print(f"  {row[0]}: DE={row[1]}, Vendor={row[2]}, {row[3]:,}원")
    print(f"  ... (상위 20건)")
else:
    print("  불일치 없음")

# 4) P/L vs aggregated comparison
print()
print("=== P/L 저장값 vs DailyExpense 합계 비교 (1월) ===")
r = s.exec(text(
    "SELECT expense_ingredient, expense_material, expense_utility, "
    "expense_rent, expense_tax, expense_insurance, expense_card_fee, "
    "expense_other, expense_labor, expense_retirement "
    "FROM monthlyprofitloss WHERE year=2026 AND month=1"
))
pl = r.first()
if pl:
    fields = [
        ("원재료비", "expense_ingredient", pl[0]),
        ("소모품비", "expense_material", pl[1]),
        ("수도광열비", "expense_utility", pl[2]),
        ("임차료", "expense_rent", pl[3]),
        ("세금과공과", "expense_tax", pl[4]),
        ("보험료", "expense_insurance", pl[5]),
        ("카드수수료", "expense_card_fee", pl[6]),
        ("기타경비", "expense_other", pl[7]),
        ("인건비", "expense_labor", pl[8]),
        ("퇴직금적립", "expense_retirement", pl[9]),
    ]
    for cat, field, pl_val in fields:
        v_val = vendor_totals.get(cat, 0)
        de_val = de_totals.get(cat, 0)
        match = "✅" if pl_val == v_val else "❌"
        print(f"  {match} {cat:8s}: P/L={pl_val:>12,}, Vendor합계={v_val:>12,}, DE합계={de_val:>12,}")
