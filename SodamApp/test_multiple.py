import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
import requests

def run_test():
    res = requests.post("http://localhost:8000/api/auth/token", data={
        "username": "admin",
        "password": "password"
    })
    token = res.json().get("access_token")
    if not token:
        res = requests.post("http://localhost:8000/api/auth/token", data={
            "username": "superadmin",
            "password": "password"
        })
        token = res.json().get("access_token")

    # Fetch staff list
    staff_res = requests.get("http://localhost:8000/api/hr/staff?status=all", headers={
        "Authorization": f"Bearer {token}"
    })
    staff_list = staff_res.json().get("data", [])
    print(f"Loaded {len(staff_list)} staff members.")
    
    for s in staff_list[:5]: # Test first 5
        print(f"Testing staff {s['id']} - {s['name']}")
        calc_res = requests.get(f"http://localhost:8000/api/hr/retirement/calc/{s['id']}", headers={
            "Authorization": f"Bearer {token}"
        })
        print(f"  Status: {calc_res.status_code}")
        if calc_res.status_code != 200:
            print(f"  Error: {calc_res.text}")

if __name__ == "__main__":
    run_test()
