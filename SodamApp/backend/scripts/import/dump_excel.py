"""Dump an Excel employee sheet to see the actual cell layout"""
import pandas as pd

EXCEL_PATH = r"C:\WORK\SodamFN\2026소득분석\2026소담김밥01월급여계산서.xlsx"
xl = pd.ExcelFile(EXCEL_PATH)

# Dump first employee sheet (김금순)
for sheet_name in ["김금순", "허윤희", "설주리"]:
    print(f"\n{'='*80}")
    print(f"Sheet: {sheet_name}")
    print(f"{'='*80}")
    df = xl.parse(sheet_name, header=None)
    for idx, row in df.iterrows():
        vals = []
        for col_idx, v in enumerate(row):
            if pd.notna(v):
                vals.append(f"C{col_idx}={repr(v)}")
        if vals:
            print(f"R{idx}: {', '.join(vals)}")
    print()
