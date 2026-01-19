
import pandas as pd
import sys

file_path = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx"

try:
    xl = pd.ExcelFile(file_path)
    print(f"Sheet names: {xl.sheet_names}")
    for sheet in xl.sheet_names:
        print(f"\n--- Sheet: {sheet} ---")
        df = pd.read_excel(file_path, sheet_name=sheet, nrows=5)
        print("Columns:", df.columns.tolist())
        print("First 2 rows:")
        print(df.head(2).to_string())
except Exception as e:
    print(f"Error reading excel: {e}")
