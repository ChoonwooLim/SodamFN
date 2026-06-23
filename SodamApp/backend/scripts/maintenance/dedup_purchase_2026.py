# -*- coding: utf-8 -*-
"""
매입(DailyExpense) 교차-source 중복 정리 — 2026-01 ~ 2026-06.

중복 정의: 같은 (business_id, date, vendor_name, amount) 인데 row 2개 이상.
  - 관측상 전부 (auto_bank + manual) 조합 = 같은 은행거래가 2개 경로로 적재된 것.
keeper 선택 규칙 (우선순위):
  1) vendor_id 가 연결된 row (데이터 품질 우수)
  2) source == 'auto_bank'
  3) 가장 낮은 id (먼저 생성된 원본)
나머지는 삭제 대상. 삭제 대상을 linked_daily_id 로 참조하는 BankTransaction 은 링크 해제.

기본 DRY-RUN. 실제 삭제는  --apply  플래그.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
from datetime import date
from collections import defaultdict
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor, BankTransaction

APPLY = "--apply" in sys.argv
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
    groups[(e.business_id, e.date, e.vendor_name, e.amount)].append(e)

def keeper_sort_key(e):
    # 작을수록 keeper. (vendor_id 없으면 1), (auto_bank 아니면 1), id
    return (0 if e.vendor_id else 1, 0 if e.source == "auto_bank" else 1, e.id)

to_delete = []
affected_months = set()
for k, v in groups.items():
    if len(v) < 2:
        continue
    v_sorted = sorted(v, key=keeper_sort_key)
    keeper = v_sorted[0]
    for e in v_sorted[1:]:
        to_delete.append((e, keeper))
        affected_months.add((e.date.year, e.date.month))

del_ids = [e.id for e, _ in to_delete]
del_amt = sum(e.amount for e, _ in to_delete)

print(f"=== 삭제 대상: {len(to_delete)}건 / {del_amt:,}원 ===")
print(f"영향 월: {sorted(affected_months)}")

# 월별 before/after
before = defaultdict(int); after = defaultdict(int)
del_id_set = set(del_ids)
for e in purchases:
    mk = f"{e.date.year}-{e.date.month:02d}"
    before[mk] += e.amount
    if e.id not in del_id_set:
        after[mk] += e.amount
print("\n[월별 매입합계 변화]")
for mk in sorted(before):
    print(f"  {mk}  {before[mk]:>14,}  →  {after[mk]:>14,}   (-{before[mk]-after[mk]:,})")

# source별 삭제 분포
src_del = defaultdict(lambda:[0,0])
for e,_ in to_delete:
    src_del[e.source][0]+=1; src_del[e.source][1]+=e.amount
print("\n[삭제 대상 source 분포]")
for src,(c,a) in src_del.items():
    print(f"  {src:12s} {c:4d}건  {a:,}원")

# 삭제 대상 전체 id 목록 (검증용)
print(f"\n[삭제 대상 id 전체 {len(del_ids)}개]")
print(",".join(str(i) for i in sorted(del_ids)))

# BankTransaction 링크 해제 대상
linked_txs = s.exec(select(BankTransaction).where(BankTransaction.linked_daily_id.in_(del_ids))).all() if del_ids else []
print(f"\n[linked_daily_id 해제 대상 BankTransaction: {len(linked_txs)}건]")

if not APPLY:
    print("\n*** DRY-RUN — 실제 삭제 안 함. 적용하려면 --apply ***")
    s.close()
    sys.exit(0)

# ── APPLY ──
for tx in linked_txs:
    tx.linked_daily_id = None
    s.add(tx)
for e, _ in to_delete:
    s.delete(e)
s.commit()
print(f"\n*** 삭제 완료: {len(to_delete)}건. P/L 재집계 시작... ***")

from services.profit_loss_service import sync_all_expenses
bids = set(e.business_id for e,_ in to_delete)
for bid in bids:
    for (y, m) in sorted(affected_months):
        try:
            sync_all_expenses(y, m, s, bid)
        except Exception as ex:
            print(f"  sync err {bid} {y}-{m}: {ex}")
s.commit()
print("*** P/L 재집계 완료 ***")
s.close()
