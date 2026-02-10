import requests
import os

files_to_test = [
    r'C:\WORK\SodamFN\2026소득분석\매입\202601롯데카드이용내역.xls',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601삼성카드이용내역.xlsx',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601신한은행_송금내역.xls',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601신한카드이용내역.xls',
    r'C:\WORK\SodamFN\2026소득분석\매입\202601현대카드이용내역.xls',
]

print("===== Excel Upload Complete Test =====\n")
total_success = 0
total_records = 0

for filepath in files_to_test:
    name = os.path.basename(filepath)
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (name, f, 'application/vnd.ms-excel')}
            response = requests.post('http://localhost:8000/api/upload/excel/expense', files=files)
            result = response.json()
            if response.status_code == 200 and result.get("status") == "success":
                count = result.get("count", 0)
                total_success += 1
                total_records += count
                print(f"✅ {name}: SUCCESS - {count} records")
            else:
                detail = result.get("detail", result.get("message", "Unknown error"))
                print(f"❌ {name}: FAILED - {str(detail)[:80]}")
    except Exception as e:
        print(f"❌ {name}: EXCEPTION - {str(e)[:80]}")

print(f"\n===== Summary =====")
print(f"Total files: {len(files_to_test)}")
print(f"Successful: {total_success}")
print(f"Total records inserted: {total_records}")
