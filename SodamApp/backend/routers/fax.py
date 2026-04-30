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
from typing import List, Optional

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


@router.post("/send-multi")
async def send_fax_multi(
    files: List[UploadFile] = File(...),
    target_number: str = Form(...),
    target_name: Optional[str] = Form(default=None),
    subject: Optional[str] = Form(default=None),
    source_type: str = Form(default="upload"),
    source_ref: Optional[str] = Form(default=None),
    admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """여러 파일을 한 통의 팩스로 묶어 발송 (팝빌 sendFAX_multi).

    각 파일 검증 → 모두 통과 시 첫 파일을 storage 보존 + 한 transmission 레코드 생성 →
    provider.send_multi() 호출. 페이지 수는 파일별 estimate 합산.
    """
    num = normalize_fax_number(target_number)
    if not num or len(num.replace("+", "")) < 7:
        raise HTTPException(status_code=400, detail="유효한 팩스번호가 아닙니다.")
    if not files:
        raise HTTPException(status_code=400, detail="파일이 1개 이상 필요합니다.")

    files_data = []  # [(content_bytes, filename), ...]
    total_size = 0
    for uf in files:
        content = await uf.read()
        total_size += len(content)
        if total_size > MAX_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"전체 파일 크기 합계가 {MAX_SIZE_MB}MB를 초과합니다.",
            )
        if uf.content_type and uf.content_type not in ALLOWED_MIMES and not (uf.filename or "").lower().endswith(
            (".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".gif")
        ):
            raise HTTPException(
                status_code=400,
                detail=f"허용되지 않는 파일 형식입니다: {uf.content_type} ({uf.filename})",
            )
        files_data.append((content, uf.filename or "fax.pdf"))

    # 첫 파일은 보존용으로 storage 업로드 (이력 다운로드/미리보기에 사용)
    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    first_content, first_name = files_data[0]
    ext = os.path.splitext(first_name)[1] or ".pdf"
    storage_key = f"fax/{bid}/{timestamp}{ext}"
    file_url = storage.upload_file(
        io.BytesIO(first_content),
        storage_key,
        files[0].content_type or "application/pdf",
    )

    combined_filename = first_name if len(files_data) == 1 else f"{first_name} 외 {len(files_data) - 1}건"
    total_pages = sum(estimate_page_count(c, n) for c, n in files_data)

    tx = FaxTransmission(
        business_id=bid,
        target_number=num,
        target_name=(target_name or "").strip()[:120] or None,
        subject=(subject or "").strip()[:200] or None,
        source_type=source_type.strip()[:30] or "upload",
        source_ref=(source_ref or "").strip()[:120] or None,
        file_path=file_url,
        original_filename=combined_filename[:255],
        page_count=total_pages,
        status="pending",
        created_by_user_id=getattr(admin, "id", None),
    )
    session.add(tx)
    session.commit()
    session.refresh(tx)

    provider = get_provider()
    tx.status = "sending"
    tx.provider = provider.name
    tx.sent_at = datetime.now()
    session.add(tx)
    session.commit()

    if hasattr(provider, "send_multi"):
        result = provider.send_multi(
            target_number=tx.target_number,
            files=files_data,
            subject=tx.subject,
        )
    else:
        # fallback — 각 파일별 send() N회 호출 (별도 팩스 전송 N건). 첫 실패 시 중단.
        from services.fax_service import FaxResult
        result = FaxResult(ok=True, provider_tx_id="")
        ids = []
        for content, name in files_data:
            r = provider.send(
                target_number=tx.target_number,
                file_path_or_url="",
                file_bytes=content,
                original_filename=name,
                subject=tx.subject,
            )
            if not r.ok:
                result = r
                break
            ids.append(r.provider_tx_id or "")
        else:
            result = FaxResult(ok=True, provider_tx_id=",".join(ids))

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
