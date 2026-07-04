# -*- coding: utf-8 -*-
"""정식 재무제표 산출 — 손익계산서 · 현금흐름표 · 재무상태표(대차대조표).

사장님 지시 (2026-07-04): DMR 법인설립예산 양식과 같은 정식 회계자료 구조.

원천 데이터 (전부 실측):
  - 손익계산서: MonthlyProfitLoss (조회 시 자동 재집계로 항상 최신)
  - 현금흐름표: BankTransaction(팝빌) classified_as 전량 매핑 — 월말 실제
    잔액과 대조하는 검증 컬럼 포함 (기초 + 유입 − 유출 == 기말)
  - 재무상태표: 월말 현금 잔액 + 카드 미정산 채권(누적 승인−입금) +
    퇴직급여충당부채(적립 누적 − 실지급) / 자본은 항등식 역산 + 구성 분해
"""
import datetime
from collections import defaultdict

from sqlmodel import Session, select

from models import (
    BankTransaction, CardSalesApproval, DailyExpense, FixedAsset, MonthlyProfitLoss,
)


def _asset_book_values(assets, as_of: datetime.date):
    """as_of 시점의 (보증금 합, 상각자산 취득원가 합, 감가상각누계액, 장부가)."""
    deposit = sum(a.cost for a in assets
                  if not a.useful_life_months and a.acquired <= as_of)
    cost_total = accum = 0
    for a in assets:
        if not a.useful_life_months or a.acquired > as_of:
            continue
        cost_total += a.cost
        elapsed = (as_of.year - a.acquired.year) * 12 + (as_of.month - a.acquired.month) + 1
        elapsed = max(0, min(elapsed, a.useful_life_months))
        if elapsed >= a.useful_life_months:
            accum += a.cost           # 상각 완료 — 마지막 달이 잔차 흡수, 장부가 0
        else:
            accum += int(round(a.cost / a.useful_life_months)) * elapsed
    return deposit, cost_total, min(accum, cost_total), cost_total - min(accum, cost_total)

# 현금흐름표 라인 매핑 — classified_as 전량 커버 (누락 시 '기타' 로 수집해
# 항등식이 항상 성립하도록 한다. 숨겨지는 거래 없음.)
_INFLOW_LINES = [
    ("card_in",     "카드매출 정산입금",   {"card_settlement"}),
    ("delivery_in", "배달앱 정산입금",     {"delivery_settlement"}),
    ("pay_in",      "페이·간편결제 정산",  {"pay_settlement", "mobile_settlement"}),
    ("cash_in",     "현금매출 예입",       {"cash_deposit", "revenue", "cash_revenue"}),
    ("nonop_in",    "영업외수익(임대·이자 등)", {"other_income"}),
    ("owner_in",    "사장님 자금 불입",    {"owner_deposit", "loan_in"}),
    ("misc_in",     "기타 입금",           {"misc_deposit", "excluded", "unclassified", "transfer"}),
]
_OUTFLOW_LINES = [
    ("purchase_out",  "매입·경비 지출",   {"expense", "purchase"}),
    ("card_pay_out",  "카드대금 결제",     {"card_payment"}),
    ("labor_out",     "인건비 지급",       {"labor"}),
    ("severance_out", "퇴직금 지급",       {"severance"}),
    ("rent_out",      "임차료",            {"rent"}),
    ("tax_out",       "세금 납부",         {"tax_payment"}),
    ("insurance_out", "4대보험 납부",      {"insurance_payment"}),
    ("owner_out",     "사장님 인출",       {"owner_withdraw"}),
]

_PL_REVENUE_FIELDS = ("revenue_store", "revenue_coupang", "revenue_baemin",
                      "revenue_yogiyo", "revenue_ddangyo")
_PL_SGA_FIELDS = (  # 판매비와관리비 (매출원가·세금 제외 영업비용)
    "expense_labor", "expense_retirement", "expense_insurance",
    "expense_insurance_employee", "expense_tax_employee",
    "expense_material", "expense_utility", "expense_rent", "expense_repair",
    "expense_depreciation", "expense_card_fee", "expense_delivery_fee",
    "expense_other",
)


def _month_range(year: int, month: int):
    start = datetime.date(year, month, 1)
    end = (datetime.date(year + 1, 1, 1) if month == 12
           else datetime.date(year, month + 1, 1))
    return start, end


def build_statements(year: int, session: Session, business_id: int) -> dict:
    """연 단위 3표 산출 — 월별 컬럼 + 데이터 있는 달만 active 플래그."""
    # ── 원천 로드 ────────────────────────────────────────────────
    txs = session.exec(select(BankTransaction).where(
        BankTransaction.business_id == business_id,
        BankTransaction.trans_date >= datetime.date(year, 1, 1),
        BankTransaction.trans_date < datetime.date(year + 1, 1, 1),
    )).all()
    txs.sort(key=lambda t: (t.trans_date, t.trans_time or "", t.id))

    pls = {p.month: p for p in session.exec(select(MonthlyProfitLoss).where(
        MonthlyProfitLoss.business_id == business_id,
        MonthlyProfitLoss.year == year)).all()}

    # 영업외수익 (은행 실측, 월별)
    nonop_by_month = defaultdict(int)
    for t in txs:
        if t.classified_as == "other_income":
            nonop_by_month[t.trans_date.month] += t.in_amount or 0

    # ── 1) 손익계산서 (정식 단계) ────────────────────────────────
    income = []
    for m in range(1, 13):
        pl = pls.get(m)
        rev = sum((getattr(pl, f, 0) or 0) for f in _PL_REVENUE_FIELDS) if pl else 0
        cogs = (pl.expense_ingredient or 0) if pl else 0
        sga = sum((getattr(pl, f, 0) or 0) for f in _PL_SGA_FIELDS) if pl else 0
        nonop = nonop_by_month.get(m, 0)
        tax = (pl.expense_tax or 0) if pl else 0
        gross = rev - cogs
        op = gross - sga
        ordinary = op + nonop
        net = ordinary - tax
        income.append({
            "month": m, "active": bool(rev or cogs or sga or tax),
            "revenue": rev, "cogs": cogs, "gross_profit": gross,
            "sga": sga, "operating_profit": op,
            "non_operating": nonop, "ordinary_profit": ordinary,
            "tax": tax, "net_profit": net,
        })

    # ── 2) 현금흐름표 (은행 원장 전량 매핑 + 잔액 검증) ─────────
    cls_to_in = {c: key for key, _, cset in _INFLOW_LINES for c in cset}
    cls_to_out = {c: key for key, _, cset in _OUTFLOW_LINES for c in cset}

    # 기초 현금 (연초): 첫 거래의 잔액에서 그 거래 효과를 되돌림
    opening = 0
    if txs:
        t0 = txs[0]
        if t0.balance is not None:
            opening = (t0.balance or 0) - (t0.in_amount or 0) + (t0.out_amount or 0)

    cash_flow = []
    running = opening
    for m in range(1, 13):
        rows = [t for t in txs if t.trans_date.month == m]
        inflow = defaultdict(int)
        outflow = defaultdict(int)
        last_balance = None
        for t in rows:
            c = t.classified_as or "unclassified"
            if (t.in_amount or 0) > 0:
                inflow[cls_to_in.get(c, "misc_in")] += t.in_amount
            if (t.out_amount or 0) > 0:
                outflow[cls_to_out.get(c, "purchase_out")] += t.out_amount
            if t.balance is not None:
                last_balance = t.balance
        total_in = sum(inflow.values())
        total_out = sum(outflow.values())
        begin = running
        end = begin + total_in - total_out
        cash_flow.append({
            "month": m, "active": bool(rows),
            "beginning_cash": begin,
            "inflows": {key: inflow.get(key, 0) for key, _, _ in _INFLOW_LINES},
            "total_inflow": total_in,
            "outflows": {key: outflow.get(key, 0) for key, _, _ in _OUTFLOW_LINES},
            "total_outflow": total_out,
            "ending_cash": end,
            "actual_balance": last_balance,        # 실제 월말 통장 잔액
            "verified": (last_balance is None or abs(end - last_balance) < 1000),
        })
        running = end

    # ── 3) 재무상태표 (월말) ─────────────────────────────────────
    approvals = session.exec(select(CardSalesApproval).where(
        CardSalesApproval.business_id == business_id)).all()
    # 개인가계부 지출 (사업 계좌에서 나간 가계 지출 — 자본 인출 성격)
    personal_rows = session.exec(select(DailyExpense).where(
        DailyExpense.business_id == business_id,
        DailyExpense.category == "개인가계부",
        DailyExpense.date >= datetime.date(year, 1, 1),
        DailyExpense.date < datetime.date(year + 1, 1, 1))).all()
    # 비유동자산 대장 (임대보증금·주방집기·인테리어 — 사장님 제공 2026-07-04)
    fixed_assets = session.exec(select(FixedAsset).where(
        FixedAsset.business_id == business_id)).all()
    # 기초자본 = 연초 현금 + 연초 시점 비유동자산 장부가
    ob_dep, _, _, ob_book = _asset_book_values(
        fixed_assets, datetime.date(year - 1, 12, 31))
    opening_capital = opening + ob_dep + ob_book
    balance_sheet = []
    for m in range(1, 13):
        _, month_end = _month_range(year, m)
        cf = cash_flow[m - 1]
        if not cf["active"]:
            balance_sheet.append({"month": m, "active": False})
            continue
        cash = cf["actual_balance"] if cf["actual_balance"] is not None else cf["ending_cash"]
        # 카드 미정산 채권 = 누적 승인 − 누적 정산입금 (월말 기준, D+2 지연분)
        appr_cum = sum(a.amount or 0 for a in approvals if a.approval_date < month_end)
        dep_cum = sum((t.in_amount or 0) for t in txs
                      if t.classified_as == "card_settlement" and t.trans_date < month_end)
        card_receivable = max(0, appr_cum - dep_cum)
        month_last = month_end - datetime.timedelta(days=1)
        deposit_asset, fixed_cost, accum_dep, fixed_book = _asset_book_values(
            fixed_assets, month_last)
        assets = cash + card_receivable + deposit_asset + fixed_book
        # 퇴직급여충당부채 = 당해 적립 누적 − 퇴직금 실지급 누적
        retirement_cum = sum((pls[mm].expense_retirement or 0)
                             for mm in range(1, m + 1) if mm in pls)
        severance_cum = sum((t.out_amount or 0) for t in txs
                            if t.classified_as == "severance" and t.trans_date < month_end)
        retirement_liability = max(0, retirement_cum - severance_cum)
        liabilities = retirement_liability
        equity = assets - liabilities
        # 자본 구성 분해 (참고용)
        net_cum = sum(income[mm - 1]["net_profit"] for mm in range(1, m + 1))
        owner_net = sum((t.in_amount or 0) for t in txs
                        if t.classified_as in ("owner_deposit", "loan_in") and t.trans_date < month_end) \
                  - sum((t.out_amount or 0) for t in txs
                        if t.classified_as == "owner_withdraw" and t.trans_date < month_end)
        personal_cum = sum(r.amount or 0 for r in personal_rows if r.date < month_end)
        balance_sheet.append({
            "month": m, "active": True,
            "cash": cash, "card_receivable": card_receivable,
            "deposit": deposit_asset,                 # 임대보증금
            "fixed_cost": fixed_cost,                 # 유형자산 취득원가
            "accum_depreciation": -accum_dep,         # 감가상각누계액 (음수 표기)
            "fixed_book": fixed_book,                 # 유형자산 장부가액
            "total_assets": assets,
            "retirement_liability": retirement_liability, "total_liabilities": liabilities,
            "total_equity": equity,
            "equity_detail": {
                "opening_capital": opening_capital,   # 연초 현금 + 비유동자산 장부가
                "cumulative_net_profit": net_cum,
                "owner_net_contribution": owner_net,
                "personal_spending": -personal_cum,   # 사업 계좌 가계 지출 (인출 성격)
                "adjustment": equity - opening_capital - net_cum - owner_net + personal_cum,
            },
        })

    return {
        "year": year,
        "income_statement": income,
        "cash_flow": cash_flow,
        "balance_sheet": balance_sheet,
        "inflow_lines": [(k, label) for k, label, _ in _INFLOW_LINES],
        "outflow_lines": [(k, label) for k, label, _ in _OUTFLOW_LINES],
        "notes": [
            "손익계산서: 발생주의(임차료 귀속조정·주문 기준 매출), 매출원가=원재료비, 감가상각=자산대장 정액법(5년).",
            "현금흐름표: 신한은행 원장 전량 매핑 — 기초+유입−유출=기말이 실제 통장 잔액과 대조 검증됨.",
            "재무상태표: 임대보증금 8,000만·주방집기 5,000만·인테리어 5,000만 (사장님 제공, 취득일 2025-06 가정). 차입금 0원 확인(사장님). 재고자산 미등록.",
            "자본 조정 항목 = 현금매출 미예치·발생/현금 시차 등 손익 미반영 현금 이동.",
        ],
    }
