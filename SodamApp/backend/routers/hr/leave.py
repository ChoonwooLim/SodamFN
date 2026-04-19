from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

from routers.auth import get_admin_user, get_current_user
from models import Staff, LeaveBalance, LeaveRequest, User as AuthUser, Business
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

# --- Pydantic Schemas ---

class LeaveRequestCreate(BaseModel):
    staff_id: int
    leave_type: str = "연차"
    start_date: date
    end_date: date
    days: float = 1.0
    reason: Optional[str] = None

class LeaveRequestUpdate(BaseModel):
    status: str  # 승인, 반려, 취소
    reject_reason: Optional[str] = None
    force: bool = False  # 잔여 부족해도 강제 승인 허용

class LeaveBalanceAdjust(BaseModel):
    total_annual: Optional[float] = None
    total_sick: Optional[float] = None
    total_special: Optional[float] = None


# --- Constants ---

ANNUAL_TYPES = {"연차", "반차(오전)", "반차(오후)"}
SICK_TYPES = {"병가"}
SPECIAL_TYPES = {"경조사", "출산휴가", "특별휴가", "공가"}


# --- Helpers ---

def calc_legal_annual_leave(start_date: date, ref_year: int) -> float:
    """근로기준법 기반 연차 자동 계산
    - 1년 미만: 1개월 개근 시 1일 (최대 11일)
    - 1년 이상: 15일
    - 3년 이상: 매 2년마다 +1일 (최대 25일)
    """
    from dateutil.relativedelta import relativedelta

    ref_date = date(ref_year, 1, 1)
    if start_date >= ref_date:
        return 0

    work_start = start_date
    years_worked = (ref_date - work_start).days / 365.25

    if years_worked < 1:
        months_worked = 0
        check = work_start
        while check < date(ref_year, 12, 31):
            check += relativedelta(months=1)
            if check <= date(ref_year, 12, 31):
                months_worked += 1
        return min(months_worked, 11)

    base = 15
    if years_worked >= 3:
        extra = int((years_worked - 1) / 2)
        base = min(15 + extra, 25)

    return float(base)


def _verify_tenant(record, bid: Optional[int], label: str = "리소스"):
    """멀티테넌트 격리 검증 — bid가 설정되어 있으면 record.business_id와 일치해야 함."""
    if bid is not None and record.business_id is not None and record.business_id != bid:
        raise HTTPException(status_code=404, detail=f"{label}을(를) 찾을 수 없습니다.")


def _balance_field_for(leave_type: str) -> Optional[str]:
    """휴가 유형 → LeaveBalance used_* 필드명 매핑."""
    if leave_type in ANNUAL_TYPES:
        return "used_annual"
    if leave_type in SICK_TYPES:
        return "used_sick"
    if leave_type in SPECIAL_TYPES:
        return "used_special"
    return None  # 무급휴가/육아휴직 등은 잔액에 반영 안 함


def _apply_balance_delta(balance: LeaveBalance, leave_type: str, days: float, sign: int):
    """잔액 used_* 에 sign(+1/-1) * days 를 반영. 음수 방지."""
    field = _balance_field_for(leave_type)
    if not field:
        return
    current = getattr(balance, field)
    new_val = current + sign * days
    setattr(balance, field, max(0.0, new_val))


def _get_or_create_balance(
    session: Session, staff: Staff, year: int, bid: Optional[int], lock: bool = False
) -> LeaveBalance:
    """연도별 LeaveBalance 조회 또는 생성. lock=True면 행 잠금(동시성 안전).
    UniqueConstraint(staff_id, year) 경합 시 재조회.
    """
    stmt = select(LeaveBalance).where(
        LeaveBalance.staff_id == staff.id,
        LeaveBalance.year == year,
    )
    if lock:
        stmt = stmt.with_for_update()
    balance = session.exec(stmt).first()
    if balance:
        _verify_tenant(balance, bid, "잔여 현황")
        return balance

    total_annual = calc_legal_annual_leave(staff.start_date, year) if staff.start_date else 0
    balance = LeaveBalance(
        business_id=bid or staff.business_id,
        staff_id=staff.id,
        year=year,
        total_annual=total_annual,
    )
    session.add(balance)
    try:
        session.flush()  # UniqueConstraint 즉시 검증
    except IntegrityError:
        session.rollback()
        # 동시 생성된 레코드 재조회
        balance = session.exec(stmt).first()
        if not balance:
            raise
    return balance


def _check_sufficient(balance: LeaveBalance, leave_type: str, days: float):
    """잔여 부족 검증 — 연차만 총량 제한. 병가/특별휴가는 관리자가 별도 관리."""
    if leave_type not in ANNUAL_TYPES:
        return
    remaining = balance.total_annual - balance.used_annual
    if days > remaining + 1e-6:
        raise HTTPException(
            status_code=400,
            detail=f"잔여 연차 부족 — 신청 {days}일, 잔여 {remaining:.1f}일",
        )


# --- Endpoints ---

@router.get("/leave/balance/{staff_id}")
def get_leave_balance(
    staff_id: int,
    year: Optional[int] = None,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """연차 잔여 현황 조회 (없으면 자동 생성)"""
    if not year:
        year = date.today().year

    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    _verify_tenant(staff, bid, "직원")

    balance = _get_or_create_balance(session, staff, year, bid)

    stmt_req = (
        select(LeaveRequest)
        .where(
            LeaveRequest.staff_id == staff_id,
            LeaveRequest.start_date >= date(year, 1, 1),
            LeaveRequest.start_date <= date(year, 12, 31),
        )
        .order_by(LeaveRequest.start_date.desc())
    )
    requests = session.exec(stmt_req).all()

    session.commit()
    session.refresh(balance)

    return {
        "status": "success",
        "balance": balance,
        "requests": requests,
        "staff_name": staff.name,
        "start_date": str(staff.start_date) if staff.start_date else None,
    }


@router.put("/leave/balance/{staff_id}")
def update_leave_balance(
    staff_id: int,
    year: int,
    data: LeaveBalanceAdjust,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """잔액 수동 조정 (admin)"""
    stmt = select(LeaveBalance).where(
        LeaveBalance.staff_id == staff_id, LeaveBalance.year == year
    ).with_for_update()
    balance = session.exec(stmt).first()
    if not balance:
        raise HTTPException(status_code=404, detail="잔여 현황을 찾을 수 없습니다.")
    _verify_tenant(balance, bid, "잔여 현황")

    if data.total_annual is not None:
        balance.total_annual = data.total_annual
    if data.total_sick is not None:
        balance.total_sick = data.total_sick
    if data.total_special is not None:
        balance.total_special = data.total_special

    session.add(balance)
    session.commit()
    session.refresh(balance)
    return {"status": "success", "balance": balance}


@router.post("/leave/request")
def create_leave_request(
    data: LeaveRequestCreate,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """관리자가 직접 생성 — 즉시 승인 처리. 단일 트랜잭션으로 원자적 반영."""
    staff = session.get(Staff, data.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    _verify_tenant(staff, bid, "직원")

    year = data.start_date.year
    balance = _get_or_create_balance(session, staff, year, bid, lock=True)
    _check_sufficient(balance, data.leave_type, data.days)

    req = LeaveRequest(
        business_id=bid or staff.business_id,
        staff_id=data.staff_id,
        staff_name=staff.name,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=data.days,
        reason=data.reason,
        status="승인",
        approved_at=datetime.now(),
        approved_by="관리자",
    )
    session.add(req)

    _apply_balance_delta(balance, data.leave_type, data.days, sign=+1)
    session.add(balance)

    session.commit()  # 단일 커밋: request + balance 원자적 반영
    session.refresh(req)

    return {"status": "success", "data": req}


@router.put("/leave/request/{request_id}")
def update_leave_request(
    request_id: int,
    data: LeaveRequestUpdate,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """승인/반려/취소 — 상태 전이 시 잔액 delta를 원자적으로 반영."""
    req = session.get(LeaveRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="휴가 신청을 찾을 수 없습니다.")
    _verify_tenant(req, bid, "휴가 신청")

    old_status = req.status
    new_status = data.status

    if new_status not in ("승인", "반려", "취소"):
        raise HTTPException(status_code=400, detail=f"허용되지 않은 상태: {new_status}")

    # 상태 변화 없으면 노-op
    if new_status == old_status:
        return {"status": "success", "data": req}

    # 잔액 delta: 승인 해제 시 -, 승인 진입 시 +
    year = req.start_date.year
    balance = None
    need_decrement = old_status == "승인"
    need_increment = new_status == "승인"

    if need_decrement or need_increment:
        staff = session.get(Staff, req.staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
        balance = _get_or_create_balance(session, staff, year, bid, lock=True)

    # 반영 순서: 먼저 감산, 그 다음 가산 (잔액 검증 정확)
    if need_decrement:
        _apply_balance_delta(balance, req.leave_type, req.days, sign=-1)
    if need_increment:
        if not data.force:
            _check_sufficient(balance, req.leave_type, req.days)
        _apply_balance_delta(balance, req.leave_type, req.days, sign=+1)

    req.status = new_status
    if new_status == "승인":
        req.approved_at = datetime.now()
        req.approved_by = "관리자"
    elif new_status == "반려":
        req.reject_reason = data.reject_reason

    session.add(req)
    if balance:
        session.add(balance)

    session.commit()
    session.refresh(req)

    return {"status": "success", "data": req}


@router.delete("/leave/request/{request_id}")
def delete_leave_request(
    request_id: int,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """신청 삭제 — 승인 상태였다면 잔액 복원."""
    req = session.get(LeaveRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="휴가 신청을 찾을 수 없습니다.")
    _verify_tenant(req, bid, "휴가 신청")

    if req.status == "승인":
        year = req.start_date.year
        staff = session.get(Staff, req.staff_id)
        if staff:
            balance = _get_or_create_balance(session, staff, year, bid, lock=True)
            _apply_balance_delta(balance, req.leave_type, req.days, sign=-1)
            session.add(balance)

    session.delete(req)
    session.commit()

    return {"status": "success"}


@router.get("/leave/requests")
def list_leave_requests(
    status: Optional[str] = None,
    limit: int = 50,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """관리자용: 휴가 신청 목록. status로 필터(대기/승인/반려/취소). 사업장 스코프 자동 적용."""
    stmt = apply_bid_filter(select(LeaveRequest), LeaveRequest, bid)
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    stmt = stmt.order_by(LeaveRequest.start_date.desc()).limit(limit)
    rows = session.exec(stmt).all()
    return {"status": "success", "data": rows, "count": len(rows)}


@router.get("/leave/summary")
def get_leave_summary(
    year: Optional[int] = None,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """전 재직 직원의 연차 요약"""
    if not year:
        year = date.today().year

    stmt = apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "재직")
    staffs = session.exec(stmt).all()

    result = []
    for s in staffs:
        balance = _get_or_create_balance(session, s, year, bid)
        result.append({
            "staff_id": s.id,
            "staff_name": s.name,
            "role": s.role,
            "start_date": str(s.start_date) if s.start_date else None,
            "total_annual": balance.total_annual,
            "used_annual": balance.used_annual,
            "remaining_annual": balance.total_annual - balance.used_annual,
            "total_sick": balance.total_sick,
            "used_sick": balance.used_sick,
            "total_special": balance.total_special,
            "used_special": balance.used_special,
        })

    session.commit()  # 자동 생성된 balance 일괄 커밋 (loop 안 커밋 제거)

    return {"status": "success", "data": result, "year": year}


# ---------------------------------------------------------------------------
# 직원용(Self-service) 엔드포인트 — 본인 것만 조회/신청/취소
# ---------------------------------------------------------------------------

class MyLeaveRequestCreate(BaseModel):
    leave_type: str = "연차"
    start_date: date
    end_date: date
    days: float = 1.0
    reason: Optional[str] = None


def _resolve_self_staff(user: AuthUser, session: Session) -> tuple[Staff, bool]:
    """현재 로그인한 사용자의 Staff 레코드 조회. (staff, is_under5) 반환.

    5인 미만 사업장도 무급휴가/병가/경조사는 허용하되, 연차(유급)는 POST 시점에 차단.
    """
    if not user.staff_id:
        raise HTTPException(status_code=403, detail="직원 계정이 연결되지 않았습니다.")
    staff = session.get(Staff, user.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원 정보를 찾을 수 없습니다.")

    is_under5 = False
    if staff.business_id:
        biz = session.get(Business, staff.business_id)
        if biz and getattr(biz, "employee_scale", "over5") == "under5":
            is_under5 = True
    return staff, is_under5


@router.get("/leave/my")
def get_my_leave(
    year: Optional[int] = None,
    user: AuthUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """본인 연차 잔여 + 신청 이력 조회. under5 사업장은 balance=None 으로 반환(잔액 개념 없음)."""
    staff, is_under5 = _resolve_self_staff(user, session)
    if not year:
        year = date.today().year

    balance = None
    if not is_under5:
        balance = _get_or_create_balance(session, staff, year, staff.business_id)

    stmt = (
        select(LeaveRequest)
        .where(
            LeaveRequest.staff_id == staff.id,
            LeaveRequest.start_date >= date(year, 1, 1),
            LeaveRequest.start_date <= date(year, 12, 31),
        )
        .order_by(LeaveRequest.start_date.desc())
    )
    requests = session.exec(stmt).all()

    session.commit()
    if balance is not None:
        session.refresh(balance)

    return {
        "status": "success",
        "staff_id": staff.id,
        "staff_name": staff.name,
        "start_date": str(staff.start_date) if staff.start_date else None,
        "is_under5": is_under5,
        "balance": balance,
        "requests": requests,
    }


@router.post("/leave/my/request")
def create_my_leave_request(
    data: MyLeaveRequestCreate,
    user: AuthUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """본인이 직접 신청 — 대기(승인 전) 상태로 저장. 잔액은 아직 차감하지 않음.

    under5 사업장: 연차(유급) 타입은 차단, 무급휴가/병가/경조사 등은 허용.
    """
    staff, is_under5 = _resolve_self_staff(user, session)

    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="종료일은 시작일 이후여야 합니다.")
    if data.days <= 0:
        raise HTTPException(status_code=400, detail="일수는 0보다 커야 합니다.")

    # under5 사업장은 유급 연차 의무가 없으므로 연차 타입 차단
    if is_under5 and data.leave_type in ANNUAL_TYPES:
        raise HTTPException(
            status_code=403,
            detail="5인 미만 사업장은 유급 연차 의무가 없습니다. 무급휴가/병가/경조사로 신청해주세요.",
        )

    # 잔여 참고용 사전 검사 (연차만) — over5만 대상
    if not is_under5:
        year = data.start_date.year
        balance = _get_or_create_balance(session, staff, year, staff.business_id)
        try:
            _check_sufficient(balance, data.leave_type, data.days)
        except HTTPException:
            # 신청 시점 자체는 허용하되 관리자가 승인 시 재검증 (force 필요)
            pass

    req = LeaveRequest(
        business_id=staff.business_id,
        staff_id=staff.id,
        staff_name=staff.name,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=data.days,
        reason=data.reason,
        status="대기",
    )
    session.add(req)
    session.commit()
    session.refresh(req)

    return {"status": "success", "data": req}


@router.delete("/leave/my/request/{request_id}")
def cancel_my_leave_request(
    request_id: int,
    user: AuthUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """본인의 대기 중 신청을 취소(삭제). 이미 승인/반려된 건은 관리자 문의."""
    staff, _ = _resolve_self_staff(user, session)

    req = session.get(LeaveRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="휴가 신청을 찾을 수 없습니다.")
    if req.staff_id != staff.id:
        raise HTTPException(status_code=403, detail="본인의 신청만 취소할 수 있습니다.")
    if req.status != "대기":
        raise HTTPException(
            status_code=400,
            detail=f"대기 중인 신청만 취소할 수 있습니다. (현재 상태: {req.status})",
        )

    session.delete(req)
    session.commit()
    return {"status": "success"}
