"""
Verification test: Compare system calculations against 2026 Feb payroll
(세무사 산출 급여명세서와 시스템 계산 결과 비교)
"""
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax

def verify():
    print("=" * 60)
    print("  세무사 산출 기준 검증 (2026년 2월 허윤희)")
    print("=" * 60)
    
    # 허윤희: 4대보험, 보수월액=1,500,000, 총지급액=1,680,000
    gross_pay = 1680000
    insurance_base = 1500000
    
    print(f"\n총 지급액: {gross_pay:>12,}원")
    print(f"보수월액:   {insurance_base:>12,}원")
    print()
    
    ins = calculate_insurances(gross_pay, 2026, insurance_base=insurance_base)
    it = calculate_korean_income_tax(gross_pay, dependents=1, children=0)
    lit = int(it * 0.1 / 10) * 10
    
    expected = {
        "np": 71250,
        "hi": 53920,
        "lti": 7080,
        "ei": 13500,
        "it": 12640,
        "lit": 1260,
    }
    
    items = [
        ("국민연금", "np", ins["np"]),
        ("건강보험", "hi", ins["hi"]),
        ("장기요양", "lti", ins["lti"]),
        ("고용보험", "ei", ins["ei"]),
        ("소득세  ", "it", it),
        ("지방소득세", "lit", lit),
    ]
    
    all_pass = True
    total_calc = 0
    total_expected = 0
    
    for label, key, calc_val in items:
        exp_val = expected[key]
        match = "✅" if calc_val == exp_val else "❌"
        if calc_val != exp_val:
            all_pass = False
        print(f"  {label}: {calc_val:>8,}원  (세무사: {exp_val:>8,}원) {match}")
        total_calc += calc_val
        total_expected += exp_val
    
    print(f"\n  공제액 합계: {total_calc:>8,}원  (세무사: {total_expected:>8,}원) {'✅' if total_calc == total_expected else '❌'}")
    print(f"  차인지급액: {gross_pay - total_calc:>8,}원  (세무사: {gross_pay - total_expected:>8,}원)")
    
    print(f"\n{'=' * 60}")
    if all_pass:
        print("  ✅ 모든 항목이 세무사 산출 결과와 일치합니다!")
    else:
        print("  ❌ 일부 항목이 불일치합니다. 확인 필요!")
    print(f"{'=' * 60}")
    
    # Additional test: 소득세 간이세액표 몇 가지 추가 검증
    print(f"\n\n--- 간이세액표 추가 검증 ---")
    test_cases = [
        (1500000, 1, 8920, "150만원/1인"),
        (1680000, 1, 12640, "168만원/1인 (허윤희)"),
        (3000000, 1, 73900, "300만원/1인"),
    ]
    
    for income, deps, expected_tax, label in test_cases:
        calc_tax = calculate_korean_income_tax(income, dependents=deps)
        match = "✅" if calc_tax == expected_tax else "❌"
        print(f"  {label}: {calc_tax:>8,}원 (기대: {expected_tax:>8,}원) {match}")

if __name__ == "__main__":
    verify()
