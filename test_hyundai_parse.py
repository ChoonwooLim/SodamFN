"""
Focused test: just total records, categories, and problem areas
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\WORK\SodamFN\SodamApp\backend')
from services.purchase_parser import parse_hyundai, classify_category

filepath = r'C:\WORK\SodamFN\2026소득분석\매입\2월\hyundaicard_20260303.xls'
records = parse_hyundai(filepath)

print(f"TOTAL RECORDS: {len(records)}")

# Category summary
cat_data = {}
for r in records:
    cat = r['category']
    if cat not in cat_data:
        cat_data[cat] = {'count': 0, 'total': 0}
    cat_data[cat]['count'] += 1
    cat_data[cat]['total'] += r['amount']

print("\n=== CATEGORY SUMMARY ===")
for cat, d in sorted(cat_data.items(), key=lambda x: -x[1]['total']):
    print(f"  {cat}: {d['count']}건, {d['total']:,}원")

# 기타경비 details
print("\n=== 기타경비 (UNCLASSIFIED) DETAILS ===")
for r in records:
    if r['category'] == '기타경비':
        print(f"  {r['date']} | {r['vendor_name']:<35} | {r['amount']:>10,} | bizType={r.get('business_type','')}")

# 소모품비 details - check if 쇼핑/유통 is over-matching
print("\n=== 소모품비 DETAILS (check 쇼핑/유통 match) ===")
for r in records:
    if r['category'] == '소모품비':
        print(f"  {r['date']} | {r['vendor_name']:<35} | {r['amount']:>10,} | bizType={r.get('business_type','')}")

# Vendor unique list
print("\n=== UNIQUE VENDORS ===")
unique = {}
for r in records:
    v = r['vendor_name']
    if v not in unique:
        unique[v] = {'count': 0, 'total': 0, 'cat': r['category']}
    unique[v]['count'] += 1
    unique[v]['total'] += r['amount']

for v, d in sorted(unique.items(), key=lambda x: -x[1]['total']):
    print(f"  {v:<35} {d['count']:>3}건 {d['total']:>12,}원 -> {d['cat']}")

# Check: vendors with 쇼핑/유통 bizType that got 소모품비 but should be 원재료비
print("\n=== POTENTIAL MISCLASSIFICATION (쇼핑/유통 -> 소모품비 but maybe should be 원재료비) ===")
food_keywords = ['식품', '마트', '유통', '푸드', '농산', '수산', '축산']
for r in records:
    if r['category'] == '소모품비':
        vendor = r['vendor_name']
        if any(fk in vendor for fk in food_keywords):
            print(f"  ⚠️ {r['date']} | {vendor:<35} | {r['amount']:>10,} -> 소모품비 (should be 원재료비?)")
