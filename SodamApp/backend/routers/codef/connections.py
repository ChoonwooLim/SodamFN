"""CODEF 연결 CRUD + organization 카탈로그 라우터."""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

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


class CompleteSimpleAuthRequest(BaseModel):
    """간편인증 2단계 — 사장님 본인인증 완료 후 호출."""
    auth_pending_id: int


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

    # 간편인증(카카오/네이버/PASS 등) → 2-step 흐름: start_simple_auth 사용.
    # 기존 ID/PW 흐름은 그대로 register_card.
    login_type = (body.auth.get("loginType") or "").lower() if isinstance(body.auth, dict) else ""
    is_simple_auth = login_type in CodefConnectionService.SIMPLE_AUTH_LOGIN_TYPES

    svc = CodefConnectionService(engine=engine)
    try:
        if is_simple_auth:
            return svc.start_simple_auth(
                business_id=bid,
                card_corp_code=body.organization_code,
                auth_payload=body.auth,
                connection_type=conn_type,
            )
        conn = svc.register_card(
            business_id=bid,
            card_corp_code=body.organization_code,
            auth_payload=body.auth,
            connection_type=conn_type,
        )
    except CodefAdditionalAuth as e:
        # ID/PW 인데 카드사가 추가본인확인을 요구한 경우 — SMS 등.
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


@router.post("/connections/simple-auth/complete")
def complete_simple_auth(
    body: CompleteSimpleAuthRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """간편인증 2단계 — 사장님이 카톡/네이버앱 본인인증을 완료한 직후 호출.

    1단계(/connections/register) 응답으로 받은 ``auth_pending_id`` 를 그대로 전달.
    """
    resolve_bid(admin, x_view_as_business)
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.complete_simple_auth(auth_pending_id=body.auth_pending_id)
    except CodefAdditionalAuth as e:
        # 사장님이 인증 미완료/타임아웃 등 — 다시 시도 안내
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except CodefAuthExpired as e:
        raise HTTPException(400, f"인증 만료: {str(e)}")
    except CodefAPIError as e:
        detail = {"message": str(e), "code": e.code, "raw": e.raw}
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
    call_codef: bool = True,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """비활성화 + CODEF 측 connectedId 삭제 (06_delete_account).

    Query param ``call_codef=false`` 면 CODEF 호출 건너뛰고 DB 만 비활성 — DEMO 환경
    잔재가 PRODUCT 전환 후 청구에 영향 안 주도록 기본은 호출. CODEF 호출이 실패해도
    DB 는 deactivated 로 마킹되며 ``codef_error`` 필드로 원인 확인 가능.
    """
    resolve_bid(admin, x_view_as_business)
    svc = CodefConnectionService(engine=engine)
    try:
        result = svc.deactivate(connection_id=cid, call_codef=call_codef)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"status": "deactivated", **result}


class UpdateCredentialsRequest(BaseModel):
    """ID/PW 비번 변경 — auth 에 새 id + password 전달."""
    auth: dict  # {"id": "...", "password": "..."}


@router.post("/connections/{cid}/update-credentials")
def update_credentials(
    cid: int,
    body: UpdateCredentialsRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """ID/PW 인증 connection 의 비번 변경 (05_update_account).

    재등록(/reverify) 과 달리 같은 connectedId 를 유지 — 적재된 거래내역과의 연속성
    보존 + 호출 한도 절약. 간편인증(kakao 등) 방식 connection 은 ValueError.
    """
    resolve_bid(admin, x_view_as_business)
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.update_credentials(connection_id=cid, auth_payload=body.auth)
    except CodefAdditionalAuth as e:
        return {
            "status": "additional_auth_required",
            "method": e.method,
            "extra_info": e.extra_info,
        }
    except CodefAuthExpired as e:
        raise HTTPException(400, f"인증 만료: {str(e)}")
    except CodefAPIError as e:
        detail = {"message": str(e), "code": e.code, "raw": e.raw}
        raise HTTPException(400, detail)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"status": "active", "connection": _connection_dto(conn)}


# ─── 진단 (SuperAdmin) ─────────────────────────────

@router.get("/diagnostics/connected-id-sync")
def diagnose_connected_id_sync(
    admin: User = Depends(get_admin_user),
):
    """CODEF 측 connectedId 목록 vs 우리 DB 정합성 검증 (04_get_connected_id_list).

    client_id 단위로 CODEF 측 전체 connectedId 를 조회하고 우리 DB 의
    CodefConnection 과 양방향 diff 산출:

      - ``in_codef_not_in_db`` : CODEF 측에는 존재하나 우리 DB 어디에도 없음.
                                 (다른 환경에서 등록했거나 과거 잔재)
      - ``in_db_not_in_codef`` : 우리 DB 는 active 인데 CODEF 측에 없음.
                                 (CODEF 측에서 수동 삭제됨 → 재등록 필요)
      - ``deactivated_but_in_codef``: 우리는 deactivated 처리했는데 CODEF 측에 남아있음.
                                      (운영 청구 정확성 영향 — 06_delete 재시도 대상)
    """
    svc = CodefConnectionService(engine=engine)
    try:
        codef_ids = svc.list_codef_connected_ids()
    except CodefAPIError as e:
        raise HTTPException(502, {"message": str(e), "code": e.code, "raw": e.raw})

    with Session(engine) as s:
        all_rows = list(s.exec(select(CodefConnection)))

    db_by_cid: dict[str, list[CodefConnection]] = {}
    for row in all_rows:
        if not row.connected_id:
            continue
        db_by_cid.setdefault(row.connected_id, []).append(row)

    codef_set = set(codef_ids)
    db_set = set(db_by_cid.keys())

    in_codef_not_in_db = sorted(codef_set - db_set)
    in_db_not_in_codef = []
    deactivated_but_in_codef = []
    for cid, rows in db_by_cid.items():
        for row in rows:
            entry = {
                "connection_id": row.id,
                "business_id": row.business_id,
                "organization_code": row.organization_code,
                "organization_label": row.organization_label,
                "connection_type": row.connection_type,
                "connected_id": row.connected_id,
                "status": row.status,
            }
            if cid not in codef_set and row.status == "active":
                in_db_not_in_codef.append(entry)
            elif cid in codef_set and row.status == "deactivated":
                deactivated_but_in_codef.append(entry)

    return {
        "codef_total": len(codef_ids),
        "db_total": len(all_rows),
        "in_codef_not_in_db": in_codef_not_in_db,
        "in_db_not_in_codef": in_db_not_in_codef,
        "deactivated_but_in_codef": deactivated_but_in_codef,
        "summary": {
            "codef_only_count": len(in_codef_not_in_db),
            "db_active_missing_codef_count": len(in_db_not_in_codef),
            "stale_in_codef_count": len(deactivated_but_in_codef),
        },
    }
