import pandas as pd
import sys
import os

# Set encoding to utf-8
sys.stdout.reconfigure(encoding='utf-8')

file_path = '소담김밥손익계산서(9~12).xlsx'

try:
    xl = pd.ExcelFile(file_path)
    
    # Focus on '종합'
    sheet = '종합'
    print(f"--- Analyzing Sheet: {sheet} ---")
    df = xl.parse(sheet, header=None)
    
    # Export first 50 rows to text for manual inspection
    with open('comprehensive_preview.txt', 'w', encoding='utf-8') as f:
        f.write(df.head(50).to_string())
    
    print("Exported first 50 rows to comprehensive_preview.txt")

    # Try to find key rows
    for index, row in df.iterrows():
        row_str = " ".join([str(x) for x in row if pd.notna(x)])
        if "매출" in row_str or "비용" in row_str or "이익" in row_str:
            print(f"Row {index}: {row_str}")

except Exception as e:
    print(f"Error: {e}")
