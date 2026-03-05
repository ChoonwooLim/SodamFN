"""
보수월액 산출 및 사업소득자 3.3% 원천징수 검증 스크립트

PDF 데이터 기준:
1. 직장가입자 보수총액 통보서 → 보수월액 산출 검증
2. 사업소득 원천징수영수증 → 3.3% 원천징수 검증
"""
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax

def verify_insurance_base():
    """직장가입자 보수총액 통보서 기반 보수월액 산출 검증"""
    print("=" * 65)
    print("  직장가입자 보수총액 통보서 기반 보수월액 산출 검증")
    print("=" * 65)
    
    employees = [
        {"name": "김금순", "total": 33_600_000, "months": 11},
        {"name": "허윤희", "total": 13_267_800, "months": 9},
        {"name": "정명주", "total": 14_145_800, "months": 9},
    ]
    
    all_pass = True
    for emp in employees:
        base_salary = round(emp["total"] / emp["months"] / 1000) * 1000
        raw = emp["total"] / emp["months"]
        print(f"\n  [{emp['name']}]")
        print(f"    보수총액:    {emp['total']:>12,}원")
        print(f"    근무월수:    {emp['months']:>12}개월")
        print(f"    원계산값:    {raw:>12,.1f}원")
        print(f"    보수월액:    {base_salary:>12,}원 (천원 반올림)")
        
        # 2026년 4대보험 산출
        ins = calculate_insurances(0, 2026, insurance_base=base_salary)
        d_np = ins["np"]
        d_hi = ins["hi"]
        d_lti = ins["lti"]
        d_ei = ins["ei"]
        
        print(f"\n    [2026년 4대보험 공제액 산출]")
        print(f"    국민연금:    {d_np:>12,}원  (4.75%)")
        print(f"    건강보험:    {d_hi:>12,}원  (3.595%)")
        print(f"    장기요양:    {d_lti:>12,}원  (건보×13.14%)")
        print(f"    고용보험:    {d_ei:>12,}원  (0.9%)")
        total_ins = d_np + d_hi + d_lti + d_ei
        print(f"    보험합계:    {total_ins:>12,}원")
    
    print(f"\n{'=' * 65}")
    return all_pass


def verify_business_income_tax():
    """사업소득자 3.3% 원천징수 검증 (김순복)"""
    print("\n" + "=" * 65)
    print("  사업소득자 3.3% 원천징수 검증 (김순복)")
    print("=" * 65)
    
    # PDF 데이터: 25년 사업소득원천징수영수증
    monthly_data = [
        ("2025-03", 1_407_000, 42_210, 4_220),
        ("2025-04", 1_449_000, 43_470, 4_340),
        ("2025-05", 1_524_600, 45_730, 4_570),
        ("2025-06", 1_661_100, 49_830, 4_980),
        ("2025-07", 2_143_900, 64_310, 6_430),
        ("2025-08", 1_353_000, 40_590, 4_050),
        ("2025-09", 2_052_600, 61_570, 6_150),
        ("2025-10", 1_927_200, 57_810, 5_780),
        ("2025-11", 1_973_400, 59_200, 5_920),
        ("2025-12", 2_019_600, 60_580, 6_050),
    ]
    
    all_pass = True
    print(f"\n  {'귀속월':>8}  {'지급총액':>12}  {'소득세(계산)':>12}  {'소득세(PDF)':>12}  {'지방세(계산)':>12}  {'지방세(PDF)':>12}  결과")
    print(f"  {'-'*8}  {'-'*12}  {'-'*12}  {'-'*12}  {'-'*12}  {'-'*12}  {'-'*4}")
    
    for month, gross, pdf_it, pdf_lit in monthly_data:
        # 시스템 계산: 3.3% 원천징수
        calc_it = int(gross * 0.03 / 10) * 10
        calc_lit = int(calc_it * 0.1 / 10) * 10
        
        it_match = calc_it == pdf_it
        lit_match = calc_lit == pdf_lit
        both_match = it_match and lit_match
        
        if not both_match:
            all_pass = False
        
        status = "PASS" if both_match else "FAIL"
        print(f"  {month:>8}  {gross:>12,}  {calc_it:>12,}  {pdf_it:>12,}  {calc_lit:>12,}  {pdf_lit:>12,}  {status}")
    
    # Totals
    total_gross = sum(d[1] for d in monthly_data)
    total_pdf_it = sum(d[2] for d in monthly_data)
    total_pdf_lit = sum(d[3] for d in monthly_data)
    total_calc_it = sum(int(d[1] * 0.03 / 10) * 10 for d in monthly_data)
    total_calc_lit = sum(int(int(d[1] * 0.03 / 10) * 10 * 0.1 / 10) * 10 for d in monthly_data)
    
    print(f"\n  {'합계':>8}  {total_gross:>12,}  {total_calc_it:>12,}  {total_pdf_it:>12,}  {total_calc_lit:>12,}  {total_pdf_lit:>12,}  {'PASS' if all_pass else 'FAIL'}")
    
    print(f"\n{'=' * 65}")
    if all_pass:
        print("  PASS 모든 월의 3.3% 원천징수액이 PDF 데이터와 일치합니다!")
    else:
        print("  FAIL 일부 항목이 불일치합니다. (절사 방식 차이 가능)")
    print(f"{'=' * 65}")
    
    return all_pass


def verify_heo_yunhee_cross_check():
    """허윤희 보수월액 교차 검증 (기존 test_payroll_2026.py 데이터와 비교)"""
    print("\n" + "=" * 65)
    print("  허윤희 보수월액 교차 검증")
    print("=" * 65)
    
    # 기존 테스트: 보수월액 1,500,000 (세무사 산출 기준)
    # 통보서 산출: 13,267,800 ÷ 9 = 1,474,200 → 1,474,000
    old_base = 1_500_000
    new_base = round(13_267_800 / 9 / 1000) * 1000
    
    print(f"\n  기존 보수월액 (세무사 기준):  {old_base:>12,}원")
    print(f"  통보서 산출 보수월액:         {new_base:>12,}원")
    print(f"  차이:                        {old_base - new_base:>12,}원")
    
    print(f"\n  ※ 세무사가 1,500,000원을 적용한 것은 취득시결정 또는 반올림 차이일 수 있습니다.")
    print(f"  ※ 통보서 기반 정기결정(1,474,000원)이 공식 기준입니다.")
    
    # 두 기준 비교
    for label, base in [("세무사 기준 (1,500,000)", old_base), ("통보서 기준 (1,474,000)", new_base)]:
        ins = calculate_insurances(0, 2026, insurance_base=base)
        it = calculate_korean_income_tax(1_680_000, dependents=1, children=0)
        lit = int(it * 0.1 / 10) * 10
        total = ins["np"] + ins["hi"] + ins["lti"] + ins["ei"] + it + lit
        print(f"\n  [{label}]")
        print(f"    국민연금: {ins['np']:>8,}  건강보험: {ins['hi']:>8,}  장기요양: {ins['lti']:>8,}  고용보험: {ins['ei']:>8,}")
        print(f"    소득세:   {it:>8,}  지방세:   {lit:>8,}  총공제: {total:>8,}")
    
    print(f"\n{'=' * 65}")


if __name__ == "__main__":
    verify_insurance_base()
    verify_business_income_tax()
    verify_heo_yunhee_cross_check()
