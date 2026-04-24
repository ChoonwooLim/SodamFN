"""사업장(회사) 공식 문서 보관 API.

사업자등록증·영업신고증·임대차계약서 등 회사 운영 서류를 업로드/조회/삭제.
Staff 서류(hr/staff documents)와 완전히 분리된 회사 단위 보관함.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form, Query
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime
import os

from database import get_session
from models import BusinessDocument, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.storage_service import get_storage

router = APIRouter(prefix="/business-docs", tags=["business-docs"])


ALLOWED_MIME = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/x-hwp",
    "application/haansofthwp",
    "application/vnd.hancom.hwp",
    "application/octet-stream",
    "text/plain",
}
MAX_SIZE_MB = 15


@router.get("")
def list_business_docs(
    doc_type: Optional[str] = Query(default=None),
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    stmt = select(BusinessDocument).where(BusinessDocument.business_id == bid)
    if doc_type:
        stmt = stmt.where(BusinessDocument.doc_type == doc_type)
    stmt = stmt.order_by(BusinessDocument.uploaded_at.desc())  # type: ignore
    rows = session.exec(stmt).all()
    return [
        {
            "id": r.id,
            "doc_type": r.doc_type,
            "label": r.label,
            "file_path": r.file_path,
            "original_filename": r.original_filename,
            "note": r.note,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
        }
        for r in rows
    ]


@router.post("")
async def upload_business_doc(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    label: Optional[str] = Form(default=None),
    note: Optional[str] = Form(default=None),
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    if not doc_type or not doc_type.strip():
        raise HTTPException(status_code=400, detail="doc_type이 필요합니다.")
    if file.content_type and file.content_type not in ALLOWED_MIME:
        # Allow unknown types by filename extension; hwp/zip etc. often report octet-stream
        pass

    # Read to check size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"파일 크기가 {MAX_SIZE_MB}MB를 초과합니다.")

    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "doc")[1]
    safe_type = "".join(ch for ch in doc_type if ch.isalnum() or ch in "-_") or "other"
    storage_key = f"business_docs/{bid}/{safe_type}_{timestamp}{ext}"

    import io
    file_url = storage.upload_file(io.BytesIO(content), storage_key, file.content_type or "application/octet-stream")

    doc = BusinessDocument(
        business_id=bid,
        doc_type=doc_type.strip()[:64],
        label=(label or "").strip()[:120] or None,
        file_path=file_url,
        original_filename=(file.filename or "unnamed")[:255],
        note=(note or "").strip()[:500] or None,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return {
        "status": "success",
        "id": doc.id,
        "file_path": doc.file_path,
        "original_filename": doc.original_filename,
        "doc_type": doc.doc_type,
        "label": doc.label,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


@router.delete("/{doc_id}")
def delete_business_doc(
    doc_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    doc = session.get(BusinessDocument, doc_id)
    if not doc or doc.business_id != bid:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    session.delete(doc)
    session.commit()
    return {"status": "success"}


@router.post("/seal-image")
async def upload_seal_image(
    file: UploadFile = File(...),
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """도장 이미지 업로드 — settings_json.seal_image_url에 저장.

    업로드된 이미지가 있으면 증명서에서 SVG 대신 이 이미지를 표시.
    """
    from models import Business
    import json

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기가 5MB를 초과합니다.")

    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "seal.png")[1]
    storage_key = f"business_seals/{bid}/seal_{timestamp}{ext}"

    import io
    file_url = storage.upload_file(io.BytesIO(content), storage_key, file.content_type or "image/png")

    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    try:
        settings = json.loads(business.settings_json) if business.settings_json else {}
        if not isinstance(settings, dict):
            settings = {}
    except Exception:
        settings = {}
    settings["seal_image_url"] = file_url
    business.settings_json = json.dumps(settings, ensure_ascii=False)
    session.add(business)
    session.commit()
    return {"status": "success", "seal_image_url": file_url}


@router.delete("/seal-image")
def clear_seal_image(
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    from models import Business
    import json

    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    try:
        settings = json.loads(business.settings_json) if business.settings_json else {}
    except Exception:
        settings = {}
    if isinstance(settings, dict) and "seal_image_url" in settings:
        settings.pop("seal_image_url", None)
        business.settings_json = json.dumps(settings, ensure_ascii=False)
        session.add(business)
        session.commit()
    return {"status": "success"}
