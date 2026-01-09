from fastapi import APIRouter, HTTPException
from services.database_service import DatabaseService
from models import Staff, Attendance
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

router = APIRouter()

class StaffCreate(BaseModel):
    name: str
    role: str
    hourly_wage: int
    bank_account: Optional[str] = None
    start_date: date = date.today()

@router.get("/staff")
def get_all_staff():
    service = DatabaseService()
    try:
        from sqlmodel import select
        staffs = service.session.exec(select(Staff)).all()
        return {"status": "success", "data": staffs}
    finally:
        service.close()

@router.post("/staff")
def create_staff(staff: StaffCreate):
    service = DatabaseService()
    try:
        new_staff = Staff(
            name=staff.name,
            role=staff.role,
            hourly_wage=staff.hourly_wage,
            bank_account=staff.bank_account,
            start_date=staff.start_date
        )
        service.session.add(new_staff)
        service.session.commit()
        return {"status": "success", "message": "Staff created"}
    finally:
        service.close()

class AttendanceAction(BaseModel):
    staff_id: int
    action: str # "checkin" or "checkout"

@router.post("/attendance")
def log_attendance(payload: AttendanceAction):
    service = DatabaseService()
    try:
        from sqlmodel import select
        from datetime import datetime
        today = date.today()
        now_time = datetime.now().time()
        
        # Check if record exists for today
        stmt = select(Attendance).where(Attendance.staff_id == payload.staff_id, Attendance.date == today)
        record = service.session.exec(stmt).first()
        
        if payload.action == "checkin":
            if record: return {"status": "error", "message": "Already checked in today"}
            new_record = Attendance(staff_id=payload.staff_id, date=today, check_in=now_time)
            service.session.add(new_record)
        
        elif payload.action == "checkout":
            if not record: return {"status": "error", "message": "No check-in record found"}
            record.check_out = now_time
            # Calculate hours
            start_dt = datetime.combine(today, record.check_in)
            end_dt = datetime.combine(today, now_time)
            duration = (end_dt - start_dt).total_seconds() / 3600
            record.total_hours = round(duration, 2)
            service.session.add(record)
            
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()
