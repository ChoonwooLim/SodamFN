import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
import requests

def run_test():
    # Login as admin to get a token
    res = requests.post("http://localhost:8000/api/auth/token", data={
        "username": "admin",
        "password": "password"  # The standard password in SodamApp
    })
    if res.status_code != 200:
        print("Login failed:", res.text)
        return
            
    token = res.json()["access_token"]
    
    # calc_res = requests.get("http://localhost:8000/api/hr/retirement/calc/4", headers={
    calc_res = requests.get("http://localhost:8000/api/hr/staff?status=all", headers={
        "Authorization": f"Bearer {token}"
    })
    
    print("\nStatus:", calc_res.status_code)
    try:
        print("Response:", len(calc_res.json().get('data', [])))
    except:
        print("Response text:", calc_res.text)

if __name__ == "__main__":
    run_test()
