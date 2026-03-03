"""Test: Parse Samsung card Excel and verify"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\WORK\SodamFN\SodamApp\backend')
from services.purchase_parser import parse_samsung, classify_category

filepath = r'C:\WORK\SodamFN\2026소득분석\매입\2월\삼성카드이용내역_202602.xlsx'
try:
    records = parse_samsung(filepath)
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

    # All records
    print(f"\n=== ALL RECORDS ===")
    print(f"{'Date':<14} {'Vendor':<35} {'Amount':>12} {'Category':<14} {'ApprNo':<12} {'Cancelled'}")
    print("-" * 105)
    for r in records:
        print(f"{str(r['date']):<14} {r['vendor_name']:<35} {r['amount']:>12,} {r['category']:<14} {r.get('approval_no',''):<12} {r.get('is_cancelled','')}")

    # 기타경비
    print(f"\n=== 기타경비 (UNCLASSIFIED) ===")
    for r in records:
        if r['category'] == '기타경비':
            print(f"  {r['date']} | {r['vendor_name']:<35} | {r['amount']:>10,}")

    # Unique vendors
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
