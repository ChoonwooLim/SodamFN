# -*- coding: utf-8 -*-
"""
장인김밥(business_id=2) 2026 1~5월 종합 데모 데이터 생성 — 외부 평가용.
우상향 성장 + 건강한 마진. 매장+배달3채널 매출, 전 비용 카테고리, 8명 급여, 배달수수료.

clean regenerate: 기존 1~5월 DailyExpense/Payroll/DeliveryRevenue 삭제 후 재생성.
실행: python -X utf8 scripts/maintenance/seed_jangin_full_2026.py --apply
"""
import sys, io, os, random, json, calendar
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
import datetime
from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense, Payroll, DeliveryRevenue, MonthlyProfitLoss, Staff
from services.profit_loss_service import sync_all_expenses, sync_labor_cost, sync_revenue_to_pl

APPLY = "--apply" in sys.argv
BID = 2
random.seed(20260623)

# ── 월별 매출 목표 (store, delivery_total) — 우상향 ──
MONTHLY = {
    1: dict(store=26_000_000, deliv=15_500_000, ingredient=0.310, utility=800_000),
    2: dict(store=27_500_000, deliv=16_300_000, ingredient=0.306, utility=820_000),
    3: dict(store=29_500_000, deliv=17_700_000, ingredient=0.302, utility=850_000),
    4: dict(store=31_200_000, deliv=18_900_000, ingredient=0.298, utility=880_000),
    5: dict(store=33_500_000, deliv=20_300_000, ingredient=0.295, utility=900_000),
}
DELIV_SPLIT = {"배달의민족": 0.45, "쿠팡이츠": 0.35, "요기요": 0.20}
SUPPLY_RATIO = 0.025      # 소모품비 (매출 대비)
RENT = 3_500_000          # 임차료 고정
INSURANCE_BIZ = 250_000   # 보험료(사업용) 고정
TAX_RATIO = 0.010         # 세금과공과 (매출 대비)
CARD_FEE_RATIO = 0.013    # 카드수수료 (매장매출 대비) — P/L 직접 세팅
DELIV_FEE_RATIO = 0.280   # 배달앱수수료 (배달매출 대비)

# ── 급여체계 (소담김밥 방식: 주방장만 월급제, 나머지 시급제+주휴수당) ──
HEAD_ID = 18              # 박준혁 주방장 (월급제)
HEAD_MONTHLY = 2_400_000  # 주방장 월급 (주휴 포함)
WEEKS = 4.345             # 월 평균 주수 (주휴수당 환산)
# id: (시급, 1월 근무시간, 주휴 일소정시간, 4대보험가입) — 주 15h 미만은 주휴 자동 미지급
HOURLY_CFG = {
    22: (13_000, 152, 8.0, True),   # 김장인 점장 (~35h/주)
    23: (12_000, 132, 7.0, True),   # 이주방 주방실장 (~30h/주)
    24: (10_800, 96, 6.0, True),    # 박홀서 홀서빙 (~22h/주)
    19: (10_400, 72, 5.0, False),   # 이서연 홀서빙 (~16.6h/주)
    20: (10_400, 68, 5.0, False),   # 김태호 저녁서빙 (~15.6h/주)
    21: (10_200, 52, 4.0, False),   # 최민지 주방보조 (~12h/주 → 주휴 미달)
    25: (10_030, 40, 0.0, False),   # 최알바 알바 (~9h/주 → 주휴 미달)
}
HOUR_GROWTH = {1: 1.00, 2: 1.04, 3: 1.08, 4: 1.12, 5: 1.16}  # 성장에 따른 근무시간 증가


def calc_deductions(gross, ins4):
    """4대보험 가입자 ~10%, 미가입자 3.3%(사업소득 원천징수)."""
    if ins4:
        np_ = round(gross * 0.045); hi = round(gross * 0.0354)
        lti = round(hi * 0.1295); ei = round(gross * 0.009)
        it = round(gross * 0.013); lit = round(it * 0.1)
    else:
        np_ = hi = lti = ei = 0
        it = round(gross * 0.030); lit = round(it * 0.1)
    return np_, hi, lti, ei, it, lit


def daily_split(total, year, month):
    """월 목표를 일별로 분배 (주말 1.25배 + ±12% 랜덤). 합 = total."""
    days = calendar.monthrange(year, month)[1]
    weights = []
    for d in range(1, days + 1):
        wd = datetime.date(year, month, d).weekday()
        base = 1.25 if wd >= 5 else 1.0
        weights.append(base * random.uniform(0.88, 1.12))
    sw = sum(weights)
    vals = [round(total * w / sw / 1000) * 1000 for w in weights]
    vals[-1] += total - sum(vals)  # 반올림 보정
    return vals


def run():
    s = Session(engine)
    vmap = {v.name: v for v in s.exec(select(Vendor).where(Vendor.business_id == BID)).all()}

    def ensure_vendor(name, vtype, cat):
        v = vmap.get(name)
        if v:
            if v.category != cat or v.vendor_type != vtype:
                v.category = cat; v.vendor_type = vtype; s.add(v)
            return v
        v = Vendor(name=name, vendor_type=vtype, category=cat, business_id=BID)
        s.add(v); s.flush(); vmap[name] = v
        return v

    # 매출 거래처
    v_store = ensure_vendor("매장매출", "revenue", "store")
    v_deliv = {n: ensure_vendor(n, "revenue", "delivery") for n in DELIV_SPLIT}
    # 비용 거래처
    ing_vendors = [ensure_vendor(n, "expense", "원재료비") for n in
                   ["신선유통", "김밥천국재료", "장인식자재마트", "대한식재료", "대한음료"]]
    sup_vendors = [ensure_vendor(n, "expense", "소모품비") for n in ["그린세제", "제일포장", "신선농산"]]
    v_gas = ensure_vendor("세종도시가스", "expense", "수도광열비")
    v_elec = ensure_vendor("한국전력공사", "expense", "수도광열비")
    v_rent = ensure_vendor("미래부동산", "expense", "임차료")
    v_tax = ensure_vendor("강동세무서", "expense", "세금과공과")
    v_ins = ensure_vendor("DB손해보험", "expense", "보험료")
    s.commit()

    staffs = {st.id: st for st in s.exec(select(Staff).where(Staff.business_id == BID)).all()}

    print(f"=== 장인김밥(BID={BID}) 1~5월 {'적용' if APPLY else 'DRY-RUN'} ===\n")
    if not APPLY:
        for m, cfg in MONTHLY.items():
            tot = cfg['store'] + cfg['deliv']
            print(f"  {m}월 매출 {tot:,} (매장 {cfg['store']:,} 배달 {cfg['deliv']:,})  원재료 {cfg['ingredient']*100:.1f}%")
        print("\n*** --apply 로 적용 ***")
        s.close(); return

    # ── 0) 기존 1~5월 데이터 삭제 ──
    start = datetime.date(2026, 1, 1); end = datetime.date(2026, 5, 31)
    old_de = s.exec(select(DailyExpense).where(DailyExpense.business_id == BID,
              DailyExpense.date >= start, DailyExpense.date <= end)).all()
    for e in old_de: s.delete(e)
    for p in s.exec(select(Payroll).where(Payroll.business_id == BID,
              Payroll.month.in_([f"2026-{m:02d}" for m in range(1, 6)]))).all():
        s.delete(p)
    for dr in s.exec(select(DeliveryRevenue).where(DeliveryRevenue.business_id == BID,
              DeliveryRevenue.year == 2026, DeliveryRevenue.month <= 5)).all():
        s.delete(dr)
    s.commit()
    print(f"기존 삭제: DailyExpense {len(old_de)}건\n")

    # ── 직원 급여체계 설정: 주방장(id18) 월급제, 나머지 7명 시급제 ──
    head = staffs.get(HEAD_ID)
    if head:
        head.monthly_salary = HEAD_MONTHLY; head.hourly_wage = 13_500
        head.insurance_4major = True; head.tax_support_enabled = False
        s.add(head)
    for sid, (wage, _jh, _dh, ins4) in HOURLY_CFG.items():
        st = staffs.get(sid)
        if st:
            st.monthly_salary = 0; st.hourly_wage = wage; st.insurance_4major = ins4
            st.tax_support_enabled = False; s.add(st)
    s.commit()

    seen = set()  # (date, vendor_id, pm, source) 유니크 가드
    def add_de(date, vendor, amount, cat, pm, source="manual", note=None):
        if amount <= 0: return
        key = (date, vendor.id, pm, source)
        if key in seen: return
        seen.add(key)
        s.add(DailyExpense(business_id=BID, date=date, vendor_name=vendor.name,
              vendor_id=vendor.id, amount=int(amount), category=cat,
              payment_method=pm, note=note, source=source))

    for month, cfg in MONTHLY.items():
        days = calendar.monthrange(2026, month)[1]
        total_rev = cfg['store'] + cfg['deliv']

        # ── 매출: 매장 (일별, 현금 ~22% + 카드 ~78% 분리) ──
        for i, val in enumerate(daily_split(cfg['store'], 2026, month), start=1):
            d = datetime.date(2026, month, i)
            cash = round(val * random.uniform(0.18, 0.26) / 1000) * 1000
            card = val - cash
            add_de(d, v_store, cash, "store", "Cash", "auto_easypos")
            add_de(d, v_store, card, "store", "Card", "auto_easypos")
        # ── 매출: 배달 3채널 (일별) ──
        deliv_month = {}
        for ch, ratio in DELIV_SPLIT.items():
            ch_total = round(cfg['deliv'] * ratio / 1000) * 1000
            deliv_month[ch] = ch_total
            for i, val in enumerate(daily_split(ch_total, 2026, month), start=1):
                src = {"쿠팡이츠": "auto_coupang", "배달의민족": "auto_baemin"}.get(ch, "manual")
                add_de(datetime.date(2026, month, i), v_deliv[ch], val, "delivery", "Bank", src)

        # ── 비용: 원재료비 (격일, 거래처 로테이션) ──
        ing_total = round(total_rev * cfg['ingredient'])
        ing_days = [d for d in range(1, days + 1) if d % 2 == 1]  # 홀숫날
        per = ing_total // len(ing_days)
        acc = 0
        for j, d in enumerate(ing_days):
            amt = per + random.randint(-per // 4, per // 4)
            amt = round(amt / 100) * 100
            if j == len(ing_days) - 1:
                amt = ing_total - acc
            acc += amt
            add_de(datetime.date(2026, month, d), ing_vendors[j % len(ing_vendors)], amt, "원재료비", "이체")
        # ── 소모품비 (주 1회) ──
        sup_total = round(total_rev * SUPPLY_RATIO)
        sup_days = [3, 10, 17, 24]
        per_s = sup_total // len(sup_days); acc = 0
        for j, d in enumerate(sup_days):
            amt = per_s if j < len(sup_days) - 1 else sup_total - acc
            acc += amt
            add_de(datetime.date(2026, month, d), sup_vendors[j % len(sup_vendors)], amt, "소모품비", "이체")
        # ── 수도광열비 (가스+전기) ──
        add_de(datetime.date(2026, month, 25), v_gas, round(cfg['utility'] * 0.55), "수도광열비", "이체")
        add_de(datetime.date(2026, month, 25), v_elec, round(cfg['utility'] * 0.45), "수도광열비", "Card")
        # ── 임차료 (월초) ──
        add_de(datetime.date(2026, month, 5), v_rent, RENT, "임차료", "이체")
        # ── 세금과공과 ──
        add_de(datetime.date(2026, month, 10), v_tax, round(total_rev * TAX_RATIO), "세금과공과", "이체")
        # ── 보험료 ──
        add_de(datetime.date(2026, month, 15), v_ins, INSURANCE_BIZ, "보험료", "이체")

        # ── 배달수수료 → DeliveryRevenue (월별 채널) ──
        ch_codes = {"배달의민족": "Baemin", "쿠팡이츠": "Coupang", "요기요": "Yogiyo"}
        for ch, ch_total in deliv_month.items():
            fee = round(ch_total * DELIV_FEE_RATIO)
            orders = round(ch_total / 22000)  # 객단가 ~22,000
            breakdown = {
                "중개수수료": round(fee * 0.42), "결제정산수수료": round(fee * 0.10),
                "배달비": round(fee * 0.40), "광고비": round(fee * 0.08),
            }
            s.add(DeliveryRevenue(business_id=BID, channel=ch_codes[ch], year=2026, month=month,
                  total_sales=ch_total, total_fees=fee, settlement_amount=ch_total - fee,
                  order_count=orders, fee_breakdown=json.dumps(breakdown, ensure_ascii=False),
                  source="excel"))

        # ── 급여: 주방장(월급제) + 나머지(시급제 + 주휴수당) ──
        tt = datetime.datetime(2026, month, 25, 10, 0, 0)
        # 주방장 박준혁 — 월급제 (주휴 월급 포함)
        gross = HEAD_MONTHLY
        np_, hi, lti, ei, it, lit = calc_deductions(gross, True)
        ded = np_ + hi + lti + ei + it + lit
        s.add(Payroll(business_id=BID, staff_id=HEAD_ID, month=f"2026-{month:02d}",
              base_pay=gross, bonus_holiday=0, deductions=ded, total_pay=gross - ded,
              deduction_np=np_, deduction_hi=hi, deduction_lti=lti, deduction_ei=ei,
              deduction_it=it, deduction_lit=lit, transfer_status="완료", transferred_at=tt))
        # 시급제 — 기본급 = 시급 × 근무시간, 주휴수당 별도(주별 w1~w5)
        g = HOUR_GROWTH[month]
        for sid, (wage, jan_h, daily_h, ins4) in HOURLY_CFG.items():
            hours = round(jan_h * g)
            base = wage * hours
            # 주휴수당: 주 소정시간 ≥15h 자격 시 일소정시간 × 시급 (주별)
            weekly_hours = hours / WEEKS
            wk_hol = round(daily_h * wage) if (daily_h > 0 and weekly_hours >= 15) else 0
            n_weeks = 4 if calendar.monthrange(2026, month)[1] <= 30 else 5
            w_list = [wk_hol] * n_weeks + [0] * (6 - n_weeks)
            bonus_hol = round(wk_hol * WEEKS) if wk_hol else 0
            if wk_hol:  # w 합 = bonus_hol 보정
                w_list[n_weeks - 1] += bonus_hol - wk_hol * n_weeks
            gross = base + bonus_hol
            np_, hi, lti, ei, it, lit = calc_deductions(gross, ins4)
            ded = np_ + hi + lti + ei + it + lit
            s.add(Payroll(business_id=BID, staff_id=sid, month=f"2026-{month:02d}",
                  base_pay=base, bonus_holiday=bonus_hol, deductions=ded, total_pay=gross - ded,
                  holiday_w1=w_list[0], holiday_w2=w_list[1], holiday_w3=w_list[2],
                  holiday_w4=w_list[3], holiday_w5=w_list[4], holiday_w6=w_list[5],
                  deduction_np=np_, deduction_hi=hi, deduction_lti=lti, deduction_ei=ei,
                  deduction_it=it, deduction_lit=lit, transfer_status="완료", transferred_at=tt))

    s.commit()
    print("데이터 생성 완료. P/L 재집계 + 카드수수료 세팅...\n")

    # ── syncs + card_fee ──
    for month, cfg in MONTHLY.items():
        sync_revenue_to_pl(2026, month, s, BID)
        sync_all_expenses(2026, month, s, BID)
        sync_labor_cost(2026, month, s, BID)
    s.commit()
    for month, cfg in MONTHLY.items():
        pl = s.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == 2026,
              MonthlyProfitLoss.month == month, MonthlyProfitLoss.business_id == BID)).first()
        if pl:
            pl.expense_card_fee = round(cfg['store'] * 0.78 * CARD_FEE_RATIO)  # 카드 결제분에만
            s.add(pl)
    s.commit()

    # ── 검증 출력 ──
    print(f"{'월':>3} {'매출':>12} {'비용':>12} {'영업이익':>11} {'마진':>6}")
    EXP_FIELDS = ['expense_labor','expense_retirement','expense_insurance','expense_insurance_employee',
        'expense_tax_employee','expense_ingredient','expense_material','expense_utility','expense_rent',
        'expense_rent_fee','expense_repair','expense_depreciation','expense_tax','expense_card_fee',
        'expense_delivery_fee','expense_other']
    for month in MONTHLY:
        pl = s.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.year == 2026,
              MonthlyProfitLoss.month == month, MonthlyProfitLoss.business_id == BID)).first()
        rev = (pl.revenue_store or 0)+(pl.revenue_coupang or 0)+(pl.revenue_baemin or 0)+(pl.revenue_yogiyo or 0)
        exp = sum(getattr(pl, f, 0) or 0 for f in EXP_FIELDS if hasattr(pl, f))
        profit = rev - exp; margin = profit/rev*100 if rev else 0
        print(f"{month:>3} {rev:>12,} {exp:>12,} {profit:>11,} {margin:>5.1f}%")
    s.close()

run()
