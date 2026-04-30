from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body, Depends
from fastapi.responses import FileResponse
import urllib.parse
from datetime import date, datetime
import shutil
import os
from sqlmodel import Session, select, col

from routers.auth import get_admin_user, get_current_user, get_password_hash
from models import User as AuthUser, Staff, StaffDocument, StaffChangeLog
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

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
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contract_type: Optional[str] = None
    insurance_4major: Optional[bool] = None
    insurance_base_salary: Optional[int] = None
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

    np_exempt: Optional[bool] = None
    durunnuri_support: Optional[bool] = None
    tax_support_enabled: Optional[bool] = None
    birth_date: Optional[date] = None


class StaffPrivateUpdate(BaseModel):
    """사업주 전용 비공개 지급 정보 PUT 페이로드."""
    private_payment_method: Optional[str] = None  # 'transfer' / 'cash' / 'other_account'
    private_actual_payee_name: Optional[str] = None
    private_actual_payee_relation: Optional[str] = None
    private_actual_payee_account: Optional[str] = None
    private_tax_unreported: Optional[bool] = None
    private_owner_note: Optional[str] = None


# 외부 노출 금지 — Staff 응답 직렬화 시 제거할 키 목록 (전체 비공개 필드)
_PRIVATE_KEYS = {
    "private_payment_method",
    "private_actual_payee_name",
    "private_actual_payee_relation",
    "private_actual_payee_account",
    "private_tax_unreported",
    "private_owner_note",
}

# admin/superadmin 에게만 기본 응답에 포함하는 요약 필드 — 직원 목록·헤더 배지 표시용.
# 민감한 본문(타인계좌·메모)은 여전히 GET /staff/{id}/private 엔드포인트 전용.
_PRIVATE_SUMMARY_KEYS = {"private_payment_method", "private_tax_unreported"}


def _strip_private(staff_obj, include_admin_summary=False):
    """Staff 객체를 dict 로 변환하면서 private_* 필드 처리.

    include_admin_summary=True 면 요약 필드(_PRIVATE_SUMMARY_KEYS)는 남김 — 사업주가
    직원 목록/헤더에서 운영 상태(현금지급/세금미신고 등)를 한눈에 볼 수 있도록.
    민감 본문(타인계좌 정보·메모)은 어떤 경우에도 기본 응답에 포함 안 함.
    """
    if hasattr(staff_obj, "model_dump"):
        data = staff_obj.model_dump()
    elif hasattr(staff_obj, "dict"):
        data = staff_obj.dict()
    else:
        data = dict(staff_obj)
    for k in _PRIVATE_KEYS:
        if include_admin_summary and k in _PRIVATE_SUMMARY_KEYS:
            continue
        data.pop(k, None)
    return data


@router.get("/staff")
def get_all_staff(q: Optional[str] = None, status: Optional[str] = None, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    stmt = apply_bid_filter(select(Staff), Staff, bid)
    
    if status and status.lower() != "all":
        stmt = stmt.where(Staff.status == status)
    elif not status and not q:
        stmt = stmt.where(Staff.status == "재직")
        
    if q:
        stmt = stmt.where(col(Staff.name).contains(q))
        
    staffs = session.exec(stmt).all()
    include_summary = _admin.role in ("admin", "superadmin")
    return {"status": "success", "data": [_strip_private(s, include_summary) for s in staffs]}

@router.post("/staff")
def create_staff(
    staff: StaffCreate,
    _admin: AuthUser = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    # SuperAdmin + View-As 시 bid 가 view-as 사업장. 일반 admin 은 본인 business_id.
    # bid 가 없으면 _admin.business_id fallback. 둘 다 없으면 orphan 방지를 위해 명시적 에러.
    target_bid = bid or _admin.business_id
    if not target_bid:
        raise HTTPException(
            status_code=400,
            detail="사업장 정보가 없습니다. SuperAdmin 은 먼저 대상 사업장을 선택(View As)하세요.",
        )
    new_staff = Staff(
        name=staff.name,
        role=staff.role,
        hourly_wage=staff.hourly_wage,
        bank_account=staff.bank_account,
        email=staff.email,
        start_date=staff.start_date,
        nationality=staff.nationality,
        visa_type=staff.visa_type,
        dependents_count=staff.dependents_count,
        children_count=staff.children_count,
        business_id=target_bid,
    )
    session.add(new_staff)
    session.commit()
    session.refresh(new_staff)
    return {"status": "success", "message": "Staff created", "id": new_staff.id}

@router.get("/staff/{staff_id}")
def get_staff_detail(staff_id: int, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    documents = session.exec(select(StaffDocument).where(StaffDocument.staff_id == staff_id)).all()
    
    from models import ElectronicContract, User, Payroll
    contracts = session.exec(select(ElectronicContract).where(ElectronicContract.staff_id == staff_id)).all()
    user_account = session.exec(select(User).where(User.staff_id == staff_id)).first()
    
    user_info = {
        "id": user_account.id,
        "username": user_account.username,
        "grade": user_account.grade
    } if user_account else None

    payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff_id)).all()

    include_summary = _admin.role in ("admin", "superadmin")
    return {
        "status": "success",
        "data": _strip_private(staff, include_summary),
        "documents": documents,
        "payrolls": payrolls,
        "contracts": contracts,
        "user": user_info
    }


@router.get("/staff/{staff_id}/private")
def get_staff_private(
    staff_id: int,
    _admin: AuthUser = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """사업주 전용 비공개 지급 정보 조회 — admin/superadmin 만 접근.

    spec: docs/superpowers/specs/2026-04-30-private-payment-info-design.md
    """
    if _admin.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    stmt = apply_bid_filter(select(Staff).where(Staff.id == staff_id), Staff, bid)
    staff = session.exec(stmt).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    return {
        "status": "success",
        "data": {
            "private_payment_method": staff.private_payment_method or "transfer",
            "private_actual_payee_name": staff.private_actual_payee_name or "",
            "private_actual_payee_relation": staff.private_actual_payee_relation or "",
            "private_actual_payee_account": staff.private_actual_payee_account or "",
            "private_tax_unreported": bool(staff.private_tax_unreported),
            "private_owner_note": staff.private_owner_note or "",
        },
    }


@router.put("/staff/{staff_id}/private")
def update_staff_private(
    staff_id: int,
    update_data: StaffPrivateUpdate,
    _admin: AuthUser = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """사업주 전용 비공개 지급 정보 수정 — admin/superadmin 만 접근."""
    if _admin.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    stmt = apply_bid_filter(select(Staff).where(Staff.id == staff_id), Staff, bid)
    staff = session.exec(stmt).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    if update_data.private_payment_method is not None:
        if update_data.private_payment_method not in ("transfer", "cash", "other_account"):
            raise HTTPException(status_code=400, detail="payment_method 값이 올바르지 않습니다.")
        staff.private_payment_method = update_data.private_payment_method
    for field in (
        "private_actual_payee_name",
        "private_actual_payee_relation",
        "private_actual_payee_account",
        "private_owner_note",
    ):
        v = getattr(update_data, field)
        if v is not None:
            setattr(staff, field, v.strip()[:255] if isinstance(v, str) else v)
    if update_data.private_tax_unreported is not None:
        staff.private_tax_unreported = bool(update_data.private_tax_unreported)
    session.add(staff)
    session.commit()
    return {"status": "success", "message": "비공개 지급 정보가 저장되었습니다."}


FIELD_LABELS = {
    'hourly_wage': '시급',
    'monthly_salary': '월급',
    'role': '직책',
    'status': '상태',
    'contract_type': '계약형태',
    'insurance_4major': '4대보험',
    'insurance_base_salary': '보수월액',
    'start_date': '입사일',
    'np_exempt': '국민연금면제',
    'durunnuri_support': '두루누리지원',
    'tax_support_enabled': '세금대납',
    'visa_type': '체류자격',
    'work_start_time': '근무시작',
    'work_end_time': '근무종료',
    'contract_start_date': '계약시작일',
    'contract_end_date': '계약종료일',
}

CHANGE_TYPE_MAP = {
    'hourly_wage': '시급변경',
    'monthly_salary': '월급변경',
    'role': '직책변경',
    'status': '상태변경',
    'contract_type': '계약변경',
    'insurance_4major': '4대보험변경',
    'insurance_base_salary': '4대보험변경',
    'start_date': '입사',
    'np_exempt': '4대보험변경',
    'durunnuri_support': '4대보험변경',
    'tax_support_enabled': '세금대납',
    'visa_type': '계약변경',
    'work_start_time': '계약변경',
    'work_end_time': '계약변경',
    'contract_start_date': '계약변경',
    'contract_end_date': '계약변경',
}


@router.put("/staff/{staff_id}")
def update_staff(staff_id: int, update_data: StaffUpdate, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    update_dict = update_data.dict(exclude_unset=True)

    # Capture old values for tracked fields before applying updates
    old_values = {}
    for key in update_dict:
        if key in FIELD_LABELS:
            old_values[key] = getattr(staff, key, None)

    for key, value in update_dict.items():
        setattr(staff, key, value)

    session.add(staff)
    session.commit()
    session.refresh(staff)

    # Auto-log changes for HR-significant fields
    for key, old_val in old_values.items():
        new_val = getattr(staff, key, None)
        if str(old_val) != str(new_val):
            log = StaffChangeLog(
                business_id=bid or staff.business_id,
                staff_id=staff_id,
                staff_name=staff.name,
                change_type=CHANGE_TYPE_MAP.get(key, '기타변경'),
                field_name=FIELD_LABELS[key],
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(new_val) if new_val is not None else None,
                changed_by="관리자",
            )
            session.add(log)

    session.commit()

    return {"status": "success", "data": staff}

@router.post("/staff/{staff_id}/account")
def create_staff_account(
    staff_id: int, 
    username: str = Body(..., embed=True), 
    password: str = Body(..., embed=True),
    grade: str = Body("정직원", embed=True),
    _admin: AuthUser = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    from models import User
    try:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
            
        staff_account = session.exec(select(User).where(User.staff_id == staff_id)).first()
        if staff_account:
            raise HTTPException(status_code=400, detail="Staff already has an account")
            
        staff = session.get(Staff, staff_id)
        
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            role="staff",
            grade=grade,
            staff_id=staff_id,
            real_name=staff.name if staff else None,
            business_id=staff.business_id if staff else _admin.business_id
        )
        session.add(new_user)
        session.commit()
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

@router.put("/staff/{staff_id}/account/grade")
def update_staff_account_grade(
    staff_id: int,
    grade: str = Body(..., embed=True),
    _admin: AuthUser = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    from models import User
    user_account = session.exec(select(User).where(User.staff_id == staff_id)).first()
    if not user_account:
        raise HTTPException(status_code=404, detail="User account not found for this staff")
        
    user_account.grade = grade
    session.add(user_account)
    session.commit()
    return {"status": "success", "message": "Grade updated successfully"}

@router.get("/staff/{staff_id}/documents")
def get_staff_documents(staff_id: int, _user: AuthUser = Depends(get_current_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    documents = session.exec(
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

@router.post("/staff/{staff_id}/document")
def upload_staff_document(
    staff_id: int, 
    doc_type: str = Form(...), 
    file: UploadFile = File(...),
    _user: AuthUser = Depends(get_current_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session)
):
    from services.storage_service import get_storage
    storage = get_storage()
    
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    timestamp = int(datetime.now().timestamp())
    # Use only extension from original filename (avoid Korean chars in path)
    ext = os.path.splitext(file.filename or "")[1] or ".bin"
    filename = f"{doc_type}_{timestamp}{ext}"
    storage_key = f"staff_docs/{staff_id}/{filename}"
    
    try:
        file_url = storage.upload_file(file.file, storage_key, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    new_doc = StaffDocument(
        staff_id=staff_id,
        doc_type=doc_type,
        file_path=file_url,
        original_filename=file.filename
    )
    session.add(new_doc)
    
    attr_name = f"doc_{doc_type}"
    if hasattr(staff, attr_name):
        setattr(staff, attr_name, True)
        session.add(staff)
        
    session.commit()
    
    return {"status": "success", "file_path": file_url, "filename": filename}

@router.get("/staff/doc-file/{staff_id}/{filename:path}")
def serve_staff_document(staff_id: int, filename: str):
    import mimetypes
    decoded_filename = urllib.parse.unquote(filename)
    file_path = os.path.join("uploads", "staff_docs", str(staff_id), decoded_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
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
    _admin: AuthUser = Depends(get_admin_user),
    session: Session = Depends(get_session)
):
    doc = session.get(StaffDocument, doc_id)
    if not doc or doc.staff_id != staff_id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception:
        pass

    doc_type = doc.doc_type
    session.delete(doc)

    remaining = session.exec(
        select(StaffDocument).where(
            StaffDocument.staff_id == staff_id,
            StaffDocument.doc_type == doc_type
        )
    ).first()

    if not remaining:
        staff = session.get(Staff, staff_id)
        if staff:
            attr_name = f"doc_{doc_type}"
            if hasattr(staff, attr_name):
                setattr(staff, attr_name, False)
                session.add(staff)

    session.commit()
    return {"status": "success", "message": "Document deleted"}

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
        
    documents = session.exec(select(StaffDocument).where(StaffDocument.staff_id == staff_id)).all()
    for doc in documents:
        if os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception as e:
                pass
        session.delete(doc)
        
    base_dir = "uploads/staff_docs"
    staff_dir = os.path.join(base_dir, str(staff_id))
    if os.path.exists(staff_dir):
        try:
            shutil.rmtree(staff_dir)
        except Exception as e:
            pass

    from models import Attendance, Payroll
    attendances = session.exec(select(Attendance).where(Attendance.staff_id == staff_id)).all()
    for att in attendances:
        session.delete(att)
        
    payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff_id)).all()
    for pay in payrolls:
        session.delete(pay)
        
    session.delete(staff)
    
    session.commit()
    return {"status": "success", "message": "Staff and all related data deleted"}
