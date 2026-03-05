"""
Final audit: all employees' payroll settings and March deduction preview.
Ensures system calculations will match accountant output from March 2026 onward.
"""
from sqlmodel import Session, select
from database import engine
from models import Staff
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax
from datetime import date
from dateutil.relativedelta import relativedelta

with Session(engine) as s:
    all_staff = s.exec(select(Staff).where(Staff.status == "jaejik")).all()
    if not all_staff:
        all_staff = s.exec(select(Staff)).all()

    print("=" * 90)
    print("  ALL EMPLOYEES - PAYROLL SETTINGS AUDIT (2026-03 onward)")
    print("=" * 90)

    for st in all_staff:
        # Check NP exempt by age
        age = None
        auto_np_exempt = False
        if st.birth_date:
            age = relativedelta(date(2026, 3, 1), st.birth_date).years
            auto_np_exempt = age >= 60

        np_exempt = st.np_exempt or auto_np_exempt

        print(f"\n--- [{st.name}] (ID={st.id}) ---")
        print(f"  contract_type: {st.contract_type}")
        print(f"  status: {st.status}")
        print(f"  insurance_4major: {st.insurance_4major}")
        print(f"  insurance_base_salary: {st.insurance_base_salary:,}")
        print(f"  hourly_wage: {st.hourly_wage:,}")
        print(f"  monthly_salary: {st.monthly_salary:,}")
        print(f"  birth_date: {st.birth_date} (age={age})")
        print(f"  np_exempt: {st.np_exempt} (auto={auto_np_exempt} -> effective={np_exempt})")
        print(f"  durunnuri_support: {st.durunnuri_support}")
        print(f"  dependents: {st.dependents_count}, children: {st.children_count}")

        # Calculate expected deductions
        if st.contract_type == "sageopso" or st.contract_type == "\uc0ac\uc5c5\uc18c\ub4dd\uc790":
            print(f"  >> 3.3% withholding (no insurance)")
            print(f"  >> IT = gross * 3%, LIT = IT * 10%")
        elif st.insurance_4major or st.contract_type == "\uc815\uaddc\uc9c1":
            base = st.insurance_base_salary
            ins = calculate_insurances(0, 2026, insurance_base=base)
            np_val = 0 if np_exempt else ins["np"]
            hi_val = ins["hi"]
            lti_val = ins["lti"]
            ei_val = ins["ei"]

            if st.durunnuri_support:
                np_val = int(np_val * 0.2 / 10) * 10
                ei_val = int(ei_val * 0.2 / 10) * 10

            total_ins = np_val + hi_val + lti_val + ei_val
            print(f"  >> 4-INSURANCE (base={base:,}):")
            print(f"     NP={np_val:,}  HI={hi_val:,}  LTI={lti_val:,}  EI={ei_val:,}  TOTAL={total_ins:,}")
            
            if base == 0:
                print(f"  !! WARNING: insurance_base_salary=0, will fallback to gross_pay each month")
        else:
            print(f"  >> Part-time/Daily: EI only (0.9% of gross)")
            print(f"  >> IT: daily wage > 150,000 threshold")

    print(f"\n{'=' * 90}")
    print("  CROSS-CHECK: Known accountant figures")
    print("=" * 90)

    # Heo Yun-hee verified: base=1,500,000
    ins = calculate_insurances(0, 2026, insurance_base=1500000)
    it = calculate_korean_income_tax(1680000, dependents=1, children=0)
    lit = int(it * 0.1 / 10) * 10
    expected = {"np": 71250, "hi": 53920, "lti": 7080, "ei": 13500, "it": 12640, "lit": 1260}
    
    print(f"\n  [Heo Yun-hee] base=1,500,000, gross=1,680,000")
    items = [
        ("NP", ins["np"], expected["np"]),
        ("HI", ins["hi"], expected["hi"]),
        ("LTI", ins["lti"], expected["lti"]),
        ("EI", ins["ei"], expected["ei"]),
        ("IT", it, expected["it"]),
        ("LIT", lit, expected["lit"]),
    ]
    all_pass = True
    for label, calc, exp in items:
        match = "PASS" if calc == exp else "FAIL"
        if calc != exp:
            all_pass = False
        print(f"    {label}: calc={calc:>8,}  expected={exp:>8,}  {match}")
    
    print(f"\n  Overall: {'ALL PASS' if all_pass else 'SOME FAILED'}")
    print(f"{'=' * 90}")
