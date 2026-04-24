"""예금주조회 API (Popbill AccountCheckService 래핑).

- GET  /api/account-check/status — 현재 프로바이더 (stub / popbill)
- POST /api/account-check — 단건 조회 { bank_code | bank_name, account_number }

건당 요금 ~30원 (팝빌 포인트). stub 모드에서는 항상 '홍길동(STUB)' 반환.
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from models import User
from routers.auth import get_admin_user
from services.account_check_service import get_provider, BANK_NAMES

router = APIRouter(prefix="/account-check", tags=["account-check"])


class AccountCheckIn(BaseModel):
    bank_code: Optional[str] = Field(None, description="팝빌 은행코드 4자리 (예: '0088')")
    bank_name: Optional[str] = Field(None, description="은행명 (예: '신한은행', '신한'). bank_code 없을 때 사용")
    account_number: str = Field(..., min_length=1, description="계좌번호 (하이픈 허용)")


@router.get("/status")
def get_status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env_override = os.getenv("ACCOUNT_CHECK_PROVIDER", "").strip().lower() or "auto"
    is_stub = provider.name == "stub"
    note = (
        "⚠️ STUB 모드. 실제 조회가 아니라 항상 '홍길동(STUB)' 반환. "
        "POPBILL_LINK_ID/SECRET_KEY 설정 시 자동으로 popbill 활성화됩니다."
        if is_stub
        else f"✅ 실제 조회 활성 (팝빌 테스트환경 IsTest={os.getenv('POPBILL_IS_TEST', 'true')})."
    )
    return {"active": provider.name, "env_override": env_override, "is_stub": is_stub, "note": note}


@router.get("/banks")
def list_banks(_admin: User = Depends(get_admin_user)):
    """팝빌 은행코드 전체 목록 — 프론트 드롭다운용."""
    return [{"code": code, "name": name} for code, name in BANK_NAMES.items()]


@router.post("")
def check_account(
    body: AccountCheckIn,
    _admin: User = Depends(get_admin_user),
):
    bank_input = body.bank_code or body.bank_name or ""
    if not bank_input:
        raise HTTPException(status_code=400, detail="bank_code 또는 bank_name 중 하나를 입력하세요.")

    provider = get_provider()
    result = provider.check(bank_input, body.account_number)
    if not result.ok and result.error and "설정되지 않았" in result.error:
        raise HTTPException(status_code=500, detail=result.error)
    return result.to_dict()
