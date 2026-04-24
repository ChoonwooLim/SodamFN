"""팩스 전송 API.

- POST /api/fax/send — 파일(보통 클라이언트에서 생성한 PDF)을 받아
  스토리지에 저장하고, 설정된 프로바이더로 전송 시도. 이력 DB에 기록.
- GET /api/fax — 이력 목록 (최신순)
- GET /api/fax/{id} — 상세
- POST /api/fax/{id}/retry — 실패 건 재전송
- GET /api/fax/providers — 현재 활성 프로바이더 정보
"""
from __future__ import annotations

import os
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from database import get_session
from models import FaxTransmission, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.storage_service import get_storage
from services.fax_service import (
    estimate_page_count,
    get_provider,
    normalize_fax_number,
)

router = APIRouter(prefix="/fax", tags=["fax"])

ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/gif",
    "application/octet-stream",  # allow when content-type is unknown
}
MAX_SIZE_MB = 10


def _serialize(tx: FaxTransmission) -> dict:
    return {
        "id": tx.id,
        "business_id": tx.business_id,
        "target_number": tx.target_number,
        "target_name": tx.target_name,
        "subject": tx.subject,
        "source_type": tx.source_type,
        "source_ref": tx.source_ref,
        "file_path": tx.file_path,
        "original_filename": tx.original_filename,
        "page_count": tx.page_count,
        "status": tx.status,
        "provider": tx.provider,
        "provider_tx_id": tx.provider_tx_id,
        "error_message": tx.error_message,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
        "sent_at": tx.sent_at.isoformat() if tx.sent_at else None,
        "completed_at": tx.completed_at.isoformat() if tx.completed_at else None,
    }


@router.get("/providers")
def get_active_provider(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env = (os.getenv("FAX_PROVIDER") or "stub").strip().lower()
    return {
        "active": provider.name,
        "env_value": env,
        "is_stub": provider.name == "stub",
        "note": (
            "⚠️ 현재 STUB 모드입니다. 실제 팩스는 전송되지 않고 이력만 기록됩니다. "
            "실제 전송을 원하시면 FAX_PROVIDER 환경변수를 설정하세요 (phaxio 등)."
        ) if provider.name == "stub" else "실제 팩스 전송이 활성화되었습니다.",
    }


@router.get("")
def list_fax_transmissions(
    limit: int = 100,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    stmt = (
        select(FaxTransmission)
        .where(FaxTransmission.business_id == bid)
        .order_by(FaxTransmission.created_at.desc())  # type: ignore
        .limit(max(1, min(limit, 500)))
    )
    return [_serialize(t) for t in session.exec(stmt).all()]


@router.get("/{tx_id}")
def get_fax_transmission(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    tx = session.get(FaxTransmission, tx_id)
    if not tx or tx.business_id != bid:
        raise HTTPException(status_code=404, detail="전송 이력을 찾을 수 없습니다.")
    return _serialize(tx)


def _do_send_and_persist(
    tx: FaxTransmission,
    file_bytes: Optional[bytes],
    session: Session,
) -> FaxTransmission:
    provider = get_provider()
    tx.status = "sending"
    tx.provider = provider.name
    tx.sent_at = datetime.now()
    session.add(tx)
    session.commit()

    result = provider.send(
        target_number=tx.target_number,
        file_path_or_url=tx.file_path,
        file_bytes=file_bytes,
        original_filename=tx.original_filename,
        subject=tx.subject,
    )

    tx.completed_at = datetime.now()
    if result.ok:
        tx.status = "success"
        tx.provider_tx_id = result.provider_tx_id
        tx.error_message = None
    else:
        tx.status = "failed"
        tx.error_message = result.error or "알 수 없는 오류"
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.post("/send")
async def send_fax(
    file: UploadFile = File(...),
    target_number: str = Form(...),
    target_name: Optional[str] = Form(default=None),
    subject: Optional[str] = Form(default=None),
    source_type: str = Form(default="upload"),
    source_ref: Optional[str] = Form(default=None),
    admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    num = normalize_fax_number(target_number)
    if not num or len(num.replace("+", "")) < 7:
        raise HTTPException(status_code=400, detail="유효한 팩스번호가 아닙니다.")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"파일 크기가 {MAX_SIZE_MB}MB를 초과합니다.")
    if file.content_type and file.content_type not in ALLOWED_MIMES and not (file.filename or "").lower().endswith(
        (".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".gif")
    ):
        raise HTTPException(status_code=400, detail=f"허용되지 않는 파일 형식입니다: {file.content_type}")

    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "fax.pdf")[1] or ".pdf"
    storage_key = f"fax/{bid}/{timestamp}{ext}"
    file_url = storage.upload_file(
        io.BytesIO(content),
        storage_key,
        file.content_type or "application/pdf",
    )

    tx = FaxTransmission(
        business_id=bid,
        target_number=num,
        target_name=(target_name or "").strip()[:120] or None,
        subject=(subject or "").strip()[:200] or None,
        source_type=source_type.strip()[:30] or "upload",
        source_ref=(source_ref or "").strip()[:120] or None,
        file_path=file_url,
        original_filename=(file.filename or "fax.pdf")[:255],
        page_count=estimate_page_count(content, file.filename or ""),
        status="pending",
        created_by_user_id=getattr(admin, "id", None),
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)

    tx = _do_send_and_persist(tx, content, session)
    return _serialize(tx)


@router.post("/{tx_id}/retry")
def retry_fax(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    tx = session.get(FaxTransmission, tx_id)
    if not tx or tx.business_id != bid:
        raise HTTPException(status_code=404, detail="전송 이력을 찾을 수 없습니다.")
    if tx.status == "success":
        raise HTTPException(status_code=400, detail="이미 성공한 전송은 재전송할 수 없습니다.")

    # Try to re-download file from storage into bytes (only for local storage).
    file_bytes = None
    try:
        path = tx.file_path
        if path and not path.startswith("http"):
            local = path.lstrip("/")
            if os.path.isfile(local):
                with open(local, "rb") as f:
                    file_bytes = f.read()
    except Exception:
        file_bytes = None

    tx = _do_send_and_persist(tx, file_bytes, session)
    return _serialize(tx)


@router.delete("/{tx_id}")
def delete_fax(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    tx = session.get(FaxTransmission, tx_id)
    if not tx or tx.business_id != bid:
        raise HTTPException(status_code=404, detail="전송 이력을 찾을 수 없습니다.")
    session.delete(tx)
    session.commit()
    return {"status": "success"}
