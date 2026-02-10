from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import Staff, Attendance, Payroll, CompanyHoliday
from routers.payroll import calculate_payroll, PayrollCalculateRequest

# Mock request
req = PayrollCalculateRequest(staff_id=4, month="2026-01")

try:
    result = calculate_payroll(req)
    print("Result:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
