"""Year-end aggregator: Payroll 12개월 합산 → YearEndReport 스냅샷.

순수 함수 위주. DB 쓰기는 refresh_snapshot 만.
"""
from __future__ import annotations
import datetime
import logging
from typing import Optional

from sqlmodel import Session, select

logger = logging.getLogger("sodam.yearend.aggregator")


def aggregate_year(*, business_id: int, staff_id: int, year: int,
                   session: Session) -> dict:
    """Payroll 12개월 → 자체 집계 dict.

    Returns: {
        total_pay_year, taxable_pay, nontaxable_pay,
        taxes_withheld_total, insurance_4major_total,
        months_with_data
    }
    """
    from models import Payroll  # local import to keep test isolation easy

    rows = session.exec(
        select(Payroll)
        .where(Payroll.staff_id == staff_id)
        .where(Payroll.month.startswith(f"{year}-"))
    ).all()

    nontaxable = 0
    base_total = 0
    bonus_total = 0
    it_total = 0
    lit_total = 0
    insurance_total = 0

    for p in rows:
        # 비과세: 식대만 (현 단계). 향후 확장 시 여기 룰 추가.
        nontaxable += (p.bonus_meal or 0)
        base_total += (p.base_pay or 0)
        bonus_total += (
            (p.bonus or 0) + (p.bonus_special or 0) + (p.bonus_holiday or 0)
            + (p.holiday_w1 or 0) + (p.holiday_w2 or 0) + (p.holiday_w3 or 0)
            + (p.holiday_w4 or 0) + (p.holiday_w5 or 0) + (p.holiday_w6 or 0)
        )
        it_total += (p.deduction_it or 0)
        lit_total += (p.deduction_lit or 0)
        insurance_total += (
            (p.deduction_np or 0) + (p.deduction_hi or 0)
            + (p.deduction_lti or 0) + (p.deduction_ei or 0)
        )

    total_pay = base_total + bonus_total + nontaxable

    return {
        "total_pay_year": total_pay,
        "taxable_pay": total_pay - nontaxable,
        "nontaxable_pay": nontaxable,
        "taxes_withheld_total": it_total + lit_total,
        "insurance_4major_total": insurance_total,
        "months_with_data": len(rows),
    }


def _infer_income_type(staff) -> str:
    """Staff.contract_type → income_type (earned/business)."""
    ct = (staff.contract_type or "").strip()
    if ct in ("프리랜서", "사업소득자", "3.3%"):
        return "business"
    return "earned"


def refresh_snapshot(*, business_id: int, staff_id: int, year: int,
                     session: Session):
    """집계 결과를 YearEndReport에 반영. 없으면 생성, 있으면 갱신.

    호출 측이 session.commit() 책임.
    """
    from models import Staff, YearEndReport

    staff = session.get(Staff, staff_id)
    if staff is None:
        raise ValueError(f"Staff {staff_id} not found")

    snap = aggregate_year(
        business_id=business_id, staff_id=staff_id, year=year, session=session
    )

    report = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id)
        .where(YearEndReport.year == year)
    ).first()

    if report is None:
        report = YearEndReport(
            business_id=business_id, staff_id=staff_id, year=year,
            income_type=_infer_income_type(staff),
        )
        session.add(report)

    report.aggregated_at = datetime.datetime.utcnow()
    report.total_pay_year = snap["total_pay_year"]
    report.taxable_pay = snap["taxable_pay"]
    report.nontaxable_pay = snap["nontaxable_pay"]
    report.taxes_withheld_total = snap["taxes_withheld_total"]
    report.insurance_4major_total = snap["insurance_4major_total"]
    if report.status == "draft":
        report.status = "aggregated"

    return report
