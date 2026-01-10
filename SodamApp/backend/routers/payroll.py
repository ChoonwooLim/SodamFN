from fastapi import APIRouter, HTTPException, Body
from services.database_service import DatabaseService
from models import Staff, Attendance, Payroll, CompanyHoliday
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
from sqlmodel import select, col
import json

router = APIRouter()

class DailyHours(BaseModel):
    date: str # YYYY-MM-DD
    hours: float
    status: str = "Normal" # Normal, Absence, Holiday

class AttendanceSaveRequest(BaseModel):
    staff_id: int
    month: str # YYYY-MM
    daily_hours: List[DailyHours]

class PayrollCalculateRequest(BaseModel):
    staff_id: int
    month: str # YYYY-MM

@router.get("/attendance/{staff_id}/{month}")
def get_monthly_attendance(staff_id: int, month: str):
    service = DatabaseService()
    try:
        # Get start and end dates of the month
        start_date = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
        if start_date.month == 12:
            end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
            
        stmt = select(Attendance).where(
            Attendance.staff_id == staff_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).order_by(Attendance.date)
        records = service.session.exec(stmt).all()
        return {"status": "success", "data": records}
    finally:
        service.close()

@router.post("/attendance")
def save_monthly_attendance(req: AttendanceSaveRequest):
    service = DatabaseService()
    try:
        for dh in req.daily_hours:
            d = datetime.strptime(dh.date, "%Y-%m-%d").date()
            stmt = select(Attendance).where(Attendance.staff_id == req.staff_id, Attendance.date == d)
            record = service.session.exec(stmt).first()
            if record:
                record.total_hours = dh.hours
                record.status = dh.status
                service.session.add(record)
            else:
                new_record = Attendance(staff_id=req.staff_id, date=d, total_hours=dh.hours, status=dh.status)
                service.session.add(new_record)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()

# Company Holiday Management
class HolidayCreate(BaseModel):
    date: str
    description: Optional[str] = None

@router.get("/holidays/{month}")
def get_company_holidays(month: str):
    service = DatabaseService()
    try:
        start_date = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
        if start_date.month == 12:
            end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
            
        stmt = select(CompanyHoliday).where(CompanyHoliday.date >= start_date, CompanyHoliday.date <= end_date)
        return {"status": "success", "data": service.session.exec(stmt).all()}
    finally:
        service.close()

@router.post("/holidays")
def add_company_holiday(req: HolidayCreate):
    service = DatabaseService()
    try:
        d = datetime.strptime(req.date, "%Y-%m-%d").date()
        existing = service.session.exec(select(CompanyHoliday).where(CompanyHoliday.date == d)).first()
        if existing:
            existing.description = req.description
        else:
            new_h = CompanyHoliday(date=d, description=req.description)
            service.session.add(new_h)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()

@router.delete("/holidays/{date_str}")
def delete_company_holiday(date_str: str):
    service = DatabaseService()
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        existing = service.session.exec(select(CompanyHoliday).where(CompanyHoliday.date == d)).first()
        if existing:
            service.session.delete(existing)
            service.session.commit()
        return {"status": "success"}
    finally:
        service.close()

def get_sunday_of_week(d: date):
    # ISO weekday: Mon=1, Sun=7
    return d + timedelta(days=(7 - d.isoweekday()))

@router.post("/calculate")
def calculate_payroll(req: PayrollCalculateRequest):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, req.staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
            
        # Target month dates
        target_month_dt = datetime.strptime(f"{req.month}-01", "%Y-%m-%d")
        target_year, target_month = target_month_dt.year, target_month_dt.month
        
        # We need to fetch data for weeks that END in this month.
        # Max range: from month-7 to month+7 to be safe
        search_start = target_month_dt.date() - timedelta(days=10)
        search_end = target_month_dt.date() + timedelta(days=40)
            
        stmt = select(Attendance).where(
            Attendance.staff_id == req.staff_id,
            Attendance.date >= search_start,
            Attendance.date <= search_end
        ).order_by(Attendance.date)
        all_attendances = service.session.exec(stmt).all()
        
        if not all_attendances:
            print(f"DEBUG: No attendances found for staff {req.staff_id} in range {search_start} - {search_end}")
            return {"status": "error", "message": "근무 기록이 없습니다."}

        print(f"DEBUG: Found {len(all_attendances)} attendance records.")

        # Fetch Company Holidays for the range
        h_stmt = select(CompanyHoliday).where(CompanyHoliday.date >= search_start, CompanyHoliday.date <= search_end)
        company_holidays = {h.date for h in service.session.exec(h_stmt).all()}

        # 1. Base Pay - Only for days IN the target month
        groups = {}
        total_base_pay = 0
        
        # Filter attendances belonging to the target month for Base Pay
        month_attendances = [a for a in all_attendances if a.date.year == target_year and a.date.month == target_month]
        
        for att in month_attendances:
            if att.total_hours <= 0: continue
            
            h = att.total_hours
            rate = staff.hourly_wage
            amt = int(h * rate)
            total_base_pay += amt
            
            if h not in groups:
                groups[h] = {
                    "label": f"시급({h}시간)",
                    "rate": rate,
                    "hours": h,
                    "days": 0,
                    "amount": 0,
                    "dates": []
                }
            groups[h]["days"] += 1
            groups[h]["amount"] += amt
            groups[h]["dates"].append(str(att.date.day))
            
        work_breakdown = []
        for h in sorted(groups.keys(), reverse=True):
            g = groups[h]
            work_breakdown.append({
                "label": g["label"],
                "rate": g["rate"],
                "hours": g["hours"],
                "days": g["days"],
                "amount": g["amount"],
                "dates": f"{', '.join(g['dates'])}일"
            })

        # 2. Weekly Holiday Pay Calculation (Refined)
        # Cutoff Rule: If Sunday <= 1st of next month, stay in current month.
        # Else (Tue-Sat crossing), go to next month.
        # Note: If 1st is Mon, Sun was 31st (stays). If 1st is Sun, Sun is 1st (stays).
        # If 1st is Sat, Sun is 2nd (goes to next).
        
        next_month_1st = (target_month_dt + timedelta(days=32)).replace(day=1).date()

        weeks = {} # (year, week_num) -> [Attendance]
        for att in all_attendances:
            isocal = att.date.isocalendar()
            key = (isocal[0], isocal[1]) # ISO year, week
            if key not in weeks: weeks[key] = []
            weeks[key].append(att)
            
        total_holiday_pay = 0
        holiday_details = {}
        holiday_per_week = [0, 0, 0, 0, 0]
        
        week_idx = 0
        # Sort keys to process in chronological order
        for key in sorted(weeks.keys()):
            w_atts = weeks[key]
            # Get Sunday of this week
            y, w = key
            sun_date = date.fromisocalendar(y, w, 7)
            
            # REFINED CUTOFF RULE:
            # "다음달 1일이 (화~토)이면 다음달 포함, 1일이 일요일이면 이번달 포함"
            # Mathematically: sun_date <= 1st of next month stays in current.
            if sun_date > next_month_1st or sun_date < target_month_dt.date():
                continue
                
            # Treat store-closed days (Holidays) as 0 hours for the weekly sum
            effective_atts = []
            for a in w_atts:
                is_company_holiday = a.date in company_holidays
                is_store_closed = a.status == "Holiday" or is_company_holiday
                
                # If store is closed (Sunday/Holiday), hours are 0 for holiday pay calculation
                effective_h = 0 if is_store_closed else a.total_hours
                effective_atts.append(effective_h)
                
            w_hours = sum(effective_atts)
            
            # Rule 1: Check for Absence
            # PROTECTION: Company Holidays or 'Holiday' status don't count as absence even if hours=0.
            # Only status="Absence" triggers the penalty.
            has_absence = any(a.status == "Absence" for a in w_atts)
            
            print(f"DEBUG: Week {key} (Sun {sun_date}) -> Hours: {w_hours}, Absence: {has_absence}")

            if w_hours >= 15 and not has_absence:
                # Formula: (Weekly Total / 5) * rate
                avg_h = round(w_hours / 5, 2)
                h_amt = int(avg_h * staff.hourly_wage)
                total_holiday_pay += h_amt
                print(f"  -> Holiday Pay: {h_amt}")
                if week_idx < 5:
                    holiday_per_week[week_idx] = h_amt
                holiday_details[str(week_idx + 1)] = f"{w_hours}시간 / 5일 = {avg_h}시간"
            elif has_absence and w_hours >= 15:
                holiday_details[str(week_idx + 1)] = "결근으로 미지급"
            
            week_idx += 1

        # 3. Deductions
        gross_pay = total_base_pay + total_holiday_pay
        
        d_np, d_hi, d_ei, d_lti, d_it, d_lit = 0, 0, 0, 0, 0, 0
        
        if staff.contract_type == "정규직" or staff.insurance_4major:
            d_np = int(gross_pay * 0.045 / 10) * 10
            d_hi = int(gross_pay * 0.03545 / 10) * 10
            d_lti = int(d_hi * 0.1291 / 10) * 10
            d_ei = int(gross_pay * 0.009 / 10) * 10
            d_it = int(gross_pay * 0.01 / 10) * 10 
            d_lit = int(d_it * 0.1 / 10) * 10
        else:
            d_it = int(gross_pay * 0.03 / 10) * 10
            d_lit = int(d_it * 0.1 / 10) * 10
            
        total_deductions = d_np + d_hi + d_ei + d_lti + d_it + d_lit
        net_pay = gross_pay - total_deductions

        # 4. Save to Payroll Table
        details_json = json.dumps({
            "work_breakdown": work_breakdown,
            "holiday_details": holiday_details
        }, ensure_ascii=False)
        
        existing = service.session.exec(select(Payroll).where(Payroll.staff_id == req.staff_id, Payroll.month == req.month)).first()
        if not existing:
            existing = Payroll(staff_id=req.staff_id, month=req.month)
            
        existing.base_pay = total_base_pay
        existing.bonus = total_holiday_pay
        existing.bonus_holiday = total_holiday_pay
        existing.holiday_w1, existing.holiday_w2, existing.holiday_w3, existing.holiday_w4, existing.holiday_w5 = holiday_per_week
        existing.deductions = total_deductions
        existing.deduction_np = d_np
        existing.deduction_hi = d_hi
        existing.deduction_ei = d_ei
        existing.deduction_lti = d_lti
        existing.deduction_it = d_it
        existing.deduction_lit = d_lit
        existing.total_pay = net_pay
        existing.details_json = details_json
        
        service.session.add(existing)
        service.session.commit()
        
        return {"status": "success", "data": existing}
        
    finally:
        service.close()
