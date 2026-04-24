"""알림(카카오 알림톡·SMS) 발송 API.

- POST /api/notifications/send/alimtalk — 알림톡 단건 발송 + 이력 기록
- POST /api/notifications/send/sms — 문자(XMS: SMS/LMS 자동 분기) 단건 발송
- GET  /api/notifications — 이력 목록 (테넌트 격리)
- GET  /api/notifications/{id} — 상세
- POST /api/notifications/{id}/retry — 실패 건 재전송
- DELETE /api/notifications/{id} — 이력 삭제
- GET  /api/notifications/providers — 현재 프로바이더 정보 (stub/popbill)
- GET  /api/notifications/templates — 알림톡 템플릿 목록 (popbill 활성 시)
- GET  /api/notifications/urls/template-mgt — 템플릿 관리 팝빌 URL
- GET  /api/notifications/urls/plus-friend — 카카오 채널 관리 URL
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import NotificationHistory, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.notification_service import (
    get_provider,
    PopbillNotificationProvider,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Schemas ──────────────────────────────────────────────

class AlimtalkSendIn(BaseModel):
    template_code: str
    target_number: str
    target_name: Optional[str] = None
    content: str = ""
    alt_content: Optional[str] = None
    alt_send_type: str = "C"             # 'C'|'A'|'N'
    trigger: str = "manual"
    staff_id: Optional[int] = None
    source_ref: Optional[str] = None
    template_variables: Optional[dict] = None


class SMSSendIn(BaseModel):
    target_number: str
    target_name: Optional[str] = None
    content: str
    subject: Optional[str] = None
    trigger: str = "manual"
    staff_id: Optional[int] = None
    source_ref: Optional[str] = None


def _serialize(n: NotificationHistory) -> dict:
    return {
        "id": n.id,
        "channel": n.channel,
        "trigger": n.trigger,
        "target_number": n.target_number,
        "target_name": n.target_name,
        "sender_number": n.sender_number,
        "template_code": n.template_code,
        "subject": n.subject,
        "content": n.content,
        "status": n.status,
        "provider": n.provider,
        "provider_tx_id": n.provider_tx_id,
        "error_message": n.error_message,
        "staff_id": n.staff_id,
        "source_ref": n.source_ref,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        "completed_at": n.completed_at.isoformat() if n.completed_at else None,
    }


def _resolve_sender_number() -> str:
    return (os.getenv("POPBILL_SENDER_NUMBER", "") or "").strip()


# ─── Provider info & template management ─────────────────

@router.get("/providers")
def get_active_provider(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env = (os.getenv("NOTIFICATION_PROVIDER") or "stub").strip().lower()
    note = (
        "⚠️ 현재 STUB 모드. 실제 알림은 발송되지 않고 이력만 기록됩니다. "
        "카카오 비즈 채널 개설 + 템플릿 심사 완료 후 NOTIFICATION_PROVIDER=popbill 로 전환하세요."
        if provider.name == "stub"
        else "✅ 실제 알림 발송이 활성화되었습니다."
    )
    return {"active": provider.name, "env_value": env, "is_stub": provider.name == "stub", "note": note}


@router.get("/templates")
def list_templates(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    if not isinstance(provider, PopbillNotificationProvider):
        return {"provider": provider.name, "templates": []}
    rows = provider.list_templates() or []

    def _to_dict(t):
        if isinstance(t, dict):
            return t
        # popbill SDK 객체는 속성 기반
        return {
            "templateCode": getattr(t, "templateCode", None),
            "templateName": getattr(t, "templateName", None),
            "template": getattr(t, "template", None),
            "senderNum": getattr(t, "senderNum", None),
            "state": getattr(t, "state", None),
            "plusFriendID": getattr(t, "plusFriendID", None),
            "stateDT": getattr(t, "stateDT", None),
        }
    return {"provider": provider.name, "templates": [_to_dict(t) for t in rows]}


@router.get("/urls/template-mgt")
def get_template_mgt_url(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    if not isinstance(provider, PopbillNotificationProvider):
        raise HTTPException(status_code=400, detail="popbill 프로바이더가 활성화되어야 이용 가능합니다.")
    url = provider.get_template_mgt_url()
    if not url:
        raise HTTPException(status_code=500, detail="팝빌 관리 URL 발급 실패")
    return {"url": url}


@router.get("/urls/plus-friend")
def get_plus_friend_mgt_url(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    if not isinstance(provider, PopbillNotificationProvider):
        raise HTTPException(status_code=400, detail="popbill 프로바이더가 활성화되어야 이용 가능합니다.")
    url = provider.get_plus_friend_mgt_url()
    if not url:
        raise HTTPException(status_code=500, detail="팝빌 관리 URL 발급 실패")
    return {"url": url}


@router.get("/urls/sender-number")
def get_sender_number_mgt_url(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    if not isinstance(provider, PopbillNotificationProvider):
        raise HTTPException(status_code=400, detail="popbill 프로바이더가 활성화되어야 이용 가능합니다.")
    url = provider.get_sender_number_mgt_url()
    if not url:
        raise HTTPException(status_code=500, detail="팝빌 관리 URL 발급 실패")
    return {"url": url}


@router.get("/balance")
def get_balance(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    if not isinstance(provider, PopbillNotificationProvider):
        return {"provider": provider.name, "balance": None}
    return {"provider": provider.name, "balance": provider.get_balance()}


# ─── History ──────────────────────────────────────────────

@router.get("")
def list_history(
    limit: int = 100,
    channel: Optional[str] = None,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    stmt = select(NotificationHistory).where(NotificationHistory.business_id == bid)
    if channel:
        stmt = stmt.where(NotificationHistory.channel == channel)
    stmt = stmt.order_by(NotificationHistory.created_at.desc()).limit(max(1, min(limit, 500)))  # type: ignore
    return [_serialize(n) for n in session.exec(stmt).all()]


@router.get("/{tx_id}")
def get_history(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    n = session.get(NotificationHistory, tx_id)
    if not n or n.business_id != bid:
        raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다.")
    return _serialize(n)


@router.delete("/{tx_id}")
def delete_history(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    n = session.get(NotificationHistory, tx_id)
    if not n or n.business_id != bid:
        raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다.")
    session.delete(n)
    session.commit()
    return {"status": "success"}


# ─── Send ────────────────────────────────────────────────

def _persist_and_send(n: NotificationHistory, send_fn) -> NotificationHistory:
    """공통 발송 실행기. n 은 이미 세션에 add된 상태여야 함."""
    provider = get_provider()
    n.status = "sending"
    n.provider = provider.name
    n.sent_at = datetime.now()
    result = send_fn(provider)
    n.completed_at = datetime.now()
    if result.ok:
        n.status = "success"
        n.provider_tx_id = result.provider_tx_id
        n.error_message = None
    else:
        n.status = "failed"
        n.error_message = result.error or "알 수 없는 오류"
    return n


@router.post("/send/alimtalk")
def send_alimtalk(
    body: AlimtalkSendIn,
    admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    sender = _resolve_sender_number()
    if not sender:
        raise HTTPException(status_code=400, detail="POPBILL_SENDER_NUMBER 가 설정되지 않았습니다.")

    n = NotificationHistory(
        business_id=bid,
        channel="alimtalk",
        trigger=(body.trigger or "manual").strip()[:64],
        target_number=body.target_number.strip(),
        target_name=(body.target_name or "").strip()[:120] or None,
        sender_number=sender,
        template_code=body.template_code.strip(),
        template_variables=json.dumps(body.template_variables, ensure_ascii=False) if body.template_variables else None,
        content=body.content or "",
        status="pending",
        staff_id=body.staff_id,
        source_ref=(body.source_ref or "").strip()[:120] or None,
        created_by_user_id=getattr(admin, "id", None),
    )
    session.add(n)
    session.commit()
    session.refresh(n)

    def _send(provider):
        return provider.send_alimtalk(
            template_code=n.template_code or "",
            sender_number=n.sender_number or "",
            receiver=n.target_number,
            receiver_name=n.target_name,
            content=n.content,
            alt_content=body.alt_content or n.content,
            alt_send_type=body.alt_send_type or "C",
        )

    _persist_and_send(n, _send)
    session.add(n)
    session.commit()
    session.refresh(n)
    return _serialize(n)


@router.post("/send/sms")
def send_sms(
    body: SMSSendIn,
    admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    if not (body.content or "").strip():
        raise HTTPException(status_code=400, detail="메시지 내용이 비어 있습니다.")
    sender = _resolve_sender_number()
    if not sender:
        raise HTTPException(status_code=400, detail="POPBILL_SENDER_NUMBER 가 설정되지 않았습니다.")

    # 자동 채널 판정: 80자 기준
    channel = "lms" if len(body.content) > 80 else "sms"

    n = NotificationHistory(
        business_id=bid,
        channel=channel,
        trigger=(body.trigger or "manual").strip()[:64],
        target_number=body.target_number.strip(),
        target_name=(body.target_name or "").strip()[:120] or None,
        sender_number=sender,
        subject=(body.subject or "").strip()[:40] or None,
        content=body.content,
        status="pending",
        staff_id=body.staff_id,
        source_ref=(body.source_ref or "").strip()[:120] or None,
        created_by_user_id=getattr(admin, "id", None),
    )
    session.add(n)
    session.commit()
    session.refresh(n)

    def _send(provider):
        return provider.send_sms(
            sender_number=n.sender_number or "",
            receiver=n.target_number,
            receiver_name=n.target_name,
            content=n.content,
            subject=n.subject,
        )

    _persist_and_send(n, _send)
    session.add(n)
    session.commit()
    session.refresh(n)
    return _serialize(n)


@router.post("/{tx_id}/retry")
def retry_notification(
    tx_id: int,
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    n = session.get(NotificationHistory, tx_id)
    if not n or n.business_id != bid:
        raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다.")
    if n.status == "success":
        raise HTTPException(status_code=400, detail="이미 성공한 건은 재전송할 수 없습니다.")

    def _send(provider):
        if n.channel == "alimtalk":
            return provider.send_alimtalk(
                template_code=n.template_code or "",
                sender_number=n.sender_number or _resolve_sender_number(),
                receiver=n.target_number,
                receiver_name=n.target_name,
                content=n.content,
                alt_content=n.content,
            )
        return provider.send_sms(
            sender_number=n.sender_number or _resolve_sender_number(),
            receiver=n.target_number,
            receiver_name=n.target_name,
            content=n.content,
            subject=n.subject,
        )

    _persist_and_send(n, _send)
    session.add(n)
    session.commit()
    session.refresh(n)
    return _serialize(n)
