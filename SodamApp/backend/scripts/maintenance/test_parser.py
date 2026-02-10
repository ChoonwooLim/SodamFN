"""테스트: 신한은행 파서 변경사항 확인"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from services.purchase_parser import parse_purchase_file

filepath = r"C:\WORK\SodamFN\2026소득분석\매입\202601신한은행_송금내역.xls"
records = parse_purchase_file(filepath)

print(f"\n파싱 결과: {len(records)}건")
print(f"\n{'거래처':30s} {'금액':>12s}  카테고리")
print("-" * 65)
for r in records:
    print(f"  {r['vendor_name']:30s} {r['amount']:>12,}  {r['category']}")

# 카테고리별 집계
cats = {}
for r in records:
    cats[r['category']] = cats.get(r['category'], 0) + 1
print(f"\n카테고리별:")
for c, n in sorted(cats.items(), key=lambda x: -x[1]):
    print(f"  {c}: {n}건")
