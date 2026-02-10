"""
2026년 1월 MonthlyProfitLoss 초기화 및 시퀀스 재설정
"""
import psycopg2

DATABASE_URL = 'postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn'

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Reset MonthlyProfitLoss expense fields for 2026-01
cur.execute("""
    UPDATE monthlyprofitloss 
    SET expense_material = 0, expense_other = 0, expense_personal = 0, expense_retirement = 0,
        expense_labor = 0, expense_ingredient = 0
    WHERE year = 2026 AND month = 1
""")
pl_updated = cur.rowcount
print(f"✅ MonthlyProfitLoss 초기화: {pl_updated}건")

conn.commit()

# Reset sequences
cur.execute("SELECT setval('dailyexpense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM dailyexpense))")
cur.execute("SELECT setval('expense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM expense))")
conn.commit()
print("✅ 시퀀스 재설정 완료")

cur.close()
conn.close()

print("\n🎉 2026년 1월 MonthlyProfitLoss 초기화 완료!")
