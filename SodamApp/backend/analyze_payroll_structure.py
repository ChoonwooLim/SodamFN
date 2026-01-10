import pandas as pd

file_path = r"C:\WORK\SodamFN\2025실소득분석\2025소담김밥09월급여계산서.xlsx"

try:
    df = pd.read_excel(file_path, sheet_name='김금순', header=None)
    
    print("--- Cell Mapping for '김금순' ---")
    for r in range(15):
        row_vals = []
        for c in range(15):
            try:
                val = df.iloc[r, c]
                if pd.notna(val):
                    row_vals.append(f"({r},{c}): {val}")
            except:
                pass
        if row_vals:
            print(f"Row {r}: {', '.join(row_vals)}")

except Exception as e:
    print(e)
