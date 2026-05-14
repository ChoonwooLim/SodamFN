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

엔드포인트 (구현됨):
  GET    /api/baemin/dashboard         — 주간 합계 (최근 7일, cancelled 제외)
  GET    /api/baemin/debug/probe       — superadmin 쿠키 진단 + whoami raw
  GET    /api/baemin/debug/raw-orders  — superadmin fetch_orders 응답 raw
"""
from __future__ import annotations

import datetime
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
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


def _make_client(business_id: int) -> tuple[BaeminClient, str, Optional[str]]:
    """저장된 쿠키 → BaeminClient + scalar fields 추출. 호출자가 close 책임.

    Returns: (client, shop_owner_number, shop_name)
    """
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
        # session 닫히기 전에 scalar 값 추출 (detached attribute access 회피)
        shop_owner_number = cred.store_id
        shop_name = cred.shop_name
    return BaeminClient(cookies), shop_owner_number, shop_name


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
        client, shop_owner_number, shop_name = _make_client(business_id)
        if not shop_owner_number:
            raise HTTPException(
                422,
                "shopOwnerNumber 가 없습니다. 자격증명에 store_id (배민 점주번호) 를 입력해주세요.",
            )

        try:
            # 매장 정보 자동 보강 (shop_name 비어있으면 list_stores 로 채움)
            if not shop_name:
                try:
                    stores = client.list_stores(shop_owner_number)
                    if stores:
                        first_shop = stores[0]
                        new_name = first_shop.get("name")
                        if new_name:
                            with Session(database.engine) as ss:
                                cred2 = ss.exec(
                                    select(BaeminCredential).where(
                                        BaeminCredential.business_id == business_id
                                    )
                                ).first()
                                if cred2:
                                    cred2.shop_name = new_name
                                    cred2.updated_at = datetime.datetime.utcnow()
                                    ss.add(cred2); ss.commit()
                            shop_name = new_name
                except BaeminError as e:
                    log.warning("list_stores 실패 (계속 진행): %s", e)

            # shop_number 첫 매장 ID — orders/settlements upsert 시 store_id 컬럼에 저장.
            # 1차 구현: shop_owner_number 동일 fallback. 추후 매장 list 활용.
            shop_number = str(shop_owner_number)

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


# ─── 7) 대시보드 ───
@router.get("/dashboard")
def fetch_dashboard(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """대시보드 — 최근 7일 주문 합계 (cancelled 제외)."""
    bid = _resolve_bid(admin, x_view_as_business)
    today = datetime.date.today()
    week_start = today - datetime.timedelta(days=6)
    with Session(database.engine) as s:
        from sqlalchemy import func
        weekly = s.exec(
            select(
                func.count(BaeminOrder.id),
                func.coalesce(func.sum(BaeminOrder.total_sale_price), 0),
            ).where(
                BaeminOrder.business_id == bid,
                BaeminOrder.ordered_at >= datetime.datetime.combine(week_start, datetime.time.min),
                BaeminOrder.cancelled == False,  # noqa: E712
            )
        ).first()
        order_count_7d = int(weekly[0] or 0) if weekly else 0
        total_7d = int(weekly[1] or 0) if weekly else 0
    return {
        "weekly_summary": {
            "from": week_start.isoformat(),
            "to": today.isoformat(),
            "order_count": order_count_7d,
            "total_sales": total_7d,
        },
    }


# ─── 8) 디버그 — 쿠키 진단 (superadmin 전용) ───
@router.get("/debug/probe")
def debug_probe(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """superadmin 디버그 — 쿠키 list + whoami raw 응답 노출."""
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(database.engine) as s:
        cred = s.exec(
            select(BaeminCredential).where(
                BaeminCredential.business_id == bid
            )
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명 미등록")
        cookies = []
        if cred.cookies_encrypted:
            try:
                cookies = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
            except Exception as e:  # noqa: BLE001
                return {"error": f"쿠키 복호화 실패: {e}"}
    names = [(c.get("name") or "") for c in cookies]
    client = BaeminClient(cookies)
    probe: dict = {}
    try:
        probe["whoami"] = client.whoami()
    except Exception as e:  # noqa: BLE001
        probe["whoami_error"] = f"{type(e).__name__}: {e}"
    finally:
        client.close()
    return {
        "cookies_total": len(cookies),
        "cookie_names": names,
        "cookie_domains": list({(c.get("domain") or "-") for c in cookies}),
        "probe": probe,
    }


# ─── 9) 디버그 — 주문 raw 응답 (superadmin 전용) ───
@router.get("/debug/raw-orders")
def debug_raw_orders(
    start: Optional[str] = None,
    end: Optional[str] = None,
    page_size: int = 10,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """superadmin 디버그 — fetch_orders 응답 raw. PII 포함 가능 — superadmin 전용."""
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    try:
        start_d = datetime.date.fromisoformat(start) if start else yesterday
        end_d = datetime.date.fromisoformat(end) if end else yesterday
    except ValueError as e:
        raise HTTPException(400, f"날짜 형식 오류: {e}") from e
    client, shop_owner_number, _shop_name = _make_client(bid)
    try:
        if not shop_owner_number:
            raise HTTPException(422, "shopOwnerNumber 가 없습니다.")
        result = client.fetch_orders(
            shop_owner_number=shop_owner_number,
            start_date=start_d, end_date=end_d,
            offset=0, limit=page_size,
        )
        return {
            "shop_owner_number": shop_owner_number,
            "summary": {
                "total_sale_price": result.total_sale_price,
                "total_order_count": result.total_order_count,
                "fetched_orders_in_page": len(result.orders),
            },
            "first_order": result.orders[0] if result.orders else None,
            "raw_response": result.raw,
        }
    finally:
        client.close()


# ─── 10) 정산명세서 엑셀 수동 import (Phase 2a) ───
@router.post("/sync/monthly-excel/upload")
def upload_monthly_excel(
    year: int = Form(...),
    month: int = Form(...),
    password: Optional[str] = Form(None),
    file: UploadFile = File(...),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """배민 월별 정산명세서 xlsx 수동 업로드.

    사장님이 self.baemin.com 에서 다운로드한 정산명세서를 업로드.
    비번 입력 시 복호화 시도, 실패 시 평문 시도.
    [요약] + [상세] 시트 파싱 → DB 적재 + DeliveryRevenue 갱신.

    password 미입력 시 기본 '630730' 사용.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    if year < 2020 or year > 2030:
        raise HTTPException(400, "year 범위 오류")
    if month < 1 or month > 12:
        raise HTTPException(400, "month 범위 오류")
    pw = (password or "630730").strip() or None
    try:
        contents = file.file.read()
    except Exception as e:
        raise HTTPException(400, f"파일 읽기 실패: {e}") from e
    finally:
        try:
            file.file.close()
        except Exception:
            pass
    if not contents:
        raise HTTPException(400, "업로드 파일이 비어있습니다.")

    from services.baemin_excel_parser import parse_xlsx, BaeminExcelError
    try:
        parsed = parse_xlsx(contents, password=pw, file_name=file.filename)
    except BaeminExcelError as e:
        raise HTTPException(422, f"엑셀 파싱 실패: {e}") from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"엑셀 파싱 실패 (예외): {type(e).__name__}: {e}") from e

    from services.baemin_service import upsert_excel_settlement
    with Session(database.engine) as s:
        result = upsert_excel_settlement(s, bid, year, month, parsed)

    # P/L sync
    from services.profit_loss_service import sync_delivery_revenue_to_pl
    with Session(database.engine) as s:
        sync_delivery_revenue_to_pl(year, month, s, bid)

    return {
        "ok": True,
        "year": year,
        "month": month,
        "file_name": file.filename,
        **result,
    }


@router.get("/monthly-excel/list")
def list_monthly_excel(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """업로드된 모든 월 list."""
    bid = _resolve_bid(admin, x_view_as_business)
    from models import BaeminMonthlySummary
    with Session(database.engine) as s:
        rows = s.exec(
            select(BaeminMonthlySummary)
            .where(BaeminMonthlySummary.business_id == bid)
            .order_by(
                BaeminMonthlySummary.year.desc(),
                BaeminMonthlySummary.month.desc(),
            )
        ).all()
        return [
            {
                "year": r.year, "month": r.month,
                "deposit_total": r.deposit_total,
                "order_brokerage_total": r.order_brokerage_total,
                "ad_total": r.ad_total,
                "detail_rows": r.detail_rows,
                "uploaded_at": utc_iso(r.uploaded_at),
                "file_name": r.file_name,
            }
            for r in rows
        ]


@router.get("/monthly-excel/{year}/{month}")
def get_monthly_excel_summary(
    year: int, month: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """업로드된 월별 요약 + 상세 row 수 조회."""
    bid = _resolve_bid(admin, x_view_as_business)
    from models import BaeminMonthlySummary
    with Session(database.engine) as s:
        row = s.exec(
            select(BaeminMonthlySummary).where(
                BaeminMonthlySummary.business_id == bid,
                BaeminMonthlySummary.year == year,
                BaeminMonthlySummary.month == month,
            )
        ).first()
        if not row:
            return {"registered": False}
        return {
            "registered": True,
            "summary": {
                "order_brokerage_total": row.order_brokerage_total,
                "delivery_total": row.delivery_total,
                "etc_total": row.etc_total,
                "misc_total": row.misc_total,
                "vat_total": row.vat_total,
                "ad_total": row.ad_total,
                "baemin_order_total": row.baemin_order_total,
                "deposit_total": row.deposit_total,
            },
            "detail_rows": row.detail_rows,
            "file_name": row.file_name,
            "uploaded_at": utc_iso(row.uploaded_at),
        }
