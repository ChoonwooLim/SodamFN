from typing import Dict

def calculate_2026_insurances(gross_pay: int) -> Dict[str, int]:
    """
    Calculates 2026 South Korean 4 major insurance deductions.
    - National Pension: 4.75% (0.5% increase from 2025)
    - Health Insurance: 3.595% (0.1% increase from 2024/2025)
    - Long-term Care: 12.81% of Health Insurance
    - Employment Insurance: 0.9%
    Amounts are rounded down to the nearest 10 KRW as per standard practice.
    """
    # Gross pay for insurance normally excludes non-taxable meals (up to 200k)
    # But usually, insurance is calculated based on 'Reported Monthly Income'.
    # Here we calculate based on the provided gross_pay (which should be taxable gross).
    
    # 1. National Pension (국민연금) 4.75%
    # Cap: min 400,000, max 6,370,000 (2025.07 ~ 2026.06 standard)
    np_income = max(400000, min(gross_pay, 6370000))
    deduction_np = int(np_income * 0.0475 / 10) * 10
    
    # 2. Health Insurance (건강보험) 3.595%
    # Cap: min 280,383, max 127,725,730 (2026 standard)
    hi_income = max(280383, min(gross_pay, 127725730))
    deduction_hi = int(hi_income * 0.03595 / 10) * 10
    
    # 3. Long-term Care (장기요양보험) 12.81% of Health Insurance
    deduction_lti = int(deduction_hi * 0.1281 / 10) * 10
    
    # 4. Employment Insurance (고용보험) 0.9%
    deduction_ei = int(gross_pay * 0.009 / 10) * 10
    
    return {
        "np": deduction_np,
        "hi": deduction_hi,
        "lti": deduction_lti,
        "ei": deduction_ei
    }

def calculate_korean_income_tax(taxable_monthly_income: int, dependents: int = 1, children: int = 0) -> int:
    """
    Calculates Korean Income Tax based on the Simplified Tax Table logic.
    This is an approximation of the 2024/2025/2026 table formulas.
    """
    # Simplified logic based on common tax brackets for monthly income
    # For a precise implementation, a full lookup table is ideal, 
    # but we can implement the core logic for the common ranges in this business.
    
    if taxable_monthly_income < 1060000:
        return 0
    
    # 1. Basic Income Tax Calculation (Simplified formula based on brackets)
    # Note: This is an approximation of the many brackets in the table.
    # Standard 1-person deduction logic
    if taxable_monthly_income < 2000000:
        base_tax = (taxable_monthly_income - 1000000) * 0.01 # Roughly 1%
    elif taxable_monthly_income < 3000000:
        base_tax = 10000 + (taxable_monthly_income - 2000000) * 0.04
    else:
        base_tax = 50000 + (taxable_monthly_income - 3000000) * 0.15
        
    # 2. Dependent Deduction Adjustment
    # Every additional dependent reduces the tax.
    # Rough adjustment: -15% per additional dependent
    if dependents > 1:
        base_tax = base_tax * (1 - (dependents - 1) * 0.15)
        
    # 3. Child Tax Credit Adjustment
    # Child credit (8-20 yrs): 1 child = 12,500, 2 = 29,160, 3+ = 29,160 + 25,000 each
    child_credit = 0
    if children == 1:
        child_credit = 12500
    elif children == 2:
        child_credit = 29160
    elif children >= 3:
        child_credit = 29160 + (children - 2) * 25000
        
    final_tax = max(0, base_tax - child_credit)
    
    # Result is rounded to 10s
    return int(final_tax / 10) * 10
