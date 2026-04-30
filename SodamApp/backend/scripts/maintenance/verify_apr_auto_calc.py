"""
2026-04 급여 자동 계산 vs 세무사 PDF 검증 (DRY-RUN, DB 변경 없음)

목적:
- 현재 시스템의 자동 계산 로직(routers/payroll.py)이 세무사 PDF와 얼마나 일치하는지 측정
- 차이가 있는 항목별 원인 파악 → 자동화 잔여 작업 도출

세무사 PDF 정답 데이터 (10명):
  4대보험: 김금순(세금대납)/정명주(두루누리)/정수현(두루누리)/김순복(NP면제)
  일용직 EI만: 김다은/린(추정)
  3.3% 사업소득: 정수미/반정옥/황윤선/고아라
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from database import engine
from models import Staff, Attendance
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax
from datetime import date
from dateutil.relativedelta import relativedelta

# 세무사 PDF 정답 (id -> {name, gross, np, hi, ei, lti, it, lit})
ACCOUNTANT = {
    2:  {'name': '김금순', 'gross': 3400000, 'np': 142500, 'hi': 131040, 'ei': 0,     'lti': 17170, 'it': 114990, 'lit': 11490},
    3:  {'name': '정명주', 'gross': 1660800, 'np': 13300,  'hi': 111220, 'ei': 17920, 'lti': 14530, 'it': 12220,  'lit': 1220},
    9:  {'name': '정수현', 'gross': 2565600, 'np': 17740,  'hi': 67140,  'ei': 3370,  'lti': 8820,  'it': 37650,  'lit': 3760},
    8:  {'name': '김순복', 'gross': 1915200, 'np': 0,      'hi': 60260,  'ei': 3020,  'lti': 7910,  'it': 17390,  'lit': 1730},
    14: {'name': '김다은', 'gross': 1287000, 'np': 0,      'hi': 0,      'ei': 11440, 'lti': 0,     'it': 0,      'lit': 0},
    13: {'name': '린',     'gross': 176000,  'np': 0,      'hi': 0,      'ei': 1580,  'lti': 0,     'it': 0,      'lit': 0},
    16: {'name': '정수미', 'gross': 1863400, 'np': 0,      'hi': 0,      'ei': 0,     'lti': 0,     'it': 55900,  'lit': 5590},
    27: {'name': '반정옥', 'gross': 660000,  'np': 0,      'hi': 0,      'ei': 0,     'lti': 0,     'it': 19800,  'lit': 1980},
    29: {'name': '황윤선', 'gross': 1406900, 'np': 0,      'hi': 0,      'ei': 0,     'lti': 0,     'it': 42200,  'lit': 4220},
    30: {'name': '고아라', 'gross': 198000,  'np': 0,      'hi': 0,      'ei': 0,     'lti': 0,     'it': 5940,   'lit': 590},
}


def auto_calc(staff: Staff, gross_pay: int, year: int, month: int, attendances: list) -> dict:
    """routers/payroll.py:404-485 와 동일한 분기 로직으로 자동 계산"""
    meal_allowance = 200000 if staff.contract_type == '정규직' else 0
    taxable_income = max(0, gross_pay - meal_allowance)
    d_np = d_hi = d_ei = d_lti = d_it = d_lit = 0

    if staff.contract_type == '사업소득자':
        # 3.3%
        d_it = int(gross_pay * 0.03 / 10) * 10
        d_lit = int(d_it * 0.1 / 10) * 10
    elif staff.contract_type == '정규직' or staff.insurance_4major:
        ins = calculate_insurances(taxable_income, year=year, insurance_base=staff.insurance_base_salary or 0)
        is_np_exempt = staff.np_exempt
        if not is_np_exempt and staff.birth_date:
            age = relativedelta(date(year, month, 1), staff.birth_date).years
            if age >= 60:
                is_np_exempt = True
        d_np = 0 if is_np_exempt else ins['np']
        d_hi = ins['hi']
        d_lti = ins['lti']
        d_ei = ins['ei']
        if getattr(staff, 'durunnuri_support', False):
            d_np = int(d_np * 0.2 / 10) * 10
            d_ei = int(d_ei * 0.2 / 10) * 10
        d_it = calculate_korean_income_tax(taxable_income, dependents=staff.dependents_count or 1, children=staff.children_count or 0)
        d_lit = int(d_it * 0.1 / 10) * 10
    else:
        # 일용직: EI 0.9% + 일당 15만원 초과 소득세
        d_ei = int(gross_pay * 0.009 / 10) * 10
        # 소득세: 일당 기준 (생략 — 16만원 이하 시급제는 0)
        daily_tax_total = 0
        for att in attendances:
            if att.date.year == year and att.date.month == month and att.total_hours > 0:
                daily_wage = int(att.total_hours * (staff.hourly_wage or 0))
                if daily_wage > 150000:
                    day_tax = int((daily_wage - 150000) * 0.06 * 0.45)
                    if day_tax >= 1000:
                        daily_tax_total += day_tax
        d_it = int(daily_tax_total / 10) * 10
        d_lit = int(d_it * 0.1 / 10) * 10

    return {'np': d_np, 'hi': d_hi, 'ei': d_ei, 'lti': d_lti, 'it': d_it, 'lit': d_lit}


with Session(engine) as session:
    print("=" * 100)
    print("2026-04 자동 계산 vs 세무사 PDF 검증 (DRY-RUN)")
    print("=" * 100)

    print(f"\n{'직원':<8} {'분류':<10} {'gross':>10} | {'항목':<5} {'세무사':>10} {'자동계산':>10} {'차이':>10}")
    print("-" * 100)

    total_match = 0
    total_check = 0
    perfect_count = 0

    for sid in [2, 3, 9, 8, 14, 13, 16, 27, 29, 30]:
        staff = session.get(Staff, sid)
        if not staff:
            continue

        # 출퇴근 데이터 가져오기 (일용직 소득세 계산용)
        atts = session.exec(select(Attendance).where(Attendance.staff_id == sid)).all()

        a = ACCOUNTANT[sid]
        gross = a['gross']
        auto = auto_calc(staff, gross, 2026, 4, atts)

        # 분류 표시
        if staff.contract_type == '사업소득자':
            cat = '3.3%'
        elif staff.contract_type == '정규직' or staff.insurance_4major:
            cat = '4대보험'
        else:
            cat = '일용직'

        # 세무사 합계
        acc_sum = a['np'] + a['hi'] + a['ei'] + a['lti'] + a['it'] + a['lit']
        auto_sum = sum(auto.values())
        diff = auto_sum - acc_sum

        flag = '[OK]' if abs(diff) <= 100 else '[DIFF]'
        print(f"{a['name']:<8} {cat:<10} {gross:>10,} | {'':6} {acc_sum:>10,} {auto_sum:>10,} {diff:>+10,} {flag}")

        if abs(diff) <= 100:
            perfect_count += 1
            total_match += 1
        else:
            # 항목별 차이 분석
            for k in ['np', 'hi', 'ei', 'lti', 'it', 'lit']:
                d = auto[k] - a[k]
                if d != 0:
                    print(f"{'':<28}   {k:<5} {a[k]:>10,} {auto[k]:>10,} {d:>+10,}")
        total_check += 1

    print("\n" + "=" * 100)
    print(f"결과: 10명 중 {perfect_count}명 정확 일치 (오차 ≤ 100원)")
    print("=" * 100)
