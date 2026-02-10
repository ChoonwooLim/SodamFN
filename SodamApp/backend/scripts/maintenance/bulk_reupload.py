"""Fix: Delete in correct FK order, add all columns, re-upload, sync P/L"""
import sys, os, glob
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, text, select
from models import DailyExpense, Vendor, MonthlyProfitLoss
from services.purchase_parser import parse_purchase_file
from services.profit_loss_service import sync_all_expenses

FILES_DIR = r"C:\WORK\SodamFN\2026소득분석\매입"
print("DB:", engine.url)

# ── 1) PG 컬럼 추가 ──
print("\n=== 1) PostgreSQL 컬럼 확인 ===")
with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='monthlyprofitloss'"
    ))
    existing = set(r[0] for r in result)
    
    needed = ['expense_ingredient', 'expense_other', 'expense_repair',
              'expense_depreciation', 'expense_tax', 'expense_insurance']
    
    for col in needed:
        if col not in existing:
            conn.execute(text(f"ALTER TABLE monthlyprofitloss ADD COLUMN {col} INTEGER DEFAULT 0"))
            print(f"  ✅ 추가: {col}")
        else:
            print(f"  ✔️ 존재: {col}")
    conn.commit()

# ── 2) PG 테이블 목록 + FK 확인 ──
print("\n=== 2) 테이블 + FK 확인 ===")
with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    ))
    tables = [r[0] for r in result]
    print("  테이블:", tables)
    
    # Check FK constraints referencing vendor
    result = conn.execute(text("""
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'vendor'
    """))
    fks = list(result)
    print("  vendor FK 참조:", [(r[0], r[1]) for r in fks])

# ── 3) 데이터 삭제 (FK 순서: expense → dailyexpense → vendor) ──
print("\n=== 3) 데이터 삭제 ===")
with engine.connect() as conn:
    # Delete from ALL tables that reference vendor first
    for tbl in ['product', 'expense', 'dailyexpense', 'revenue', 'vendorrule']:
        if tbl in tables:
            try:
                result = conn.execute(text(f"DELETE FROM {tbl}"))
                print(f"  {tbl}: {result.rowcount}건 삭제")
            except Exception as e:
                print(f"  {tbl}: 스킵 ({e})")
    
    # Now delete vendors
    result = conn.execute(text("DELETE FROM vendor"))
    print(f"  vendor: {result.rowcount}건 삭제")
    
    # Reset P/L expense fields
    conn.execute(text("""UPDATE monthlyprofitloss SET 
        expense_ingredient=0, expense_material=0, expense_utility=0,
        expense_rent=0, expense_repair=0, expense_depreciation=0,
        expense_tax=0, expense_insurance=0, expense_card_fee=0,
        expense_other=0, expense_personal=0,
        expense_rent_fee=0, expense_vat=0, expense_biz_tax=0, expense_income_tax=0
    """))
    print("  P/L expense fields 초기화")
    
    conn.commit()
    print("  ✅ 삭제 완료")

# ── 4) 파일 업로드 ──
print("\n=== 4) 파일 업로드 ===")
files = sorted(glob.glob(os.path.join(FILES_DIR, "*.*")))
print(f"  대상: {len(files)}개 파일\n")

vendor_cache = {}
total_inserted = 0

for fpath in files:
    fname = os.path.basename(fpath)
    print(f"  📤 {fname} ... ", end="", flush=True)
    
    try:
        records = parse_purchase_file(fpath, fname)
    except Exception as e:
        print(f"❌ 파싱 에러: {e}")
        continue
    
    if not records:
        print("⚠️ 0건")
        continue
    
    inserted = 0
    with Session(engine) as session:
        # Refresh vendor cache
        if not vendor_cache:
            for v in session.exec(select(Vendor)).all():
                vendor_cache[v.name] = v.id
        
        for rec in records:
            vname = rec['vendor_name']
            date_obj = rec['date']
            amount = rec['amount']
            category = rec.get('category', '기타경비')
            
            if amount <= 0:
                continue
            
            # Find or create vendor
            if vname not in vendor_cache:
                vendor = Vendor(name=vname, category=category, vendor_type='expense')
                session.add(vendor)
                session.flush()
                vendor_cache[vname] = vendor.id
            
            vendor_id = vendor_cache[vname]
            
            # Duplicate check
            existing = session.exec(
                select(DailyExpense).where(
                    DailyExpense.date == date_obj,
                    DailyExpense.vendor_id == vendor_id,
                    DailyExpense.amount == amount,
                )
            ).first()
            
            if existing:
                continue
            
            # Build note
            note_parts = []
            if rec.get('card_company'):
                note_parts.append(f"카드사:{rec['card_company']}")
            approval = str(rec.get('approval_no', ''))
            if approval and approval not in ['', 'nan']:
                note_parts.append(f"승인:{approval}")
            btype = str(rec.get('business_type', ''))
            if btype and btype not in ['', 'nan']:
                note_parts.append(f"업종:{btype}")
            
            expense = DailyExpense(
                date=date_obj,
                vendor_name=vname,
                vendor_id=vendor_id,
                amount=amount,
                category=category,
                note=", ".join(note_parts) if note_parts else None,
            )
            session.add(expense)
            inserted += 1
        
        session.commit()
    
    total_inserted += inserted
    print(f"✅ {inserted}건")

print(f"\n  총 삽입: {total_inserted}건")

# ── 5) P/L 동기화 ──
print("\n=== 5) P/L 동기화 ===")
with Session(engine) as session:
    result = session.exec(text(
        "SELECT DISTINCT EXTRACT(YEAR FROM date)::int, EXTRACT(MONTH FROM date)::int FROM dailyexpense"
    ))
    months = [(r[0], r[1]) for r in result]
    
    for year, month in sorted(months):
        totals = sync_all_expenses(year, month, session)
        print(f"  {year}-{month:02d}: {totals}")

print("  ✅ 동기화 완료")

# ── 6) 결과 ──
print("\n=== 6) 최종 결과 ===")
with Session(engine) as session:
    result = session.exec(text("SELECT count(id) FROM dailyexpense"))
    print(f"  DailyExpense: {result.one()[0]}건")
    
    result = session.exec(text("SELECT count(id) FROM vendor"))
    print(f"  Vendor: {result.one()[0]}건")
    
    result = session.exec(text(
        "SELECT category, count(id) FROM dailyexpense GROUP BY category ORDER BY count(id) DESC"
    ))
    print("\n  [카테고리별]")
    for r in result:
        print(f"    {r[0]}: {r[1]}건")
    
    result = session.exec(text(
        "SELECT to_char(date, 'YYYY-MM') as m, count(id), sum(amount) FROM dailyexpense GROUP BY m ORDER BY m"
    ))
    print("\n  [월별]")
    for r in result:
        print(f"    {r[0]}: {r[1]}건, {r[2]:,}원")

print("\n✅ 전체 완료!")
