"""쿠팡이츠(store.coupangeats.com) 사장님 포털 매출 자동수집 라우터.

엔드포인트:
  POST   /api/coupang-eats/credential        — 자격증명 등록/갱신 (ID/PW)
  GET    /api/coupang-eats/credential        — 등록 상태 조회 (PW/쿠키 비노출)
  DELETE /api/coupang-eats/credential        — 자격증명 + 쿠키 전체 삭제
  POST   /api/coupang-eats/manual-cookies    — 사장님 직접 쿠키 붙여넣기 (Playwright 차단 시 폴백)
  POST   /api/coupang-eats/test-login        — Playwright 즉시 로그인 + 매장 정보 확인
  POST   /api/coupang-eats/sync/manual       — 수동 동기화 (기간 지정)
  POST   /api/coupang-eats/sync/cron-trigger — Orbitron cron 호출 (전 사업장)
  GET    /api/coupang-eats/sync/logs         — 동기화 이력
  GET    /api/coupang-eats/dashboard         — 실시간 잔액/예상정산/오늘 주문수

권한: admin/superadmin. X-View-As-Business 헤더로 superadmin 이 다른 사업장 조회.
"""
from __future__ import annotations

import datetime
import json
import logging
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine
from models import (
    CoupangEatsCredential,
    CoupangEatsOrder,
    CoupangEatsSettlement,
    CoupangEatsSyncLog,
    User,
)
from routers.auth import get_admin_user
from services.crypto_util import encrypt_text, decrypt_text
from services.coupang_eats_service import (
    CoupangEatsClient,
    CoupangEatsError,
    CookieInvalidError,
    serialize_cookies,
    deserialize_cookies,
    earliest_cookie_expiry,
    upsert_orders,
    upsert_settlements,
    upsert_revenue_from_orders,
)
from services.coupang_eats_login import (
    login_and_get_cookies,
    CoupangEatsLoginError,
)


log = logging.getLogger("coupang_eats.router")
router = APIRouter(prefix="/api/coupang-eats", tags=["coupang-eats"])


# ──────────────────────────────────────────────────────────────────────────
# 공통 헬퍼
# ──────────────────────────────────────────────────────────────────────────

def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


def _cred_dto(row: CoupangEatsCredential) -> dict:
    return {
        "id": row.id,
        "login_id": row.login_id,
        "store_id": row.store_id,
        "shop_name": row.shop_name,
        "status": row.status,
        "login_method": row.login_method,
        "cookies_present": bool(row.cookies_encrypted),
        "cookies_obtained_at": row.cookies_obtained_at.isoformat() if row.cookies_obtained_at else None,
        "cookies_expires_at": row.cookies_expires_at.isoformat() if row.cookies_expires_at else None,
        "last_verified_at": row.last_verified_at.isoformat() if row.last_verified_at else None,
        "last_failed_at": row.last_failed_at.isoformat() if row.last_failed_at else None,
        "last_error_message": row.last_error_message,
        "consecutive_failures": row.consecutive_failures,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _log_dto(row: CoupangEatsSyncLog) -> dict:
    return {
        "id": row.id,
        "sync_mode": row.sync_mode,
        "target_start": row.target_start.isoformat() if row.target_start else None,
        "target_end": row.target_end.isoformat() if row.target_end else None,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "finished_at": row.finished_at.isoformat() if row.finished_at else None,
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


def _save_cookies(session: Session, cred: CoupangEatsCredential,
                  cookies: list[dict], *,
                  login_method: Optional[str] = None,
                  store_id: Optional[int] = None,
                  shop_name: Optional[str] = None) -> None:
    """쿠키를 Fernet 암호화 + cred 메타데이터 업데이트.

    호출자가 session.commit() 책임을 가지지만 안전을 위해 여기서도 commit.
    """
    cred.cookies_encrypted = encrypt_text(serialize_cookies(cookies))
    cred.cookies_obtained_at = datetime.datetime.utcnow()
    cred.cookies_expires_at = earliest_cookie_expiry(cookies)
    if login_method:
        cred.login_method = login_method
    if store_id:
        cred.store_id = store_id
    if shop_name:
        cred.shop_name = shop_name
    cred.status = "active"
    cred.last_verified_at = datetime.datetime.utcnow()
    cred.last_failed_at = None
    cred.last_error_message = None
    cred.consecutive_failures = 0
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _record_failure(session: Session, cred: CoupangEatsCredential,
                    message: str, status: str = "failed") -> None:
    cred.last_failed_at = datetime.datetime.utcnow()
    cred.last_error_message = message[:500] if message else None
    cred.consecutive_failures = (cred.consecutive_failures or 0) + 1
    cred.status = status
    cred.updated_at = datetime.datetime.utcnow()
    session.add(cred)
    session.commit()


def _refresh_via_playwright(session: Session,
                            cred: CoupangEatsCredential) -> list[dict]:
    """저장된 ID/PW 로 Playwright 자동 로그인 → 새 쿠키 저장.

    Returns: 새 쿠키 list.
    Raises: CoupangEatsLoginError (자격증명 미등록 / playwright 누락 / 차단 등)
    """
    if not cred.login_id or not cred.password_encrypted:
        raise CoupangEatsLoginError(
            "자동 로그인 자격증명(ID/PW)이 등록되지 않았습니다. "
            "수동 쿠키 입력으로 동작 중이라면 쿠키 만료 후 사장님이 직접 갱신해야 합니다.",
            reason="no_credentials",
        )
    try:
        password = decrypt_text(cred.password_encrypted)
    except Exception as e:  # noqa: BLE001
        raise CoupangEatsLoginError(
            f"비밀번호 복호화 실패: {e}", reason="decrypt_failed"
        ) from e

    result = login_and_get_cookies(cred.login_id, password)
    cookies = result.get("cookies") or []
    if not cookies:
        raise CoupangEatsLoginError(
            "Playwright 로그인은 성공했지만 쿠키를 추출하지 못했습니다.",
            reason="no_cookies",
        )
    _save_cookies(session, cred, cookies,
                  login_method="auto",
                  store_id=result.get("store_id") or cred.store_id)
    return cookies


def _execute_with_refresh(business_id: int,
                          action: Callable[[CoupangEatsClient], Any]) -> tuple[Any, bool]:
    """action(client) 실행. CookieInvalidError 시 자동 재로그인 → 1회 재시도.

    Returns:
        (result, auth_refreshed)
    """
    auth_refreshed = False

    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == business_id
            )
        ).first()
        if not cred:
            raise HTTPException(404, "쿠팡이츠 자격증명이 등록되지 않았습니다.")

        cookies: list[dict] = []
        if cred.cookies_encrypted:
            try:
                cookies = deserialize_cookies(decrypt_text(cred.cookies_encrypted))
            except Exception as e:  # noqa: BLE001
                log.warning("cookie decrypt failed bid=%s: %s", business_id, e)
                cookies = []

        # 쿠키 없거나 비어있으면 즉시 재로그인 (자격증명 있을 때만)
        if not cookies:
            if not cred.login_id or not cred.password_encrypted:
                raise HTTPException(
                    422,
                    "쿠키와 자동 로그인 자격증명 모두 없습니다. "
                    "사장님 ID/PW 등록 또는 수동 쿠키 입력이 필요합니다.",
                )
            try:
                cookies = _refresh_via_playwright(s, cred)
                auth_refreshed = True
            except CoupangEatsLoginError as e:
                _record_failure(s, cred, str(e))
                raise HTTPException(422, f"자동 로그인 실패: {e}") from e

    # client 생성 후 action 실행
    while True:
        client = CoupangEatsClient(cookies)
        try:
            result = action(client)
            return result, auth_refreshed
        except CookieInvalidError as e:
            client.close()
            if auth_refreshed:
                # 이미 재로그인 했는데 또 실패 — 진짜 차단
                with Session(engine) as s:
                    cred = s.exec(
                        select(CoupangEatsCredential).where(
                            CoupangEatsCredential.business_id == business_id
                        )
                    ).first()
                    if cred:
                        _record_failure(s, cred,
                                        f"재로그인 후에도 쿠키 무효: {e}",
                                        status="cookie_invalid")
                raise HTTPException(
                    422,
                    f"쿠팡이츠가 자동 재로그인 후에도 인증을 거부합니다 — 차단 가능성: {e}",
                ) from e
            # 첫 실패 — 재로그인 시도
            with Session(engine) as s:
                cred = s.exec(
                    select(CoupangEatsCredential).where(
                        CoupangEatsCredential.business_id == business_id
                    )
                ).first()
                if not cred:
                    raise HTTPException(404, "자격증명이 사라졌습니다.")
                try:
                    cookies = _refresh_via_playwright(s, cred)
                    auth_refreshed = True
                except CoupangEatsLoginError as le:
                    _record_failure(s, cred, str(le))
                    raise HTTPException(422, f"쿠키 만료 + 자동 재로그인 실패: {le}") from le
            continue
        except CoupangEatsError as e:
            client.close()
            raise HTTPException(502, f"쿠팡이츠 API 오류: {e}") from e
        finally:
            try:
                client.close()
            except Exception:
                pass


# ──────────────────────────────────────────────────────────────────────────
# DTOs
# ──────────────────────────────────────────────────────────────────────────

class CredentialIn(BaseModel):
    login_id: str = Field(..., min_length=3, max_length=64,
                          description="쿠팡이츠 사장님 포털 로그인 ID")
    password: str = Field(..., min_length=4, max_length=128,
                          description="쿠팡이츠 비밀번호 (평문 — 서버가 즉시 Fernet 암호화)")
    store_id: Optional[int] = Field(None, description="매장 ID — 모르면 자동 로그인 후 자동 추출")


class ManualCookiesIn(BaseModel):
    cookies: list[dict] = Field(..., description="브라우저에서 추출한 쿠키 list (name/value/domain/path/expires)")
    store_id: Optional[int] = None
    shop_name: Optional[str] = None


class ManualSyncIn(BaseModel):
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    sync_orders: bool = True
    sync_settlements: bool = True


# ──────────────────────────────────────────────────────────────────────────
# 1) 자격증명
# ──────────────────────────────────────────────────────────────────────────

@router.post("/credential")
def upsert_credential(
    body: CredentialIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """쿠팡이츠 ID/PW 등록 또는 갱신. (business 당 1건)

    저장만 하고 로그인은 시도하지 않음. /test-login 으로 별도 검증.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    now = datetime.datetime.utcnow()
    with Session(engine) as s:
        row = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if row:
            row.login_id = body.login_id.strip()
            row.password_encrypted = encrypt_text(body.password)
            if body.store_id:
                row.store_id = body.store_id
            row.status = "active"
            row.last_failed_at = None
            row.last_error_message = None
            row.consecutive_failures = 0
            row.updated_at = now
            s.add(row)
        else:
            row = CoupangEatsCredential(
                business_id=bid,
                login_id=body.login_id.strip(),
                password_encrypted=encrypt_text(body.password),
                store_id=body.store_id,
                status="active",
                login_method="auto",
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
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
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
    with Session(engine) as s:
        row = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not row:
            raise HTTPException(404, "등록된 자격증명이 없습니다.")
        s.delete(row)
        s.commit()
        return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────
# 2) 수동 쿠키 입력 (Playwright 차단 시 폴백)
# ──────────────────────────────────────────────────────────────────────────

@router.post("/manual-cookies")
def submit_manual_cookies(
    body: ManualCookiesIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """사장님이 브라우저 F12 로 추출한 쿠키를 직접 입력.

    Akamai 가 Playwright 헤드리스를 차단하는 경우의 비상용. ID/PW 가 등록
    안 되어 있어도 동작. 단, 쿠키 만료 시 다시 사장님이 갱신해야 함.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    if not body.cookies:
        raise HTTPException(400, "쿠키 list 가 비어있습니다.")

    # 인증 쿠키 sanity check — 핵심 쿠키 1개라도 있어야 함
    cookie_names = {(c.get("name") or "").upper() for c in body.cookies}
    has_auth = any(
        n in cookie_names
        for n in ("EATS_AT", "EATS_RT", "X-EATS-AT", "X-EATS-RT", "AUTH-TOKEN")
    )
    if not has_auth:
        # 경고만 — 쿠키 이름이 바뀌었을 수 있으니 차단하지는 않음
        log.warning("manual cookies missing common auth names, names=%s", cookie_names)

    with Session(engine) as s:
        row = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not row:
            row = CoupangEatsCredential(
                business_id=bid,
                login_method="manual",
                status="active",
            )
            s.add(row)
            s.commit()
            s.refresh(row)

        _save_cookies(s, row, body.cookies,
                      login_method="manual",
                      store_id=body.store_id or row.store_id,
                      shop_name=body.shop_name or row.shop_name)
        s.refresh(row)
        return {"ok": True, **_cred_dto(row)}


# ──────────────────────────────────────────────────────────────────────────
# 3) 로그인 테스트 (Playwright)
# ──────────────────────────────────────────────────────────────────────────

@router.post("/test-login")
def test_login(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """저장된 ID/PW 로 Playwright 즉시 로그인 → 쿠키 저장 + whoami 검증.

    매번 새 쿠키 발급(브라우저 비용 큼) — 일상 호출용 아님. 사장님이 UI 에서
    명시 클릭할 때만 실행.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명이 등록되지 않았습니다.")
        try:
            cookies = _refresh_via_playwright(s, cred)
        except CoupangEatsLoginError as e:
            _record_failure(s, cred, str(e))
            raise HTTPException(422, f"자동 로그인 실패 ({e.reason}): {e}") from e

    # whoami 로 쿠키 검증 + 매장 list 조회
    def _action(client: CoupangEatsClient):
        info = client.whoami()
        stores = []
        try:
            stores = client.list_stores()
        except CoupangEatsError as e:
            log.warning("list_stores after login failed: %s", e)
        return {"whoami": info, "stores": stores}

    try:
        (data, _refreshed) = _execute_with_refresh(bid, _action)
    except HTTPException:
        raise

    # store_id / shop_name 자동 보강
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if cred and data.get("stores"):
            first_store = data["stores"][0]
            if not cred.store_id:
                # storeId 키 다양: storeId / id / store_id
                sid = (first_store.get("storeId")
                       or first_store.get("id")
                       or first_store.get("store_id"))
                if sid:
                    try:
                        cred.store_id = int(sid)
                    except (TypeError, ValueError):
                        pass
            if not cred.shop_name:
                cred.shop_name = (first_store.get("shopName")
                                  or first_store.get("name")
                                  or first_store.get("storeName"))
            cred.updated_at = datetime.datetime.utcnow()
            s.add(cred)
            s.commit()

    return {
        "ok": True,
        "whoami": data.get("whoami"),
        "stores": data.get("stores", []),
        "cookies_count": len(cookies),
    }


# ──────────────────────────────────────────────────────────────────────────
# 4) 수동 동기화
# ──────────────────────────────────────────────────────────────────────────

@router.post("/sync/manual")
def sync_manual(
    body: ManualSyncIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """수동 동기화 — 기간 지정. 기본 = 어제 하루."""
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


# ──────────────────────────────────────────────────────────────────────────
# 5) Cron 트리거 (Orbitron 호출)
# ──────────────────────────────────────────────────────────────────────────

@router.post("/sync/cron-trigger")
def sync_cron_trigger(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """Orbitron cron 매일 새벽 04:00 KST 호출 → 전 사업장 전일 주문/정산 수집.

    인증: 환경변수 CRON_SHARED_SECRET 과 X-Cron-Secret 헤더 일치.
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
            select(CoupangEatsCredential.business_id).where(
                CoupangEatsCredential.status.in_(["active"])
            )
        )]

    results = []
    for bid in bids:
        try:
            r = _run_sync(bid, yesterday, yesterday,
                          sync_orders=True, sync_settlements=True,
                          triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:
            log.error("cron sync failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})

    return {
        "ok": True,
        "target_date": yesterday.isoformat(),
        "business_count": len(bids),
        "results": results,
    }


# ──────────────────────────────────────────────────────────────────────────
# 6) 이력 / 대시보드
# ──────────────────────────────────────────────────────────────────────────

@router.get("/sync/logs")
def list_sync_logs(
    limit: int = 30,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        rows = s.exec(
            select(CoupangEatsSyncLog)
            .where(CoupangEatsSyncLog.business_id == bid)
            .order_by(CoupangEatsSyncLog.started_at.desc())
            .limit(min(max(limit, 1), 200))
        ).all()
        return [_log_dto(r) for r in rows]


@router.get("/dashboard")
def fetch_dashboard(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """실시간 대시보드 — 잔액 + 예상정산 + 최근 7일 주문 합계."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명 미등록")
        store_id = cred.store_id

    if not store_id:
        raise HTTPException(422, "매장 ID 가 없습니다. /test-login 으로 매장 정보를 먼저 동기화하세요.")

    def _action(client: CoupangEatsClient):
        try:
            balance = client.fetch_balance(store_id)
        except CoupangEatsError as e:
            balance = {"error": str(e)}
        try:
            expected = client.fetch_expected_settlement(store_id)
        except CoupangEatsError as e:
            expected = {"error": str(e)}
        return {"balance": balance, "expected_settlement": expected}

    (data, refreshed) = _execute_with_refresh(bid, _action)

    # DB 집계 — 최근 7일 주문 합계
    today = datetime.date.today()
    week_start = today - datetime.timedelta(days=6)
    with Session(engine) as s:
        from sqlalchemy import func
        weekly = s.exec(
            select(
                func.count(CoupangEatsOrder.id),
                func.coalesce(func.sum(CoupangEatsOrder.total_sale_price), 0),
            ).where(
                CoupangEatsOrder.business_id == bid,
                CoupangEatsOrder.ordered_at >= datetime.datetime.combine(week_start, datetime.time.min),
                CoupangEatsOrder.cancelled == False,  # noqa: E712
            )
        ).first()
        order_count_7d = int(weekly[0] or 0) if weekly else 0
        total_7d = int(weekly[1] or 0) if weekly else 0

    return {
        "balance": data.get("balance"),
        "expected_settlement": data.get("expected_settlement"),
        "weekly_summary": {
            "from": week_start.isoformat(),
            "to": today.isoformat(),
            "order_count": order_count_7d,
            "total_sales": total_7d,
        },
        "auth_refreshed": refreshed,
    }


# ──────────────────────────────────────────────────────────────────────────
# 핵심 동기화 로직
# ──────────────────────────────────────────────────────────────────────────

def _run_sync(business_id: int,
              start_date: datetime.date,
              end_date: datetime.date,
              *,
              sync_orders: bool = True,
              sync_settlements: bool = True,
              triggered_by: str = "manual") -> dict:
    """기간 내 주문 + 정산을 수집 → DB upsert + Revenue 일자집계.

    각 호출은 _execute_with_refresh 를 거치므로 쿠키 만료 시 자동 재로그인.
    """
    summary = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "orders": {"fetched": 0, "inserted": 0, "updated": 0},
        "settlements": {"fetched": 0, "inserted": 0, "updated": 0},
        "total_sales": 0,
        "auth_refreshed": False,
        "errors": [],
    }

    # 매장 ID 확인
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == business_id
            )
        ).first()
        if not cred:
            raise HTTPException(404, "자격증명 미등록")
        if not cred.store_id:
            raise HTTPException(
                422,
                "매장 ID 가 없습니다. 외부연동 → 쿠팡이츠 → 로그인 테스트 로 매장정보를 먼저 동기화하세요.",
            )
        store_id = cred.store_id

    # SyncLog 시작
    log_id: Optional[int] = None
    with Session(engine) as s:
        sl = CoupangEatsSyncLog(
            business_id=business_id,
            sync_mode=("full" if (sync_orders and sync_settlements)
                       else "orders" if sync_orders
                       else "settlements"),
            target_start=start_date,
            target_end=end_date,
            triggered_by=triggered_by,
            status="running",
        )
        s.add(sl)
        s.commit()
        s.refresh(sl)
        log_id = sl.id

    try:
        # 1) 주문 — 호출 시점 단위 ms 범위
        if sync_orders:
            start_dt = datetime.datetime.combine(start_date, datetime.time.min)
            end_dt = datetime.datetime.combine(end_date, datetime.time.max)

            def _fetch_orders(client: CoupangEatsClient):
                return client.fetch_all_orders(store_id, start_dt, end_dt)

            (orders, refreshed) = _execute_with_refresh(business_id, _fetch_orders)
            summary["auth_refreshed"] = summary["auth_refreshed"] or refreshed
            with Session(engine) as s:
                up = upsert_orders(s, business_id, store_id, orders)
            summary["orders"]["fetched"] = len(orders)
            summary["orders"]["inserted"] = up["inserted"]
            summary["orders"]["updated"] = up["updated"]

            # Revenue 일자집계 — 각 일자마다
            for offset in range((end_date - start_date).days + 1):
                d = start_date + datetime.timedelta(days=offset)
                with Session(engine) as s:
                    total = upsert_revenue_from_orders(s, business_id, d)
                summary["total_sales"] += total

        # 2) 정산
        if sync_settlements:
            def _fetch_settle(client: CoupangEatsClient):
                return client.fetch_all_settlements(store_id, start_date, end_date)

            (settlements, refreshed) = _execute_with_refresh(business_id, _fetch_settle)
            summary["auth_refreshed"] = summary["auth_refreshed"] or refreshed
            with Session(engine) as s:
                up = upsert_settlements(s, business_id, store_id, settlements)
            summary["settlements"]["fetched"] = len(settlements)
            summary["settlements"]["inserted"] = up["inserted"]
            summary["settlements"]["updated"] = up["updated"]

        # 완료
        with Session(engine) as s:
            sl = s.get(CoupangEatsSyncLog, log_id)
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
                sl.auth_refreshed = summary["auth_refreshed"]
                s.add(sl)
                s.commit()

    except HTTPException as he:
        with Session(engine) as s:
            sl = s.get(CoupangEatsSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(he.detail)[:500]
                s.add(sl)
                s.commit()
        summary["errors"].append({"error": str(he.detail), "status_code": he.status_code})
        raise
    except Exception as e:
        with Session(engine) as s:
            sl = s.get(CoupangEatsSyncLog, log_id)
            if sl:
                sl.finished_at = datetime.datetime.utcnow()
                sl.status = "failed"
                sl.error_message = str(e)[:500]
                s.add(sl)
                s.commit()
        summary["errors"].append({"error": str(e)})
        log.error("sync failed bid=%s: %s", business_id, e, exc_info=True)
        raise

    return summary
