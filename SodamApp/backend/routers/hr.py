from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from services.database_service import DatabaseService
from models import Staff, Attendance, StaffDocument
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import shutil
import os
from sqlmodel import select, col

router = APIRouter()

# --- Pydantic Models ---

class StaffCreate(BaseModel):
    name: str
    role: str
    hourly_wage: int
    bank_account: Optional[str] = None
    email: Optional[str] = None
    start_date: date = date.today()
    nationality: str = "South Korea"
    visa_type: Optional[str] = None
    dependents_count: int = 1
    children_count: int = 0

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    hourly_wage: Optional[int] = None
    bank_account: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contract_type: Optional[str] = None
    insurance_4major: Optional[bool] = None
    monthly_salary: Optional[int] = None
    work_schedule: Optional[str] = None
    doc_contract: Optional[bool] = None
    doc_health_cert: Optional[bool] = None
    doc_id_copy: Optional[bool] = None
    doc_bank_copy: Optional[bool] = None
    nationality: Optional[str] = None
    visa_type: Optional[str] = None
    address: Optional[str] = None
    resident_number: Optional[str] = None
    dependents_count: Optional[int] = None
    children_count: Optional[int] = None
    
    # Contract Details
    contract_start_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    rest_start_time: Optional[str] = None
    rest_end_time: Optional[str] = None
    working_days: Optional[str] = None
    weekly_holiday: Optional[str] = None
    job_description: Optional[str] = None
    bonus_enabled: Optional[bool] = None
    bonus_amount: Optional[str] = None
    salary_payment_date: Optional[str] = None
    salary_payment_method: Optional[str] = None

class AttendanceAction(BaseModel):
    staff_id: int
    action: str # "checkin" or "checkout"

# --- Endpoints ---

@router.get("/staff")
def get_all_staff(q: Optional[str] = None, status: Optional[str] = None):
    service = DatabaseService()
    try:
        stmt = select(Staff)
        
        # Apply Status Filter if Provided
        if status:
            stmt = stmt.where(Staff.status == status)
        elif not q:
            # Default: If no status AND no query, show only Active
            stmt = stmt.where(Staff.status == "재직")
            
        # Apply Search Query
        if q:
            stmt = stmt.where(col(Staff.name).contains(q))
            
        staffs = service.session.exec(stmt).all()
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
            start_date=staff.start_date,
            nationality=staff.nationality,
            visa_type=staff.visa_type
        )
        service.session.add(new_staff)
        service.session.commit()
        return {"status": "success", "message": "Staff created"}
    finally:
        service.close()

@router.get("/staff/{staff_id}")
def get_staff_detail(staff_id: int):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
            
        # Fetch Documents
        documents = service.session.exec(select(StaffDocument).where(StaffDocument.staff_id == staff_id)).all()
        
        # Fetch Contracts
        from models import ElectronicContract
        contracts = service.session.exec(select(ElectronicContract).where(ElectronicContract.staff_id == staff_id)).all()
        
        # Fetch User Account
        from models import User, Payroll
        user_account = service.session.exec(select(User).where(User.staff_id == staff_id)).first()
        user_info = {
            "id": user_account.id,
            "username": user_account.username,
            "grade": user_account.grade
        } if user_account else None

        # Fetch Payrolls
        payrolls = service.session.exec(select(Payroll).where(Payroll.staff_id == staff_id)).all()

        return {
            "status": "success", 
            "data": staff, 
            "documents": documents, 
            "payrolls": payrolls, 
            "contracts": contracts,
            "user": user_info
        }
    finally:
        service.close()

@router.put("/staff/{staff_id}")
def update_staff(staff_id: int, update_data: StaffUpdate):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
            
        update_dict = update_data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(staff, key, value)
            
        service.session.add(staff)
        service.session.commit()
        service.session.refresh(staff)
        return {"status": "success", "data": staff}
    finally:
        service.close()

@router.post("/staff/{staff_id}/account")
def create_staff_account(
    staff_id: int, 
    username: str = Body(..., embed=True), 
    password: str = Body(..., embed=True),
    grade: str = Body("normal", embed=True)
):
    from models import User
    from routers.auth import get_password_hash
    service = DatabaseService()
    try:
        # Check if username exists
        existing = service.session.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
            
        # Check if staff already has account
        staff_account = service.session.exec(select(User).where(User.staff_id == staff_id)).first()
        if staff_account:
            raise HTTPException(status_code=400, detail="Staff already has an account")
            
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            role="staff",
            grade=grade,
            staff_id=staff_id
        )
        service.session.add(new_user)
        service.session.commit()
        return {"status": "success", "message": "Account created successfully"}
    finally:
        service.close()

@router.put("/staff/{staff_id}/account/grade")
def update_staff_account_grade(
    staff_id: int,
    grade: str = Body(..., embed=True)
):
    from models import User
    service = DatabaseService()
    try:
        user_account = service.session.exec(select(User).where(User.staff_id == staff_id)).first()
        if not user_account:
            raise HTTPException(status_code=404, detail="User account not found for this staff")
            
        user_account.grade = grade
        service.session.add(user_account)
        service.session.commit()
        return {"status": "success", "message": "Grade updated successfully"}
    finally:
        service.close()

@router.post("/staff/{staff_id}/document")

def upload_staff_document(
    staff_id: int, 
    doc_type: str = Form(...), 
    file: UploadFile = File(...)
):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
            
        # Determine Save Path
        base_dir = "uploads/staff_docs"
        staff_dir = os.path.join(base_dir, str(staff_id))
        os.makedirs(staff_dir, exist_ok=True)
        
        # Save File
        timestamp = int(datetime.now().timestamp())
        filename = f"{doc_type}_{timestamp}_{file.filename}"
        file_path = os.path.join(staff_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Save to DB
        new_doc = StaffDocument(
            staff_id=staff_id,
            doc_type=doc_type,
            file_path=file_path, # relative path or full? standardizing on relative for portability usually
            original_filename=file.filename
        )
        service.session.add(new_doc)
        
        # Update Staff CheckBox
        attr_name = f"doc_{doc_type}"
        if hasattr(staff, attr_name):
            setattr(staff, attr_name, True)
            service.session.add(staff)
            
        service.session.commit()
        
        # Return URL-friendly path if needed, or just path
        # Frontend will need to prepend server URL
        return {"status": "success", "file_path": file_path, "filename": filename}
    finally:
        service.close()

@router.post("/attendance")
def log_attendance(payload: AttendanceAction):
    service = DatabaseService()
    try:
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

@router.get("/attendance/status/{staff_id}")
def get_attendance_status(staff_id: int):
    service = DatabaseService()
    try:
        today = date.today()
        stmt = select(Attendance).where(Attendance.staff_id == staff_id, Attendance.date == today)
        record = service.session.exec(stmt).first()
        
        if not record:
            return {"status": "success", "data": {"checked_in": False, "checked_out": False}}
        
        return {
            "status": "success", 
            "data": {
                "checked_in": record.check_in is not None,
                "checked_out": record.check_out is not None,
                "check_in_time": record.check_in,
                "check_out_time": record.check_out
            }
        }
    finally:
        service.close()

@router.get("/attendance/history/{staff_id}")
def get_attendance_history(staff_id: int):
    service = DatabaseService()
    try:
        # Get last 5 records
        stmt = select(Attendance).where(Attendance.staff_id == staff_id).order_by(Attendance.date.desc()).limit(5)
        records = service.session.exec(stmt).all()
        return {"status": "success", "data": records}
    finally:
        service.close()

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int):
    service = DatabaseService()
    try:
        staff = service.session.get(Staff, staff_id)
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
            
        # 1. Delete Documents and Files
        documents = service.session.exec(select(StaffDocument).where(StaffDocument.staff_id == staff_id)).all()
        for doc in documents:
            if os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                except Exception as e:
                    print(f"Error deleting file {doc.file_path}: {e}")
            service.session.delete(doc)
            
        # Clean up staff doc directory if empty
        base_dir = "uploads/staff_docs"
        staff_dir = os.path.join(base_dir, str(staff_id))
        if os.path.exists(staff_dir):
            try:
                shutil.rmtree(staff_dir)
            except Exception as e:
                print(f"Error removing directory {staff_dir}: {e}")

        # 2. Delete Attendance
        attendances = service.session.exec(select(Attendance).where(Attendance.staff_id == staff_id)).all()
        for att in attendances:
            service.session.delete(att)
            
        # 3. Delete Payroll
        from models import Payroll
        payrolls = service.session.exec(select(Payroll).where(Payroll.staff_id == staff_id)).all()
        for pay in payrolls:
            service.session.delete(pay)
            
        # 4. Delete Staff Record
        service.session.delete(staff)
        
        service.session.commit()
        return {"status": "success", "message": "Staff and all related data deleted"}
    finally:
        service.close()

