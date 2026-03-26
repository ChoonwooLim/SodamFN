import pandas as pd
import os

files = [
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\배달의민족_2026년 2월 정산명세서.xlsx',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\coupang_eats_2026-02.xlsx',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\땡겨요 정산내역(2월건별).xls',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\요기요_2026년_02월_정산내역_639-12-01514.xlsx'
]

for f in files:
    print('==================================================')
    print('File:', os.path.basename(f))
    try:
        # For baemin, handle sheets
        if '배달의민족' in f:
            xls = pd.ExcelFile(f)
            print('Sheets:', xls.sheet_names)
            if '상세' in xls.sheet_names:
                df = pd.read_excel(f, sheet_name='상세', header=None, nrows=15)
            else:
                df = pd.read_excel(f, header=None, nrows=15)
        elif f.endswith('.xls'):
            try:
                dfs = pd.read_html(f, encoding='utf-8')
                df = max(dfs, key=lambda x: x.size).head(15)
                print('Parsed as HTML')
            except Exception as e:
                df = pd.read_excel(f, engine='xlrd', header=None, nrows=15)
        else:
            df = pd.read_excel(f, header=None, nrows=15)
        
        # print non-null columns only for easier reading
        df = df.dropna(how='all', axis=1)
        print(df.to_string())
    except Exception as e:
        print(f'Error: {e}')
