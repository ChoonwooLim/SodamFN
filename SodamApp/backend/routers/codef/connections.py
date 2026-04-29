"""CODEF 연결 CRUD + organization 카탈로그 라우터."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import engine
from models import User, CodefConnection
from routers.auth import get_admin_user
from services.codef.connection_service import CodefConnectionService
from services.codef.organization_catalog import (
    get_organizations,
    list_card_corps,
)
from services.codef.exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefAPIError,
)


router = APIRouter(prefix="/api/codef", tags=["codef"])


class RegisterRequest(BaseModel):
    organization_type: str
    organization_code: str
    auth: dict  # {"id": ..., "password": ...} 또는 {"loginType": "kakao", ...}


class ReverifyRequest(BaseModel):
    auth: dict


class VerifyRequest(BaseModel):
    """추가본인확인 verify (PoC Task 33 보강 예정)."""
    sms_code: Optional[str] = None
    captcha: Optional[str] = None
    extra: Optional[dict] = None


def _connection_dto(c: CodefConnection) -> dict:
    return {
        "id": c.id,
        "organization_type": c.organization_type,
        "organization_code": c.organization_code,
        "organization_label": c.organization_label,
        "auth_method": c.auth_method,
        "status": c.status,
        "last_verified_at": c.last_verified_at.isoformat() if c.last_verified_at else None,
        "last_failed_at": c.last_failed_at.isoformat() if c.last_failed_at else None,
        "last_error_code": c.last_error_code,
        "last_error_message": c.last_error_message,
    }


# ─── 카탈로그 (드롭다운용) ────────────────────────

@router.get("/organizations/catalog")
def get_catalog(type: Optional[str] = None,
                admin: User = Depends(get_admin_user)):
    orgs = (
        list_card_corps() if type == "card"
        else list(get_organizations().values())
    )
    return {
        "organizations": [
            {
                "code": o.code,
                "label": o.label,
                "type": o.type,
                "auth_methods": [m.value for m in o.auth_methods],
            }
            for o in orgs
        ]
    }


# ─── 연결 CRUD ────────────────────────────────────

@router.get("/connections")
def list_connections(type: Optional[str] = None,
                     admin: User = Depends(get_admin_user)):
    if not admin.business_id:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    svc = CodefConnectionService(engine=engine)
    conns = svc.list_all(business_id=admin.business_id, organization_type=type)
    return {"connections": [_connection_dto(c) for c in conns]}


@router.post("/connections/register")
def register(body: RegisterRequest, admin: User = Depends(get_admin_user)):
    if not admin.business_id:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    if body.organization_type != "card":
        raise HTTPException(400, f"Phase 1 은 'card' 만 지원 (got {body.organization_type})")
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.register_card(
            business_id=admin.business_id,
            card_corp_code=body.organization_code,
            auth_payload=body.auth,
        )
    except CodefAdditionalAuth as e:
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except (CodefAuthExpired, CodefAPIError) as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {"status": "active", "connection": _connection_dto(conn)}


@router.post("/connections/{cid}/verify")
def verify(cid: int, body: VerifyRequest, admin: User = Depends(get_admin_user)):
    """SMS 코드/캡차 등 추가본인확인 응답 처리.

    구현 노트: easycodefpy 의 추가본인확인 흐름은 SDK 응답 형식에 따라 달라짐.
    PoC 첫 실호출(Phase 1F Task 29)에서 SDK 응답 패턴 확인 후 본 메서드 보강.
    """
    if not admin.business_id:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    raise HTTPException(
        501,
        "추가본인확인 verify 는 PoC 검증 후 구현 예정 (Phase 1G Task 33)"
    )


@router.post("/connections/{cid}/reverify")
def reverify(cid: int, body: ReverifyRequest, admin: User = Depends(get_admin_user)):
    if not admin.business_id:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.reverify(connection_id=cid, auth_payload=body.auth)
    except CodefAdditionalAuth as e:
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except (CodefAuthExpired, CodefAPIError, ValueError) as e:
        raise HTTPException(400, str(e))
    return {"status": "active", "connection": _connection_dto(conn)}


@router.delete("/connections/{cid}")
def deactivate(cid: int, admin: User = Depends(get_admin_user)):
    if not admin.business_id:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    svc = CodefConnectionService(engine=engine)
    try:
        svc.deactivate(connection_id=cid)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"status": "deactivated"}
