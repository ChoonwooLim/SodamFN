"""기업정보 조회 API (Popbill BizInfoCheckService 래핑).

- GET  /api/bizinfo-check/status — 현재 프로바이더 (stub / popbill)
- POST /api/bizinfo-check — 단건 조회 { corp_num }

건당 요금 ~88원 (팝빌 포인트). stub 모드에서는 더미 데이터 반환.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from models import User
from routers.auth import get_admin_user
from services.bizinfo_check_service import get_provider

router = APIRouter(prefix="/bizinfo-check", tags=["bizinfo-check"])


class CheckIn(BaseModel):
    corp_num: str = Field(..., description="조회할 사업자번호 (하이픈 허용)")


@router.get("/status")
def get_status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env_override = os.getenv("BIZINFO_CHECK_PROVIDER", "").strip().lower() or "auto"
    is_stub = provider.name == "stub"
    note = (
        "⚠️ STUB 모드. 실제 조회가 아니라 더미 데이터를 반환합니다."
        if is_stub
        else f"✅ 실제 조회 활성 (팝빌 테스트환경 IsTest={os.getenv('POPBILL_IS_TEST', 'true')})."
    )
    return {"active": provider.name, "env_override": env_override, "is_stub": is_stub, "note": note}


@router.post("")
def check(
    body: CheckIn,
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    result = provider.check(body.corp_num)
    if not result.ok and result.error and "설정되지 않았" in result.error:
        raise HTTPException(status_code=500, detail=result.error)
    return result.to_dict()
