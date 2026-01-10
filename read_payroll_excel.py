import pandas as pd

file_path = r"c:\WORK\SodamFN\2025실소득분석\2025소담김밥07월급여계산서.xlsx"

try:
    file_path = r"c:\WORK\SodamFN\2025실소득분석\2025소담김밥12월급여계산서.xlsx"
    xl = pd.ExcelFile(file_path)
    sheet_name = '허윤희'
    if sheet_name in xl.sheet_names:
        print(f"--- Dec 2025 Sheet: {sheet_name} MAP ---")
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        
        for r in range(20):
            for c in range(df.shape[1]):
                val = df.iloc[r, c]
                if pd.notna(val) and str(val).strip() != "":
                    print(f"[{r}, {c}] {val}")
    else:
        print(f"Sheet {sheet_name} not found.")
except Exception as e:
    print(f"Error reading Excel: {e}")
