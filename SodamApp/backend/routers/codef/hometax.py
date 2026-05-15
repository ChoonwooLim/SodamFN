"""홈택스 수집 라우터 (CODEF organization 0001 국세청).

- GET  /api/codef/hometax/connection            : 연결 상태
- POST /api/codef/hometax/connect               : connectedId 발급 (ID/PW · 공동인증서 · 간편인증)
- POST /api/codef/hometax/simple-auth/complete  : 간편인증 2단계
- DELETE /api/codef/hometax/connection          : 연결 해제 (CODEF 측 delete + DB deactivate)
- POST /api/codef/hometax/sync                  : record_type 별 sync (cash_sales/cash_purchase/tax_invoice_integrated)
- GET  /api/codef/hometax/records               : 적재된 자료 목록 (필터)
- GET  /api/codef/hometax/summary               : 요약 통계 (record_type 별 건수/합계)
- GET  /api/codef/hometax/cursors               : sync cursor 상태

발행은 팝빌, 조회/수집은 CODEF 전용 — 외부 통합 전략 일관.
"""
from __future__ import annotations

import datetime
import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from database import engine
from models import (
    CodefConnection,
    HometaxRecord,
    HometaxSyncCursor,
    User,
)
from routers.auth import get_admin_user
from services.codef.connection_service import CodefConnectionService
from services.codef.exceptions import (
    CodefAdditionalAuth,
    CodefAPIError,
    CodefAuthExpired,
)
from services.codef.hometax_provider import (
    HOMETAX_ORG_CODE,
    CodefHometaxProvider,
)
from services.codef.organization_catalog import get_organization
from ._helpers import resolve_bid


router = APIRouter(prefix="/api/codef/hometax", tags=["codef-hometax"])


# ─── schemas ──────────────────────────────────────

class ConnectRequest(BaseModel):
    """홈택스 connectedId 발급 요청. 3가지 인증 방식 모두 지원.

    형식:
      ID/PW         : {"id": "...", "password": "...", "client_type": "B"}
      공동인증서    : {"certFile": "<b64>", "keyFile": "<b64>", "certPwd": "...",
                       "client_type": "B"}
      간편인증      : {"loginType": "kakao"|"naver"|"pass"|"toss"|"payco"|"samsung",
                       "userName": "홍지연", "phoneNo": "01071391796",
                       "birthDate": "19800101", "telecom": "0",
                       "client_type": "B"}
    """
    auth: dict


class CompleteSimpleAuthRequest(BaseModel):
    auth_pending_id: int


VALID_RECORD_TYPES = {
    "cash_sales", "cash_purchase",
    "tax_invoice_integrated",  # 매출+매입 한 번에
}


class SyncRequest(BaseModel):
    record_type: str = Field(..., description=(
        "cash_sales / cash_purchase / tax_invoice_integrated"
    ))


# ─── helpers ──────────────────────────────────────

def _connection_dto(c: CodefConnection) -> dict:
    return {
        "id": c.id,
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


def _get_hometax_connection(bid: int) -> Optional[CodefConnection]:
    with Session(engine) as s:
        return s.exec(
            select(CodefConnection)
            .where(CodefConnection.business_id == bid)
            .where(CodefConnection.organization_code == HOMETAX_ORG_CODE)
            .where(CodefConnection.status != "deactivated")
            .order_by(CodefConnection.id.desc())
        ).first()


def _register_hometax_connection(
    svc: CodefConnectionService, business_id: int, auth_payload: dict,
) -> dict:
    """홈택스 등록 — 은행과 동일 패턴 (register_bank 재사용).

    organization_catalog 의 type='public_tax' 라 register_bank 가 ValueError —
    하지만 SDK 페이로드 구조는 은행과 동일(BK businessType 가능). 여기서는
    public_tax 전용 빌더로 직접 호출.
    """
    org = get_organization(HOMETAX_ORG_CODE)
    if not org:
        raise ValueError(f"organization {HOMETAX_ORG_CODE} 카탈로그 미등록")

    biz_reg_no = svc._get_business_reg_no(business_id)  # type: ignore[attr-defined]
    sdk_payload, auth_method = _build_hometax_payload(
        svc, org, auth_payload, biz_reg_no,
    )

    # 간편인증이면 2-step
    login_type = (auth_payload.get("loginType") or "").lower()
    if login_type in svc.SIMPLE_AUTH_LOGIN_TYPES:
        # start_simple_auth 의 sdk_payload 빌더는 카드 전용 — 우리 빌더로 교체 호출.
        return _start_hometax_simple_auth(
            svc=svc, business_id=business_id, org=org, login_type=login_type,
            sdk_payload=sdk_payload, auth_method=auth_method,
        )

    # 즉시 등록 (ID/PW · 공동인증서)
    result = svc._client.create_account(sdk_payload)  # type: ignore[attr-defined]
    conn = svc._upsert_connection(  # type: ignore[attr-defined]
        business_id=business_id,
        organization=org,
        connected_id=result.connected_id,
        auth_method=auth_method,
        connection_type="hometax",
    )
    return {"status": "active", "connection": _connection_dto(conn)}


def _build_hometax_payload(
    svc: CodefConnectionService, org, auth_payload: dict, biz_reg_no: str,
) -> tuple[dict, str]:
    """홈택스 인증 페이로드 빌드 (3가지 방식).

    CODEF 공공기관(0001 국세청) 의 표준 페이로드:
      businessType : "PB" (Public)
      loginType    : "0" 공동인증서 / "1" ID/PW / "5" 간편인증
      loginTypeLevel: 간편인증 사 코드 (카카오=1, 페이코=2, 삼성패스=3,
                      KB모바일=4, 통신사PASS=5, 네이버=6, 신한인증서=7, 토스=8)
    """
    client_type = (auth_payload.get("client_type") or "B").upper()
    if client_type not in {"P", "B"}:
        client_type = "B"

    base = {
        "countryCode": "KR",
        "businessType": "PB",  # 공공기관 (Public)
        "clientType": client_type,
        "organization": org.code,
    }
    if client_type == "B" and biz_reg_no:
        base["businessRegNo"] = biz_reg_no

    # 1) 공동인증서
    if "certFile" in auth_payload and "keyFile" in auth_payload:
        cert_pwd = auth_payload.get("certPwd") or auth_payload.get("cert_pwd") or ""
        account = {
            **base,
            "loginType": "0",
            "certType": "1",
            "certFile": auth_payload["certFile"],
            "keyFile": auth_payload["keyFile"],
            "certPassword": svc._client.encrypt_password(cert_pwd) if cert_pwd else "",  # type: ignore[attr-defined]
        }
        return {"accountList": [account]}, "cert"

    # 2) 간편인증 — CODEF 표준 loginTypeLevel 매핑
    simple_types_level = {
        "kakao": "1", "payco": "2", "samsung": "3", "kbmobile": "4",
        "pass": "5", "naver": "6", "shinhan": "7", "toss": "8",
    }
    login_type = (auth_payload.get("loginType") or "").lower()
    if login_type in simple_types_level:
        # CF-00007 회피: 카드/은행 simple_auth 와 동일하게 빈 값도 키는 유지.
        # CODEF 가 키 누락을 "잘못된 파라미터" 로 판단하는 경우 대응.
        user_name = (auth_payload.get("userName") or "").strip()
        phone_no = (auth_payload.get("phoneNo") or auth_payload.get("phone") or "").strip()
        birth_date = (auth_payload.get("birthDate") or auth_payload.get("identity") or "").strip()
        if not user_name:
            raise ValueError("간편인증은 이름이 필요합니다.")
        if not phone_no:
            raise ValueError("간편인증은 휴대폰 번호가 필요합니다.")
        if not birth_date:
            raise ValueError("간편인증은 생년월일(YYYYMMDD)이 필요합니다.")
        account = {
            **base,
            "loginType": "5",
            "loginTypeLevel": simple_types_level[login_type],
            "userName": user_name,
            "phoneNo": re.sub(r"\D", "", phone_no),
            "birthDate": re.sub(r"\D", "", birth_date),
            "telecom": auth_payload.get("telecom", "0"),
            "isIdentify": "1",
            "is2Way": "true",
        }
        return {"accountList": [account]}, f"simple_{login_type}"

    # 3) ID/PW (홈택스 ID) — 2차 인증으로 대표자 주민번호 필요
    if "id" in auth_payload and "password" in auth_payload:
        encrypted = svc._client.encrypt_password(auth_payload["password"])  # type: ignore[attr-defined]
        # 주민번호 — 7자리 (앞자리만) 또는 13자리 모두 허용. 숫자만 추출.
        identity = re.sub(r"\D", "", str(auth_payload.get("identity") or ""))
        if not identity or len(identity) < 7:
            raise ValueError(
                "홈택스 ID 로그인은 2차 인증으로 대표자 주민번호 앞 7자리가 필요합니다. "
                "identity 필드에 주민번호(7자리 또는 13자리)를 입력해주세요.",
            )
        account = {
            **base,
            "loginType": "1",
            "id": auth_payload["id"],
            "password": encrypted,
            "identity": identity,  # CODEF 가 홈택스 2차 인증 단계에서 사용
        }
        return {"accountList": [account]}, "id_pw"

    raise ValueError(
        "auth_payload 가 ID/PW 또는 공동인증서 또는 간편인증 형식이 아님",
    )


def _start_hometax_simple_auth(*, svc: CodefConnectionService, business_id: int,
                                org, login_type: str, sdk_payload: dict,
                                auth_method: str) -> dict:
    """홈택스 간편인증 1단계 — CodefConnectionService.start_simple_auth 의 hometax 버전.

    payload 빌더만 차이. 결과 구조는 동일.
    """
    import json
    import datetime as _dt

    from models import PendingCodefAuth

    response = svc._client.create_account_raw(sdk_payload)  # type: ignore[attr-defined]
    result = response.get("result", {}) or {}
    code = result.get("code", "")
    if code not in {"CF-03002", "CF-03012", "CF-03013"}:
        raise CodefAPIError(
            code=code or "unexpected",
            message=(
                f"간편인증 1단계 응답이 추가인증 코드가 아님: "
                f"{result.get('message', '')} {result.get('extraMessage', '')}"
            ).strip(),
            raw=response,
        )
    data = response.get("data") or {}
    required = ("jobIndex", "threadIndex", "jti", "twoWayTimestamp")
    if not all(k in data for k in required):
        raise CodefAPIError(
            code=code,
            message=f"twoWayInfo 필수 4 키 누락 — 받은 키: {list(data.keys())}",
            raw=response,
        )
    two_way = {
        "jobIndex": int(data["jobIndex"]),
        "threadIndex": int(data["threadIndex"]),
        "twoWayTimestamp": int(data["twoWayTimestamp"]),
        "jti": data["jti"],
    }
    extra_info = data.get("extraInfo") or data

    now = _dt.datetime.utcnow()
    expires_at = now + _dt.timedelta(minutes=2)
    with Session(engine) as s:
        pending = PendingCodefAuth(
            business_id=business_id,
            organization_code=org.code,
            connection_type="hometax",
            auth_method=auth_method,
            payload_json=json.dumps(sdk_payload, ensure_ascii=False),
            extra_info_json=json.dumps(
                {"twoWayInfo": two_way, "extraInfo": extra_info},
                ensure_ascii=False,
            ),
            created_at=now,
            expires_at=expires_at,
        )
        s.add(pending); s.commit(); s.refresh(pending)
        pending_id = pending.id

    return {
        "status": "additional_auth_required",
        "method": auth_method,
        "auth_pending_id": pending_id,
        "extra_info": extra_info,
        "expires_at": expires_at.isoformat(),
    }


# ─── endpoints ────────────────────────────────────

@router.get("/connection")
def get_connection(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """현재 사업장의 홈택스 연결 상태 (active/expired/없음)."""
    bid = resolve_bid(admin, x_view_as_business)
    conn = _get_hometax_connection(bid)
    if not conn:
        return {"connected": False, "connection": None}
    return {"connected": conn.status == "active", "connection": _connection_dto(conn)}


@router.post("/connect")
def connect(
    body: ConnectRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    import logging
    log = logging.getLogger("sodam.codef.hometax.connect")
    bid = resolve_bid(admin, x_view_as_business)
    # auth 의 password/certPwd 등 민감 정보 마스킹 후 로깅 (디버그 — Phase 1 검증용)
    masked = {
        k: ("***" if k in {"password", "certPwd", "cert_pwd"} else v)
        for k, v in (body.auth or {}).items()
    }
    log.warning("hometax/connect bid=%s payload_keys=%s payload=%s", bid, list(masked.keys()), masked)
    svc = CodefConnectionService(engine=engine)
    try:
        return _register_hometax_connection(svc, bid, body.auth)
    except CodefAdditionalAuth as e:
        return {"status": "additional_auth_required", "method": e.method, "extra_info": e.extra_info}
    except CodefAuthExpired as e:
        raise HTTPException(400, f"인증 만료: {e}")
    except CodefAPIError as e:
        log.error("hometax/connect CODEF API error code=%s msg=%s raw=%s",
                  e.code, str(e), str(e.raw)[:1000])
        raise HTTPException(400, {"message": str(e), "code": e.code, "raw": e.raw})
    except ValueError as e:
        log.error("hometax/connect ValueError: %s", e)
        raise HTTPException(400, str(e))


@router.post("/simple-auth/complete")
def complete_simple_auth(
    body: CompleteSimpleAuthRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """간편인증 2단계 — 사장님 모바일 본인인증 완료 직후 호출."""
    resolve_bid(admin, x_view_as_business)
    svc = CodefConnectionService(engine=engine)
    try:
        conn = svc.complete_simple_auth(auth_pending_id=body.auth_pending_id)
    except CodefAdditionalAuth as e:
        return {"status": "additional_auth_required", "method": e.method, "extra_info": e.extra_info}
    except CodefAuthExpired as e:
        raise HTTPException(400, f"인증 만료: {e}")
    except CodefAPIError as e:
        raise HTTPException(400, {"message": str(e), "code": e.code, "raw": e.raw})
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"status": "active", "connection": _connection_dto(conn)}


@router.delete("/connection")
def disconnect(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """홈택스 연결 해제 — CODEF 측 connectedId 도 삭제."""
    bid = resolve_bid(admin, x_view_as_business)
    conn = _get_hometax_connection(bid)
    if not conn:
        return {"status": "no_active_connection"}
    svc = CodefConnectionService(engine=engine)
    result = svc.deactivate(connection_id=conn.id, call_codef=True)
    return {"status": "deactivated", **result}


@router.post("/sync")
def sync(
    body: SyncRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """record_type 별 sync 실행 (cash_sales/cash_purchase/tax_invoice_integrated)."""
    if body.record_type not in VALID_RECORD_TYPES:
        raise HTTPException(400, f"잘못된 record_type. 허용: {sorted(VALID_RECORD_TYPES)}")
    bid = resolve_bid(admin, x_view_as_business)
    conn = _get_hometax_connection(bid)
    if not conn or conn.status != "active":
        raise HTTPException(400, "홈택스 연결이 활성 상태가 아닙니다. 먼저 [홈택스 연결]을 진행해주세요.")

    provider = CodefHometaxProvider(engine=engine)
    if body.record_type == "cash_sales":
        result = provider.sync_cash_sales(conn.id)
    elif body.record_type == "cash_purchase":
        result = provider.sync_cash_purchase(conn.id)
    else:  # tax_invoice_integrated
        result = provider.sync_tax_invoice_integrated(conn.id)

    return {
        "ok": result.ok,
        "record_type": result.record_type,
        "rows_inserted": result.rows_inserted,
        "rows_updated": result.rows_updated,
        "rows_total": result.rows_total,
        "error": result.error,
    }


@router.get("/records")
def list_records(
    record_type: Optional[str] = Query(None),
    s_date: Optional[str] = Query(None, description="시작일 YYYY-MM-DD (기본: 90일 전)"),
    e_date: Optional[str] = Query(None, description="종료일 YYYY-MM-DD (기본: 오늘)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    sd = _parse_iso_date(s_date) or (datetime.date.today() - datetime.timedelta(days=90))
    ed = _parse_iso_date(e_date) or datetime.date.today()

    with Session(engine) as s:
        stmt = (
            select(HometaxRecord)
            .where(HometaxRecord.business_id == bid)
            .where(HometaxRecord.tx_date >= sd, HometaxRecord.tx_date <= ed)
        )
        if record_type:
            stmt = stmt.where(HometaxRecord.record_type == record_type)
        stmt = stmt.order_by(HometaxRecord.tx_date.desc(), HometaxRecord.id.desc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        rows = s.exec(stmt).all()

    return {
        "ok": True,
        "page": page, "per_page": per_page,
        "s_date": sd.isoformat(), "e_date": ed.isoformat(),
        "rows": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "identifier": r.identifier,
                "tx_date": r.tx_date.isoformat(),
                "counterparty_name": r.counterparty_name,
                "counterparty_corp_num": r.counterparty_corp_num,
                "supply_cost": r.supply_cost,
                "tax": r.tax,
                "total_amount": r.total_amount,
                "item_name": r.item_name,
            }
            for r in rows
        ],
    }


@router.get("/summary")
def summary(
    s_date: Optional[str] = Query(None),
    e_date: Optional[str] = Query(None),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """record_type 별 건수 + 총액 요약."""
    bid = resolve_bid(admin, x_view_as_business)
    sd = _parse_iso_date(s_date) or (datetime.date.today() - datetime.timedelta(days=90))
    ed = _parse_iso_date(e_date) or datetime.date.today()
    with Session(engine) as s:
        rows = s.exec(
            select(
                HometaxRecord.record_type,
                func.count(HometaxRecord.id),
                func.coalesce(func.sum(HometaxRecord.total_amount), 0),
            )
            .where(HometaxRecord.business_id == bid)
            .where(HometaxRecord.tx_date >= sd, HometaxRecord.tx_date <= ed)
            .group_by(HometaxRecord.record_type)
        ).all()
    return {
        "ok": True,
        "s_date": sd.isoformat(), "e_date": ed.isoformat(),
        "by_type": [
            {"record_type": r[0], "count": int(r[1] or 0), "total": int(r[2] or 0)}
            for r in rows
        ],
    }


@router.get("/cursors")
def list_cursors(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cursors = s.exec(
            select(HometaxSyncCursor).where(HometaxSyncCursor.business_id == bid)
        ).all()
    return {
        "ok": True,
        "cursors": [
            {
                "record_type": c.record_type,
                "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
                "last_tx_date": c.last_tx_date.isoformat() if c.last_tx_date else None,
                "last_status": c.last_status,
                "last_error": c.last_error,
                "rows_total": c.rows_total,
            }
            for c in cursors
        ],
    }


def _parse_iso_date(s: Optional[str]) -> Optional[datetime.date]:
    if not s:
        return None
    try:
        return datetime.date.fromisoformat(s)
    except ValueError:
        return None
