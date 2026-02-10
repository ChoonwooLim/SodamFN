"""Fix payroll ID sequence and import Jan 2026 payroll from Excel."""
import pandas as pd
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

EXCEL_PATH = r"C:\WORK\SodamFN\2026소득분석\2026소담김밥01월급여계산서.xlsx"

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///sodam_database.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

eng = create_engine(DATABASE_URL)

def find_cell_value(df, label_substr, rightmost=False):
    """Find label in any column, return numeric value from same row.
    If rightmost=True, returns the LAST numeric value in the row (for amount columns).
    If rightmost=False, returns the FIRST numeric value after the label."""
    for idx, row in df.iterrows():
        for col_idx in range(len(row)):
            val = row.iloc[col_idx]
            if isinstance(val, str) and label_substr in val.strip():
                if rightmost:
                    # Find the rightmost numeric value in the row
                    last_val = 0
                    for j in range(col_idx + 1, len(row)):
                        v = row.iloc[j]
                        if isinstance(v, (int, float)) and not pd.isna(v):
                            last_val = int(v)
                    return last_val
                else:
                    for j in range(col_idx + 1, min(col_idx + 6, len(row))):
                        v = row.iloc[j]
                        if isinstance(v, (int, float)) and not pd.isna(v):
                            return int(v)
    return 0

def parse_sheet(df, contract_type):
    base_pay = find_cell_value(df, "기본급")
    meal = find_cell_value(df, "식비")

    if contract_type == "정규직":
        if meal > 0:
            base_pay = base_pay + meal
    else:
        work_total = find_cell_value(df, "근무시간 합계", rightmost=True)
        if work_total > 0:
            base_pay = work_total

    holiday_pay = find_cell_value(df, "주휴수당 합계", rightmost=True)
    hw1 = find_cell_value(df, "주휴수당 1주차", rightmost=True)
    hw2 = find_cell_value(df, "주휴수당 2주차", rightmost=True)
    hw3 = find_cell_value(df, "주휴수당 3주차", rightmost=True)
    hw4 = find_cell_value(df, "주휴수당 4주차", rightmost=True)
    hw5 = find_cell_value(df, "주휴수당 5주차", rightmost=True)

    d_np = find_cell_value(df, "국민연금")
    d_hi = find_cell_value(df, "건강보험")
    d_ei = find_cell_value(df, "고용보험")
    d_lti = find_cell_value(df, "장기요양")
    d_it = find_cell_value(df, "소득세")
    d_lit = find_cell_value(df, "지방소득세") or find_cell_value(df, "주민세")
    total_ded = find_cell_value(df, "공제 합계")

    tax_support = find_cell_value(df, "제세공과금")
    total_pay = find_cell_value(df, "급여합계") or find_cell_value(df, "급여 합계")

    subtotal = find_cell_value(df, "소   계") or find_cell_value(df, "소 계")
    if total_pay == 0:
        total_pay = (subtotal or (base_pay + holiday_pay)) - total_ded + tax_support

    return {
        "base_pay": base_pay, "holiday_pay": holiday_pay,
        "hw1": hw1, "hw2": hw2, "hw3": hw3, "hw4": hw4, "hw5": hw5,
        "d_np": d_np, "d_hi": d_hi, "d_ei": d_ei, "d_lti": d_lti,
        "d_it": d_it, "d_lit": d_lit,
        "total_ded": total_ded, "tax_support": tax_support, "total_pay": total_pay,
    }

def main():
    xl = pd.ExcelFile(EXCEL_PATH)

    with eng.connect() as conn:
        # Fix sequence: set to max existing ID + 1
        max_id = conn.execute(text("SELECT COALESCE(MAX(id), 0) FROM payroll")).scalar()
        print(f"Current max payroll ID: {max_id}")
        conn.execute(text(f"ALTER SEQUENCE payroll_id_seq RESTART WITH {max_id + 1}"))
        conn.commit()
        print(f"Sequence reset to {max_id + 1}")

        # Clean existing Jan 2026
        result = conn.execute(text("DELETE FROM payroll WHERE month = '2026-01'"))
        conn.commit()
        print(f"Deleted {result.rowcount} existing Jan 2026 records\n")

        # Get staff
        staff_rows = conn.execute(text("SELECT id, name, contract_type FROM staff WHERE status = '재직'")).fetchall()
        staff_map = {r[1]: {"id": r[0], "name": r[1], "contract_type": r[2]} for r in staff_rows}

        employee_sheets = [s for s in xl.sheet_names if s not in ["손익분석", "급여총액", "합계"]]
        imported = 0

        for sheet_name in employee_sheets:
            clean = sheet_name.split("(")[0].strip()
            staff = staff_map.get(clean)
            if not staff:
                for sname, sobj in staff_map.items():
                    if clean in sname or sname in clean:
                        staff = sobj
                        break
            if not staff:
                print(f"SKIP {sheet_name}: no matching staff")
                continue

            df = xl.parse(sheet_name, header=None)
            data = parse_sheet(df, staff["contract_type"])

            print(f"{staff['name']} ({staff['contract_type']}): Base={data['base_pay']:,}  Holiday={data['holiday_pay']:,}  Ded=-{data['total_ded']:,}  Support={data['tax_support']:,}  Total={data['total_pay']:,}")

            if data['base_pay'] == 0 and data['total_pay'] == 0:
                print("  SKIP: no data")
                continue

            conn.execute(text("""
                INSERT INTO payroll (
                    month, staff_id, base_pay, bonus, deductions, total_pay,
                    bonus_meal, bonus_tax_support, bonus_holiday,
                    holiday_w1, holiday_w2, holiday_w3, holiday_w4, holiday_w5,
                    deduction_np, deduction_hi, deduction_ei, deduction_lti,
                    deduction_it, deduction_lit, transfer_status
                ) VALUES (
                    :month, :staff_id, :base_pay, :bonus, :deductions, :total_pay,
                    0, :bonus_tax_support, :bonus_holiday,
                    :hw1, :hw2, :hw3, :hw4, :hw5,
                    :d_np, :d_hi, :d_ei, :d_lti, :d_it, :d_lit, '이체대기'
                )
            """), {
                "month": "2026-01", "staff_id": staff["id"],
                "base_pay": data["base_pay"], "bonus": data["holiday_pay"],
                "deductions": data["total_ded"], "total_pay": data["total_pay"],
                "bonus_tax_support": data["tax_support"], "bonus_holiday": data["holiday_pay"],
                "hw1": data["hw1"], "hw2": data["hw2"], "hw3": data["hw3"],
                "hw4": data["hw4"], "hw5": data["hw5"],
                "d_np": data["d_np"], "d_hi": data["d_hi"],
                "d_ei": data["d_ei"], "d_lti": data["d_lti"],
                "d_it": data["d_it"], "d_lit": data["d_lit"],
            })
            imported += 1

        conn.commit()

        # Summary
        print(f"\n{'='*60}")
        print(f"DONE: {imported} payroll records imported")
        rows = conn.execute(text("""
            SELECT s.name, p.base_pay, p.bonus_holiday, p.deductions, p.total_pay, p.bonus_tax_support
            FROM payroll p JOIN staff s ON p.staff_id = s.id
            WHERE p.month = '2026-01' ORDER BY s.id
        """)).fetchall()
        for r in rows:
            print(f"  {r[0]}: base={r[1]:,}  holiday={r[2]:,}  ded=-{r[3]:,}  support={r[5]:,}  total={r[4]:,}")

if __name__ == "__main__":
    main()
