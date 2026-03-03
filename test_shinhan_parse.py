"""Test: Parse Shinhan card Excel and verify"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\WORK\SodamFN\SodamApp\backend')
from services.purchase_parser import parse_shinhan_card

filepath = r'C:\WORK\SodamFN\2026소득분석\매입\2월\Shinhancard_202602.xls'
try:
    records = parse_shinhan_card(filepath)
    print(f"TOTAL RECORDS: {len(records)}")

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

    print(f"\n=== ALL RECORDS ===")
    for r in records:
        print(f"  {str(r['date']):<14} {r['vendor_name']:<35} {r['amount']:>12,} {r['category']:<14} biz={r.get('business_type','')} cancelled={r.get('is_cancelled','')}")

    print(f"\n=== 기타경비 ===")
    for r in records:
        if r['category'] == '기타경비':
            print(f"  {r['date']} | {r['vendor_name']:<35} | {r['amount']:>10,}")

    print(f"\n=== UNIQUE VENDORS ===")
    unique = {}
    for r in records:
        v = r['vendor_name']
        if v not in unique:
            unique[v] = {'count': 0, 'total': 0, 'cat': r['category']}
        unique[v]['count'] += 1
        unique[v]['total'] += r['amount']
    for v, d in sorted(unique.items(), key=lambda x: -x[1]['total']):
        print(f"  {v:<35} {d['count']:>3}건 {d['total']:>12,}원 -> {d['cat']}")

except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
