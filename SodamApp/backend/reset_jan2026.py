"""
2026년 1월 데이터 초기화 스크립트
- DailyExpense (월별비용)
- Expense (지출)
- MonthlyProfitLoss 재동기화
"""
import psycopg2

DATABASE_URL = 'postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn'

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# 1. Delete DailyExpense for 2026-01
cur.execute("DELETE FROM dailyexpense WHERE date >= '2026-01-01' AND date < '2026-02-01'")
daily_deleted = cur.rowcount
print(f"✅ DailyExpense 삭제: {daily_deleted}건")

# 2. Delete Expense for 2026-01
cur.execute("DELETE FROM expense WHERE date >= '2026-01-01' AND date < '2026-02-01'")
expense_deleted = cur.rowcount
print(f"✅ Expense 삭제: {expense_deleted}건")

# 3. Reset MonthlyProfitLoss expense fields for 2026-01
cur.execute("""
    UPDATE monthlyprofitloss 
    SET expense_material = 0, expense_other = 0, expense_personnel = 0, expense_retirement = 0
    WHERE year = 2026 AND month = 1
""")
pl_updated = cur.rowcount
print(f"✅ MonthlyProfitLoss 초기화: {pl_updated}건")

conn.commit()

# 4. Reset sequences
cur.execute("SELECT setval('dailyexpense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM dailyexpense))")
cur.execute("SELECT setval('expense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM expense))")
conn.commit()
print("✅ 시퀀스 재설정 완료")

cur.close()
conn.close()

print("\n🎉 2026년 1월 데이터 초기화 완료!")
