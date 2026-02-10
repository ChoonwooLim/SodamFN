import pandas as pd
import os
import re
import glob
from sqlmodel import Session, select, create_engine
from models import Staff, Payroll, StaffDocument # Assuming these exist in models.py

# Setup DB
DATABASE_URL = "sqlite:///sodam_database.db"
engine = create_engine(DATABASE_URL)

def normalize_name(name):
    return name.replace(" ", "").strip()

def get_staff_map(session):
    staffs = session.exec(select(Staff)).all()
    return {normalize_name(s.name): s.id for s in staffs}

def extract_payroll_from_sheet(df):
    values = df.values
    rows, cols = values.shape
    
    def clean_money(val):
        if pd.isna(val): return 0
        s = str(val).replace(",", "").replace("원", "").strip()
        try:
            return int(float(s))
        except:
            return 0
            
    # Detailed Bonus (Earnings)
    bonus_meal = 0
    bonus_holiday = 0
    
    # Detailed Deductions
    deduction_np = 0
    deduction_hi = 0
    deduction_ei = 0
    deduction_lti = 0
    deduction_it = 0
    deduction_lit = 0
    
    bank_account = None
    hourly_wage = 0
    total_pay = 0
    base_pay = 0
    bonus = 0
    deductions = 0
    
    # Weekly Holiday Allowance
    h_w1, h_w2, h_w3, h_w4, h_w5 = 0, 0, 0, 0, 0
    
    # Detailed working breakdown
    work_breakdown = []
    # Weekly Holiday Calculations
    holiday_details = {} # week_num -> calc_string
    
    key_map = {}
    
    # Common Korean Bank Names
    bank_names = ["농협", "국민", "신한", "우리", "기업", "하나", "새마을", "카카오", "부산", "대구", "광주", "SC", "씨티", "수협", "우체국"]
    
    potential_wages = []

    for r in range(rows):
        for c in range(cols):
            val = values[r][c]
            if pd.notna(val):
                s_val = str(val).strip()
                key_map[s_val] = (r, c)
                
                # Hourly Breakdown (Image 1) - Searching for "시급(N시간)"
                if "시급(" in s_val and "시간)" in s_val:
                    # Robust search for rate, hours, days, amount in current row
                    nums = []
                    for offset in range(1, 10):
                        if c+offset < cols:
                            v = values[r][c+offset]
                            if pd.notna(v):
                                try:
                                    # Clean and convert to float
                                    s = str(v).replace(",", "").replace("원", "").strip()
                                    if s: nums.append((c+offset, float(s)))
                                except: pass
                    
                    rate = 0
                    hours = 0
                    days = 0
                    amount = 0
                    
                    # Heuristics:
                    # - Rate is usually >= 9000
                    # - Amount is the largest value or at the far right
                    # - Hours and Days are smaller values
                    
                    if nums:
                        # Find rate
                        for col_idx, val in nums:
                            if 9000 <= val < 100000:
                                rate = int(val)
                                break
                        # Find amount (usually largest and far right)
                        amount = int(max(nums, key=lambda x: x[1])[1])
                        # Remaining values are hours and days
                        other_nums = [n for n in nums if n[1] != rate and n[1] != amount]
                        if len(other_nums) >= 2:
                            hours = other_nums[0][1]
                            days = int(other_nums[1][1])
                        elif len(other_nums) == 1:
                            hours = other_nums[0][1]
                            
                    # Look for dates in the row below (Scan entire row)
                    dates = ""
                    if r+1 < rows:
                         for c_test in range(cols):
                              test_val = str(values[r+1][c_test])
                              if "일" in test_val and any(char.isdigit() for char in test_val):
                                   if "급여" not in test_val and "수당" not in test_val:
                                        dates = test_val.strip()
                                        break
                    
                    work_breakdown.append({
                        "label": s_val,
                        "rate": rate,
                        "hours": hours,
                        "days": days,
                        "amount": amount,
                        "dates": dates
                    })

                # Bank Account
                if "계좌" in s_val and ":" in s_val:
                    parts = s_val.split(":")
                    if len(parts) > 1: bank_account = parts[1].strip()
                
                if not bank_account:
                    for bank in bank_names:
                        if bank in s_val:
                            if any(char.isdigit() for char in s_val):
                                if "연금" in s_val or "보험" in s_val: continue
                                bank_account = s_val.strip()
                                break
                        
                # Hourly Wage Collection
                v_num = clean_money(val)
                if 9000 <= v_num <= 50000:
                    potential_wages.append(v_num)
                    
                # Explicit "시급" tag
                if "시급" in s_val:
                    for c2 in range(cols):
                        v_test = clean_money(values[r][c2])
                        if 9000 <= v_test <= 50000:
                            hourly_wage = v_test
                            
                # Weekly Holiday Allowance & Calculation (Image 2)
                for w_num in range(1, 6):
                    if f"주휴수당 {w_num}주차" in s_val:
                        # Extract calculation string
                        calc = ""
                        for offset in range(1, 5):
                            if c+offset < cols:
                                test_c = str(values[r][c+offset])
                                if "/" in test_c and "=" in test_c:
                                    calc = test_c.strip()
                                    break
                        if calc:
                             holiday_details[str(w_num)] = calc

                        # Amount (Rightmost value >= 1000)
                        found_amt = 0
                        for offset in range(1, 15):
                            if c+offset < cols:
                                v = clean_money(values[r][c+offset])
                                if v >= 1000: 
                                     found_amt = v # Keep updating to get the rightmost one
                        if w_num == 1: h_w1 = found_amt
                        elif w_num == 2: h_w2 = found_amt
                        elif w_num == 3: h_w3 = found_amt
                        elif w_num == 4: h_w4 = found_amt
                        elif w_num == 5: h_w5 = found_amt

                # Detailed Payroll Keys
                # Deductions
                if "국민연금" in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_np = v; break
                if "건강보험" in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_hi = v; break
                if "고용보험" in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_ei = v; break
                if "장기요양" in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_lti = v; break
                if "소득세" in s_val and "지방" not in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_it = v; break
                if "지방소득세" in s_val:
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_lit = v; break
                if "원천징수" in s_val or ("3.3%" in s_val and "공제" in s_val):
                     # Usually for part-time, single deduction
                    for offset in range(1, 8):
                        if c+offset < cols:
                            v = clean_money(values[r][c+offset])
                            if v > 0: deduction_it = v; break

                # Payroll Keys
                if "실급여 지급액" in s_val or "실 지급액" in s_val:
                    key_map["MATCH_REAL_PAY"] = (r, c, s_val)
                if "급여 합계" in s_val:
                    key_map["MATCH_TOTAL_PAY"] = (r, c, s_val)
                if "공제 합계" in s_val:
                    key_map["MATCH_DED_TOTAL"] = (r, c)
                if "주휴수당 합계" in s_val:
                    key_map["MATCH_HOLIDAY"] = (r, c)
                if "식비지원" in s_val:
                    key_map["MATCH_MEAL"] = (r, c)
                if "제세공과금 지원금" in s_val:
                    key_map["MATCH_TAX_SUPPORT"] = (r, c)
                if "소 계" in s_val:
                    key_map["MATCH_SUBTOTAL"] = (r, c)

    # Determine Wage
    if hourly_wage == 0 and potential_wages:
        from statistics import mode, StatisticsError
        try:
            hourly_wage = mode(potential_wages)
        except StatisticsError:
            hourly_wage = max(potential_wages)

    import json
    details_json = json.dumps({
        "work_breakdown": work_breakdown,
        "holiday_details": holiday_details
    }, ensure_ascii=False)

    # SPECIAL LOGIC FOR REGULAR STAFF
    if "MATCH_TAX_SUPPORT" in key_map:
        # Bonus (Tax Support as Additional Allowance)
        r, c = key_map["MATCH_TAX_SUPPORT"]
        if c+4 < cols: bonus = clean_money(values[r][c+4])
        if bonus == 0 and c+1 < cols: bonus = clean_money(values[r][c+1])
        
        # Base Pay (Subtotal)
        if "MATCH_SUBTOTAL" in key_map:
            r, c = key_map["MATCH_SUBTOTAL"]
            if c+4 < cols: base_pay = clean_money(values[r][c+4])
                 
        # Deductions
        if "MATCH_DED_TOTAL" in key_map:
            r, c = key_map["MATCH_DED_TOTAL"]
            if c+4 < cols: deductions = clean_money(values[r][c+4])
                
        total_pay = base_pay + bonus - deductions
             
        return base_pay, bonus, deductions, total_pay, bank_account, hourly_wage, 0, 0, deduction_np, deduction_hi, deduction_ei, deduction_lti, deduction_it, deduction_lit, 0, 0, 0, 0, 0, details_json

    # PART-TIME LOGIC
    # 1. Total Pay
    if "MATCH_REAL_PAY" in key_map:
        r, c, txt = key_map["MATCH_REAL_PAY"]
        match = re.search(r'([\d,-]+)', txt.split(':')[-1])
        if match: total_pay = clean_money(match.group(1))
        else:
             if c+1 < cols: total_pay = clean_money(values[r][c+1])
    
    if total_pay == 0 and "MATCH_TOTAL_PAY" in key_map:
        r, c, txt = key_map["MATCH_TOTAL_PAY"]
        found = False
        for offset in range(1, 4):
            if c+offset < cols:
                v = clean_money(values[r][c+offset])
                if v != 0:
                    total_pay = v
                    found = True
                    break
        if not found and r+1 < rows and c+1 < cols:
             total_pay = clean_money(values[r+1][c+1])

    # 2. Deductions
    if "MATCH_DED_TOTAL" in key_map:
        r, c = key_map["MATCH_DED_TOTAL"]
        for offset in range(1, 8):
            if c+offset < cols:
                v = values[r][c+offset]
                if pd.notna(v) and str(v).strip() != "":
                     deductions = clean_money(v)
                     break

    # 3. Bonus
    if "MATCH_MEAL" in key_map:
        r, c = key_map["MATCH_MEAL"]
        if c+2 < cols: bonus_meal = clean_money(values[r][c+2])
    
    if "MATCH_HOLIDAY" in key_map:
        r, c = key_map["MATCH_HOLIDAY"]
        for offset in range(1, 8):
            if c+offset < cols:
                v = values[r][c+offset]
                if pd.notna(v) and str(v).strip() != "":
                     bonus_holiday = clean_money(v)
                     break
    
    bonus = bonus_meal + bonus_holiday
                     
    # 4. Base Pay (Derived)
    base_pay = total_pay - bonus + deductions
    
    return base_pay, bonus, deductions, total_pay, bank_account, hourly_wage, bonus_meal, bonus_holiday, deduction_np, deduction_hi, deduction_ei, deduction_lti, deduction_it, deduction_lit, h_w1, h_w2, h_w3, h_w4, h_w5, details_json

def process_files():
    data_dir = r"c:\WORK\SodamFN\2025실소득분석"
    files = glob.glob(os.path.join(data_dir, "*월급여계산서.xlsx"))
    
    with Session(engine) as session:
        staff_map = get_staff_map(session)
        
        # Cache staff updates to avoid overwriting with older data (use latest month?)
        # Actually latest file is best. Iterate files in order?
        files.sort() # Ensure Jan -> Dec order
        
        for file in files:
            filename = os.path.basename(file)
            match = re.search(r'2025.*(\d{2})월', filename)
            if not match: continue
            month = f"2025-{match.group(1)}"
            print(f"Processing {filename} -> Month {month}")
            
            try:
                xl = pd.ExcelFile(file)
                for sheet in xl.sheet_names:
                    norm_sheet = normalize_name(sheet)
                    if norm_sheet in staff_map:
                        staff_id = staff_map[norm_sheet]
                        df = pd.read_excel(file, sheet_name=sheet, header=None)
                        base, bonus, ded, total, bank, wage, b_meal, b_holiday, d_np, d_hi, d_ei, d_lti, d_it, d_lit, h1, h2, h3, h4, h5, d_json = extract_payroll_from_sheet(df)
                        
                        if total == 0 and base == 0: continue
                            
                        # UPSERT PAYROLL
                        existing = session.exec(select(Payroll).where(Payroll.staff_id == staff_id, Payroll.month == month)).first()
                        if existing:
                            existing.base_pay = base
                            existing.bonus = bonus
                            existing.deductions = ded
                            existing.total_pay = total
                            existing.bonus_meal = b_meal
                            existing.bonus_holiday = b_holiday
                            existing.holiday_w1 = h1
                            existing.holiday_w2 = h2
                            existing.holiday_w3 = h3
                            existing.holiday_w4 = h4
                            existing.holiday_w5 = h5
                            existing.deduction_np = d_np
                            existing.deduction_hi = d_hi
                            existing.deduction_ei = d_ei
                            existing.deduction_lti = d_lti
                            existing.deduction_it = d_it
                            existing.deduction_lit = d_lit
                            existing.details_json = d_json
                            session.add(existing)
                        else:
                            new_p = Payroll(
                                staff_id=staff_id,
                                month=month,
                                base_pay=base,
                                bonus=bonus,
                                deductions=ded,
                                total_pay=total,
                                bonus_meal=b_meal,
                                bonus_holiday=b_holiday,
                                holiday_w1 = h1,
                                holiday_w2 = h2,
                                holiday_w3 = h3,
                                holiday_w4 = h4,
                                holiday_w5 = h5,
                                deduction_np=d_np,
                                deduction_hi=d_hi,
                                deduction_ei=d_ei,
                                deduction_lti=d_lti,
                                deduction_it=d_it,
                                deduction_lit=d_lit,
                                details_json = d_json
                            )
                            session.add(new_p)
                        
                        # UPDATE STAFF INFO (Cumulative update, latest wins)
                        staff = session.get(Staff, staff_id)
                        if staff:
                            if bank: staff.bank_account = bank
                            if wage > 0: staff.hourly_wage = wage
                            # If Regular (Base > 1M), set monthly salary
                            if staff.contract_type == "정규직" and base > 1000000:
                                staff.monthly_salary = base
                            session.add(staff)
                            
                session.commit()
            except Exception as e:
                print(f"Error processing {file}: {e}")

if __name__ == "__main__":
    process_files()
