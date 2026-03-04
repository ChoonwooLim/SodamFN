"""
Adjust January 2026 payroll to match tax accountant's PDF figures.
Key differences from Feb:
- 설주리/김순복: 1월 입사, 4대보험 미가입 → 소득세만
- 정수현: 1월에는 두루누리 미적용 (NP/EI 100%)
- 김금순: no 고용보험 (정규직)
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlmodel import Session, select
from database import engine
from models import Staff, Payroll
from services.profit_loss_service import sync_labor_cost

# Tax accountant's January figures
# name -> (np, hi, ei, lti, it, lit)
TAX_ACCOUNTANT_JAN = {
    '김금순':  (142500, 107850, 0,     14170, 91460,  9140),
    '허윤희':  (71250,  53920,  13500, 7080,  15110,  1510),
    '정명주':  (16100,  50330,  2520,  6610,  17800,  1780),
    '정수현':  (88680,  67140,  16810, 8820,  26270,  2620),
    '설주리':  (0,      0,      0,     0,     38340,  3830),   # 1월 입사: 4대보험 없음
    '김순복':  (0,      0,      0,     0,     12430,  1240),   # 1월 입사: 4대보험 없음
}

with Session(engine) as session:
    print("=== 1월 급여 세무사 수치 적용 ===\n")
    
    for name, (np, hi, ei, lti, it, lit) in TAX_ACCOUNTANT_JAN.items():
        staff = session.exec(select(Staff).where(Staff.name == name)).first()
        if not staff:
            print(f"[SKIP] {name}: not found")
            continue
        
        p = session.exec(select(Payroll).where(
            Payroll.staff_id == staff.id,
            Payroll.month == '2026-01'
        )).first()
        
        if not p:
            print(f"[SKIP] {name}: no Jan payroll")
            continue
        
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        
        # Set deductions
        p.deduction_np = np
        p.deduction_hi = hi
        p.deduction_ei = ei
        p.deduction_lti = lti
        p.deduction_it = it
        p.deduction_lit = lit
        total_ded = np + hi + ei + lti + it + lit
        p.deductions = total_ded
        p.total_pay = gross - total_ded
        
        # Tax support for 김금순
        if getattr(staff, 'tax_support_enabled', False):
            p.bonus_tax_support = total_ded
        
        ins = np + hi + ei + lti
        tax = it + lit
        print(f"  {name}: gross={gross:,} ins={ins:,} tax={tax:,} ded={total_ded:,} net={p.total_pay:,}")
        
        session.add(p)
    
    session.commit()
    
    # Re-sync P/L
    result = sync_labor_cost(2026, 1, session)
    print(f"\nP/L 1월 re-synced: labor={result:,}")
    
    # Final verification
    print("\n=== Final Comparison ===")
    payrolls = session.exec(select(Payroll).where(Payroll.month == '2026-01')).all()
    for p in payrolls:
        staff = session.get(Staff, p.staff_id)
        name = staff.name if staff else f"ID={p.staff_id}"
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        print(f"  {name}: gross={gross:,} ded={p.deductions:,} net={p.total_pay:,}")
