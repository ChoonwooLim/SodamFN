import requests

with open(r'C:\WORK\SodamFN\2026소득분석\매입\202601현대카드이용내역.xls', 'rb') as f:
    files = {'file': ('202601현대카드이용내역.xls', f, 'application/vnd.ms-excel')}
    response = requests.post('http://localhost:8000/api/upload/excel/expense', files=files)
    print('Status:', response.status_code)
    print('Response:', response.text[:800])
