import pandas as pd

file_path = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx"

xl = pd.ExcelFile(file_path)
print(f"=== Sheet names: {xl.sheet_names} ===\n")

# Analyze each sheet
for sheet in xl.sheet_names:
    print(f"\n{'='*60}")
    print(f"Sheet: {sheet}")
    print('='*60)
    df = pd.read_excel(file_path, sheet_name=sheet, header=None)
    print(f"Shape: {df.shape}")
    print(f"\nFirst 15 rows:")
    print(df.head(15).to_string())
    print("\n")
