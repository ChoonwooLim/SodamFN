import requests
import os

files_to_test = [
    r'C:\WORK\SodamFN\2026소득분석\매입\202601롯데카드이용내역.xls',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601삼성카드이용내역.xlsx',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601현대카드이용내역.xls',
]

for filepath in files_to_test:
    name = os.path.basename(filepath)
    with open(filepath, 'rb') as f:
        files = {'file': (name, f, 'application/vnd.ms-excel')}
        response = requests.post('http://localhost:8000/api/upload/excel/expense', files=files)
        result = response.json()
        if response.status_code == 200:
            print(f'{name}: SUCCESS - {result.get("count", 0)} records')
        else:
            detail = result.get("detail", "Unknown error")
            print(f'{name}: FAILED - {str(detail)[:100]}')
