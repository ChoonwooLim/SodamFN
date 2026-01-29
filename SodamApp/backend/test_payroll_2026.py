from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax

def test_calc():
    print("--- 2025 vs 2026 Payroll Calculation Test ---")
    
    gross = 3000000
    
    # 2025 Test
    ins2025 = calculate_insurances(gross, year=2025)
    print(f"2025 Test: Gross {gross:,}")
    print(f"  - NP (4.5%): {ins2025['np']:,} (Expected 135,000)")
    print(f"  - HI (3.545%): {ins2025['hi']:,} (Expected 106,350)")
    
    # 2026 Test
    ins2026 = calculate_insurances(gross, year=2026)
    print(f"\n2026 Test: Gross {gross:,}")
    print(f"  - NP (4.75%): {ins2026['np']:,} (Expected 142,500)")
    print(f"  - HI (3.595%): {ins2026['hi']:,} (Expected 107,850)")
    
    # General Deductions (2026 context)
    it = calculate_korean_income_tax(gross, dependents=1, children=0)
    lit = int(it * 0.1 / 10) * 10
    print(f"\nExample 2026 Net Pay Check:")
    print(f"  - IT: {it:,}")
    print(f"  - LIT: {lit:,}")
    print(f"  - Net Pay (2026): {gross - (ins2026['np']+ins2026['hi']+ins2026['lti']+ins2026['ei']+it+lit):,}")
    
    # Example 2: Gross 2,500,000 KRW, 3 dependents, 1 child
    gross2 = 2500000
    ins2 = calculate_insurances(gross2, year=2026)
    it2 = calculate_korean_income_tax(gross2, dependents=3, children=1)
    lit2 = int(it2 * 0.1 / 10) * 10
    
    print(f"\nTest 2: Gross {gross2:,}, 3 Dep, 1 Child")
    print(f"  - IT (Tax): {it2:,} (Expect lower than Test 1 due to dependents/child)")
    print(f"  - Net Pay: {gross2 - (ins2['np']+ins2['hi']+ins2['lti']+ins2['ei']+it2+lit2):,}")

if __name__ == "__main__":
    test_calc()
