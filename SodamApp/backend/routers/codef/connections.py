"""CODEF 연결 CRUD + organization 카탈로그 라우터."""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from database import engine
from models import User, CodefConnection
from routers.auth import get_admin_user
from ._helpers import resolve_bid
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
    # 신규: 같은 카드사도 매출(card_sales)·매입(card_purchase) 별도 connection 으로 관리.
    # 기본값은 'card_sales' 로 기존 호출과 호환.
    connection_type: Optional[str] = "card_sales"


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
        "connection_type": c.connection_type,
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
def list_connections(
    type: Optional[str] = None,
    connection_type: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """CODEF 연결 목록.

    Query params:
      - type            : organization_type 필터 ('card' / 'bank' 등)
      - connection_type : connection_type 필터 ('card_sales' / 'card_purchase' / 'bank')

    `type=card_purchase` 같은 단축 사용도 허용 — frontend 가 type 만 알고 있을 때 분기.
    """
    bid = resolve_bid(admin, x_view_as_business)

    # 단축 호환: type=card_purchase|card_sales → connection_type 으로 변환
    if type in {"card_purchase", "card_sales", "bank"} and connection_type is None:
        connection_type = type
        type = None  # organization_type 필터 해제 (card_sales/card_purchase 모두 organization_type='card')

    svc = CodefConnectionService(engine=engine)
    conns = svc.list_all(
        business_id=bid,
        organization_type=type,
        connection_type=connection_type,
    )
    return {"connections": [_connection_dto(c) for c in conns]}


@router.post("/connections/register")
def register(
    body: RegisterRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    if body.organization_type != "card":
        raise HTTPException(400, f"카드 연결만 본 엔드포인트에서 처리 (got {body.organization_type})")
    conn_type = body.connection_type or "card_sales"
    if conn_type not in {"card_sales", "card_purchase"}:
        raise HTTPException(400, f"잘못된 connection_type: {conn_type}")
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.register_card(
            business_id=bid,
            card_corp_code=body.organization_code,
            auth_payload=body.auth,
            connection_type=conn_type,
        )
    except CodefAdditionalAuth as e:
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except CodefAuthExpired as e:
        raise HTTPException(400, f"인증 만료: {str(e)}")
    except CodefAPIError as e:
        # CODEF 측 에러 — raw 응답을 detail 에 포함해 진단 가능
        detail = {
            "message": str(e),
            "code": e.code,
            "raw": e.raw,
        }
        raise HTTPException(400, detail)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {"status": "active", "connection": _connection_dto(conn)}


@router.post("/connections/{cid}/verify")
def verify(
    cid: int,
    body: VerifyRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """SMS 코드/캡차 등 추가본인확인 응답 처리.

    구현 노트: easycodefpy 의 추가본인확인 흐름은 SDK 응답 형식에 따라 달라짐.
    PoC 첫 실호출(Phase 1F Task 29)에서 SDK 응답 패턴 확인 후 본 메서드 보강.
    """
    resolve_bid(admin, x_view_as_business)
    raise HTTPException(
        501,
        "추가본인확인 verify 는 PoC 검증 후 구현 예정 (Phase 1G Task 33)"
    )


@router.post("/connections/{cid}/reverify")
def reverify(
    cid: int,
    body: ReverifyRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    resolve_bid(admin, x_view_as_business)
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
def deactivate(
    cid: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    resolve_bid(admin, x_view_as_business)
    svc = CodefConnectionService(engine=engine)
    try:
        svc.deactivate(connection_id=cid)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"status": "deactivated"}
