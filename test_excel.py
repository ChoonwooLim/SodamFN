
import pandas as pd
import os

files = [
    r'c:\\WORK\\SodamFN\\2026소득분석\\매출\\2월\\배달의민족_2026년 2월 정산명세서.xlsx',
    r'c:\\WORK\\SodamFN\\2026소득분석\\매출\\2월\\coupang_eats_2026-02.xlsx',
    r'c:\\WORK\\SodamFN\\2026소득분석\\매출\\2월\\땡겨요 정산내역(2월건별).xls',
    r'c:\\WORK\\SodamFN\\2026소득분석\\매출\\2월\\요기요_2026년_02월_정산내역_639-12-01514.xlsx'
]

for f in files:
    print('='*50)
    print(f'File: {os.path.basename(f)}')
    try:
        if f.endswith('.xls'):
            try:
                dfs = pd.read_html(f, encoding='utf-8')
                df = max(dfs, key=lambda x: x.size).head(10)
                print('Parsed as HTML')
            except Exception as e:
                df = pd.read_excel(f, engine='xlrd', header=None, nrows=10)
        else:
            df = pd.read_excel(f, header=None, nrows=10)
        print(df.to_string())
    except Exception as e:
        print(f'Error: {e}')

