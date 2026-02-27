"""App distribution router - Send install links to staff/admin phones"""
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from models import Staff, User as AuthUser
from database import get_session
from routers.auth import get_admin_user

router = APIRouter(prefix="/distribute", tags=["Distribute"])


# ── Models ──

class SendLinksRequest(BaseModel):
    staff_ids: List[int]
    app_type: str  # "staff" | "admin"
    method: str = "link"  # "link" | "sms" (future)


class DistributionRecord(BaseModel):
    id: int
    staff_id: int
    staff_name: str
    app_type: str
    method: str
    sent_at: str
    status: str


# In-memory distribution history (can be persisted to DB later)
distribution_history: List[dict] = []
history_id_counter = 0


# App URLs
APP_URLS = {
    "staff": "https://sodam-staff.pages.dev",
    "admin": "https://sodamfn.twinverse.org",
}


# ── Endpoints ──

@router.get("/staff-list")
def get_distributable_staff(
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    """Get list of active staff with phone numbers for distribution"""
    staff_list = session.exec(
        select(Staff).where(Staff.status == "재직")
    ).all()

    result = []
    for s in staff_list:
        # Check if already sent
        sent_records = [
            h for h in distribution_history
            if h["staff_id"] == s.id
        ]
        last_sent = sent_records[-1]["sent_at"] if sent_records else None

        result.append({
            "id": s.id,
            "name": s.name,
            "role": s.role,
            "phone": s.phone or "",
            "email": s.email or "",
            "last_sent": last_sent,
            "has_phone": bool(s.phone),
        })

    return {"status": "success", "data": result}


@router.post("/send-links")
def send_install_links(
    req: SendLinksRequest,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    """Send install links to selected staff members"""
    global history_id_counter

    if req.app_type not in APP_URLS:
        raise HTTPException(400, "Invalid app_type")

    app_url = APP_URLS[req.app_type]
    results = []

    for staff_id in req.staff_ids:
        staff = session.get(Staff, staff_id)
        if not staff:
            continue

        history_id_counter += 1
        record = {
            "id": history_id_counter,
            "staff_id": staff.id,
            "staff_name": staff.name,
            "staff_phone": staff.phone or "",
            "app_type": req.app_type,
            "app_url": app_url,
            "method": req.method,
            "sent_at": datetime.datetime.now().isoformat(),
            "status": "sent" if req.method == "link" else "pending",
        }

        # TODO: When SMS API is integrated, actually send SMS here
        # if req.method == "sms" and staff.phone:
        #     send_sms(staff.phone, f"소담 Staff 앱을 설치하세요: {app_url}")
        #     record["status"] = "sent"

        distribution_history.append(record)
        results.append(record)

    return {
        "status": "success",
        "message": f"{len(results)}명에게 전송 기록이 저장되었습니다.",
        "data": results,
        "app_url": app_url,
    }


@router.get("/history")
def get_distribution_history(
    app_type: Optional[str] = None,
    _admin: AuthUser = Depends(get_admin_user),
):
    """Get distribution history"""
    records = distribution_history
    if app_type:
        records = [r for r in records if r["app_type"] == app_type]

    # Return most recent first
    return {"status": "success", "data": list(reversed(records[-50:]))}


@router.get("/app-urls")
def get_app_urls(_admin: AuthUser = Depends(get_admin_user)):
    """Get app URLs for QR code generation"""
    return {"status": "success", "data": APP_URLS}
