"""Test upload with classifications."""
import requests, json

login_resp = requests.post("http://localhost:8000/api/auth/login", data={"username": "admin", "password": "admin1234"})
token = login_resp.json().get("access_token")

bank_file = r"C:\WORK\SodamFN\2026소득분석\매출\2월\신한은행_2월입금내역.xls"
headers = {"Authorization": f"Bearer {token}"}

# Step 1: Upload without classifications -> should return requires_classification
with open(bank_file, "rb") as f:
    files = {"file": ("신한은행_2월입금내역.xls", f, "application/vnd.ms-excel")}
    resp1 = requests.post("http://localhost:8000/api/upload/excel/revenue", files=files, headers=headers)

print(f"Step 1 status: {resp1.status_code}")
body1 = resp1.json()
print(f"Step 1 response status: {body1.get('status')}")
print(f"Step 1 items count: {len(body1.get('items', []))}")

# Step 2: Re-upload with classifications
if body1.get('status') == 'requires_classification':
    mappings = []
    for item in body1['items']:
        mappings.append({"memo": item['memo'], "category": "현금매출"})  # Just classify all as cash for testing
    
    with open(bank_file, "rb") as f:
        files = {"file": ("신한은행_2월입금내역.xls", f, "application/vnd.ms-excel")}
        data = {"classifications": json.dumps(mappings)}
        resp2 = requests.post("http://localhost:8000/api/upload/excel/revenue", files=files, data=data, headers=headers)
    
    print(f"\nStep 2 status: {resp2.status_code}")
    body2 = resp2.json()
    print(f"Step 2 response: {json.dumps(body2, indent=2, ensure_ascii=False)[:2000]}")
