"""홈택스 전자세금계산서 수집 API (Popbill HTTaxinvoiceService).

부서사용자 등록 → 수집요청(JobID) → 작업상태 폴링 → 결과 조회.
주 사용처: 매월 세무사 준비, 매출/매입 통합 검증.

엔드포인트:
- GET  /api/hometax/status                현재 프로바이더
- GET  /api/hometax/dept-user             부서사용자 등록 여부
- POST /api/hometax/dept-user             { dept_user_id, dept_user_pwd }
- DEL  /api/hometax/dept-user
- GET  /api/hometax/dept-user/login-check 로그인 가능 여부 (PW 만료 등)
- POST /api/hometax/request-job           { type: SELL|BUY, s_date, e_date }
- GET  /api/hometax/job-state/{job_id}
- GET  /api/hometax/active-jobs
- GET  /api/hometax/search                ?job_id=&type=SELL|BUY&page=&per_page=
- GET  /api/hometax/summary               ?job_id=&type=
- GET  /api/hometax/popbill-url           ?togo=HOMETAX|CERT
"""
from __future__ import annotations

import os
import re
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from models import User
from routers.auth import get_admin_user
from services.hometax_service import get_provider

router = APIRouter(prefix="/hometax", tags=["hometax"])


def _validate_date(d: str, label: str) -> str:
    s = re.sub(r"\D", "", d or "")
    if len(s) != 8:
        raise HTTPException(status_code=400, detail=f"{label}는 YYYYMMDD 형식이어야 합니다.")
    return s


# ─── schemas ───

class RegistDeptIn(BaseModel):
    dept_user_id: str = Field(..., min_length=1)
    dept_user_pwd: str = Field(..., min_length=1)


class RequestJobIn(BaseModel):
    type: str = Field("SELL", description="SELL(매출) / BUY(매입) / TRUSTEE(수탁)")
    s_date: str = Field(..., description="시작일 YYYYMMDD")
    e_date: str = Field(..., description="종료일 YYYYMMDD")


# ─── status ───

@router.get("/status")
def status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    is_stub = provider.name == "stub"
    return {
        "active": provider.name,
        "is_stub": is_stub,
        "env_override": os.getenv("HOMETAX_PROVIDER", "").strip().lower() or "auto",
        "note": "STUB 모드" if is_stub else f"실제 수집 활성 (IsTest={os.getenv('POPBILL_IS_TEST', 'true')})",
    }


# ─── dept user ───

@router.get("/dept-user")
def get_dept_user(_admin: User = Depends(get_admin_user)):
    return get_provider().check_dept_user()


@router.post("/dept-user")
def regist_dept_user(body: RegistDeptIn, _admin: User = Depends(get_admin_user)):
    res = get_provider().regist_dept_user(body.dept_user_id, body.dept_user_pwd)
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.error or "등록 실패")
    return {"ok": True}


@router.delete("/dept-user")
def delete_dept_user(_admin: User = Depends(get_admin_user)):
    res = get_provider().delete_dept_user()
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.error or "삭제 실패")
    return {"ok": True}


@router.get("/dept-user/login-check")
def check_login_dept_user(_admin: User = Depends(get_admin_user)):
    res = get_provider().check_login_dept_user()
    return res.to_dict()


# ─── jobs ───

@router.post("/request-job")
def request_job(body: RequestJobIn, _admin: User = Depends(get_admin_user)):
    s = _validate_date(body.s_date, "시작일")
    e = _validate_date(body.e_date, "종료일")
    type_ = (body.type or "SELL").upper()
    if type_ not in ("SELL", "BUY", "TRUSTEE"):
        raise HTTPException(status_code=400, detail="type은 SELL / BUY / TRUSTEE 중 하나여야 합니다.")
    res = get_provider().request_job(type_, s, e)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "요청 실패")
    return res


@router.get("/job-state/{job_id}")
def job_state(job_id: str, _admin: User = Depends(get_admin_user)):
    return get_provider().get_job_state(job_id).to_dict()


@router.get("/active-jobs")
def active_jobs(_admin: User = Depends(get_admin_user)):
    rows = get_provider().list_active_jobs()
    return [r.to_dict() for r in rows]


# ─── results ───

@router.get("/search")
def search(
    job_id: str = Query(..., min_length=1),
    type: str = Query("SELL", description="SELL/BUY/TRUSTEE"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    _admin: User = Depends(get_admin_user),
):
    type_ = (type or "SELL").upper()
    return get_provider().search(
        job_id=job_id, type_filter=[type_], page=page, per_page=per_page,
    )


@router.get("/summary")
def summary(
    job_id: str = Query(..., min_length=1),
    type: str = Query("SELL", description="SELL/BUY/TRUSTEE"),
    _admin: User = Depends(get_admin_user),
):
    type_ = (type or "SELL").upper()
    return get_provider().summary(job_id=job_id, type_filter=[type_])


# ─── helpers / popbill url ───

@router.get("/popbill-url")
def popbill_url(
    togo: str = Query("HOMETAX", description="HOMETAX(부서사용자관리) / CERT(인증서등록)"),
    _admin: User = Depends(get_admin_user),
):
    try:
        url = get_provider().get_popbill_url(togo=togo)
        return {"ok": True, "url": url, "togo": togo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-range")
def quick_range(_admin: User = Depends(get_admin_user)):
    """빠른 기간 프리셋 (이번달/지난달/최근3개월)."""
    today = date.today()
    first_this = today.replace(day=1)
    last_month_end = first_this - timedelta(days=1)
    first_last = last_month_end.replace(day=1)
    three_months_ago = (first_this - timedelta(days=90))

    def _fmt(d: date) -> str: return d.strftime("%Y%m%d")

    return {
        "this_month": {"label": "이번달", "s_date": _fmt(first_this), "e_date": _fmt(today)},
        "last_month": {"label": "지난달", "s_date": _fmt(first_last), "e_date": _fmt(last_month_end)},
        "last_3months": {"label": "최근 3개월", "s_date": _fmt(three_months_ago), "e_date": _fmt(today)},
    }
