"""
Comprehensive Feb payroll alignment with tax accountant figures.
1. Add durunnuri_support column to staff
2. Set insurance_base_salary for all active employees
3. Adjust all Feb payroll to match tax accountant
4. Re-sync P/L
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlmodel import Session, select
from database import engine
from models import Staff, Payroll, MonthlyProfitLoss
from sqlalchemy import text, inspect
from services.profit_loss_service import sync_labor_cost

# ===== Step 1: Add durunnuri_support column =====
inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('staff')]
if 'durunnuri_support' not in columns:
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE staff ADD COLUMN durunnuri_support BOOLEAN DEFAULT FALSE'))
    print('[OK] Added durunnuri_support column')
else:
    print('[OK] durunnuri_support already exists')

# ===== Step 2: Set insurance_base_salary & flags for all employees =====
STAFF_SETTINGS = {
    # name: (insurance_base_salary, np_exempt, durunnuri_support)
    '김금순': (3000000, False, False),
    '허윤희': (1500000, False, False),
    '정명주': (1400000, False, True),   # durunnuri 80%
    '정수현': (1868000, False, True),   # durunnuri 80%
    '김순복': (3351000, True, False),   # NP exempt (60+)
    '설주리': (5173000, False, False),  # already quit, for record
}

with Session(engine) as session:
    for name, (base, np_ex, duru) in STAFF_SETTINGS.items():
        staff = session.exec(select(Staff).where(Staff.name == name)).first()
        if staff:
            staff.insurance_base_salary = base
            staff.np_exempt = np_ex
            # durunnuri_support might not be recognized by ORM yet since we just added the column
            # Use raw SQL for safety
            session.add(staff)
            print(f'[OK] {name}: base={base:,} np_exempt={np_ex}')
        else:
            print(f'[SKIP] {name}: not found in DB')
    session.commit()

# Set durunnuri via raw SQL (since ORM might not pick up new column immediately)
with engine.begin() as conn:
    conn.execute(text("UPDATE staff SET durunnuri_support = TRUE WHERE name IN ('정명주', '정수현')"))
    conn.execute(text("UPDATE staff SET durunnuri_support = FALSE WHERE name NOT IN ('정명주', '정수현')"))
    print('[OK] durunnuri_support flags set')

# ===== Step 3: Adjust ALL Feb 2026 payroll to tax accountant figures =====
# From PDF: 2월 급여명세서(소담김밥).pdf
# For IT/LIT: store NET value (after 연말정산)

# Map: staff_name -> (np, hi, ei, lti, it_net, lit_net)
TAX_ACCOUNTANT_FEB = {
    '김금순':  (142500, 107850, 0,     14170, 114990-18140, 11490-1750),
    '허윤희':  (71250,  53920,  13500, 7080,  12640-75810,  1260-7540),   # already set
    '정명주':  (13300,  50330,  2520,  6610,  8450-77330,   840-7680),
    '정수현':  (17740,  67140,  3370,  8820,  13880,        1380),
    '설주리':  (245760, 186000, 46560, 24440, -38340,       -3830),
    '김순복':  (0,      120520, 30160, 15820, 17180,        1710),         # already set
}

with Session(engine) as session:
    for name, (np, hi, ei, lti, it, lit) in TAX_ACCOUNTANT_FEB.items():
        staff = session.exec(select(Staff).where(Staff.name == name)).first()
        if not staff:
            print(f'[SKIP] {name}: not found')
            continue
        
        p = session.exec(select(Payroll).where(
            Payroll.staff_id == staff.id, 
            Payroll.month == '2026-02'
        )).first()
        
        if not p:
            print(f'[SKIP] {name}: no Feb payroll record')
            continue
        
        p.deduction_np = np
        p.deduction_hi = hi
        p.deduction_ei = ei
        p.deduction_lti = lti
        p.deduction_it = it
        p.deduction_lit = lit
        total_ded = np + hi + ei + lti + it + lit
        p.deductions = total_ded
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        p.total_pay = gross - total_ded
        session.add(p)
        print(f'[OK] {name}: gross={gross:,} deductions={total_ded:,} net_pay={gross-total_ded:,}')
    
    session.commit()

# ===== Step 4: Re-sync P/L for Feb =====
with Session(engine) as session:
    result = sync_labor_cost(2026, 2, session)
    print(f'[OK] P/L Feb re-synced: labor(net)={result:,}')

# ===== Step 5: Verify results =====
with Session(engine) as session:
    payrolls = session.exec(select(Payroll).where(Payroll.month == '2026-02')).all()
    
    total_ins_emp = 0
    total_tax_emp = 0
    print()
    print('=== FINAL 2월 Payroll Summary ===')
    for p in payrolls:
        staff = session.get(Staff, p.staff_id)
        name = staff.name if staff else f'ID={p.staff_id}'
        ins = (p.deduction_np or 0) + (p.deduction_hi or 0) + (p.deduction_ei or 0) + (p.deduction_lti or 0)
        tax = (p.deduction_it or 0) + (p.deduction_lit or 0)
        total_ins_emp += ins
        total_tax_emp += tax
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        print(f'  {name}: gross={gross:,} ins={ins:,} tax={tax:,} net={p.total_pay:,}')
    
    print(f'\n  Employee insurance total: {total_ins_emp:,}')
    print(f'  Employee tax total: {total_tax_emp:,}')
    
    pl = session.exec(select(MonthlyProfitLoss).where(
        MonthlyProfitLoss.year == 2026, MonthlyProfitLoss.month == 2
    )).first()
    if pl:
        print(f'\n=== P/L 2월 ===')
        print(f'  expense_labor (net pay): {pl.expense_labor:,}')
        print(f'  expense_insurance (employer): {pl.expense_insurance:,}')
        print(f'  expense_insurance_employee: {pl.expense_insurance_employee:,}')
        print(f'  expense_tax_employee: {pl.expense_tax_employee:,}')
        print(f'  expense_retirement: {pl.expense_retirement:,}')

print('\nDone!')
