def calc_tax(gross):
    # This is a dummy script to test the exact formula and see if we can get 11600!
    # A simplified attempt at the NTS formula for 2024+
    A = gross * 12
    # 근로소득공제
    if A <= 5000000: D = A * 0.7
    elif A <= 15000000: D = 3500000 + (A - 5000000) * 0.4
    elif A <= 45000000: D = 7500000 + (A - 15000000) * 0.15
    elif A <= 100000000: D = 12000000 + (A - 45000000) * 0.05
    else: D = 14750000 + (A - 100000000) * 0.02
    
    E = A - int(D)
    
    # 기본공제 1인
    P = 1500000 * 1
    
    # 국민연금, 건강보험, 고용보험
    # NTS formula typically uses an approximation for insurance
    # Let's use the actual exact insurance paid? Or let's see what NTS simplifies it to.
    import math
    
    I_rates = [0.10, 0.11, 0.12, 0.13, 0.14, 0.07545]  # trying various standards
    
    print(f"Gross: {gross}, Annual: {A}, Earned: {E}")
    for rate in I_rates:
        I = min(gross, 6370000) * 12 * rate if rate > 0 else 0
        
        # 특별소득공제 (표준공제)
        S = 130000
        if A <= 30000000:
            S = 3100000 + A * 0.04 - E * 0.05
            S = max(130000, S)
        
        taxable_base = max(0, E - P - I - S)
        
        # 세액 산출
        if taxable_base <= 14000000: tax = taxable_base * 0.06
        elif taxable_base <= 50000000: tax = 840000 + (taxable_base - 14000000) * 0.15
        elif taxable_base <= 88000000: tax = 6240000 + (taxable_base - 50000000) * 0.24
        elif taxable_base <= 150000000: tax = 15360000 + (taxable_base - 88000000) * 0.35
        else: tax = 37060000 + (taxable_base - 150000000) * 0.38
        
        # 근로소득세액공제
        if tax <= 500000: tax_credit = tax * 0.55
        else: tax_credit = 275000 + (tax - 500000) * 0.3

        if A <= 33000000: tax_credit_limit = 740000
        elif A <= 70000000: tax_credit_limit = 660000
        else: tax_credit_limit = 500000
        
        tax_credit = min(tax_credit, tax_credit_limit)
        
        final_tax_annual = tax - tax_credit
        monthly_tax = max(0, final_tax_annual / 12)
        print(f"Rate: {rate}, Monthly Tax: {int(monthly_tax/10)*10}")

calc_tax(1630800)
calc_tax(1430800)  # With 200k meal applied
calc_tax(2268000)
calc_tax(2068000)  # With 200k meal applied
calc_tax(3400000)
calc_tax(3200000)  # With 200k meal applied
