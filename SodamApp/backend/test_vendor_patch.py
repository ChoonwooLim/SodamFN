import requests
import json

response = requests.get('http://localhost:8000/api/vendors?vendor_type=expense')
data = response.json()

vendors = data.get('data', [])
print(f'Found {len(vendors)} vendors\n')

if vendors:
    v = vendors[0]
    vid = v['id']
    print(f'Testing PATCH on vendor ID {vid} ({v["name"]})...')
    r = requests.patch(f'http://localhost:8000/api/vendors/{vid}', json={'category': '재료비'})
    print('PATCH Status:', r.status_code)
    print('Response:', r.text)
