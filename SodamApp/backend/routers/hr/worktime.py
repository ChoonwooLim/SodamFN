from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import date, datetime, time, timedelta
from typing import Optional

from routers.auth import get_admin_user
from models import User as AuthUser, Staff, Attendance
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _time_to_minutes(t: time) -> int:
    """Convert a time object to minutes since midnight."""
    return t.hour * 60 + t.minute


def _overlap_minutes(start1: int, end1: int, start2: int, end2: int) -> int:
    """Calculate overlap in minutes between two ranges (in minutes since midnight).
    Handles ranges that might cross midnight for night-work calculation."""
    overlap = max(0, min(end1, end2) - max(start1, start2))
    return overlap


def _calc_night_minutes(check_in: time, check_out: time) -> int:
    """Calculate minutes worked between 22:00-06:00 (night work / 야간근로).
    Night window: 22:00 (1320 min) to 30:00 (1800 min, i.e. 06:00 next day).
    We normalize by treating times after midnight as +1440.
    """
    ci = _time_to_minutes(check_in)
    co = _time_to_minutes(check_out)

    # If checkout is before checkin, it crossed midnight
    if co <= ci:
        co += 1440  # add 24 hours

    total_night = 0

    # Night window 1: 22:00 (1320) to 24:00 (1440) on same day
    total_night += _overlap_minutes(ci, co, 1320, 1440)

    # Night window 2: 00:00 (0 or 1440) to 06:00 (360 or 1800)
    # If work spans past midnight, use 1440-1800 range
    total_night += _overlap_minutes(ci, co, 1440, 1800)

    # Also check the regular 00:00-06:00 window for early-morning starts
    total_night += _overlap_minutes(ci, co, 0, 360)

    return total_night


def _is_holiday(d: date) -> bool:
    """Check if a date is Saturday or Sunday."""
    return d.weekday() in (5, 6)  # 5=Saturday, 6=Sunday


def _get_week_range(ref_date: date):
    """Get Monday-Sunday range for the week containing ref_date."""
    monday = ref_date - timedelta(days=ref_date.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _get_month_range(month_str: str):
    """Parse YYYY-MM and return (start_date, end_date_exclusive)."""
    dt = datetime.strptime(f"{month_str}-01", "%Y-%m-%d")
    start = date(dt.year, dt.month, 1)
    if dt.month == 12:
        end = date(dt.year + 1, 1, 1)
    else:
        end = date(dt.year, dt.month + 1, 1)
    return start, end


def _analyze_records(records):
    """Analyze a list of Attendance records and return hour breakdowns."""
    total_minutes = 0
    regular_minutes = 0
    overtime_minutes = 0
    night_minutes = 0
    holiday_minutes = 0

    for r in records:
        if not r.check_in or not r.check_out:
            continue

        ci = _time_to_minutes(r.check_in)
        co = _time_to_minutes(r.check_out)
        if co <= ci:
            co += 1440

        worked = co - ci  # total minutes worked this day

        total_minutes += worked

        # Night minutes
        nm = _calc_night_minutes(r.check_in, r.check_out)
        night_minutes += nm

        # Holiday work
        if _is_holiday(r.date):
            holiday_minutes += worked

        # Regular vs overtime: max 8h (480 min) per day is regular
        day_regular = min(worked, 480)
        day_overtime = max(0, worked - 480)
        regular_minutes += day_regular
        overtime_minutes += day_overtime

    return {
        "total_hours": round(total_minutes / 60, 2),
        "regular_hours": round(regular_minutes / 60, 2),
        "overtime_hours": round(overtime_minutes / 60, 2),
        "night_hours": round(night_minutes / 60, 2),
        "holiday_hours": round(holiday_minutes / 60, 2),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/worktime/alerts")
def get_worktime_alerts(
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """대시보드 — 주 48시간 초과 직원 경고 목록"""
    today = date.today()
    monday, sunday = _get_week_range(today)

    stmt = apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "재직")
    staffs = session.exec(stmt).all()

    alerts = []
    for s in staffs:
        att_stmt = (
            select(Attendance)
            .where(
                Attendance.staff_id == s.id,
                Attendance.date >= monday,
                Attendance.date <= sunday,
            )
        )
        records = session.exec(att_stmt).all()
        breakdown = _analyze_records(records)

        if breakdown["total_hours"] >= 48:
            level = "danger" if breakdown["total_hours"] >= 52 else "caution"
            alerts.append({
                "staff_id": s.id,
                "staff_name": s.name,
                "role": s.role,
                "total_hours": breakdown["total_hours"],
                "overtime_hours": breakdown["overtime_hours"],
                "warning_level": level,
                "week_start": str(monday),
                "week_end": str(sunday),
            })

    # Sort by total_hours descending
    alerts.sort(key=lambda x: x["total_hours"], reverse=True)

    return {"status": "success", "data": alerts}


@router.get("/worktime/weekly/{staff_id}")
def get_weekly_worktime(
    staff_id: int,
    ref_date: Optional[str] = None,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """특정 직원의 금주 근로시간 분석"""
    staff = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    target = date.today()
    if ref_date:
        try:
            target = datetime.strptime(ref_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    monday, sunday = _get_week_range(target)

    stmt = (
        select(Attendance)
        .where(
            Attendance.staff_id == staff_id,
            Attendance.date >= monday,
            Attendance.date <= sunday,
        )
        .order_by(Attendance.date)
    )
    records = session.exec(stmt).all()
    breakdown = _analyze_records(records)

    # Warning level
    total = breakdown["total_hours"]
    if total >= 52:
        warning_level = "danger"
    elif total >= 48:
        warning_level = "caution"
    else:
        warning_level = "normal"

    # Daily detail
    daily = []
    for r in records:
        daily.append({
            "date": str(r.date),
            "weekday": ["월", "화", "수", "목", "금", "토", "일"][r.date.weekday()],
            "check_in": str(r.check_in)[:5] if r.check_in else None,
            "check_out": str(r.check_out)[:5] if r.check_out else None,
            "hours": r.total_hours,
            "is_holiday": _is_holiday(r.date),
        })

    return {
        "status": "success",
        "data": {
            "staff_id": staff_id,
            "staff_name": staff.name,
            "week_start": str(monday),
            "week_end": str(sunday),
            **breakdown,
            "warning_level": warning_level,
            "daily": daily,
        },
    }


@router.get("/worktime/monthly/{staff_id}/{month}")
def get_monthly_worktime(
    staff_id: int,
    month: str,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """특정 직원의 월간 근로시간 분석 (주별 분석 포함)"""
    staff = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    try:
        start_date, end_date = _get_month_range(month)
    except ValueError:
        raise HTTPException(status_code=400, detail="월 형식이 올바르지 않습니다. (YYYY-MM)")

    stmt = (
        select(Attendance)
        .where(
            Attendance.staff_id == staff_id,
            Attendance.date >= start_date,
            Attendance.date < end_date,
        )
        .order_by(Attendance.date)
    )
    records = session.exec(stmt).all()

    # Monthly totals
    monthly_breakdown = _analyze_records(records)

    # Weekly breakdown
    weeks = {}
    for r in records:
        monday, sunday = _get_week_range(r.date)
        week_key = str(monday)
        if week_key not in weeks:
            weeks[week_key] = {
                "week_start": str(monday),
                "week_end": str(sunday),
                "records": [],
            }
        weeks[week_key]["records"].append(r)

    weekly_data = []
    for wk in sorted(weeks.keys()):
        w = weeks[wk]
        wb = _analyze_records(w["records"])
        total = wb["total_hours"]
        if total >= 52:
            level = "danger"
        elif total >= 48:
            level = "caution"
        else:
            level = "normal"
        weekly_data.append({
            "week_start": w["week_start"],
            "week_end": w["week_end"],
            **wb,
            "warning_level": level,
        })

    return {
        "status": "success",
        "data": {
            "staff_id": staff_id,
            "staff_name": staff.name,
            "month": month,
            **monthly_breakdown,
            "weekly_breakdown": weekly_data,
        },
    }
