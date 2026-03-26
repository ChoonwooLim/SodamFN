import sys
import os
import json

sys.path.append(r'c:\WORK\SodamFN\SodamApp\backend')
from services.excel_service import ExcelService

files = [
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\배달의민족_2026년 2월 정산명세서.xlsx',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\coupang_eats_2026-02.xlsx',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\땡겨요 정산내역(2월건별).xls',
    r'c:\WORK\SodamFN\2026소득분석\매출\2월\요기요_2026년_02월_정산내역_639-12-01514.xlsx'
]

svc = ExcelService('dummy_path')

with open('test_results.txt', 'w', encoding='utf-8') as f_out:
    for f in files:
        f_out.write('==================================================\n')
        f_out.write(f'File: {os.path.basename(f)}\n')
        with open(f, 'rb') as fp:
            content = fp.read()
            
        try:
            res = svc.parse_revenue_upload(content)
            f_out.write(f'Status: {res.get("status")}\n')
            if res.get('message'):
                f_out.write(f'Message: {res.get("message")}\n')
            if 'summary' in res:
                f_out.write('Summary: ' + json.dumps(res['summary'], ensure_ascii=False) + '\n')
            if 'data' in res:
                f_out.write(f'Data count: {len(res["data"])}\n')
                f_out.write(f'Data [0]: {res["data"][0]}\n')
        except Exception as e:
            import traceback
            f_out.write(f'EXCEPTION: {traceback.format_exc()}\n')
