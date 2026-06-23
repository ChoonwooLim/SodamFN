# -*- coding: utf-8 -*-
"""
손익계산서 지출 오분류 정정 — 2026 1~6월.
1) 4대보험(국민연금·건강보험·고용보험·산재보험) 공단 납부 → category '4대보험납부' (P/L·비용 제외)
   - 인건비 섹션 4대보험료(사업주/직원)에 이미 반영 → 이중계상 제거
2) 김지연 → '개인가계부' (사장님 확인: 개인 지출)
3) P/L 1~6월 재집계 (sync_all_expenses)
기본 DRY-RUN. 적용은 --apply.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
from datetime import date
from collections import defaultdict
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor, MonthlyProfitLoss
from services.profit_loss_service import FOUR_INSURANCE_KEYWORDS, FOUR_INSURANCE_CATEGORY, sync_all_expenses

APPLY = "--apply" in sys.argv
BID = 1
s = Session(engine)
rev_vids = set(v.id for v in s.exec(select(Vendor).where(Vendor.vendor_type=="revenue")).all())
vmap = {v.id: v for v in s.exec(select(Vendor)).all()}

rows = s.exec(select(DailyExpense).where(
    DailyExpense.date >= date(2026,1,1), DailyExpense.date <= date(2026,6,30),
    DailyExpense.business_id == BID
)).all()

# 1) 4대보험
four = [e for e in rows if e.vendor_id not in rev_vids and any(k in (e.vendor_name or '') for k in FOUR_INSURANCE_KEYWORDS)]
# 2) 김지연
kim = [e for e in rows if (e.vendor_name or '').strip() == '김지연' and e.vendor_id not in rev_vids]

print(f"=== 4대보험 → '{FOUR_INSURANCE_CATEGORY}': {len(four)}건 / {sum(e.amount for e in four):,}원 ===")
bym = defaultdict(int)
for e in four: bym[e.date.month]+=e.amount
for m in sorted(bym): print(f"   {m}월: {bym[m]:,}")

print(f"\n=== 김지연 → '개인가계부': {len(kim)}건 / {sum(e.amount for e in kim):,}원 ===")
for e in kim: print(f"   {e.date} {e.amount:,} (현재 {e.category})")

# 영향 거래처 (vendor category 동기화 대상)
four_vids = set(e.vendor_id for e in four if e.vendor_id)
kim_vids = set(e.vendor_id for e in kim if e.vendor_id)

if not APPLY:
    print("\n*** DRY-RUN — --apply 로 적용 ***")
    s.close(); sys.exit(0)

for e in four:
    e.category = FOUR_INSURANCE_CATEGORY; s.add(e)
for vid in four_vids:
    v = vmap.get(vid)
    if v: v.category = FOUR_INSURANCE_CATEGORY; s.add(v)
for e in kim:
    e.category = "개인가계부"; s.add(e)
for vid in kim_vids:
    v = vmap.get(vid)
    if v: v.category = "개인가계부"; s.add(v)
s.commit()
print(f"\n*** 재분류 완료. P/L 1~6월 재집계... ***")
for m in range(1,7):
    sync_all_expenses(2026, m, s, BID)
s.commit()

# 결과 출력
print("\n[정정 후 P/L 지출 (DailyExpense 기반 필드)]")
for m in range(1,7):
    pl = s.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.year==2026, MonthlyProfitLoss.month==m, MonthlyProfitLoss.business_id==BID)).first()
    if pl:
        print(f"  {m}월: 세금과공과 {pl.expense_tax:>10,}  기타경비 {pl.expense_other:>10,}")
s.close()
