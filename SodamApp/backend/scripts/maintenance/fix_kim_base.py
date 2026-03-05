from sqlmodel import Session
from database import engine
from models import Staff
from utils.payroll_calc_utils import calculate_insurances

with Session(engine) as s:
    staff = s.get(Staff, 8)
    old_val = staff.insurance_base_salary
    staff.insurance_base_salary = 1500000
    s.add(staff)
    s.commit()
    print(f"Updated: {staff.name}")
    print(f"  Old insurance_base_salary: {old_val:,}")
    print(f"  New insurance_base_salary: {staff.insurance_base_salary:,}")

    ins = calculate_insurances(0, 2026, insurance_base=1500000)
    print()
    print("3월 예상 공제액 (insurance_base=1,500,000):")
    print(f"  NP:  {ins['np']:>8,} (면제 적용시 0)")
    print(f"  HI:  {ins['hi']:>8,}")
    print(f"  LTI: {ins['lti']:>8,}")
    print(f"  EI:  {ins['ei']:>8,}")
    total_ins = ins['hi'] + ins['lti'] + ins['ei']
    print(f"  보험합계 (NP면제): {total_ins:>8,}")
