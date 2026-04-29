"""CODEF 라우터 공통 헬퍼.

SuperAdmin View-As 패턴 — bank_sync.py 와 동일한 _resolve_bid.
"""
from typing import Optional
from fastapi import HTTPException

from models import User


def resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    """admin 의 business_id 를 결정.

    - 일반 admin: admin.business_id 사용
    - superadmin: X-View-As-Business 헤더 우선
    - 둘 다 없으면 400
    """
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(
            status_code=400,
            detail="사업장 정보가 없습니다. (SuperAdmin은 먼저 대상 사업장을 선택하세요.)",
        )
    return bid
