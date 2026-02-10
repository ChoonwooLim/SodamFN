"""Test purchase parser - output to file"""
import sys
sys.path.insert(0, 'SodamApp/backend')
from services.purchase_parser import parse_purchase_file
import os

FOLDER = r"C:\WORK\SodamFN\2026소득분석\매입"
OUT = r"C:\WORK\SodamFN\parser_test_output.txt"

with open(OUT, 'w', encoding='utf-8') as f:
    grand_total = 0
    grand_count = 0
    for fname in sorted(os.listdir(FOLDER)):
        fpath = os.path.join(FOLDER, fname)
        f.write(f"\n{'='*70}\n")
        f.write(f"FILE: {fname}\n")
        try:
            records = parse_purchase_file(fpath, fname)
            f.write(f"PARSED: {len(records)} records\n")
            grand_count += len(records)
            cats = {}
            total = 0
            for r in records:
                cats[r['category']] = cats.get(r['category'], 0) + r['amount']
                total += r['amount']
            grand_total += total
            f.write(f"TOTAL: {total:,}원\n")
            f.write(f"CATEGORY BREAKDOWN:\n")
            for cat, amt in sorted(cats.items(), key=lambda x: -x[1]):
                f.write(f"  {cat:12s}: {amt:>12,}원 ({amt*100//total if total else 0}%)\n")
        except Exception as e:
            f.write(f"ERROR: {e}\n")
            import traceback
            traceback.print_exc(file=f)
    
    f.write(f"\n{'='*70}\n")
    f.write(f"GRAND TOTAL: {grand_count} records, {grand_total:,}원\n")

print(f"Done. Output: {OUT}")
