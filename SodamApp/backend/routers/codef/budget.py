"""CODEF 예산 + 비용 대시보드 라우터.

GET /api/codef/budget/current   — 이달 호출 수/비용 + settings
PUT /api/codef/budget/settings  — 월 예산/임계값 저장
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine
from models import User, CodefBudgetSetting
from routers.auth import get_admin_user
from ._helpers import resolve_bid
from services.codef.quota_service import CodefQuotaService


router = APIRouter(prefix="/api/codef/budget", tags=["codef"])


class BudgetSettings(BaseModel):
    monthly_budget_krw: int = Field(ge=0)
    warning_threshold_pct: int = Field(default=80, ge=1, le=100)
    hard_limit_pct: int = Field(default=100, ge=1, le=200)


@router.get("/current")
def current(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    quota = CodefQuotaService(engine=engine)
    summary = quota.current_month_summary(business_id=bid)

    with Session(engine) as s:
        setting = s.exec(
            select(CodefBudgetSetting).where(
                CodefBudgetSetting.business_id == bid
            )
        ).first()

    return {
        **summary,
        "settings": {
            "monthly_budget_krw": setting.monthly_budget_krw if setting else 0,
            "warning_threshold_pct": setting.warning_threshold_pct if setting else 80,
            "hard_limit_pct": setting.hard_limit_pct if setting else 100,
        },
    }


@router.put("/settings")
def update_settings(
    body: BudgetSettings,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        setting = s.exec(
            select(CodefBudgetSetting).where(
                CodefBudgetSetting.business_id == bid
            )
        ).first()
        if not setting:
            setting = CodefBudgetSetting(business_id=bid)
        setting.monthly_budget_krw = body.monthly_budget_krw
        setting.warning_threshold_pct = body.warning_threshold_pct
        setting.hard_limit_pct = body.hard_limit_pct
        setting.updated_at = datetime.datetime.utcnow()
        s.add(setting)
        s.commit()
        s.refresh(setting)
    return {"ok": True}
