from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body, Depends
from fastapi.responses import FileResponse
import urllib.parse
from routers.auth import get_admin_user, get_current_user
from models import User as AuthUser
from services.database_service import DatabaseService
from models import Staff, Attendance, StaffDocument, WorkLocation
from services.geofence_service import verify_location
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import shutil
import os
from sqlmodel import select, col
from tenant_filter import get_bid_from_token, apply_bid_filter

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
    bank_name: Optional[str] = None  # 은행명
    account_number: Optional[str] = None  # 계좌번호
    account_holder: Optional[str] = None  # 예금주
    start_date: Optional[date] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contract_type: Optional[str] = None
    insurance_4major: Optional[bool] = None
    insurance_base_salary: Optional[int] = None  # 보수월액
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

    # Insurance & Tax Options
    np_exempt: Optional[bool] = None  # 국민연금 면제 (60세 이상)
    durunnuri_support: Optional[bool] = None  # 두루누리 지원 (NP/EI 80% 감면)
    tax_support_enabled: Optional[bool] = None  # 세금 대납 (사업주 부담)
    birth_date: Optional[date] = None  # 생년월일

class AttendanceAction(BaseModel):
    staff_id: int
    action: str  # "checkin" or "checkout"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# --- Endpoints ---

@router.get("/staff")
def get_all_staff(q: Optional[str] = None, status: Optional[str] = None, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        stmt = apply_bid_filter(select(Staff), Staff, bid)
        
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
def create_staff(staff: StaffCreate, _admin: AuthUser = Depends(get_admin_user)):
    # Auto-assign business_id from admin
    staff_business_id = _admin.business_id if _admin.role != "superadmin" else None
    service = DatabaseService()
    try:
        new_staff = Staff(
            name=staff.name,
            role=staff.role,
            hourly_wage=staff.hourly_wage,
            bank_account=staff.bank_account,
            start_date=staff.start_date,
            nationality=staff.nationality,
            visa_type=staff.visa_type,
            business_id=staff_business_id or _admin.business_id
        )
        service.session.add(new_staff)
        service.session.commit()
        return {"status": "success", "message": "Staff created"}
    finally:
        service.close()

@router.get("/staff/{staff_id}")
def get_staff_detail(staff_id: int, _admin: AuthUser = Depends(get_admin_user)):
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
def update_staff(staff_id: int, update_data: StaffUpdate, _admin: AuthUser = Depends(get_admin_user)):
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
    grade: str = Body("normal", embed=True),
    _admin: AuthUser = Depends(get_admin_user)
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
            
        # Get staff name for real_name
        staff = service.session.get(Staff, staff_id)
        
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            role="staff",
            grade=grade,
            staff_id=staff_id,
            real_name=staff.name if staff else None,
            business_id=staff.business_id if staff else _admin.business_id
        )
        service.session.add(new_user)
        service.session.commit()
        return {"status": "success", "message": "Account created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        detail = str(e)
        if "UNIQUE" in detail.upper() or "unique" in detail:
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디이거나, 해당 직원에게 이미 계정이 있습니다.")
        raise HTTPException(status_code=500, detail="계정 생성 중 오류가 발생했습니다.")
    finally:
        service.close()

@router.put("/staff/{staff_id}/account/grade")
def update_staff_account_grade(
    staff_id: int,
    grade: str = Body(..., embed=True),
    _admin: AuthUser = Depends(get_admin_user)
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

@router.get("/staff/{staff_id}/documents")
def get_staff_documents(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        documents = service.session.exec(
            select(StaffDocument).where(StaffDocument.staff_id == staff_id)
        ).all()
        return {
            "status": "success",
            "data": [
                {
                    "id": doc.id,
                    "doc_type": doc.doc_type,
                    "original_filename": doc.original_filename,
                    "file_path": doc.file_path,
                    "uploaded_at": doc.upload_date.isoformat() if doc.upload_date else None,
                }
                for doc in documents
            ]
        }
    finally:
        service.close()

@router.post("/staff/{staff_id}/document")

def upload_staff_document(
    staff_id: int, 
    doc_type: str = Form(...), 
    file: UploadFile = File(...),
    _user: AuthUser = Depends(get_current_user),
    bid = Depends(get_bid_from_token)
):
    from services.storage_service import get_storage
    storage = get_storage()
    
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Generate storage key
        timestamp = int(datetime.now().timestamp())
        filename = f"{doc_type}_{timestamp}_{file.filename}"
        storage_key = f"staff_docs/{staff_id}/{filename}"
        
        # Upload to R2 (or local disk fallback)
        file_url = storage.upload_file(file.file, storage_key, file.content_type)
            
        # Save to DB
        new_doc = StaffDocument(
            staff_id=staff_id,
            doc_type=doc_type,
            file_path=file_url,  # R2 public URL or local path
            original_filename=file.filename
        )
        service.session.add(new_doc)
        
        # Update Staff CheckBox
        attr_name = f"doc_{doc_type}"
        if hasattr(staff, attr_name):
            setattr(staff, attr_name, True)
            service.session.add(staff)
            
        service.session.commit()
        
        return {"status": "success", "file_path": file_url, "filename": filename}
    finally:
        service.close()

@router.get("/staff/doc-file/{staff_id}/{filename:path}")
def serve_staff_document(staff_id: int, filename: str):
    """Serve uploaded staff document files (handles Korean filenames)"""
    import mimetypes
    # Decode the filename in case it's URL-encoded
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join("uploads", "staff_docs", str(staff_id), decoded_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    media_type, _ = mimetypes.guess_type(file_path)
    if not media_type:
        media_type = "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
    )

@router.delete("/staff/{staff_id}/document/{doc_id}")
def delete_staff_document(
    staff_id: int,
    doc_id: int,
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        doc = service.session.get(StaffDocument, doc_id)
        if not doc or doc.staff_id != staff_id:
            raise HTTPException(status_code=404, detail="Document not found")

        # Delete physical file
        try:
            if os.path.exists(doc.file_path):
                os.remove(doc.file_path)
        except Exception:
            pass

        doc_type = doc.doc_type
        service.session.delete(doc)

        # Check if there are remaining documents of the same type
        remaining = service.session.exec(
            select(StaffDocument).where(
                StaffDocument.staff_id == staff_id,
                StaffDocument.doc_type == doc_type
            )
        ).first()

        # If no remaining docs of this type, uncheck the staff flag
        if not remaining:
            staff = service.session.get(Staff, staff_id)
            if staff:
                attr_name = f"doc_{doc_type}"
                if hasattr(staff, attr_name):
                    setattr(staff, attr_name, False)
                    service.session.add(staff)

        service.session.commit()
        return {"status": "success", "message": "Document deleted"}
    finally:
        service.close()

from routers.auth import get_current_user, get_tenant_bid
from tenant_filter import get_bid_from_token, apply_bid_filter

@router.post("/attendance")
def log_attendance(payload: AttendanceAction, _user: AuthUser = Depends(get_current_user)):
    service = DatabaseService()
    try:
        today = date.today()
        now_time = datetime.now().time()
        
        # --- GPS Geofence 검증 ---
        gps_result = None
        if payload.latitude is not None and payload.longitude is not None:
            gps_result = verify_location(payload.latitude, payload.longitude, service.session, _user.business_id)
            if not gps_result["verified"]:
                return {
                    "status": "error",
                    "message": gps_result["message"],
                    "gps": gps_result
                }
        
        # Check if record exists for today
        stmt = select(Attendance).where(Attendance.staff_id == payload.staff_id, Attendance.date == today)
        record = service.session.exec(stmt).first()
        
        if payload.action == "checkin":
            if record:
                print(f"[ATTENDANCE] Duplicate check-in blocked for staff_id={payload.staff_id} on {today}, existing record id={record.id}")
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
            service.session.add(new_record)
        
        elif payload.action == "checkout":
            if not record: return {"status": "error", "message": "출근 기록이 없습니다."}
            record.check_out = now_time
            record.check_out_lat = payload.latitude
            record.check_out_lng = payload.longitude
            record.check_out_verified = gps_result["verified"] if gps_result else False
            record.check_out_distance = gps_result["distance"] if gps_result else None
            # Calculate hours
            start_dt = datetime.combine(today, record.check_in)
            end_dt = datetime.combine(today, now_time)
            duration = (end_dt - start_dt).total_seconds() / 3600
            record.total_hours = round(duration, 2)
            service.session.add(record)
            
        try:
            service.session.commit()
        except Exception as e:
            import traceback
            print(f"[ATTENDANCE ERROR] {type(e).__name__}: {str(e)}")
            traceback.print_exc()
            service.session.rollback()
            error_msg = str(e)
            if "IntegrityError" in type(e).__name__ or "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                return {"status": "error", "message": "이미 출근 기록이 있습니다. (중복 데이터)"}
            raise HTTPException(status_code=500, detail=f"출퇴근 기록 중 오류: {error_msg}")
        return {
            "status": "success",
            "gps": gps_result,
            "message": "출근이 기록되었습니다." if payload.action == "checkin" else f"퇴근이 기록되었습니다. (근무시간: {record.total_hours if payload.action == 'checkout' else 0}시간)"
        }
    finally:
        service.close()

@router.get("/attendance/status/{staff_id}")
def get_attendance_status(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
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
                "check_out_time": record.check_out,
                "check_in_verified": record.check_in_verified,
                "check_out_verified": record.check_out_verified,
                "check_in_distance": record.check_in_distance,
                "check_out_distance": record.check_out_distance,
            }
        }
    finally:
        service.close()

@router.get("/attendance/history/{staff_id}")
def get_attendance_history(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        # Get last 5 records
        stmt = select(Attendance).where(Attendance.staff_id == staff_id).order_by(Attendance.date.desc()).limit(5)
        records = service.session.exec(stmt).all()
        return {"status": "success", "data": records}
    finally:
        service.close()

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
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

# --- 매장 위치 관리 (Geofence) ---

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: int = 100

@router.get("/location")
def get_work_location(_admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """현재 매장 위치 설정 조회"""
    service = DatabaseService()
    try:
        stmt = apply_bid_filter(select(WorkLocation), WorkLocation, bid).where(WorkLocation.is_active == True)
        location = service.session.exec(stmt).first()
        if not location:
            return {"status": "success", "data": None, "message": "매장 위치가 설정되지 않았습니다."}
        return {
            "status": "success",
            "data": {
                "id": location.id,
                "name": location.name,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "radius_meters": location.radius_meters,
                "is_active": location.is_active,
            }
        }
    finally:
        service.close()

@router.post("/location")
def set_work_location(data: LocationUpdate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """매장 위치 설정 (생성 또는 업데이트)"""
    service = DatabaseService()
    try:
        stmt = apply_bid_filter(select(WorkLocation), WorkLocation, bid).where(WorkLocation.is_active == True)
        existing = service.session.exec(stmt).first()
        
        if existing:
            existing.latitude = data.latitude
            existing.longitude = data.longitude
            existing.radius_meters = data.radius_meters
            if data.name:
                existing.name = data.name
            service.session.add(existing)
        else:
            new_loc = WorkLocation(
                name=data.name or "소담김밥",
                latitude=data.latitude,
                longitude=data.longitude,
                radius_meters=data.radius_meters,
                business_id=bid
            )
            service.session.add(new_loc)
        
        service.session.commit()
        return {"status": "success", "message": f"매장 위치가 설정되었습니다. (반경 {data.radius_meters}m)"}
    finally:
        service.close()

# --- 월간 근무 요약 ---

@router.get("/attendance/monthly-summary/{staff_id}/{month}")
def get_monthly_attendance_summary(staff_id: int, month: str, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token)):
    """
    월간 출퇴근 요약 (근무일수, 총 근무시간, GPS 검증율, 예상 급여)
    month = "YYYY-MM"
    """
    service = DatabaseService()
    try:
        staff = service.session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
        
        from datetime import timedelta
        target = datetime.strptime(f"{month}-01", "%Y-%m-%d")
        year, m = target.year, target.month
        
        # Date range for the month
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
        records = service.session.exec(stmt).all()
        
        total_days = len([r for r in records if r.total_hours > 0])
        total_hours = sum(r.total_hours for r in records)
        verified_count = sum(1 for r in records if r.check_in_verified)
        
        # Daily breakdown
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
        
        # Estimated pay
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
    finally:
        service.close()


# --- 퇴직금 관리 ---

class RetirementPaymentCreate(BaseModel):
    staff_id: int
    end_date: date               # 퇴사일
    paid_amount: int = 0         # 실제 지급액
    payment_date: Optional[date] = None
    payment_method: str = "계좌이체"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    note: Optional[str] = None

class RetirementPaymentUpdate(BaseModel):
    paid_amount: Optional[int] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None


def _calc_accrued_retirement(staff, end_date):
    """퇴직금 적립액 계산 + P/L에 이미 반영된 적립액 합산"""
    from models import Payroll
    from database import engine as _engine
    from sqlmodel import Session as _Session
    
    start = staff.start_date
    work_days = (end_date - start).days
    
    with _Session(_engine) as s:
        payrolls = s.exec(
            select(Payroll).where(Payroll.staff_id == staff.id).order_by(Payroll.month.desc())
        ).all()
    
    # P/L에 이미 반영된 적립액 (매월 Payroll에서 expense_retirement로 잡힌 금액)
    # 퇴직금 적립 = 해당 직원의 총급여 × 약 1/12 (실제 P/L에 반영된 퇴직금 비용)
    pl_accrued = 0
    for p in payrolls:
        # Payroll에 retirement 필드가 있으면 사용, 없으면 total_pay의 약 8.33% 추정
        if hasattr(p, 'retirement_pay') and p.retirement_pay:
            pl_accrued += p.retirement_pay
        else:
            pl_accrued += int(p.total_pay * 0.0833)  # 1/12
    
    # 법적 퇴직금 (1년 이상 시 평균임금 계산)
    legal_retirement = 0
    breakdown = {}
    if work_days >= 365 and payrolls:
        # 최근 3개월 분의 급여 총합 산출 (Gross Pay = base + holiday + meal)
        recent = payrolls[:3]
        total_gross = sum((p.base_pay or 0) + (p.bonus_holiday or 0) + (p.bonus_meal or 0) for p in recent)
        
        # 정확한 일수 계산 (사직일로부터 3개월 전)
        from dateutil.relativedelta import relativedelta
        start_3m_date = end_date - relativedelta(months=3)
        exact_days = (end_date - start_3m_date).days
        if exact_days == 0: exact_days = 90
        
        daily_wage = total_gross / exact_days
        legal_retirement = int(daily_wage * 30 * work_days / 365)
        
        breakdown = {
            "total_gross_3m": total_gross,
            "exact_days_3m": exact_days,
            "daily_wage": int(daily_wage),
            "recent_months": [p.month for p in recent]
        }
    elif work_days >= 365:
        # 출근 기록/급여 기록이 없을 경우 (Fallback)
        avg_monthly = staff.hourly_wage if staff.hourly_wage >= 100000 else staff.hourly_wage * 209
        daily_wage = avg_monthly / 30
        legal_retirement = int(daily_wage * 30 * work_days / 365)
        
        breakdown = {
            "total_gross_3m": avg_monthly * 3,
            "exact_days_3m": 90,
            "daily_wage": int(daily_wage),
            "recent_months": ["기록없음(기본급추정)"]
        }
    
    return legal_retirement, work_days, pl_accrued, breakdown


@router.get("/retirement")
def get_retirement_list(_admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """퇴직금 현황 조회 (퇴사자 + 기존 지급 기록)"""
    from models import RetirementPayment
    from sqlmodel import Session as _Session
    from database import engine as _engine
    
    with _Session(_engine) as session:
        # 퇴사자 목록
        resigned = session.exec(
            apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "퇴사")
        ).all()
        
        # 기존 지급 기록
        payments = session.exec(
            apply_bid_filter(select(RetirementPayment), RetirementPayment, bid)
        ).all()
        payment_by_staff = {p.staff_id: p for p in payments}
        
        result = []
        for staff in resigned:
            payment = payment_by_staff.get(staff.id)
            
            if payment:
                # payment does not store breakdown, we recalculate it for display
                legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, payment.end_date)
                
                result.append({
                    "staff_id": staff.id,
                    "staff_name": staff.name,
                    "start_date": str(staff.start_date),
                    "end_date": str(payment.end_date),
                    "work_days": payment.work_days,
                    "accrued_amount": payment.accrued_amount,
                    "paid_amount": payment.paid_amount,
                    "difference": payment.difference,
                    "payment_date": str(payment.payment_date) if payment.payment_date else None,
                    "status": payment.status,
                    "payment_id": payment.id,
                    "note": payment.note,
                    "pl_accrued": getattr(payment, 'pl_accrued', 0),
                    "under_one_year": payment.work_days < 365,
                    "breakdown": breakdown
                })
            else:
                # 아직 지급 기록 없음 → 자동 산정
                legal, work_days, pl_accrued, breakdown = _calc_accrued_retirement(staff, date.today())
                result.append({
                    "staff_id": staff.id,
                    "staff_name": staff.name,
                    "start_date": str(staff.start_date),
                    "end_date": None,
                    "work_days": work_days,
                    "accrued_amount": legal,
                    "paid_amount": 0,
                    "difference": 0,
                    "payment_date": None,
                    "status": "미등록",
                    "payment_id": None,
                    "note": None,
                    "pl_accrued": pl_accrued,
                    "under_one_year": work_days < 365,
                    "breakdown": breakdown
                })
        
        return {"status": "success", "data": result}


@router.get("/retirement/calc/{staff_id}")
def get_retirement_calculation_detail(staff_id: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """PDF 출력을 위한 구체적인 퇴직금 산정 내역 리턴"""
    from models import RetirementPayment
    from sqlmodel import Session as _Session
    from database import engine as _engine
    
    with _Session(_engine) as session:
        staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
            
        payment = session.exec(apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(RetirementPayment.staff_id == staff_id)).first()
        calc_end_date = payment.end_date if payment else (staff.end_date or date.today())
        
        legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date)
        
        # Pay history
        payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff_id).order_by(Payroll.month.desc()).limit(4)).all()
        
        from dateutil.relativedelta import relativedelta
        start_3m_date = calc_end_date - relativedelta(months=3)
        
        history = []
        for p in payrolls:
            # We approximate the exact days included by looking at the month string
            try:
                p_month_dt = datetime.strptime(f"{p.month}-01", "%Y-%m-%d").date()
                from calendar import monthrange
                last_day = monthrange(p_month_dt.year, p_month_dt.month)[1]
                p_end = date(p_month_dt.year, p_month_dt.month, last_day)
                
                # Intersection with [start_3m_date, calc_end_date]
                i_start = max(start_3m_date, p_month_dt)
                i_end = min(calc_end_date, p_end)
                
                if i_start <= i_end:
                    days_in_period = (i_end - i_start).days + 1
                    
                    history.append({
                        "period": f"{i_start.strftime('%Y-%m-%d')} ~ {i_end.strftime('%Y-%m-%d')}",
                        "days": days_in_period,
                        "base_pay": int((p.base_pay or 0) * days_in_period / last_day) if i_start > p_month_dt or i_end < p_end else (p.base_pay or 0),
                        "meal_pay": int((p.bonus_meal or 0) * days_in_period / last_day) if i_start > p_month_dt or i_end < p_end else (p.bonus_meal or 0),
                        "holiday_pay": int((p.bonus_holiday or 0) * days_in_period / last_day) if i_start > p_month_dt or i_end < p_end else (p.bonus_holiday or 0)
                    })
            except Exception:
                pass
                
        # Calculate sums
        history.reverse() # chronological
        for h in history:
            h["subtotal"] = h["base_pay"] + h["meal_pay"] + h["holiday_pay"]

        return {
            "status": "success",
            "data": {
                "staff": {
                    "emp_no": staff.id,
                    "name": staff.name,
                    "dept": staff.department if hasattr(staff, 'department') else "",
                    "level": staff.position if hasattr(staff, 'position') else "직급없음",
                    "start_date": str(staff.start_date),
                    "end_date": str(calc_end_date),
                    "work_days": w_days
                },
                "breakdown": breakdown,
                "history": history,
                "legal_retirement": legal
            }
        }


@router.post("/retirement")
def create_retirement_payment(data: RetirementPaymentCreate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """퇴직금 지급 기록 생성"""
    from models import RetirementPayment
    from sqlmodel import Session as _Session
    from database import engine as _engine
    
    with _Session(_engine) as session:
        staff = session.exec(
            apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == data.staff_id)
        ).first()
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
        
        # 중복 체크
        existing = session.exec(
            apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(
                RetirementPayment.staff_id == data.staff_id
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 퇴직금 지급 기록이 존재합니다.")
        
        legal, work_days, pl_accrued, breakdown = _calc_accrued_retirement(staff, data.end_date)
        difference = data.paid_amount - legal
        
        from models import MonthlyProfitLoss
        
        # 1년 미만 퇴사: 환입 처리
        reversal_amount = 0
        if work_days < 365:
            # P/L에 적립했던 금액을 환입 (비용 차감)
            reversal_amount = pl_accrued
            note_prefix = f"[1년미만 퇴사] 적립 환입: -{reversal_amount:,}원"
            if data.paid_amount > 0:
                note_prefix += f" / 실지급: {data.paid_amount:,}원"
            auto_note = note_prefix + (f" / {data.note}" if data.note else "")
        else:
            auto_note = data.note
        
        payment = RetirementPayment(
            business_id=bid,
            staff_id=data.staff_id,
            staff_name=staff.name,
            start_date=staff.start_date,
            end_date=data.end_date,
            work_days=work_days,
            accrued_amount=legal if work_days >= 365 else 0,
            paid_amount=data.paid_amount,
            difference=difference if work_days >= 365 else data.paid_amount,
            payment_date=data.payment_date or data.end_date,
            payment_method=data.payment_method,
            bank_name=data.bank_name or staff.bank_name,
            account_number=data.account_number or staff.account_number,
            note=auto_note,
            status="환입완료" if work_days < 365 and data.paid_amount == 0 else ("지급완료" if data.payment_date else "대기"),
        )
        session.add(payment)
        
        # P/L 조정 - 퇴사월 기준
        target_date = data.payment_date or data.end_date
        target_year = target_date.year
        target_month = target_date.month
        pl = session.exec(
            apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                MonthlyProfitLoss.year == target_year,
                MonthlyProfitLoss.month == target_month,
            )
        ).first()
        
        if pl:
            if work_days < 365:
                # 1년 미만: 적립액 환입 (비용 차감) + 실지급액 추가
                pl.expense_retirement = max(0, pl.expense_retirement - reversal_amount + data.paid_amount)
                session.add(pl)
            elif difference > 0:
                # 1년 이상: 차액만 추가 비용
                pl.expense_retirement += difference
                session.add(pl)
        
        session.commit()
        
        msg_parts = [f"{staff.name} 퇴직금 기록 완료"]
        if work_days < 365:
            msg_parts.append(f"1년 미만 퇴사 → P/L 적립 환입: -{reversal_amount:,}원")
            if data.paid_amount > 0:
                msg_parts.append(f"실지급: {data.paid_amount:,}원")
        else:
            msg_parts.append(f"법적 퇴직금: {legal:,}원, 지급: {data.paid_amount:,}원, 차액: {difference:,}원")
        
        return {
            "status": "success",
            "message": " / ".join(msg_parts),
            "data": {
                "legal_retirement": legal,
                "pl_accrued": pl_accrued,
                "reversal": reversal_amount,
                "paid": data.paid_amount,
                "work_days": work_days,
                "under_one_year": work_days < 365,
            }
        }


@router.put("/retirement/{payment_id}")
def update_retirement_payment(payment_id: int, data: RetirementPaymentUpdate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    """퇴직금 지급 기록 수정"""
    from models import RetirementPayment
    from sqlmodel import Session as _Session
    from database import engine as _engine
    
    with _Session(_engine) as session:
        payment = session.exec(
            apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(
                RetirementPayment.id == payment_id
            )
        ).first()
        if not payment:
            raise HTTPException(status_code=404, detail="지급 기록을 찾을 수 없습니다.")
        
        update_dict = data.dict(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(payment, key, value)
        
        if 'paid_amount' in update_dict:
            payment.difference = payment.paid_amount - payment.accrued_amount
        
        session.add(payment)
        session.commit()
        
        return {"status": "success", "message": "퇴직금 기록이 수정되었습니다."}
