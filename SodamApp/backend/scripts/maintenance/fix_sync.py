"""
Fix: sync_all_expenses를 다시 실행하되,
DailyExpense.category가 '개인가계부'인 레코드는 P/L 계산에서 제외되도록
Vendor 카테고리도 '개인가계부'로 동기화.

문제 원인:
- DailyExpense.category='개인가계부'인데 Vendor.category='기타경비'인 경우가 많음
- sync_all_expenses는 Vendor.category 기준으로 합산하므로
  개인가계부가 기타경비로 합산되어 14.7M로 부풀려짐
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, text

s = Session(engine)

# Step 1: 불일치 현황 (DailyExpense=개인가계부, Vendor!=개인가계부)
print("=== 불일치 현황: DE=개인가계부, Vendor!=개인가계부 ===")
r = s.execute(text(
    "SELECT v.id, v.name, v.category as v_cat, count(de.id) as cnt, sum(de.amount) as total "
    "FROM dailyexpense de "
    "JOIN vendor v ON de.vendor_id = v.id "
    "WHERE de.category = :cat AND v.category != :cat "
    "GROUP BY v.id, v.name, v.category "
    "ORDER BY sum(de.amount) DESC"
), {"cat": "개인가계부"})
rows = list(r)
total_amount = 0
vendor_ids_to_fix = []
for row in rows:
    print(f"  Vendor[{row[0]}] {row[1]:30s} V_cat={row[2]:10s} {row[3]}건 {row[4]:>10,}원")
    total_amount += row[4]
    vendor_ids_to_fix.append(row[0])

print(f"\n총 {len(rows)}개 거래처, {total_amount:,}원 불일치")
print(f"Vendor IDs to fix: {vendor_ids_to_fix}")

# Step 2: 이 거래처들의 vendor.category를 개인가계부로 업데이트
if vendor_ids_to_fix:
    print(f"\n=== {len(vendor_ids_to_fix)}개 Vendor의 category를 '개인가계부'로 업데이트 ===")
    for vid in vendor_ids_to_fix:
        s.execute(text(
            "UPDATE vendor SET category = :cat WHERE id = :vid"
        ), {"cat": "개인가계부", "vid": vid})
    s.commit()
    print("업데이트 완료!")

# Step 3: sync_all_expenses 재실행
print("\n=== sync_all_expenses 재실행 (2026-01) ===")
from services.profit_loss_service import sync_all_expenses
result = sync_all_expenses(2026, 1, s)
for field, val in sorted(result.items()):
    print(f"  {field}: {val:,}")

# Step 4: 최종 P/L 확인
print("\n=== 최종 P/L 값 (2026-01) ===")
r = s.exec(text(
    "SELECT expense_ingredient, expense_material, expense_utility, "
    "expense_rent, expense_tax, expense_insurance, expense_card_fee, "
    "expense_other, expense_labor, expense_retirement "
    "FROM monthlyprofitloss WHERE year=2026 AND month=1"
))
pl = r.first()
if pl:
    fields_names = ["원재료비", "소모품비", "수도광열비", "임차료", "세금과공과",
                    "보험료", "카드수수료", "기타경비", "인건비", "퇴직금적립"]
    for name, val in zip(fields_names, pl):
        print(f"  {name:8s}: {val:>12,}원")
