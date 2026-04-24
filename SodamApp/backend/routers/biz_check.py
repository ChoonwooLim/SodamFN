"""사업자등록상태 조회 API (Popbill ClosedownService 래핑).

- GET  /api/biz-check/status — 현재 프로바이더 (stub / popbill)
- POST /api/biz-check — 단건 조회 { corp_num }
- POST /api/biz-check/batch — 다건 조회 { corp_nums: [10개자리 * 1000이하] }

건당 요금 ~30원 (팝빌 포인트). stub 모드에서는 항상 '정상(등록)' 반환.
"""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from models import User
from routers.auth import get_admin_user
from services.biz_check_service import get_provider, PopbillBizCheckProvider

router = APIRouter(prefix="/biz-check", tags=["biz-check"])


class SingleCheckIn(BaseModel):
    corp_num: str = Field(..., description="사업자등록번호 (하이픈 허용)")


class BatchCheckIn(BaseModel):
    corp_nums: List[str] = Field(..., min_length=1, max_length=1000)


@router.get("/status")
def get_status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env_override = os.getenv("BIZ_CHECK_PROVIDER", "").strip().lower() or "auto"
    is_stub = provider.name == "stub"
    note = (
        "⚠️ STUB 모드. 실제 조회가 아니라 항상 '정상(등록)' 반환. "
        "POPBILL_LINK_ID/SECRET_KEY 설정 시 자동으로 popbill 활성화됩니다."
        if is_stub
        else f"✅ 실제 조회 활성 (팝빌 테스트환경 IsTest={os.getenv('POPBILL_IS_TEST', 'true')})."
    )
    return {"active": provider.name, "env_override": env_override, "is_stub": is_stub, "note": note}


@router.post("")
def check_one(
    body: SingleCheckIn,
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    result = provider.check_one(body.corp_num)
    if not result.ok and result.error and "설정되지 않았" in result.error:
        raise HTTPException(status_code=500, detail=result.error)
    return result.to_dict()


@router.post("/batch")
def check_batch(
    body: BatchCheckIn,
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    results = provider.check_many(body.corp_nums)
    return {
        "total": len(results),
        "results": [r.to_dict() for r in results],
    }
