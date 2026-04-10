"""
업로드 시 자동 제외할 벤더 판정 로직.

주 용도: 직원급여가 가족/배우자 명의 은행이체로 출금되는 경우처럼,
급여 시스템(Payroll)에서 이미 비용 처리되는 항목이 은행 출금/카드 파일 등에
중복으로 들어오는 것을 방지한다.

2가지 검증 방식:
1) 급여 매칭 (권장) — `is_payroll_duplicate(session, bid, vendor_name, amount, exp_date)`
   해당 월의 Payroll을 조회하여 Staff.name 또는 Staff.account_holder(예금주)가
   vendor_name과 매칭되고 total_pay가 amount와 정확히 일치하면 True.
   → Staff 레코드의 account_holder에 실제 이체 예금주를 등록해두면 자동 감지됨.

2) 정적 블랙리스트 (백업) — `is_excluded_vendor(name)`
   Payroll 데이터가 아직 없거나 매칭이 안 되는 경우 최후의 안전망으로 사용.
   EXCLUDED_VENDOR_NAMES에 부분문자열 추가.
"""
from __future__ import annotations

from datetime import date as _date
from typing import Optional

from sqlmodel import Session, select

from models import Staff, Payroll


# ─── 정적 블랙리스트 (백업) ───

EXCLUDED_VENDOR_NAMES: set[str] = set()  # 현재는 비어있음. Payroll 매칭으로 충분.


def is_excluded_vendor(name: Optional[str]) -> bool:
    """벤더명이 정적 블랙리스트에 해당하는지 확인."""
    if not name or not EXCLUDED_VENDOR_NAMES:
        return False
    n = name.strip()
    return any(excl in n for excl in EXCLUDED_VENDOR_NAMES)


# ─── 급여 매칭 기반 동적 감지 ───

def _name_matches(candidate: Optional[str], vendor_name: str) -> bool:
    """후보 이름(직원명 또는 예금주)이 vendor_name과 매칭되는지."""
    if not candidate:
        return False
    c = candidate.strip()
    v = vendor_name.strip()
    if not c or not v:
        return False
    # 양방향 부분문자열 매칭 (예: "윤영수" ⊂ "윤영수님")
    return c in v or v in c


def is_payroll_duplicate(
    session: Session,
    bid: int,
    vendor_name: Optional[str],
    amount: int,
    exp_date: _date,
) -> Optional[str]:
    """
    해당 항목이 급여 지급 중복인지 확인.

    조건: 동일 월(YYYY-MM)의 Payroll 중에서
      - total_pay == amount  (정확히 일치)
      - Staff.name 또는 Staff.account_holder가 vendor_name과 매칭
    이면 중복으로 간주.

    Returns:
        매칭된 직원명 (문자열) - 중복인 경우
        None - 중복 아님
    """
    if not vendor_name or amount <= 0:
        return None

    month_str = f"{exp_date.year}-{exp_date.month:02d}"

    # Payroll.business_id가 누락된 레거시 데이터가 있으므로 Staff.business_id로 필터
    rows = session.exec(
        select(Payroll, Staff)
        .join(Staff, Staff.id == Payroll.staff_id)
        .where(
            Staff.business_id == bid,
            Payroll.month == month_str,
            Payroll.total_pay == amount,
        )
    ).all()

    for _payroll, staff in rows:
        if _name_matches(staff.account_holder, vendor_name):
            return f"{staff.name}(예금주:{staff.account_holder})"
        if _name_matches(staff.name, vendor_name):
            return staff.name

    return None


def should_skip_expense(
    session: Session,
    bid: int,
    vendor_name: Optional[str],
    amount: int,
    exp_date: _date,
) -> tuple[bool, Optional[str]]:
    """
    업로드 시 해당 지출이 skip 대상인지 통합 판정.

    Returns:
        (should_skip, reason)
          - True, "사유" : skip
          - False, None : 정상 처리
    """
    if is_excluded_vendor(vendor_name):
        return True, f"블랙리스트 매칭: {vendor_name}"

    staff_name = is_payroll_duplicate(session, bid, vendor_name, amount, exp_date)
    if staff_name:
        return True, f"급여 중복: {staff_name} {amount:,}원"

    return False, None
