# -*- coding: utf-8 -*-
"""
매입관리(DailyExpense) 1~6월 데이터 정합성 진단 — READ ONLY.
- source별 분포
- 카테고리별 분포 (매입관리 페이지 필터와 동일하게 카드대금/card_payment 제외)
- 교차 source 중복 후보 (같은 date+vendor+amount 인데 row 2개 이상)
- 같은 date+amount 인데 vendor_id 만 다른 유사 중복
"""
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
start = date(2026, 1, 1)
end = date(2026, 6, 30)

rows = s.exec(select(DailyExpense).where(
    DailyExpense.date >= start, DailyExpense.date <= end
).order_by(DailyExpense.date)).all()

# expense vendor ids
vendors = s.exec(select(Vendor)).all()
vmap = {v.id: v for v in vendors}
expense_vendor_ids = set(v.id for v in vendors if v.vendor_type == "expense")

def is_purchase(e):
    if e.category in EXCLUDED:
        return False
    if e.vendor_id and e.vendor_id not in expense_vendor_ids:
        return False
    return True

print(f"=== 전체 DailyExpense 1~6월: {len(rows)}건 ===\n")

# source 분포 (전체)
by_source = defaultdict(lambda: [0, 0])
for e in rows:
    by_source[e.source][0] += 1
    by_source[e.source][1] += e.amount
print("[source별 분포 — 전체]")
for src, (c, amt) in sorted(by_source.items(), key=lambda x: -x[1][1]):
    print(f"  {src:20s} {c:5d}건  {amt:>14,}원")

# 매입관리 페이지 기준 필터
purchases = [e for e in rows if is_purchase(e)]
print(f"\n=== 매입관리 페이지 표시 대상: {len(purchases)}건 ===")

# 월별
by_month = defaultdict(lambda: [0, 0])
for e in purchases:
    k = f"{e.date.year}-{e.date.month:02d}"
    by_month[k][0] += 1
    by_month[k][1] += e.amount
print("\n[월별 매입 합계]")
for k in sorted(by_month):
    c, amt = by_month[k]
    print(f"  {k}  {c:5d}건  {amt:>14,}원")

# source별 (매입 대상만)
by_source2 = defaultdict(lambda: [0, 0])
for e in purchases:
    by_source2[e.source][0] += 1
    by_source2[e.source][1] += e.amount
print("\n[source별 — 매입 대상만]")
for src, (c, amt) in sorted(by_source2.items(), key=lambda x: -x[1][1]):
    print(f"  {src:20s} {c:5d}건  {amt:>14,}원")

# ── 교차 중복 후보: 같은 (date, vendor_name, amount) 인데 row 2+ ──
groups = defaultdict(list)
for e in purchases:
    groups[(e.date, e.vendor_name, e.amount)].append(e)
dups = {k: v for k, v in groups.items() if len(v) > 1}
dup_extra_count = sum(len(v) - 1 for v in dups.values())
dup_extra_amt = sum((len(v) - 1) * k[2] for k, v in dups.items())
print(f"\n=== [중복후보 A] 같은 날짜+거래처명+금액 2건 이상: {len(dups)}그룹, 초과 {dup_extra_count}건 / {dup_extra_amt:,}원 ===")
for k, v in sorted(dups.items(), key=lambda x: -(len(x[1])-1)*x[0][2])[:40]:
    srcs = ",".join(sorted(set(e.source for e in v)))
    ids = ",".join(str(e.id) for e in v)
    print(f"  {k[0]} {k[1][:22]:22s} {k[2]:>12,}원 x{len(v)}  src=[{srcs}]  ids=[{ids}]")

# ── 중복 후보 B: 같은 (date, amount) 인데 vendor_id 다른 (vendor 미연결 vs 연결) ──
groups2 = defaultdict(list)
for e in purchases:
    groups2[(e.date, e.amount)].append(e)
cross_vendor = {}
for k, v in groups2.items():
    if len(v) > 1:
        names = set((e.vendor_name or '').strip() for e in v)
        vids = set(e.vendor_id for e in v)
        # 거래처명은 다르지만 같은 날 같은 금액 — 의심
        if len(v) > 1 and (len(vids) > 1):
            cross_vendor[k] = v
print(f"\n=== [중복후보 B] 같은 날짜+금액, vendor_id 상이: {len(cross_vendor)}그룹 (수동확인 필요) ===")
shown = 0
for k, v in sorted(cross_vendor.items(), key=lambda x: -x[0][1]):
    if shown >= 30:
        break
    # 거래처명이 동일하거나 매우 유사한 경우만 출력 (명백한 우연 제외)
    names = [(e.vendor_name or '') for e in v]
    detail = " | ".join(f"{e.vendor_name[:16]}(id{e.id},vid{e.vendor_id},{e.source})" for e in v)
    print(f"  {k[0]} {k[1]:>12,}원  {detail}")
    shown += 1

s.close()
