"""Check vendor types and categories in DB"""
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()
url = os.environ.get("DATABASE_URL", "").replace("postgres://", "postgresql://", 1)
eng = create_engine(url)

with eng.connect() as conn:
    print("=== Vendors by type & category ===")
    rows = conn.execute(text("""
        SELECT v.vendor_type, v.category, v.name, COUNT(de.id) as cnt
        FROM vendor v 
        LEFT JOIN dailyexpense de ON v.id = de.vendor_id
        GROUP BY v.vendor_type, v.category, v.name, v.id
        ORDER BY v.vendor_type DESC, v.category, v.name
    """)).fetchall()
    for r in rows:
        print(f"  {r[0]:8s} | {r[1] or '':12s} | cnt={r[3]:4d} | {r[2]}")

    print("\n=== Revenue vendors with DailyExpense records ===")
    rows2 = conn.execute(text("""
        SELECT v.name, v.category, de.category as de_cat, COUNT(*) as cnt, SUM(de.amount) as total
        FROM dailyexpense de
        JOIN vendor v ON de.vendor_id = v.id
        WHERE v.vendor_type = 'revenue'
        GROUP BY v.name, v.category, de.category
        ORDER BY v.name
    """)).fetchall()
    for r in rows2:
        print(f"  vendor={r[0]} | v.cat={r[1]} | de.cat={r[2]} | cnt={r[3]} | total={r[4]:,}")

    print("\n=== MonthlyProfitLoss for Jan 2026 ===")
    rows3 = conn.execute(text("""
        SELECT * FROM monthlyprofitloss WHERE year=2026 AND month=1
    """)).fetchall()
    if rows3:
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='monthlyprofitloss' ORDER BY ordinal_position")).fetchall()
        col_names = [c[0] for c in cols]
        for r in rows3:
            for i, v in enumerate(r):
                if v and v != 0:
                    print(f"  {col_names[i]}: {v}")

    print("\n=== DailyExpense categories with no vendor match in CATEGORY_TO_PL_FIELD ===")
    rows4 = conn.execute(text("""
        SELECT de.category, v.category as v_cat, v.vendor_type, COUNT(*) as cnt
        FROM dailyexpense de
        LEFT JOIN vendor v ON de.vendor_id = v.id
        WHERE de.category NOT IN ('식자재','재료비','임대료','임대관리비','제세공과금','카드수수료','부가가치세','사업소득세','근로소득세','other','기타비용')
           OR de.category IS NULL
        GROUP BY de.category, v.category, v.vendor_type
        ORDER BY cnt DESC
    """)).fetchall()
    for r in rows4:
        print(f"  de.cat={r[0]} | v.cat={r[1]} | v.type={r[2]} | cnt={r[3]}")
