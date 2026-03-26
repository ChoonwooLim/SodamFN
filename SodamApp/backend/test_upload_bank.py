"""Full upload test after schema fix."""
import requests, json

login_resp = requests.post("http://localhost:8000/api/auth/login", data={"username": "admin", "password": "admin1234"})
token = login_resp.json().get("access_token")

bank_file = r"C:\WORK\SodamFN\2026소득분석\매출\2월\신한은행_2월입금내역.xls"

headers = {"Authorization": f"Bearer {token}"}
with open(bank_file, "rb") as f:
    files = {"file": ("신한은행_2월입금내역.xls", f, "application/vnd.ms-excel")}
    resp = requests.post("http://localhost:8000/api/upload/excel/revenue", files=files, headers=headers)

print(f"Status: {resp.status_code}")
try:
    body = resp.json()
    print(json.dumps(body, indent=2, ensure_ascii=False)[:5000])
except:
    print(resp.text[:5000])
