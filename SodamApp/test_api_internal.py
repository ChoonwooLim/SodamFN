import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
import json

def test_api_internal():
    from routers.hr import get_retirement_calculation_detail
    
    # Mocking dependencies
    class MockAuth:
        role = "superadmin"
        business_id = None
        
    res = get_retirement_calculation_detail(staff_id=4, _admin=MockAuth(), bid=None)
    
    # Just print the exact JSON dictionary
    print("--- API OUTPUT JSON ---")
    
    import copy
    output = copy.deepcopy(res)
    # Print the history array formatting
    for h in output["data"]["history"]:
        print(h)
        
    print(f"\nTotal exact_days_3m = {output['data']['breakdown']['exact_days_3m']}")
    print(f"Total legal_retirement = {output['data']['legal_retirement']}")

if __name__ == "__main__":
    test_api_internal()
