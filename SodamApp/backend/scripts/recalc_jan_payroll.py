"""
Recalculate January 2026 payroll deductions using updated Staff settings.
Uses: insurance_base_salary, np_exempt/birth_date, durunnuri_support, tax_support_enabled
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import date
from dateutil.relativedelta import relativedelta
from sqlmodel import Session, select
from database import engine
from models import Staff, Payroll
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax
from services.profit_loss_service import sync_labor_cost

TARGET_YEAR = 2026
TARGET_MONTH = 1
MONTH_STR = f"{TARGET_YEAR}-{TARGET_MONTH:02d}"

with Session(engine) as session:
    payrolls = session.exec(select(Payroll).where(Payroll.month == MONTH_STR)).all()
    
    print(f"=== {MONTH_STR} Payroll Recalculation ===\n")
    
    for p in payrolls:
        staff = session.get(Staff, p.staff_id)
        if not staff:
            continue
        
        name = staff.name
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        
        # Taxable income (비과세 식대 20만 제외 for 정규직)
        non_taxable = 200000 if staff.contract_type == "정규직" else 0
        taxable = max(0, gross - non_taxable)
        
        d_np, d_hi, d_ei, d_lti, d_it, d_lit = 0, 0, 0, 0, 0, 0
        
        if staff.contract_type == "정규직" or staff.insurance_4major:
            # 4대보험 계산
            insurances = calculate_insurances(
                taxable, year=TARGET_YEAR,
                insurance_base=staff.insurance_base_salary or 0
            )
            
            # NP 면제: 수동 또는 생년월일 자동
            is_np_exempt = staff.np_exempt
            if not is_np_exempt and staff.birth_date:
                age = relativedelta(date(TARGET_YEAR, TARGET_MONTH, 1), staff.birth_date).years
                if age >= 60:
                    is_np_exempt = True
            
            d_np = 0 if is_np_exempt else insurances["np"]
            d_hi = insurances["hi"]
            d_lti = insurances["lti"]
            d_ei = insurances["ei"]
            
            # 두루누리
            if getattr(staff, 'durunnuri_support', False):
                d_np = int(d_np * 0.2 / 10) * 10
                d_ei = int(d_ei * 0.2 / 10) * 10
            
            # 소득세
            d_it = calculate_korean_income_tax(
                taxable, 
                dependents=staff.dependents_count or 1,
                children=staff.children_count or 0
            )
            d_lit = int(d_it * 0.1)
            
        elif staff.contract_type == "일용직":
            # 일용직: 고용보험만
            if staff.insurance_4major:
                insurances = calculate_insurances(gross, year=TARGET_YEAR)
                d_ei = insurances["ei"]
        else:
            # 아르바이트 (4대보험 미가입): 원천세만
            daily_tax_base = gross
            if daily_tax_base > 150000:
                d_it = int((daily_tax_base - 150000) * 0.06 * 0.55)
                if d_it < 1000:
                    d_it = 0
                d_lit = int(d_it * 0.1)
        
        # Tax support
        total_ded = d_np + d_hi + d_ei + d_lti + d_it + d_lit
        tax_support = total_ded if getattr(staff, 'tax_support_enabled', False) else 0
        net_pay = gross - total_ded
        
        # Print comparison
        old_ded = p.deductions or 0
        old_net = p.total_pay or 0
        print(f"{name:>6}: gross={gross:>10,}")
        print(f"         OLD: ded={old_ded:>8,} net={old_net:>10,}")
        print(f"         NEW: NP={d_np:>6,} HI={d_hi:>6,} EI={d_ei:>5,} LTI={d_lti:>5,} IT={d_it:>6,} LIT={d_lit:>5,}")
        print(f"              ded={total_ded:>8,} net={net_pay:>10,} tax_support={tax_support:>8,}")
        diff = total_ded - old_ded
        print(f"         DIFF: ded={'+' if diff>=0 else ''}{diff:,}\n")
        
        # Update record
        p.deduction_np = d_np
        p.deduction_hi = d_hi
        p.deduction_ei = d_ei
        p.deduction_lti = d_lti
        p.deduction_it = d_it
        p.deduction_lit = d_lit
        p.deductions = total_ded
        p.total_pay = net_pay
        p.bonus_tax_support = tax_support
        session.add(p)
    
    session.commit()
    print("=== All records updated ===\n")
    
    # Re-sync P/L
    result = sync_labor_cost(TARGET_YEAR, TARGET_MONTH, session)
    print(f"P/L {TARGET_MONTH}월 re-synced: labor={result:,}")
