"""직원급여/개인출금/세금/임대료/4대보험 세분류 + 인건비 보완 회귀 테스트."""
import datetime
from sqlmodel import select

from models import (
    BankTransaction, Business, Staff, Payroll, MonthlyProfitLoss,
)
from routers.bank_sync import _classify_one_tx, _build_staff_name_set


def _tx(out=0, in_=0, remark1=None, remark2=None, bid=1):
    return BankTransaction(
        business_id=bid, account_id=10,
        trans_date=datetime.date(2026, 5, 25),
        in_amount=in_, out_amount=out,
        remark1=remark1, remark2=remark2,
        tid=f"t-{remark1}-{out}-{in_}",
    )


# ---------- 직원급여 (출금 + 등록된 직원 이름 매칭) ----------

def test_outbound_to_registered_staff_name_is_labor(session):
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="이소윤", role="직원", hourly_wage=0, start_date=datetime.date(2026,1,1)))
    session.commit()
    staff_names = _build_staff_name_set(session, 1)
    tx = _tx(out=510_580, remark1="이소윤", remark2="광장동")
    result = _classify_one_tx(tx, {}, {}, staff_names=staff_names)
    assert result == "labor"


def test_outbound_to_account_holder_name_is_labor(session):
    """remark1 이 계좌주명(account_holder)과 일치해도 급여로 본다."""
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="정수미", role="주방", hourly_wage=0, start_date=datetime.date(2026,1,1),
                      account_holder="정수미"))
    session.commit()
    staff_names = _build_staff_name_set(session, 1)
    tx = _tx(out=1_801_910, remark1="정수미")
    result = _classify_one_tx(tx, {}, {}, staff_names=staff_names)
    assert result == "labor"


def test_inbound_from_staff_name_is_not_labor(session):
    """입금은 급여가 아니다 (직원이 사장님께 송금 등)."""
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="이소윤", role="직원", hourly_wage=0, start_date=datetime.date(2026,1,1)))
    session.commit()
    staff_names = _build_staff_name_set(session, 1)
    tx = _tx(in_=100_000, remark1="이소윤")
    result = _classify_one_tx(tx, {}, {}, staff_names=staff_names)
    assert result != "labor"


def test_unregistered_name_falls_through_to_expense(session):
    """등록 안 된 이름 출금은 급여 아님 → 기본 expense."""
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="이소윤", role="직원", hourly_wage=0, start_date=datetime.date(2026,1,1)))
    session.commit()
    staff_names = _build_staff_name_set(session, 1)
    tx = _tx(out=50_000, remark1="홍길동상회")
    result = _classify_one_tx(tx, {}, {}, staff_names=staff_names)
    assert result == "expense"


# ---------- 세금/공과금, 임대료, 4대보험 (키워드) ----------

def test_tax_keyword_is_tax_payment(session):
    session.add(Business(id=1, name="X")); session.commit()
    tx = _tx(out=120_000, remark1="강남구청", remark2="지방소득세")
    result = _classify_one_tx(tx, {}, {}, staff_names=set())
    assert result == "tax_payment"


def test_insurance_keyword_is_insurance_payment(session):
    session.add(Business(id=1, name="X")); session.commit()
    tx = _tx(out=391_950, remark1="국민건강보험공단")
    result = _classify_one_tx(tx, {}, {}, staff_names=set())
    assert result == "insurance_payment"


def test_rent_keyword_is_rent(session):
    session.add(Business(id=1, name="X")); session.commit()
    tx = _tx(out=2_000_000, remark1="건물주", remark2="월세")
    result = _classify_one_tx(tx, {}, {}, staff_names=set())
    assert result == "rent"


def test_learned_pattern_beats_keyword_heuristic(session):
    """수동 분류 학습이 세금/임대료 키워드 휴리스틱보다 우선 (반복 덮어쓰기 방지)."""
    session.add(Business(id=1, name="X")); session.commit()
    # 사장님이 'KT임대료센터' 출금을 수동으로 expense 로 분류 → 학습됨.
    learned = {"KT임대료센터": "expense"}
    tx = _tx(out=80_000, remark1="KT임대료센터")  # '임대료' 키워드 포함
    result = _classify_one_tx(tx, {}, learned, staff_names=set())
    assert result == "expense"  # rent 가 아니라 학습값


def test_management_fee_not_rent(session):
    """'관리비' 단독은 임대료로 오분류하지 않는다 (인터넷/차량 관리비 등)."""
    session.add(Business(id=1, name="X")); session.commit()
    tx = _tx(out=33_000, remark1="KT인터넷관리비")
    result = _classify_one_tx(tx, {}, {}, staff_names=set())
    assert result == "expense"  # rent 아님 → 기본 expense


def test_staff_name_takes_priority_over_expense_default(session):
    """직원이름 매칭이 벤더 미매칭 기본 expense 보다 우선."""
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="김순복", role="직원", hourly_wage=0, start_date=datetime.date(2026,1,1)))
    session.commit()
    staff_names = _build_staff_name_set(session, 1)
    tx = _tx(out=2_333_790, remark1="김순복", remark2="광장동")
    assert _classify_one_tx(tx, {}, {}, staff_names=staff_names) == "labor"


# ---------- 인건비 보완 (Payroll 없는 달만) ----------

def test_labor_fallback_when_no_payroll(session):
    """Payroll 없는 달은 은행 labor 출금 합계로 인건비 보완."""
    from services.profit_loss_service import sync_labor_cost
    session.add(Business(id=1, name="X"))
    # 5월 Payroll 없음. labor 분류 출금 2건.
    session.add(_tx(out=510_580, remark1="이소윤"))
    t2 = _tx(out=1_801_910, remark1="정수미")
    session.add(t2)
    for t in session.exec(select(BankTransaction)).all():
        t.classified_as = "labor"
        t.classified_by = "manual"
    session.commit()

    total = sync_labor_cost(2026, 5, session, business_id=1)
    assert total == 510_580 + 1_801_910
    pl = session.exec(select(MonthlyProfitLoss).where(
        MonthlyProfitLoss.business_id == 1)).first()
    assert pl.expense_labor == 510_580 + 1_801_910


def test_payroll_takes_priority_no_double_count(session):
    """Payroll 있으면 Payroll 우선 — 은행 labor 출금은 무시 (이중계상 방지)."""
    from services.profit_loss_service import sync_labor_cost
    session.add(Business(id=1, name="X"))
    session.add(Staff(id=1, business_id=1, name="이소윤", role="직원", hourly_wage=0, start_date=datetime.date(2026,1,1)))
    session.add(Payroll(
        business_id=1, staff_id=1, month="2026-05",
        base_pay=3_000_000, transfer_status="완료",
    ))
    # 은행 labor 출금도 존재
    t = _tx(out=510_580, remark1="이소윤")
    t.classified_as = "labor"; t.classified_by = "manual"
    session.add(t)
    session.commit()

    total = sync_labor_cost(2026, 5, session, business_id=1)
    # Payroll 기반(3,000,000)만 — 은행 출금 510,580 더해지지 않음
    assert total == 3_000_000


def test_no_payroll_no_bank_labor_preserves_manual(session):
    """Payroll·은행 labor 둘 다 없으면 수동 입력 인건비를 0 으로 덮지 않는다."""
    from services.profit_loss_service import sync_labor_cost
    session.add(Business(id=1, name="X"))
    session.add(MonthlyProfitLoss(year=2026, month=5, business_id=1,
                                  expense_labor=1_500_000))
    session.commit()

    total = sync_labor_cost(2026, 5, session, business_id=1)
    assert total == 1_500_000
    pl = session.exec(select(MonthlyProfitLoss).where(
        MonthlyProfitLoss.business_id == 1)).first()
    assert pl.expense_labor == 1_500_000
