import pandas as pd
import os

# Path to a sample payroll file
file_path = r"C:\WORK\SodamFN\2025실소득분석\2025소담김밥09월급여계산서.xlsx"

try:
    # Read the file to see sheet names
    xl = pd.ExcelFile(file_path)
    print(f"Sheet names: {xl.sheet_names}")

    # Read the first sheet to see columns and preview data
    df = pd.read_excel(file_path, sheet_name=0)
    print("\nColumns:")
    print(df.columns.tolist())
    
    print("\nFirst 5 rows:")
    print(df.head(5))

except Exception as e:
    print(f"Error reading excel: {e}")
