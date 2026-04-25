"""Audit log helper for year-end actions."""
from __future__ import annotations
import datetime
import logging
from typing import Optional

from sqlmodel import Session

logger = logging.getLogger("sodam.yearend.audit")


def extract_actor_meta(request) -> tuple[Optional[str], Optional[str]]:
    """FastAPI Request → (ip, user_agent)."""
    ip = None
    ua = None
    try:
        ip = request.client.host if request.client else None
    except Exception:
        pass
    try:
        ua = request.headers.get("user-agent")
    except Exception:
        pass
    return ip, ua


def log_action(*, session: Session,
               business_id: int, staff_id: int, year: int,
               action: str, actor_user_id: int, actor_role: str,
               document_id: Optional[int] = None,
               actor_ip: Optional[str] = None,
               user_agent: Optional[str] = None,
               detail: Optional[str] = None) -> None:
    """YearEndAuditLog 1행 추가. 호출 측이 commit 책임."""
    from models import YearEndAuditLog

    row = YearEndAuditLog(
        business_id=business_id, staff_id=staff_id, year=year,
        document_id=document_id, action=action,
        actor_user_id=actor_user_id, actor_role=actor_role,
        actor_ip=actor_ip, user_agent=user_agent,
        occurred_at=datetime.datetime.utcnow(),
        detail=detail,
    )
    session.add(row)
    logger.info(
        "yearend_audit action=%s staff_id=%s year=%s actor=%s/%s",
        action, staff_id, year, actor_user_id, actor_role,
    )
