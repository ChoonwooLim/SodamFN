# -*- coding: utf-8 -*-
"""중복 그룹 상세 — note/upload_id/payment_method/source_meta/category 확인. READ ONLY."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
from datetime import date
from collections import defaultdict
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor

EXCLUDED = ("카드대금", "card_payment")
s = Session(engine)
rows = s.exec(select(DailyExpense).where(
    DailyExpense.date >= date(2026,1,1), DailyExpense.date <= date(2026,6,30)
)).all()
vendors = s.exec(select(Vendor)).all()
expense_vendor_ids = set(v.id for v in vendors if v.vendor_type == "expense")

def is_purchase(e):
    if e.category in EXCLUDED: return False
    if e.vendor_id and e.vendor_id not in expense_vendor_ids: return False
    return True

purchases = [e for e in rows if is_purchase(e)]
groups = defaultdict(list)
for e in purchases:
    groups[(e.date, e.vendor_name, e.amount)].append(e)
dups = {k: v for k, v in groups.items() if len(v) > 1}

# 중복 그룹의 두 source 조합 통계
combo = defaultdict(int)
for k, v in dups.items():
    srcs = tuple(sorted(set(e.source for e in v)))
    combo[srcs] += 1
print("[중복 그룹의 source 조합 분포]")
for c, n in sorted(combo.items(), key=lambda x:-x[1]):
    print(f"  {c}: {n}그룹")

# 중복 그룹 카테고리 분포 (초과분 기준)
cat_excess = defaultdict(lambda:[0,0])
for k, v in dups.items():
    extra = len(v)-1
    cat = v[0].category or '기타'
    cat_excess[cat][0]+=extra
    cat_excess[cat][1]+=extra*k[2]
print("\n[중복 초과분 카테고리 분포]")
for cat,(c,amt) in sorted(cat_excess.items(), key=lambda x:-x[1][1]):
    print(f"  {cat:16s} {c:4d}건  {amt:>13,}원")

# 대표 5개 그룹 full detail
print("\n[대표 그룹 상세]")
shown=0
for k, v in sorted(dups.items(), key=lambda x:-(len(x[1])-1)*x[0][2]):
    if shown>=6: break
    print(f"\n● {k[0]} | {k[1]} | {k[2]:,}원 x{len(v)}")
    for e in v:
        print(f"   id={e.id} src={e.source} vid={e.vendor_id} pm={e.payment_method} cat={e.category} upload={e.upload_id}")
        print(f"      note={e.note!r}")
        print(f"      meta={e.source_meta!r}")
    shown+=1
s.close()
