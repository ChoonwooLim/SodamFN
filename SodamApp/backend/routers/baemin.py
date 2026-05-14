"""배민(ceo.baemin.com) 사장님사이트 매출/정산 자동수집 라우터.

수동 쿠키 only — 자동 로그인 없음 (spec Q2). 쿠키 만료 시 사장님이 갱신.

엔드포인트 (현재 구현):
  POST   /api/baemin/credential        — 자격증명 (로그인 ID + 매장 ID) 등록/갱신
  GET    /api/baemin/credential        — 등록 상태 + 쿠키 만료 조회
  DELETE /api/baemin/credential        — 자격증명 + 쿠키 삭제
  POST   /api/baemin/manual-cookies    — 사장님 쿠키 붙여넣기 (메인 인증 흐름)
  POST   /api/baemin/sync/manual       — 기간 지정 동기화 (최대 91일)
  POST   /api/baemin/sync/cron-trigger — Orbitron cron 호출 (X-Cron-Secret)
  GET    /api/baemin/sync/logs         — 동기화 이력 (최대 200건)

엔드포인트 (Task 7 에서 추가 예정):
  GET    /api/baemin/dashboard         — 잔액 / 예상정산 / 주간 합계
  GET    /api/baemin/debug/probe       — superadmin 쿠키 진단
  GET    /api/baemin/debug/raw-orders  — superadmin 응답 raw
"""
from __future__ import annotations

import datetime
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

import database
from models import (
    BaeminCredential, BaeminOrder, BaeminSettlement, BaeminSyncLog, User,
)
from routers.auth import get_admin_user
from services.crypto_util import encrypt_text, decrypt_text
from services.baemin_service import (
    BaeminClient, BaeminError, CookieInvalidError,
    serialize_cookies, deserialize_cookies, earliest_cookie_expiry,
)
from utils.datetime_utils import utc_iso

log = logging.getLogger("baemin.router")
router = APIRouter(prefix="/api/baemin", tags=["baemin"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


def _cred_dto(row: BaeminCredential) -> dict:
    return {
        "id": row.id,
        "login_id": row.login_id,
        "store_id": row.store_id,
        "shop_name": row.shop_name,
        "status": row.status,
        "cookies_present": bool(row.cookies_encrypted),
        "cookies_obtained_at": utc_iso(row.cookies_obtained_at),
        "cookies_expires_at": utc_iso(row.cookies_expires_at),
        "last_verified_at": utc_iso(row.last_verified_at),
        "last_failed_at": utc_iso(row.last_failed_at),
        "last_error_message": row.last_error_message,
        "consecutive_failures": row.consecutive_failures,
        "updated_at": utc_iso(row.updated_at),
    }


def _log_dto(row: BaeminSyncLog) -> dict:
    return {
        "id": row.id,
        "sync_mode": row.sync_mode,
        "target_start": utc_iso(row.target_start),
        "target_end": utc_iso(row.target_end),
        "started_at": utc_iso(row.started_at),
        "finished_at": utc_iso(row.finished_at),
        "status": row.status,
        "orders_fetched": row.orders_fetched,
        "orders_inserted": row.orders_inserted,
        "orders_updated": row.orders_updated,
        "settlements_fetched": row.settlements_fetched,
        "settlements_inserted": row.settlements_inserted,
        "settlements_updated": row.settlements_updated,
        "total_sales": row.total_sales,
        "error_message": row.error_message,
        "triggered_by": row.triggered_by,
        "auth_refreshed": row.auth_refreshed,
    }


def _save_cookies(session: Session, cred: BaeminCredential,
                  cookies: list[dict], *,
                  store_id: Optional[str] = None,
                  shop_name: Optional[str] = None) -> None:
    cred.cookies_encrypted = encrypt_text(serialize_cookies(cookies))
    cred.cookies_obtained_at = datetime.datetime.utcnow()
    cred.cookies_expires_at = earliest_cookie_expiry(cookies)
    if store_id: cred.store_id = store_id
    if shop_name: cred.shop_name = shop_name
    cred.status = "active"
    cred.last_verified_at = datetime.datetime.utcnow()
    cred.last_failed_at = None
    cred.last_error_message = None
    cred.consecutive_failures = 0
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _record_failure(session: Session, cred: BaeminCredential,
                    message: str, status: str = "failed") -> None:
    cred.last_failed_at = datetime.datetime.utcnow()
    cred.last_error_message = message[:500] if message else None
    cred.consecutive_failures = (cred.consecutive_failures or 0) + 1
    cred.status = status
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _make_client(business_id: int) -> tuple[BaeminClient, BaeminCredential]:
    """저장된 쿠키 → BaeminClient 인스턴스 생성. 호출자가 close 책임."""
    with Session(database.engine) as s:
        cred = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == business_id
            )
        ).first()
        if not cred:
            raise HTTPException(404, "배민 자격증명이 등록되지 않았습니다.")
        if not cred.cookies_encrypted:
            raise HTTPException(
                422,
                "쿠키가 없습니다. F12 → Application → Cookies 복사해서 입력해주세요.",
            )
        try:
            cookies = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
        except Exception as e:  # noqa: BLE001
            raise HTTPException(500, f"쿠키 복호화 실패: {e}") from e
    return BaeminClient(cookies), cred


# ─── DTOs ───
class CredentialIn(BaseModel):
    login_id: str = Field(..., min_length=3, max_length=128)
    store_id: Optional[str] = None


class ManualCookiesIn(BaseModel):
    cookies: list[dict]
    store_id: Optional[str] = None
    shop_name: Optional[str] = None


class ManualSyncIn(BaseModel):
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    sync_orders: bool = True
    sync_settlements: bool = True


# ─── 1) 자격증명 ───
@router.post("/credential")
def upsert_credential(
    body: CredentialIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    now = datetime.datetime.utcnow()
    with Session(database.engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if row:
            row.login_id = body.login_id.strip()
            if body.store_id: row.store_id = body.store_id
            row.status = "active"
            row.last_failed_at = None
            row.last_error_message = None
            row.consecutive_failures = 0
            row.updated_at = now
            s.add(row)
        else:
            row = BaeminCredential(
                business_id=bid,
                login_id=body.login_id.strip(),
                store_id=body.store_id,
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
    with Session(database.engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
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
    with Session(database.engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not row:
            raise HTTPException(404, "등록된 자격증명이 없습니다.")
        s.delete(row)
        s.commit()
        return {"ok": True}


# ─── 2) 수동 쿠키 ───
@router.post("/manual-cookies")
def submit_manual_cookies(
    body: ManualCookiesIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    if not body.cookies:
        raise HTTPException(400, "쿠키 list 가 비어있습니다.")
    with Session(database.engine) as s:
        row = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not row:
            row = BaeminCredential(business_id=bid, status="active")
            s.add(row)
            s.commit()
            s.refresh(row)
        _save_cookies(s, row, body.cookies,
                      store_id=body.store_id or row.store_id,
                      shop_name=body.shop_name or row.shop_name)
        s.refresh(row)
        return {"ok": True, **_cred_dto(row)}


# ─── 3) 수동 동기화 ───
@router.post("/sync/manual")
def sync_manual(
    body: ManualSyncIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    start = body.start_date or yesterday
    end = body.end_date or start
    if end < start:
        raise HTTPException(400, "end_date 가 start_date 보다 빠릅니다.")
    if (end - start).days > 90:
        raise HTTPException(400, "한 번에 최대 91일까지만 동기화할 수 있습니다.")
    summary = _run_sync(bid, start, end,
                        sync_orders=body.sync_orders,
                        sync_settlements=body.sync_settlements,
                        triggered_by="manual")
    return {"ok": True, **summary}


# ─── 4) Cron 트리거 ───
@router.post("/sync/cron-trigger")
def sync_cron_trigger(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(401, "invalid cron secret")
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    with Session(database.engine) as s:
        bids = [r for r in s.exec(
            select(BaeminCredential.business_id).where(
                BaeminCredential.status.in_(["active"])
            )
        )]
    results = []
    for bid in bids:
        try:
            r = _run_sync(bid, yesterday, yesterday,
                          sync_orders=True, sync_settlements=True,
                          triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:  # noqa: BLE001
            log.error("cron sync failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})
    return {"ok": True, "target_date": yesterday.isoformat(),
            "business_count": len(bids), "results": results}


# ─── 5) 이력 ───
@router.get("/sync/logs")
def list_sync_logs(
    limit: int = 30,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(database.engine) as s:
        rows = s.exec(
            select(BaeminSyncLog)
            .where(BaeminSyncLog.business_id == bid)
            .order_by(BaeminSyncLog.started_at.desc())
            .limit(min(max(limit, 1), 200))
        ).all()
        return [_log_dto(r) for r in rows]


# ─── 6) 핵심 sync 로직 ───
def _run_sync(business_id: int,
              start_date: datetime.date,
              end_date: datetime.date,
              *, sync_orders: bool = True,
              sync_settlements: bool = True,
              triggered_by: str = "manual") -> dict:
    """기간 내 주문 + 정산 수집 → DB upsert + DeliveryRevenue 일자집계 + P/L sync."""
    summary = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "orders": {"fetched": 0, "inserted": 0, "updated": 0},
        "settlements": {"fetched": 0, "inserted": 0, "updated": 0},
        "total_sales": 0,
        "errors": [],
    }
    log_id: Optional[int] = None
    sync_mode = ("full" if (sync_orders and sync_settlements)
                 else "orders" if sync_orders
                 else "settlements")
    with Session(database.engine) as s:
        sl = BaeminSyncLog(business_id=business_id,
                           sync_mode=sync_mode,
                           target_start=start_date,
                           target_end=end_date,
                           triggered_by=triggered_by,
                           status="running")
        s.add(sl); s.commit(); s.refresh(sl)
        log_id = sl.id

    try:
        client, cred = _make_client(business_id)
        shop_owner_number = cred.store_id  # BaeminCredential.store_id = shopOwnerNumber
        if not shop_owner_number:
            raise HTTPException(
                422,
                "shopOwnerNumber 가 없습니다. 자격증명에 store_id (배민 점주번호) 를 입력해주세요.",
            )

        try:
            # 매장 정보 자동 보강 (shop_name 비어있으면 list_stores 로 채움)
            if not cred.shop_name:
                try:
                    stores = client.list_stores(shop_owner_number)
                    if stores:
                        first_shop = stores[0]
                        with Session(database.engine) as ss:
                            cred2 = ss.exec(
                                select(BaeminCredential).where(
                                    BaeminCredential.business_id == business_id
                                )
                            ).first()
                            if cred2:
                                cred2.shop_name = first_shop.get("name") or cred2.shop_name
                                cred2.updated_at = datetime.datetime.utcnow()
                                ss.add(cred2); ss.commit()
                except BaeminError as e:
                    log.warning("list_stores 실패 (계속 진행): %s", e)

            # shop_number 첫 매장 ID — orders/settlements upsert 시 store_id 컬럼에 저장.
            # 1차 구현: cred.store_id (= shopOwnerNumber) fallback. 추후 별도 컬럼 분리 시 보강.
            shop_number = str(cred.store_id)

            from services.baemin_service import (
                upsert_orders, upsert_settlements, upsert_revenue_from_orders,
            )

            # 1) 주문
            if sync_orders:
                orders_contents = client.fetch_all_orders(
                    shop_owner_number, start_date, end_date
                )
                with Session(database.engine) as s2:
                    up = upsert_orders(s2, business_id, shop_number, orders_contents)
                summary["orders"]["fetched"] = len(orders_contents)
                summary["orders"]["inserted"] = up["inserted"]
                summary["orders"]["updated"] = up["updated"]
                # Revenue 일자집계
                for offset in range((end_date - start_date).days + 1):
                    d = start_date + datetime.timedelta(days=offset)
                    with Session(database.engine) as s3:
                        total = upsert_revenue_from_orders(s3, business_id, d)
                    summary["total_sales"] += total

            # 2) 정산
            if sync_settlements:
                settlements = client.fetch_all_settlements(
                    shop_owner_number, start_date, end_date
                )
                with Session(database.engine) as s4:
                    up = upsert_settlements(s4, business_id, shop_number, settlements)
                summary["settlements"]["fetched"] = len(settlements)
                summary["settlements"]["inserted"] = up["inserted"]
                summary["settlements"]["updated"] = up["updated"]

            # 3) P/L 동기화 (시작/종료 월 모두)
            from services.profit_loss_service import sync_delivery_revenue_to_pl
            with Session(database.engine) as s5:
                sync_delivery_revenue_to_pl(
                    start_date.year, start_date.month, s5, business_id
                )
                if (start_date.year, start_date.month) != (end_date.year, end_date.month):
                    sync_delivery_revenue_to_pl(
                        end_date.year, end_date.month, s5, business_id
                    )
        finally:
            client.close()

        # 완료
        with Session(database.engine) as s6:
            sl = s6.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "success"
                sl.orders_fetched = summary["orders"]["fetched"]
                sl.orders_inserted = summary["orders"]["inserted"]
                sl.orders_updated = summary["orders"]["updated"]
                sl.settlements_fetched = summary["settlements"]["fetched"]
                sl.settlements_inserted = summary["settlements"]["inserted"]
                sl.settlements_updated = summary["settlements"]["updated"]
                sl.total_sales = summary["total_sales"]
                s6.add(sl); s6.commit()

    except CookieInvalidError as e:
        with Session(database.engine) as s_err:
            cred_row = s_err.exec(
                select(BaeminCredential).where(
                    BaeminCredential.business_id == business_id
                )
            ).first()
            if cred_row:
                _record_failure(s_err, cred_row, str(e), status="cookie_invalid")
            sl = s_err.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s_err.add(sl); s_err.commit()
        summary["errors"].append({"error": str(e), "kind": "cookie_invalid"})
        raise HTTPException(422, f"쿠키 만료: {e}") from e

    except HTTPException:
        # HTTPException 은 그대로 전파 (위 _make_client / shop_owner_number 검증 등)
        with Session(database.engine) as s_err:
            sl = s_err.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = "config error"
                s_err.add(sl); s_err.commit()
        raise

    except Exception as e:
        with Session(database.engine) as s_err:
            sl = s_err.get(BaeminSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s_err.add(sl); s_err.commit()
        summary["errors"].append({"error": str(e)})
        log.error("baemin sync failed bid=%s: %s", business_id, e, exc_info=True)
        raise

    return summary
