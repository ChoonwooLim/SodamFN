# -*- coding: utf-8 -*-
"""손익계산서 지출 항목 정합성 진단 — 2026 1~6월. READ ONLY.
각 P/L 지출 필드를 소스(DailyExpense/Payroll/DeliveryRevenue)에서 재계산해
저장값과 대조하고, DailyExpense 기반 항목은 거래처별 기여를 출력해 오분류를 찾는다.
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
import datetime
from collections import defaultdict
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor, MonthlyProfitLoss, Payroll, DeliveryRevenue
from services.profit_loss_service import CATEGORY_TO_PL_FIELD, _accrual_year_month

s = Session(engine)
BID = None
# business id 자동 — 첫 P/L 레코드 기준
anypl = s.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.year==2026)).first()
BID = anypl.business_id if anypl else None
print(f"business_id={BID}\n")

rev_vids = set(v.id for v in s.exec(select(Vendor).where(Vendor.vendor_type=="revenue")).all())
vendors = {v.id: v for v in s.exec(select(Vendor)).all()}

FIELD_LABEL = {
    "expense_ingredient":"원재료비","expense_material":"소모품비","expense_utility":"수도광열비",
    "expense_rent":"임차료","expense_repair":"수선비","expense_depreciation":"감가상각비",
    "expense_tax":"세금과공과","expense_insurance":"보험료/4대(사업주)","expense_card_fee":"카드수수료",
    "expense_delivery_fee":"배달앱수수료","expense_other":"기타경비","expense_labor":"인건비",
    "expense_retirement":"퇴직금적립","expense_insurance_employee":"4대(직원)","expense_tax_employee":"원천세(직원)",
}

for month in range(1,7):
    print("="*70)
    print(f"### 2026-{month:02d}")
    pl = s.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.year==2026, MonthlyProfitLoss.month==month, MonthlyProfitLoss.business_id==BID)).first()

    # --- DailyExpense 기반 재계산 (sync_all_expenses 로직 복제, 발생주의 포함) ---
    start = datetime.date(2026, month, 1)
    end = datetime.date(2026, month+1, 1) if month<12 else datetime.date(2027,1,1)
    look_end = end + datetime.timedelta(days=4)
    exps = s.exec(select(DailyExpense).where(DailyExpense.date>=start, DailyExpense.date<look_end, DailyExpense.business_id==BID)).all()
    exps = [e for e in exps if e.vendor_id not in rev_vids]
    field_contrib = defaultdict(lambda: defaultdict(int))  # field -> vendor_name -> amount
    field_total = defaultdict(int)
    for e in exps:
        cat = None
        v = vendors.get(e.vendor_id)
        if v and v.category:
            cat = v.category   # 거래처 카테고리 우선
        elif e.category:
            cat = e.category
        if not cat:
            continue
        ay, am = _accrual_year_month(e.date, cat)
        if (ay, am) != (2026, month):
            continue
        f = CATEGORY_TO_PL_FIELD.get(cat)
        if f:
            field_contrib[f][e.vendor_name] += e.amount
            field_total[f] += e.amount

    # --- Payroll ---
    mstr = f"2026-{month:02d}"
    pays = s.exec(select(Payroll).where(Payroll.month==mstr, Payroll.business_id==BID)).all()
    pays_done = [p for p in pays if p.transfer_status=="완료"]

    # --- Delivery ---
    drs = s.exec(select(DeliveryRevenue).where(DeliveryRevenue.year==2026, DeliveryRevenue.month==month, DeliveryRevenue.business_id==BID)).all()
    dr_active = [d for d in drs if (d.total_sales or 0)>0]
    dfee = sum(d.total_fees or 0 for d in dr_active)
    dsales = sum(d.total_sales or 0 for d in dr_active)

    # 출력: sync_all_expenses 관할 필드 (보험/배달/카드/인건 제외)
    EXCL = {'expense_labor','expense_retirement','expense_insurance','expense_insurance_employee','expense_tax_employee','expense_delivery_fee','expense_card_fee'}
    print("  [DailyExpense 집계 vs 저장값]")
    allfields = sorted(set(list(field_total.keys()) + (list(FIELD_LABEL.keys()) if pl else [])))
    for f in ['expense_ingredient','expense_material','expense_utility','expense_rent','expense_repair','expense_tax','expense_other']:
        recalc = field_total.get(f,0)
        stored = getattr(pl, f, None) if pl else None
        flag = '' if (stored==recalc) else '  <<< 불일치'
        print(f"   {FIELD_LABEL.get(f,f):14s} 재계산 {recalc:>12,}  저장 {stored if stored is not None else '-':>12}{flag}")
        # 상위 기여 거래처
        top = sorted(field_contrib[f].items(), key=lambda x:-x[1])[:6]
        for vn, amt in top:
            print(f"        - {vn[:26]:26s} {amt:>11,}")
    # 별도 소스 필드
    print("  [별도 소스]")
    print(f"   인건비(Payroll 완료 {len(pays_done)}/{len(pays)}명)  저장 {getattr(pl,'expense_labor',0) if pl else '-':>10}")
    print(f"   보험료(DailyExpense '보험료')  재계산 {field_total.get('expense_insurance',0):>10,}  ← sync_all 제외됨/저장은 4대(사업주)")
    print(f"   배달앱수수료  저장 {getattr(pl,'expense_delivery_fee',0) if pl else '-':>10}  (DeliveryRevenue 수수료 {dfee:,} / 매출 {dsales:,} = {dfee/dsales*100 if dsales else 0:.1f}%)")
    print(f"   카드수수료  저장 {getattr(pl,'expense_card_fee',0) if pl else '-':>10}")
    print()

s.close()
