import pandas as pd

file_path = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx"

# Analyze 7월비용 sheet in detail
print("=== 7월비용 Sheet ===")
df = pd.read_excel(file_path, sheet_name='7월비용', header=None)
print(f"Shape: {df.shape}")
print("\nFirst 30 rows (all columns):")
pd.set_option('display.max_columns', None)
pd.set_option('display.width', None)
print(df.head(30).to_string())

print("\n\n=== 종합 Sheet ===")
df2 = pd.read_excel(file_path, sheet_name='종합', header=None)
print(f"Shape: {df2.shape}")
print("\nFirst 20 rows:")
print(df2.head(20).to_string())
