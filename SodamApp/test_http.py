import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
import requests

def run_test():
    res = requests.post("http://localhost:8000/api/auth/login", json={
        "email": "admin@semhana.com",
        "password": "password"
    })
    token = res.json().get("access_token")

    if not token:
        print("Failed to login", res.json())
        return

    calc_res = requests.get("http://localhost:8000/api/hr/retirement/calc/4", headers={
        "Authorization": f"Bearer {token}"
    })
    print(calc_res.text[:800])

if __name__ == "__main__":
    run_test()
