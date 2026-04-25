"""Aggregator: Payroll 12개월 → YearEndReport 스냅샷."""
from datetime import date


def _make_staff(session, business_id, name="A", contract_type="아르바이트"):
    """Helper: insert a Staff with the minimum NOT NULL fields."""
    from models import Staff
    s = Staff(
        name=name, role="직원", hourly_wage=10_000,
        start_date=date(2025, 1, 1),
        contract_type=contract_type, business_id=business_id,
    )
    session.add(s)
    session.commit()
    return s


def _make_payroll(session, staff_id, business_id, month, base_pay, bonus_meal=0,
                  it=0, lit=0, np=0, hi=0, lti=0, ei=0):
    """Helper: insert one Payroll row."""
    from models import Payroll
    p = Payroll(
        staff_id=staff_id, business_id=business_id, month=month,
        base_pay=base_pay, bonus_meal=bonus_meal,
        deduction_it=it, deduction_lit=lit,
        deduction_np=np, deduction_hi=hi, deduction_lti=lti, deduction_ei=ei,
        total_pay=base_pay + bonus_meal - (it + lit + np + hi + lti + ei),
    )
    session.add(p)
    return p


def test_aggregate_year_sums_12_months(session):
    from models import Business, Staff
    from services.yearend.aggregator import aggregate_year

    biz = Business(name="테스트", business_type="음식점")
    session.add(biz); session.commit()
    staff = _make_staff(session, biz.id, name="홍길동")

    for m in range(1, 13):
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=2_800_000, bonus_meal=200_000,
                      it=50_000, lit=5_000,
                      np=126_000, hi=99_000, lti=13_000, ei=22_400)
    session.commit()

    snap = aggregate_year(business_id=biz.id, staff_id=staff.id, year=2025, session=session)

    assert snap["total_pay_year"] == (2_800_000 + 200_000) * 12
    assert snap["nontaxable_pay"] == 200_000 * 12
    assert snap["taxable_pay"] == 2_800_000 * 12
    assert snap["taxes_withheld_total"] == (50_000 + 5_000) * 12
    assert snap["insurance_4major_total"] == (126_000 + 99_000 + 13_000 + 22_400) * 12
    assert snap["months_with_data"] == 12


def test_aggregate_year_handles_missing_months(session):
    """8월·9월 누락 → 합산은 진행, months_with_data=10."""
    from models import Business
    from services.yearend.aggregator import aggregate_year

    biz = Business(name="X", business_type="음식점"); session.add(biz); session.commit()
    staff = _make_staff(session, biz.id, name="A")
    for m in [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]:
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=1_000_000, it=10_000, lit=1_000)
    session.commit()

    snap = aggregate_year(business_id=biz.id, staff_id=staff.id, year=2025, session=session)
    assert snap["months_with_data"] == 10
    assert snap["total_pay_year"] == 1_000_000 * 10


def test_refresh_snapshot_creates_or_updates_report(session):
    from models import Business
    from services.yearend.aggregator import refresh_snapshot

    biz = Business(name="X", business_type="음식점"); session.add(biz); session.commit()
    staff = _make_staff(session, biz.id, name="A", contract_type="정규직")
    for m in range(1, 13):
        _make_payroll(session, staff.id, biz.id, f"2025-{m:02d}",
                      base_pay=2_000_000, it=20_000, lit=2_000)
    session.commit()

    report = refresh_snapshot(business_id=biz.id, staff_id=staff.id, year=2025, session=session)
    session.commit()

    assert report.total_pay_year == 2_000_000 * 12
    assert report.taxes_withheld_total == 22_000 * 12
    assert report.status == "aggregated"
    assert report.aggregated_at is not None
    assert report.income_type == "earned"
