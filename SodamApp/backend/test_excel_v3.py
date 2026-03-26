import pandas as pd
import os

files = [
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\coupang_eats_2026-02.xlsx',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\땡겨요 정산내역(2월건별).xls',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\요기요_2026년_02월_정산내역_639-12-01514.xlsx'
]

with open('output_detail.txt', 'w', encoding='utf-8') as f_out:
    for f in files:
        f_out.write('='*50 + '\n')
        f_out.write(f'File: {os.path.basename(f)}\n')
        if f.endswith('.xlsx') or f.endswith('.xls'):
            try:
                xls = pd.ExcelFile(f)
                f_out.write(f'Sheets: {xls.sheet_names}\n')
                for sheet in xls.sheet_names:
                    df = pd.read_excel(f, sheet_name=sheet, header=None, nrows=10)
                    df = df.dropna(how='all', axis=1)
                    f_out.write(f'Sheet [{sheet}] Head:\n{df.to_string()}\n\n')
            except Exception as e:
                pass
                
        if f.endswith('.xls'):
            try:
                dfs = pd.read_html(f, encoding='utf-8')
                f_out.write(f'Found {len(dfs)} HTML tables\n')
                for i, df in enumerate(dfs):
                    df = df.dropna(how='all', axis=1)
                    f_out.write(f'Table {i} Head:\n{df.head(10).to_string()}\n\n')
            except Exception as e:
                f_out.write(f'Error HTML: {e}\n')
