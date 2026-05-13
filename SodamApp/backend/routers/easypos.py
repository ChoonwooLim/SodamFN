"""이지포스(KICC smart.easypos.net) 매출 자동수집 라우터.

엔드포인트:
  POST   /api/easypos/credential       — 자격증명 등록/갱신 (ID/PW)
  GET    /api/easypos/credential       — 등록 상태 조회 (PW 는 비노출)
  DELETE /api/easypos/credential       — 자격증명 삭제
  POST   /api/easypos/test-login       — 즉시 로그인 테스트
  POST   /api/easypos/sync/manual      — 수동 동기화 (특정 일자 또는 범위)
  POST   /api/easypos/sync/cron-trigger — Orbitron cron 호출용 (전 사업장)
  GET    /api/easypos/sync/logs        — 동기화 이력
  GET    /api/easypos/dashboard        — 대시보드 (월별/주간 요약)

권한: admin/superadmin. X-View-As-Business 헤더로 superadmin 이 다른 사업장 조회 가능.
"""
from __future__ import annotations

import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine
from models import (
    EasyPosCredential,
    EasyPosSyncLog,
    User,
)
from routers.auth import get_admin_user
from services.crypto_util import encrypt_text, decrypt_text
from services.easypos_service import (
    EasyPosClient,
    EasyPosError,
    upsert_card_sales,
    upsert_daily_receipts,
    upsert_revenue_aggregate,
)


log = logging.getLogger("easypos.router")
router = APIRouter(prefix="/api/easypos", tags=["easypos"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


# ───── DTOs ──────────────────────────────────────────────────────

class CredentialIn(BaseModel):
    easypos_id: str = Field(..., min_length=4, max_length=64,
                            description="이지포스 가맹점 로그인 ID (보통 사업자번호)")
    password: str = Field(..., min_length=4, max_length=128,
                          description="이지포스 비밀번호 (평문 — 서버가 즉시 Fernet 암호화)")


class ManualSyncIn(BaseModel):
    sale_date: Optional[datetime.date] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None


# ───── 1) 자격증명 ─────────────────────────────────────────────

@router.post("/credential")
def upsert_credential(
    body: CredentialIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """ID/PW 등록 또는 갱신. (business_id 당 1건)"""
    bid = _resolve_bid(admin, x_view_as_business)
    now = datetime.datetime.utcnow()
    with Session(engine) as s:
        row = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == bid)
        ).first()
        if row:
            row.easypos_id = body.easypos_id.strip()
            row.password_encrypted = encrypt_text(body.password)
            row.status = "active"
            row.last_failed_at = None
            row.last_error_message = None
            row.updated_at = now
            s.add(row)
        else:
            row = EasyPosCredential(
                business_id=bid,
                easypos_id=body.easypos_id.strip(),
                password_encrypted=encrypt_text(body.password),
                status="active",
            )
            s.add(row)
        s.commit()
        s.refresh(row)
        return _cred_dto(row)


@router.get("/credential")
def get_credential(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == bid)
        ).first()
        if not row:
            return {"registered": False}
        return {"registered": True, **_cred_dto(row)}


@router.delete("/credential")
def delete_credential(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == bid)
        ).first()
        if not row:
            raise HTTPException(404, "등록된 자격증명이 없습니다.")
        s.delete(row)
        s.commit()
        return {"ok": True}


def _cred_dto(row: EasyPosCredential) -> dict:
    return {
        "id": row.id,
        "easypos_id": row.easypos_id,
        "shop_name": row.shop_name,
        "erp_shop_code": row.erp_shop_code,
        "status": row.status,
        "last_verified_at": row.last_verified_at.isoformat() if row.last_verified_at else None,
        "last_failed_at": row.last_failed_at.isoformat() if row.last_failed_at else None,
        "last_error_message": row.last_error_message,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


# ───── 2) 로그인 테스트 ────────────────────────────────────────

@router.post("/test-login")
def test_login(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """저장된 자격증명으로 즉시 로그인 시도 — 매장정보·POS 목록 반환."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == bid)
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명이 등록되지 않았습니다.")

        try:
            password = decrypt_text(cred.password_encrypted)
        except Exception:
            raise HTTPException(500, "비밀번호 복호화 실패 — CREDENTIAL_ENCRYPTION_KEY 가 변경되었을 수 있습니다. 자격증명 재입력 필요.")

        with EasyPosClient() as c:
            login = c.login(cred.easypos_id, password)
            if not login.ok:
                cred.last_failed_at = datetime.datetime.utcnow()
                cred.last_error_message = login.error_message
                cred.status = "failed"
                s.add(cred)
                s.commit()
                # 422: 외부 시스템 인증 실패 — 401 쓰면 프론트 axios interceptor 가
                # 셈하나 세션 만료로 오해해서 자동 로그아웃 됨.
                raise HTTPException(422, login.error_message or "이지포스 로그인 실패")
            # 매장정보 동기화
            cred.shop_name = login.shop_name or cred.shop_name
            cred.erp_shop_code = login.erp_shop_code or cred.erp_shop_code
            cred.head_office_no = login.head_office_no or cred.head_office_no
            cred.status = "active"
            cred.last_verified_at = datetime.datetime.utcnow()
            cred.last_failed_at = None
            cred.last_error_message = None
            s.add(cred)
            s.commit()

            try:
                pos_list = c.fetch_shop_pos_list(cred.easypos_id)
            except EasyPosError as e:
                pos_list = []
                log.warning("fetch_shop_pos_list failed: %s", e)

            return {
                "ok": True,
                "shop_name": login.shop_name,
                "user_name": login.user_name,
                "erp_shop_code": login.erp_shop_code,
                "pos_list": pos_list,
                "warning_message": login.warning_message,
            }


# ───── 3) 수동 동기화 ──────────────────────────────────────────

@router.post("/sync/manual")
def sync_manual(
    body: ManualSyncIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """수동 동기화 — 단일 일자 또는 범위. range 는 31일 제한."""
    bid = _resolve_bid(admin, x_view_as_business)

    if body.sale_date:
        dates = [body.sale_date]
    elif body.start_date and body.end_date:
        if body.end_date < body.start_date:
            raise HTTPException(400, "end_date 가 start_date 보다 빠릅니다.")
        delta = (body.end_date - body.start_date).days
        if delta > 30:
            raise HTTPException(400, "한 번에 최대 31일만 동기화할 수 있습니다.")
        dates = [body.start_date + datetime.timedelta(days=i) for i in range(delta + 1)]
    else:
        dates = [datetime.date.today() - datetime.timedelta(days=1)]   # 어제

    summary = _run_sync(bid, dates, triggered_by="manual")
    return {"ok": True, **summary}


# ───── 4) 자동 cron (Orbitron 호출) ───────────────────────────

@router.post("/sync/cron-trigger")
def sync_cron_trigger(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Orbitron cron 이 매일 새벽 03:00 KST 에 호출 → 전 사업장 전일 매출 수집.

    인증: 환경변수 CRON_SHARED_SECRET 과 X-Cron-Secret 헤더 일치
    (CODEF /api/codef/sync-cards/run 과 동일 패턴).
    """
    import os
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(401, "invalid cron secret")

    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    with Session(engine) as s:
        bids = [r for r in s.exec(
            select(EasyPosCredential.business_id).where(
                EasyPosCredential.status == "active"
            )
        )]

    results = []
    for bid in bids:
        try:
            r = _run_sync(bid, [yesterday], triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:
            log.error("cron sync failed for bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})

    return {
        "ok": True,
        "target_date": yesterday.isoformat(),
        "business_count": len(bids),
        "results": results,
    }


# ───── 5) 이력 / 대시보드 ─────────────────────────────────────

@router.get("/sync/logs")
def list_sync_logs(
    limit: int = 30,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        rows = s.exec(
            select(EasyPosSyncLog)
            .where(EasyPosSyncLog.business_id == bid)
            .order_by(EasyPosSyncLog.started_at.desc())
            .limit(min(max(limit, 1), 200))
        ).all()
        return [_log_dto(r) for r in rows]


@router.get("/dashboard")
def fetch_dashboard(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """이지포스 실시간 대시보드 — DB 캐시 없이 매 호출 시 이지포스 직접 조회."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == bid)
        ).first()
    if not cred:
        raise HTTPException(404, "자격증명 미등록")
    password = decrypt_text(cred.password_encrypted)
    with EasyPosClient() as c:
        login = c.login(cred.easypos_id, password)
        if not login.ok:
            raise HTTPException(422, login.error_message or "이지포스 로그인 실패")
        return c.fetch_dashboard(cred.easypos_id)


# ───── 핵심 동기화 로직 ──────────────────────────────────────

def _run_sync(business_id: int, dates: list[datetime.date],
              triggered_by: str = "manual") -> dict:
    """주어진 날짜 list 를 순회하며 영수증 수집 + Revenue 집계.

    각 일자별로 EasyPosSyncLog 1건 기록. 중간 실패 시 해당 일자만 failed.
    """
    summary = {
        "total_dates": len(dates),
        "success_dates": 0,
        "failed_dates": 0,
        "total_inserted": 0,
        "total_updated": 0,
        "total_sales_amount": 0,
        "errors": [],
    }

    with Session(engine) as s:
        cred = s.exec(
            select(EasyPosCredential).where(EasyPosCredential.business_id == business_id)
        ).first()
        if not cred:
            raise EasyPosError("자격증명 미등록 — 셈하나 /external-integration/easypos 에서 등록 필요")
        try:
            password = decrypt_text(cred.password_encrypted)
        except Exception:
            raise EasyPosError("비밀번호 복호화 실패 — 자격증명 재입력 필요")
        easypos_id = cred.easypos_id

    with EasyPosClient() as c:
        login = c.login(easypos_id, password)
        if not login.ok:
            raise EasyPosError(login.error_message or "이지포스 로그인 실패")

        for d in dates:
            with Session(engine) as s:
                synclog = EasyPosSyncLog(
                    business_id=business_id,
                    sync_mode="daily" if len(dates) == 1 else "backfill",
                    target_date=d,
                    triggered_by=triggered_by,
                    status="running",
                )
                s.add(synclog)
                s.commit()
                s.refresh(synclog)
                log_id = synclog.id

            try:
                sales = c.fetch_daily_sales(easypos_id, d)
                with Session(engine) as s:
                    up = upsert_daily_receipts(s, business_id, sales)
                    sales_total = upsert_revenue_aggregate(s, business_id, d)

                    sl = s.get(EasyPosSyncLog, log_id)
                    sl.finished_at = datetime.datetime.utcnow()
                    sl.status = "success"
                    sl.receipts_fetched = sales.receipt_count
                    sl.receipts_inserted = up["inserted"]
                    sl.receipts_updated = up["updated"]
                    sl.total_sales = sales_total
                    s.add(sl)
                    s.commit()

                # 카드사별 매출 — 영수증 sync 와 별개로 try/except 보호.
                # 카드 endpoint 실패해도 영수증 sync 결과는 그대로 유지.
                # EasyPosSyncLog 모델에 card_sales_* 필드 없음 → log.info 로만 추적.
                try:
                    card_result = c.fetch_card_sales(
                        easypos_id=easypos_id,
                        start_date=d,
                        end_date=d,
                    )
                    with Session(engine) as s:
                        card_summary = upsert_card_sales(s, business_id, card_result)
                    log.info(
                        "EasyPOS card sales sync %s bid=%s: fetched=%d inserted=%d updated=%d skipped=%d",
                        d, business_id,
                        card_result["row_count"],
                        card_summary["inserted"],
                        card_summary["updated"],
                        card_summary["skipped"],
                    )
                except Exception as e:
                    log.warning(
                        "EasyPOS card sales sync failed (영수증 sync 는 성공) %s bid=%s: %s",
                        d, business_id, e,
                    )

                summary["success_dates"] += 1
                summary["total_inserted"] += up["inserted"]
                summary["total_updated"] += up["updated"]
                summary["total_sales_amount"] += sales_total
            except Exception as e:
                with Session(engine) as s:
                    sl = s.get(EasyPosSyncLog, log_id)
                    if sl:
                        sl.finished_at = datetime.datetime.utcnow()
                        sl.status = "failed"
                        sl.error_message = str(e)[:500]
                        s.add(sl)
                        s.commit()
                summary["failed_dates"] += 1
                summary["errors"].append({"date": d.isoformat(), "error": str(e)})
                log.warning("sync %s for bid=%s failed: %s", d, business_id, e)

    return summary


def _log_dto(row: EasyPosSyncLog) -> dict:
    return {
        "id": row.id,
        "sync_mode": row.sync_mode,
        "target_date": row.target_date.isoformat() if row.target_date else None,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "finished_at": row.finished_at.isoformat() if row.finished_at else None,
        "status": row.status,
        "receipts_fetched": row.receipts_fetched,
        "receipts_inserted": row.receipts_inserted,
        "receipts_updated": row.receipts_updated,
        "total_sales": row.total_sales,
        "error_message": row.error_message,
        "triggered_by": row.triggered_by,
    }
