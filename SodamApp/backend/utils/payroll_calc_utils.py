from typing import Dict

def calculate_insurances(gross_pay: int, year: int = 2026) -> Dict[str, int]:
    """
    Calculates South Korean 4 major insurance deductions based on the year.
    2026 Rates: NP 4.75%, HI 3.595%, LTI 12.81%
    2025 Rates: NP 4.5%, HI 3.545%, LTI 12.91%
    Employment Insurance remains 0.9%.
    """
    if year >= 2026:
        np_rate, hi_rate, lti_multiplier = 0.0475, 0.03595, 0.1281
    else:
        # Default to 2025 rates
        np_rate, hi_rate, lti_multiplier = 0.045, 0.03545, 0.1291
        
    # Cap logic (simplified for common ranges)
    np_income = max(400000, min(gross_pay, 6370000))
    hi_income = max(280383, min(gross_pay, 127725730))
    
    deduction_np = int(np_income * np_rate / 10) * 10
    deduction_hi = int(hi_income * hi_rate / 10) * 10
    deduction_lti = int(deduction_hi * lti_multiplier / 10) * 10
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
