from utils.payroll_calc_utils import calculate_2026_insurances, calculate_korean_income_tax

def test_calc():
    print("--- 2026 Payroll Calculation Test ---")
    
    # Example 1: Regular worker, Gross 3,000,000 KRW, 1 dependent, 0 children
    gross = 3000000
    ins = calculate_2026_insurances(gross)
    it = calculate_korean_income_tax(gross, dependents=1, children=0)
    lit = int(it * 0.1 / 10) * 10
    
    print(f"Test 1: Gross {gross:,}, 1 Dep, 0 Child")
    print(f"  - NP: {ins['np']:,} (Expected ~142,500)")
    print(f"  - HI: {ins['hi']:,} (Expected ~107,850)")
    print(f"  - LTI: {ins['lti']:,} (Expected ~13,810)")
    print(f"  - EI: {ins['ei']:,} (Expected ~27,000)")
    print(f"  - IT: {it:,} (Expected ~50,000)")
    print(f"  - LIT: {lit:,} (Expected ~5,000)")
    print(f"  - Total Deductions: {ins['np']+ins['hi']+ins['lti']+ins['ei']+it+lit:,}")
    print(f"  - Net Pay: {gross - (ins['np']+ins['hi']+ins['lti']+ins['ei']+it+lit):,}")
    
    # Example 2: Gross 2,500,000 KRW, 3 dependents, 1 child
    gross2 = 2500000
    ins2 = calculate_2026_insurances(gross2)
    it2 = calculate_korean_income_tax(gross2, dependents=3, children=1)
    lit2 = int(it2 * 0.1 / 10) * 10
    
    print(f"\nTest 2: Gross {gross2:,}, 3 Dep, 1 Child")
    print(f"  - IT (Tax): {it2:,} (Expect lower than Test 1 due to dependents/child)")
    print(f"  - Net Pay: {gross2 - (ins2['np']+ins2['hi']+ins2['lti']+ins2['ei']+it2+lit2):,}")

if __name__ == "__main__":
    test_calc()
