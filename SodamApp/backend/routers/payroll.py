from fastapi import Depends, APIRouter, HTTPException, Body
from services.database_service import DatabaseService
from models import Staff, Attendance, Payroll, CompanyHoliday
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
from sqlmodel import select, col
import json
from utils.payroll_calc_utils import calculate_insurances, calculate_korean_income_tax
from services.notification_service import NotificationService
from services.banking_service import BankingService
from config import FRONTEND_URL
from routers.auth import get_admin_user
from models import User
from fastapi import APIRouter, HTTPException, Body, Depends
from tenant_filter import get_bid_from_token, apply_bid_filter

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
    month: str
    special_bonus: int = 0  # 특별수당
    overrides: Optional[dict] = None  # Add overrides for tax/insurances # YYYY-MM

class InsuranceBaseImport(BaseModel):
    staff_name: str
    total_remuneration: int  # 전년도 보수총액
    months_worked: int  # 근무월수
    staff_id: Optional[int] = None  # 직접 ID 지정 (선택)

@router.get("/attendance/{staff_id}/{month}")
def get_monthly_attendance(staff_id: int, month: str, bid = Depends(get_bid_from_token)):
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
        
        # --- Carryover: find previous month's trailing incomplete week ---
        # The first week of this month may start mid-week.
        # Find the Sunday that starts the first ISO week containing day 1.
        first_day_dow = start_date.isoweekday()  # Mon=1..Sun=7
        if first_day_dow == 7:
            # 1st is Sunday -> first week starts on 1st, no carryover
            carryover_data = []
        else:
            # Find the preceding Sunday (start of the ISO week)
            prev_sunday = start_date - timedelta(days=first_day_dow)  # go back to Sunday
            # Fetch attendance from prev_sunday to day before start_date
            prev_end = start_date - timedelta(days=1)
            co_stmt = select(Attendance).where(
                Attendance.staff_id == staff_id,
                Attendance.date >= prev_sunday,
                Attendance.date <= prev_end
            ).order_by(Attendance.date)
            co_records = service.session.exec(co_stmt).all()
            carryover_data = [
                {
                    "date": str(r.date),
                    "total_hours": r.total_hours,
                    "status": r.status or "Normal",
                    "is_carryover": True
                }
                for r in co_records
            ]
        
        return {"status": "success", "data": records, "carryover": carryover_data}
    finally:
        service.close()

@router.post("/attendance")
def save_monthly_attendance(req: AttendanceSaveRequest, bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        # 벌크 조회 (N+1 → 1 쿼리)
        dates = [datetime.strptime(dh.date, "%Y-%m-%d").date() for dh in req.daily_hours]
        existing = service.session.exec(
            select(Attendance).where(
                Attendance.staff_id == req.staff_id,
                Attendance.date.in_(dates)
            )
        ).all()
        existing_map = {r.date: r for r in existing}

        for dh in req.daily_hours:
            d = datetime.strptime(dh.date, "%Y-%m-%d").date()
            record = existing_map.get(d)
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
def get_company_holidays(month: str, bid = Depends(get_bid_from_token)):
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
def add_company_holiday(req: HolidayCreate, bid = Depends(get_bid_from_token)):
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
def delete_company_holiday(date_str: str, bid = Depends(get_bid_from_token)):
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
def calculate_payroll(req: PayrollCalculateRequest, bid = Depends(get_bid_from_token)):
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

        # 1. Base Pay
        groups = {}
        total_base_pay = 0
        work_breakdown = []

        if staff.contract_type == "정규직":
            # For Regular staff, use fixed monthly salary
            total_base_pay = staff.monthly_salary or 0
            
            # --- 퇴사월 일할 계산 (Proration) ---
            # Staff 모델에는 end_date 필드가 없음 — status="퇴사" + contract_end_date 조합으로 판단.
            # 정규직 계약갱신(status="재직"인데 contract_end_date가 과거)에서 오작동 방지를 위해 status도 함께 체크.
            if (
                staff.status == "퇴사"
                and staff.contract_end_date
                and staff.contract_end_date.strftime("%Y-%m") == req.month
            ):
                from calendar import monthrange
                days_in_month = monthrange(target_year, target_month)[1]
                worked_days = min(staff.contract_end_date.day, days_in_month)
                total_base_pay = int(total_base_pay * worked_days / days_in_month)
                
                work_breakdown.append({
                    "label": f"기본급 (중도퇴사 일할계산: {worked_days}일)",
                    "rate": staff.monthly_salary,
                    "hours": 0,
                    "days": worked_days,
                    "amount": total_base_pay,
                    "dates": f"{worked_days}/{days_in_month}일"
                })
            else:
                work_breakdown.append({
                    "label": "기본급 (정규직)",
                    "rate": total_base_pay,
                    "hours": 0,
                    "days": 0,
                    "amount": total_base_pay,
                    "dates": "월급여"
                })
        else:
            # For Part-time/Day-worker, calculate based on attendance
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

        # 2. Weekly Holiday Pay Calculation
        # WEEK SYSTEM: Sunday-to-Saturday (일~토)
        # - Weeks are grouped by their starting Sunday
        # - If the 1st of the month is NOT Sunday, the first week's Sunday
        #   falls in the previous month → include carryover workdays from prev month
        # - If the last week extends past the month end (Saturday in next month)
        #   and only a few workdays are in the current month → 익월정산
        
        next_month_1st = (target_month_dt + timedelta(days=32)).replace(day=1).date()
        last_day_of_month = next_month_1st - timedelta(days=1)

        # Group attendance by Sunday-start week
        def get_week_sunday(d):
            """Get the Sunday that starts the Sun-Sat week containing date d."""
            # Python weekday(): Mon=0, Tue=1, ..., Sun=6
            if d.weekday() == 6:  # Sunday
                return d
            return d - timedelta(days=d.weekday() + 1)
        
        weeks = {}  # sunday_date -> [Attendance]
        for att in all_attendances:
            sun = get_week_sunday(att.date)
            if sun not in weeks:
                weeks[sun] = []
            weeks[sun].append(att)
            
        total_holiday_pay = 0
        holiday_details = {}
        holiday_per_week = [0, 0, 0, 0, 0, 0]
        
        if staff.contract_type != "정규직":
            week_idx = 0
            first_of_month = target_month_dt.date()
            
            for sun in sorted(weeks.keys()):
                w_atts = weeks[sun]
                sat = sun + timedelta(days=6)  # Saturday of this week
                
                # Classify days
                month_days = [a for a in w_atts 
                              if a.date.year == target_year and a.date.month == target_month]
                prev_month_days = [a for a in w_atts 
                                   if a.date < first_of_month]
                month_work_days = [a for a in month_days if a.total_hours > 0]
                prev_work_days = [a for a in prev_month_days if a.total_hours > 0]
                
                # SKIP: Week is entirely before the target month (Saturday < 1st)
                if sat < first_of_month:
                    continue
                    
                # SKIP: Week starts after the last day of month (no overlap)
                if sun > last_day_of_month:
                    continue
                
                # SKIP: No workdays at all
                if not month_work_days and not prev_work_days:
                    continue
                
                # CASE 1: TRAILING INCOMPLETE WEEK
                # Sunday is in the target month, Saturday extends into next month,
                # and the week doesn't have enough days to form a complete work week
                # → Mark as "익월정산" for next month
                if sun >= first_of_month and sat > last_day_of_month:
                    if week_idx < 6:
                        day_count = len(month_work_days)
                        day_dates = ", ".join([str(a.date.day) for a in month_days if a.total_hours > 0])
                        next_m = next_month_1st.month
                        holiday_details[str(week_idx + 1)] = f"익월정산 ({day_dates}일, {day_count}일근무→{next_m}월 합산)"
                        holiday_per_week[week_idx] = 0
                        print(f"DEBUG: Sun-week {sun}~{sat} → {week_idx+1}주차: 익월정산 ({day_count} workdays)")
                    week_idx += 1
                    continue
                
                # CASE 2: LEADING CARRYOVER WEEK
                # Sunday is in the previous month, has carryover workdays from prev month
                is_carryover = sun < first_of_month and len(prev_work_days) > 0
                
                # Calculate effective hours: include carryover days if applicable
                calc_days = w_atts if is_carryover else month_days
                
                effective_hours_sum = 0
                for a in calc_days:
                    is_company_holiday = a.date in company_holidays
                    is_store_closed = a.status == "Holiday" or is_company_holiday
                    effective_h = 0 if is_store_closed else a.total_hours
                    effective_hours_sum += effective_h
                    
                w_hours = effective_hours_sum
                
                # Check for Absence - collect specific dates
                absence_dates = [a.date for a in calc_days if a.status == "Absence"]
                has_absence = len(absence_dates) > 0
                
                # Build detail string
                if is_carryover:
                    prev_h = sum(a.total_hours for a in prev_work_days)
                    month_h = sum(a.total_hours for a in month_work_days)
                    detail_prefix = f"전월이월{prev_h}h+당월{month_h}h="
                    print(f"DEBUG: Sun-week {sun}~{sat} → {week_idx+1}주차(이월): prev={prev_h}h + month={month_h}h = {w_hours}h")
                else:
                    detail_prefix = ""
                    print(f"DEBUG: Sun-week {sun}~{sat} → {week_idx+1}주차: {w_hours}h")

                if w_hours >= 15 and not has_absence:
                    avg_h = round(w_hours / 5, 2)
                    h_amt = int(avg_h * staff.hourly_wage)
                    total_holiday_pay += h_amt
                    print(f"  → Holiday Pay: {h_amt}")
                    if week_idx < 6:
                        holiday_per_week[week_idx] = h_amt
                    holiday_details[str(week_idx + 1)] = f"{detail_prefix}{w_hours}시간 / 5일 = {avg_h}시간"
                elif has_absence:
                    absence_desc = ", ".join([f"{a.month}월{a.day}일" for a in absence_dates])
                    holiday_details[str(week_idx + 1)] = f"자격미달 ({absence_desc} 결근)"
                
                week_idx += 1
        else:
            # For Regular staff, we can add a note in details
            holiday_details["info"] = "정규직은 월급에 주휴수당 포함"

        # 3. Deductions (Precise 2026 Logic)
        gross_pay = total_base_pay + total_holiday_pay
        
        # Non-taxable meal allowance (up to 200,000 KRW monthly)
        # Assuming for now that some part of the gross pay or a fixed bonus might be meal-related.
        # If the staff is 'Part-time' (아르바이트), they might not have a separate meal allowance,
        # but for regular staff, we could subtract up to 200k from the taxable base.
        meal_allowance = 0
        if staff.contract_type == "정규직":
            meal_allowance = min(gross_pay, 200000)
            
        taxable_income = max(0, gross_pay - meal_allowance)
        
        d_np, d_hi, d_ei, d_lti, d_it, d_lit = 0, 0, 0, 0, 0, 0
        
        if staff.contract_type == "사업소득자":
            # ── 사업소득자 (프리랜서 3.3% 원천징수) ──
            # 소득세: 지급총액 × 3.0%
            d_it = int(gross_pay * 0.03 / 10) * 10
            # 지방소득세: 소득세 × 10% (= 지급총액 × 0.3%)
            d_lit = int(d_it * 0.1 / 10) * 10
            # 4대보험 공제 없음 (직장가입자 아님)
        elif staff.contract_type == "정규직" or staff.insurance_4major:
            # 정규직 또는 4대보험 가입 직원: 4대보험 + 간이세액표 소득세
            insurances = calculate_insurances(
                taxable_income, 
                year=target_year,
                insurance_base=staff.insurance_base_salary or 0
            )
            # 국민연금 면제: 생년월일 기준 60세 이상 자동 면제 또는 수동 설정
            is_np_exempt = staff.np_exempt  # 수동 설정
            if not is_np_exempt and staff.birth_date:
                from dateutil.relativedelta import relativedelta
                payroll_date = date(target_year, target_month, 1)
                age = relativedelta(payroll_date, staff.birth_date).years
                if age >= 60:
                    is_np_exempt = True
            d_np = 0 if is_np_exempt else insurances["np"]
            d_hi = insurances["hi"]
            d_lti = insurances["lti"]
            d_ei = insurances["ei"]
            
            # 두루누리 사회보험 지원: NP/EI 80% 감면 (직원은 20%만 납부)
            if getattr(staff, 'durunnuri_support', False):
                d_np = int(d_np * 0.2 / 10) * 10
                d_ei = int(d_ei * 0.2 / 10) * 10
            
            # Precise Income Tax using dependents/children
            d_it = calculate_korean_income_tax(
                taxable_income, 
                dependents=staff.dependents_count or 1, 
                children=staff.children_count or 0
            )
            d_lit = int(d_it * 0.1 / 10) * 10
        else:
            # ── 일용직/아르바이트 (2026 법규 기준) ──
            # 1) 고용보험: 0.9% (일용직도 의무 가입)
            d_ei = int(gross_pay * 0.009 / 10) * 10
            
            # 2) 소득세: 일당 15만원 초과분에만 적용
            #    공식: (일급 - 150,000) × 6% × (1 - 55%) = 2.7%
            #    일당 15만원 이하면 소득세 0원
            #    ※ 시급제 아르바이트는 근무시간으로 일당 계산
            month_attendances = [a for a in all_attendances 
                                 if a.date.year == target_year and a.date.month == target_month]
            work_days = [a for a in month_attendances if a.total_hours > 0]
            
            daily_tax_total = 0
            for att in work_days:
                daily_wage = int(att.total_hours * (staff.hourly_wage or 0))
                if daily_wage > 150000:
                    # (일급 - 150,000) × 6% × 45% (= 55% 세액공제 후)
                    day_tax = int((daily_wage - 150000) * 0.06 * 0.45)
                    # 소액부징수: 1,000원 미만이면 미징수
                    if day_tax >= 1000:
                        daily_tax_total += day_tax
            
            d_it = int(daily_tax_total / 10) * 10  # 원 단위 절사
            d_lit = int(d_it * 0.1 / 10) * 10      # 지방소득세: 소득세의 10%
            
            # 국민연금/건강보험: 미가입 (insurance_4major=False일 때)
            d_np, d_hi, d_lti = 0, 0, 0

        # ── 4. 세무사 산출 기준(Overrides) 수동 덮어쓰기 적용 ──
        if req.overrides:
            if req.overrides.get('np') is not None: d_np = int(req.overrides['np'])
            if req.overrides.get('hi') is not None: d_hi = int(req.overrides['hi'])
            if req.overrides.get('lti') is not None: d_lti = int(req.overrides['lti'])
            if req.overrides.get('ei') is not None: d_ei = int(req.overrides['ei'])
            if req.overrides.get('it') is not None: d_it = int(req.overrides['it'])
            if req.overrides.get('lit') is not None: d_lit = int(req.overrides['lit'])
        
        # 5. 최종 금액 산출
        total_deductions = d_np + d_hi + d_ei + d_lti + d_it + d_lit
        net_pay = gross_pay - total_deductions
        
        # Save overrides if any
        if req.overrides:
            details['overrides'] = req.overrides
        
        # Tax Support (제세공과금 지원금) - 사업주 세금 대납
        tax_support = 0
        if getattr(staff, 'tax_support_enabled', False):
            # Company reimburses all deductions
            tax_support = total_deductions

        # 4. Save to Payroll Table
        details_json = json.dumps({
            "work_breakdown": work_breakdown,
            "holiday_details": holiday_details
        }, ensure_ascii=False)
        
        existing = service.session.exec(apply_bid_filter(select(Payroll), Payroll, bid).where(Payroll.staff_id == req.staff_id, Payroll.month == req.month)).first()
        # bid filter applied via select stmt above
        if not existing:
            existing = Payroll(staff_id=req.staff_id, month=req.month, business_id=bid)
            
        special_bonus = req.special_bonus or 0

        existing.base_pay = total_base_pay
        existing.bonus = total_holiday_pay
        existing.bonus_holiday = total_holiday_pay
        existing.bonus_special = special_bonus
        existing.holiday_w1, existing.holiday_w2, existing.holiday_w3, existing.holiday_w4, existing.holiday_w5, existing.holiday_w6 = holiday_per_week
        existing.deductions = total_deductions
        existing.deduction_np = d_np
        existing.deduction_hi = d_hi
        existing.deduction_ei = d_ei
        existing.deduction_lti = d_lti
        existing.deduction_it = d_it
        existing.deduction_lit = d_lit
        existing.bonus_tax_support = tax_support
        # 실수령액: 세금대납 시 공제를 사업주가 대납하므로 차감하지 않음
        if tax_support > 0:
            # 세금대납: 실수령 = 기본급 + 특별수당 + 주휴수당 + 세금대납 (공제 미차감, 사업주 별도납부)
            existing.total_pay = total_base_pay + special_bonus + total_holiday_pay + tax_support
        else:
            # 일반: 실수령 = 기본급 + 특별수당 + 주휴수당 - 공제
            existing.total_pay = total_base_pay + special_bonus + total_holiday_pay - total_deductions
        existing.details_json = details_json
        
        service.session.add(existing)
        service.session.commit()
        service.session.refresh(existing)
        
        # Auto-sync to MonthlyProfitLoss.expense_labor
        from routers.profitloss import sync_labor_cost
        sync_labor_cost(target_year, target_month, service.session, bid)
        
        print(f"DEBUG: Calculated Payroll: Base={total_base_pay}, Bonus={total_holiday_pay}, Total={net_pay}")
        
        return {"status": "success", "data": existing.model_dump()}
        
    finally:
        service.close()

@router.post("/import-insurance-base")
def import_insurance_base(
    entries: List[InsuranceBaseImport] = Body(...),
    admin: User = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
):
    """
    직장가입자 보수총액 통보서 기반 보수월액 일괄 설정.
    세무사가 제공한 전년도 보수총액과 근무월수로 보수월액을 산출하여 Staff 레코드에 저장합니다.
    """
    service = DatabaseService()
    try:
        results = []
        for entry in entries:
            # Find staff by ID or name
            if entry.staff_id:
                staff = service.session.get(Staff, entry.staff_id)
            else:
                stmt = select(Staff).where(Staff.name == entry.staff_name)
                stmt = apply_bid_filter(stmt, Staff, bid)
                staff = service.session.exec(stmt).first()
            
            if not staff:
                results.append({
                    "staff_name": entry.staff_name,
                    "status": "error",
                    "message": f"직원 '{entry.staff_name}'을(를) 찾을 수 없습니다."
                })
                continue
            
            if entry.months_worked <= 0:
                results.append({
                    "staff_name": staff.name,
                    "status": "error",
                    "message": "근무월수가 0 이하입니다."
                })
                continue
            
            # 보수월액 산출: 보수총액 ÷ 근무월수 → 천원 단위 반올림
            base_salary = round(entry.total_remuneration / entry.months_worked / 1000) * 1000
            
            old_value = staff.insurance_base_salary
            staff.insurance_base_salary = base_salary
            service.session.add(staff)
            
            results.append({
                "staff_name": staff.name,
                "staff_id": staff.id,
                "status": "success",
                "total_remuneration": entry.total_remuneration,
                "months_worked": entry.months_worked,
                "old_insurance_base": old_value,
                "new_insurance_base": base_salary,
            })
        
        service.session.commit()
        return {"status": "success", "results": results}
    finally:
        service.close()

@router.get("/staff/{staff_id}/{month}")
def get_staff_payroll(staff_id: int, month: str, bid = Depends(get_bid_from_token)):
    """Staff-accessible payroll data for a specific month"""
    service = DatabaseService()
    try:
        stmt = select(Payroll).where(Payroll.staff_id == staff_id, Payroll.month == month)
        stmt = apply_bid_filter(stmt, Payroll, bid)
        payroll = service.session.exec(stmt).first()
        if not payroll:
            return {"status": "not_found"}
        
        staff = service.session.get(Staff, staff_id)
        details = json.loads(payroll.details_json) if payroll.details_json else {}
        
        return {
            "status": "success",
            "data": {
                "month": payroll.month,
                "staff_name": staff.name if staff else "",
                "contract_type": staff.contract_type if staff else "",
                "hourly_wage": staff.hourly_wage if staff else 0,
                "base_pay": payroll.base_pay,
                "holiday_pay": payroll.bonus_holiday,
                "holiday_w1": payroll.holiday_w1,
                "holiday_w2": payroll.holiday_w2,
                "holiday_w3": payroll.holiday_w3,
                "holiday_w4": payroll.holiday_w4,
                "holiday_w5": payroll.holiday_w5,
                "holiday_w6": payroll.holiday_w6,
                "gross_pay": (payroll.base_pay or 0) + (payroll.bonus_holiday or 0),
                "deduction_np": payroll.deduction_np,
                "deduction_hi": payroll.deduction_hi,
                "deduction_ei": payroll.deduction_ei,
                "deduction_lti": payroll.deduction_lti,
                "deduction_it": payroll.deduction_it,
                "deduction_lit": payroll.deduction_lit,
                "total_deductions": payroll.deductions,
                "net_pay": (payroll.base_pay or 0) + (payroll.bonus_holiday or 0) - (payroll.deductions or 0),
                "tax_support": payroll.bonus_tax_support,
                "total_pay": payroll.total_pay,
                "overrides": details.get("overrides", {}),
                "work_breakdown": details.get("work_breakdown", []),
                "holiday_details": details.get("holiday_details", {}),
                "bank_name": staff.bank_name if staff else "",
                "account_number": staff.account_number if staff else "",
                "account_holder": staff.account_holder if staff else "",
                "transfer_status": payroll.transfer_status,
            }
        }
    finally:
        service.close()

@router.post("/send-attendance-request")
def send_attendance_request(staff_id: int = Body(..., embed=True), month: str = Body(..., embed=True), admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff or not staff.phone:
            raise HTTPException(status_code=400, detail="Staff not found or phone number missing")
            
        # Link to staff portal / dashboard where they can see attendance
        link = f"{FRONTEND_URL}/dashboard"
        
        result = NotificationService.send_attendance_request(
            phone_num=staff.phone,
            staff_name=staff.name,
            month=month,
            link=link
        )
        return {"status": "success", "solapi_result": result}
    finally:
        service.close()

@router.post("/send-statement")
def send_payroll_statement(staff_id: int = Body(..., embed=True), month: str = Body(..., embed=True), admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff or not staff.phone:
            raise HTTPException(status_code=400, detail="Staff not found or phone number missing")
            
        # Link to the specific payroll statement (payslip) for the month
        link = f"{FRONTEND_URL}/payroll-statement/{staff_id}/{month}"
        
        result = NotificationService.send_payroll_statement(
            phone_num=staff.phone,
            staff_name=staff.name,
            month=month,
            link=link
        )
        return {"status": "success", "solapi_result": result}
    finally:
        service.close()

@router.get("/transfer/biz-account")
def get_biz_account(admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    return {"status": "success", "data": BankingService.get_biz_account()}

@router.put("/transfer/biz-account")
def update_biz_account(data: dict = Body(...), admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    success = BankingService.update_biz_account(
        bank=data.get("bank", ""),
        number=data.get("number", ""),
        holder=data.get("holder", "")
    )
    if success:
        return {"status": "success", "message": "Business account updated"}
    raise HTTPException(status_code=500, detail="Failed to update business account")

@router.post("/transfer/{payroll_id}")
def execute_transfer(payroll_id: int, admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    result = BankingService.execute_payroll_transfer(payroll_id)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.put("/{payroll_id}/status")
def update_payroll_status(payroll_id: int, body: dict = Body(...), admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """지급 상태 수동 변경 (지급완료/지급대기)"""
    new_status = body.get("transfer_status")
    if new_status not in ("완료", "대기"):
        raise HTTPException(status_code=400, detail="상태는 '완료' 또는 '대기'만 가능합니다.")
    service = DatabaseService()
    try:
        payroll = service.session.get(Payroll, payroll_id)
        if not payroll:
            raise HTTPException(status_code=404, detail="급여 기록을 찾을 수 없습니다.")
        payroll.transfer_status = new_status
        service.session.commit()
        return {"status": "success", "message": f"지급 상태가 '{('지급완료' if new_status == '완료' else '지급대기')}'(으)로 변경되었습니다."}
    finally:
        service.session.close()

@router.post("/transfer/bulk-data")
def get_bulk_transfer_data(payroll_ids: List[int] = Body(..., embed=True), admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    data = BankingService.get_bulk_transfer_data(payroll_ids)
    return {"status": "success", "data": data}

@router.get("/calc-insurance-base/{staff_id}")
def calc_insurance_base_salary(staff_id: int, year: int = None, admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """
    보수월액 자동 산출 (건강보험·국민연금 정기결정 방식)
    
    기존 직원: 전년도 총 보수(비과세 제외) ÷ 근무월수 → 천원 단위 반올림
    신규 직원: 시급 × 주당 예상시간 × 52.14 ÷ 12 또는 월급
    """
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
        
        # 기준년도: default = 올해 (전년도 데이터 사용)
        if year is None:
            year = date.today().year
        prev_year = year - 1
        
        # 전년도 급여 데이터 조회
        payrolls = service.session.exec(
            apply_bid_filter(select(Payroll), Payroll, bid).where(
                Payroll.staff_id == staff_id,
                Payroll.month >= f"{prev_year}-01",
                Payroll.month <= f"{prev_year}-12"
            )
        ).all()
        
        method = ""
        breakdown = {}
        
        if payrolls and len(payrolls) >= 1:
            # === 정기결정 방식: 전년도 실적 기반 ===
            months_worked = len(payrolls)
            total_gross = 0
            total_non_taxable = 0
            
            for p in payrolls:
                gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
                total_gross += gross
                # 비과세: 식대 200,000원 (정규직만)
                if staff.contract_type == "정규직":
                    total_non_taxable += 200000
            
            taxable_total = total_gross - total_non_taxable
            base_salary = round(taxable_total / months_worked / 1000) * 1000  # 천원 단위 반올림
            
            method = "정기결정 (전년도 실적)"
            breakdown = {
                "기준년도": prev_year,
                "근무월수": months_worked,
                "총보수": total_gross,
                "비과세합계": total_non_taxable,
                "과세보수합계": taxable_total,
                "산출보수월액": base_salary,
            }
        else:
            # === 취득시결정 방식: 예상 소득 기반 ===
            if staff.contract_type == "정규직" and staff.monthly_salary > 0:
                # 정규직: 월급 - 비과세(식대 20만)
                base_salary = round((staff.monthly_salary - 200000) / 1000) * 1000
                method = "취득시결정 (월급 기준)"
                breakdown = {
                    "월급": staff.monthly_salary,
                    "비과세(식대)": 200000,
                    "산출보수월액": base_salary,
                }
            elif staff.hourly_wage > 0:
                # 시급제: 시급 × 주당 예상시간 × 52.14 / 12
                # 주당 시간 추정: 올해 데이터 사용 가능하면 평균, 아니면 40시간 기본
                current_payrolls = service.session.exec(
                    apply_bid_filter(select(Payroll), Payroll, bid).where(
                        Payroll.staff_id == staff_id,
                        Payroll.month >= f"{year}-01",
                        Payroll.month <= f"{year}-12"
                    )
                ).all()
                
                if current_payrolls:
                    # 올해 데이터로 월평균 추정
                    total_gross = sum((p.base_pay or 0) + (p.bonus_holiday or 0) for p in current_payrolls)
                    avg_monthly = total_gross / len(current_payrolls)
                    base_salary = round(avg_monthly / 1000) * 1000
                    method = f"취득시결정 (올해 {len(current_payrolls)}개월 평균)"
                    breakdown = {
                        "올해총보수": total_gross,
                        "근무월수": len(current_payrolls),
                        "월평균": int(avg_monthly),
                        "산출보수월액": base_salary,
                    }
                else:
                    # 시급 기반 추정 (주 40시간 기준)
                    weekly_hours = 40
                    annual_est = staff.hourly_wage * weekly_hours * 52.14
                    base_salary = round(annual_est / 12 / 1000) * 1000
                    method = "취득시결정 (시급×40h 추정)"
                    breakdown = {
                        "시급": staff.hourly_wage,
                        "주당시간(추정)": weekly_hours,
                        "연간추정": int(annual_est),
                        "산출보수월액": base_salary,
                    }
            else:
                return {
                    "status": "error",
                    "message": "급여 데이터가 부족하여 보수월액을 산출할 수 없습니다."
                }
        
        # 국민연금 상·하한 (2026년 기준)
        NP_MIN = 370000
        NP_MAX = 6170000
        capped = max(NP_MIN, min(base_salary, NP_MAX))
        if capped != base_salary:
            breakdown["상하한적용"] = f"{base_salary:,} → {capped:,}"
        
        return {
            "status": "success",
            "data": {
                "insurance_base_salary": base_salary,
                "method": method,
                "breakdown": breakdown,
            }
        }
    finally:
        service.close()
