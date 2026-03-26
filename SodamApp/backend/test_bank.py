import sys
import os
import json

sys.path.append(r'c:\WORK\SodamFN\SodamApp\backend')
from services.excel_service import ExcelService

f = r'C:\WORK\SodamFN\2026소득분석\매출\2월\신한은행_2월입금내역.xls'
svc = ExcelService('dummy_path')

with open(f, 'rb') as fp:
    content = fp.read()
    
try:
    res = svc.parse_revenue_upload(content)
    print(f'Status: {res.get("status")}')
    if res.get('message'): print(f'Message: {res.get("message")}')
    if 'summary' in res: print('Summary:', json.dumps(res['summary'], ensure_ascii=False))
except Exception as e:
    import traceback
    print(f'EXCEPTION: {traceback.format_exc()}')
