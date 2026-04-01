from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from sqlmodel import Session, select

from routers.auth import get_admin_user, get_current_user
from models import User as AuthUser, Staff, Attendance
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter
from services.geofence_service import verify_location

router = APIRouter()

class AttendanceAction(BaseModel):
    staff_id: int
    action: str  # "checkin" or "checkout"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@router.post("/attendance")
def log_attendance(payload: AttendanceAction, _user: AuthUser = Depends(get_current_user), session: Session = Depends(get_session)):
    today = date.today()
    now_time = datetime.now().time()
    
    gps_result = None
    if payload.latitude is not None and payload.longitude is not None:
        gps_result = verify_location(payload.latitude, payload.longitude, session, _user.business_id)
        if not gps_result["verified"]:
            return {
                "status": "error",
                "message": gps_result["message"],
                "gps": gps_result
            }
    
    stmt = select(Attendance).where(Attendance.staff_id == payload.staff_id, Attendance.date == today)
    record = session.exec(stmt).first()
    
    if payload.action == "checkin":
        if record:
            return {"status": "error", "message": "이미 출근 기록이 있습니다."}
        new_record = Attendance(
            staff_id=payload.staff_id,
            date=today,
            check_in=now_time,
            check_in_lat=payload.latitude,
            check_in_lng=payload.longitude,
            check_in_verified=gps_result["verified"] if gps_result else False,
            check_in_distance=gps_result["distance"] if gps_result else None,
            business_id=_user.business_id,
        )
        session.add(new_record)
    
    elif payload.action == "checkout":
        if not record: return {"status": "error", "message": "출근 기록이 없습니다."}
        record.check_out = now_time
        record.check_out_lat = payload.latitude
        record.check_out_lng = payload.longitude
        record.check_out_verified = gps_result["verified"] if gps_result else False
        record.check_out_distance = gps_result["distance"] if gps_result else None
        
        start_dt = datetime.combine(today, record.check_in)
        end_dt = datetime.combine(today, now_time)
        duration = (end_dt - start_dt).total_seconds() / 3600
        record.total_hours = round(duration, 2)
        session.add(record)
        
    try:
        session.commit()
    except Exception as e:
        session.rollback()
        error_msg = str(e)
        if "IntegrityError" in type(e).__name__ or "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            return {"status": "error", "message": "이미 출근 기록이 있습니다. (중복 데이터)"}
        raise HTTPException(status_code=500, detail=f"출퇴근 기록 중 오류: {error_msg}")
        
    return {
        "status": "success",
        "gps": gps_result,
        "message": "출근이 기록되었습니다." if payload.action == "checkin" else f"퇴근이 기록되었습니다. (근무시간: {record.total_hours if payload.action == 'checkout' else 0}시간)"
    }

@router.get("/attendance/status/{staff_id}")
def get_attendance_status(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    today = date.today()
    stmt = select(Attendance).where(Attendance.staff_id == staff_id, Attendance.date == today)
    record = session.exec(stmt).first()
    
    if not record:
        return {"status": "success", "data": {"checked_in": False, "checked_out": False}}
    
    return {
        "status": "success", 
        "data": {
            "checked_in": record.check_in is not None,
            "checked_out": record.check_out is not None,
            "check_in_time": record.check_in,
            "check_out_time": record.check_out,
            "check_in_verified": record.check_in_verified,
            "check_out_verified": record.check_out_verified,
            "check_in_distance": record.check_in_distance,
            "check_out_distance": record.check_out_distance,
        }
    }

@router.get("/attendance/history/{staff_id}")
def get_attendance_history(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    stmt = select(Attendance).where(Attendance.staff_id == staff_id).order_by(Attendance.date.desc()).limit(5)
    records = session.exec(stmt).all()
    
    return {"status": "success", "data": records}

@router.get("/attendance/monthly-summary/{staff_id}/{month}")
def get_monthly_attendance_summary(staff_id: int, month: str, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    
    target = datetime.strptime(f"{month}-01", "%Y-%m-%d")
    year, m = target.year, target.month
    
    start_date = date(year, m, 1)
    if m == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, m + 1, 1)
    
    stmt = (select(Attendance)
            .where(Attendance.staff_id == staff_id,
                   Attendance.date >= start_date,
                   Attendance.date < end_date)
            .order_by(Attendance.date))
    records = session.exec(stmt).all()
    
    total_days = len([r for r in records if r.total_hours > 0])
    total_hours = sum(r.total_hours for r in records)
    verified_count = sum(1 for r in records if r.check_in_verified)
    
    daily_data = []
    for r in records:
        daily_data.append({
            "date": str(r.date),
            "check_in": str(r.check_in)[:5] if r.check_in else None,
            "check_out": str(r.check_out)[:5] if r.check_out else None,
            "hours": r.total_hours,
            "gps_verified": r.check_in_verified,
            "distance": r.check_in_distance,
        })
    
    estimated_pay = 0
    if staff.contract_type == "정규직":
        estimated_pay = staff.monthly_salary or 0
    else:
        estimated_pay = int(total_hours * staff.hourly_wage)
    
    return {
        "status": "success",
        "data": {
            "staff_name": staff.name,
            "month": month,
            "total_work_days": total_days,
            "total_hours": round(total_hours, 2),
            "verified_count": verified_count,
            "verified_ratio": round(verified_count / len(records) * 100, 1) if records else 0,
            "estimated_base_pay": estimated_pay,
            "hourly_wage": staff.hourly_wage,
            "contract_type": staff.contract_type,
            "daily_data": daily_data,
        }
    }
