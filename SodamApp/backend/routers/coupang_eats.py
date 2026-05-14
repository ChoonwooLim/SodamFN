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
import logging
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
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
    sync_monthly_excel,
)
from services.coupang_eats_login import (
    login_and_get_cookies,
    CoupangEatsLoginError,
)
from utils.datetime_utils import utc_iso


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
        "cookies_obtained_at": utc_iso(row.cookies_obtained_at),
        "cookies_expires_at": utc_iso(row.cookies_expires_at),
        "last_verified_at": utc_iso(row.last_verified_at),
        "last_failed_at": utc_iso(row.last_failed_at),
        "last_error_message": row.last_error_message,
        "consecutive_failures": row.consecutive_failures,
        "updated_at": utc_iso(row.updated_at),
    }


def _log_dto(row: CoupangEatsSyncLog) -> dict:
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

    # 인증 쿠키 sanity check — 신/구버전 모두 허용
    # 구버전: EATS_AT / EATS_RT
    # 신버전(2026~): unify-token + account-id (통합 인증)
    cookie_names_upper = {(c.get("name") or "").upper() for c in body.cookies}
    cookie_names_lower = {(c.get("name") or "").lower() for c in body.cookies}
    has_auth = (
        any(n in cookie_names_upper for n in ("EATS_AT", "EATS_RT", "AUTH-TOKEN"))
        or "unify-token" in cookie_names_lower
        or "account-id" in cookie_names_lower
    )
    if not has_auth:
        log.warning("manual cookies missing common auth names, names=%s", cookie_names_upper)

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

# ──────────────────────────────────────────────────────────────────────────
# 6) 월별 매출내역서(엑셀) — fee breakdown 의 유일한 소스
# ──────────────────────────────────────────────────────────────────────────


@router.get("/downloadable-periods")
def get_downloadable_periods(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """매출내역서 엑셀 다운로드 가능 기간 조회.

    응답 예:
      {"data": {"downloadablePeriods":[{"periodUnitType":"MONTH","start":"2020-01","inclusiveEnd":"2026-04"}]}}

    inclusiveEnd 가 보통 전월. 당월은 마감 후 다운로드 가능.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred or not cred.store_id:
            raise HTTPException(404, "자격증명/매장 ID 미등록")
        store_id = cred.store_id

    def _action(client: CoupangEatsClient):
        return client.fetch_downloadable_periods(store_id)

    (data, refreshed) = _execute_with_refresh(bid, _action)
    return {"ok": True, "store_id": store_id, "data": data, "auth_refreshed": refreshed}


class MonthlyExcelSyncIn(BaseModel):
    year_month: str = Field(..., min_length=7, max_length=7,
                            description="'YYYY-MM' (다운로드 가능 기간 내)")


@router.post("/sync/monthly-excel")
def sync_monthly_excel_endpoint(
    body: MonthlyExcelSyncIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """월별 매출내역서 자동 다운로드 → 파싱 → CoupangEatsOrderFee 적재
    → CoupangEatsSettlement.fee_* 일자별 갱신.

    P/L 의 쿠팡이츠 수수료/배달비/광고비/멤버십 정확도를 위한 핵심 동기화.
    멱등 (재실행 시 동일 데이터 갱신).
    """
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred or not cred.store_id:
            raise HTTPException(404, "자격증명/매장 ID 미등록")
        store_id = cred.store_id

    def _action(client: CoupangEatsClient):
        return client.download_sales_order_excel(store_id, body.year_month)

    (excel_bytes, refreshed) = _execute_with_refresh(bid, _action)

    with Session(engine) as s:
        try:
            result = sync_monthly_excel(
                s, bid, store_id, body.year_month, excel_bytes,
                triggered_by="manual",
            )
        except CoupangEatsError as e:
            raise HTTPException(422, f"엑셀 처리 실패: {e}") from e
    result["auth_refreshed"] = refreshed
    return result


@router.post("/sync/monthly-excel/upload")
def sync_monthly_excel_upload(
    year_month: str,
    file: UploadFile = File(...),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """사장님이 직접 다운로드받은 엑셀 파일을 업로드해서 처리.

    Akamai 차단 등으로 API 자동 다운로드 실패 시 폴백.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    if not year_month or len(year_month) != 7 or year_month[4] != "-":
        raise HTTPException(400, "year_month 는 'YYYY-MM' 형식이어야 합니다.")

    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred or not cred.store_id:
            raise HTTPException(404, "자격증명/매장 ID 미등록")
        store_id = cred.store_id

    try:
        excel_bytes = file.file.read()
    finally:
        try:
            file.file.close()
        except Exception:
            pass
    if not excel_bytes:
        raise HTTPException(400, "업로드 파일이 비어있습니다.")
    if excel_bytes[:4] != b"PK\x03\x04":
        raise HTTPException(
            400, f"엑셀(.xlsx) 파일이 아닙니다. (앞 4바이트={excel_bytes[:4]!r})"
        )

    with Session(engine) as s:
        try:
            result = sync_monthly_excel(
                s, bid, store_id, year_month, excel_bytes,
                triggered_by="manual_upload",
            )
        except CoupangEatsError as e:
            raise HTTPException(422, f"엑셀 처리 실패: {e}") from e
    return result


@router.post("/sync/monthly-excel/cron-trigger")
def sync_monthly_excel_cron(
    year_month: Optional[str] = None,
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """매월 6일 03:30 cron — 전월 + 전전월(누락 대비) 자동 다운로드.

    `year_month` 미지정 시 (전월, 전전월) 두 달 처리. 인증 모두 실패한 사업장은 skip.
    """
    import os
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(401, "invalid cron secret")

    today = datetime.date.today()
    if year_month:
        targets = [year_month]
    else:
        # 전월 + 전전월 (재시도 안정성)
        first_of_this_month = today.replace(day=1)
        prev_month_end = first_of_this_month - datetime.timedelta(days=1)
        prev_prev_month_end = prev_month_end.replace(day=1) - datetime.timedelta(days=1)
        targets = [
            prev_month_end.strftime("%Y-%m"),
            prev_prev_month_end.strftime("%Y-%m"),
        ]

    with Session(engine) as s:
        creds_rows = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.status.in_(["active"])
            )
        ).all()
        cred_map = {c.business_id: c.store_id for c in creds_rows if c.store_id}

    results = []
    for bid, store_id in cred_map.items():
        for ym in targets:
            try:
                def _action(client: CoupangEatsClient, _sid=store_id, _ym=ym):
                    return client.download_sales_order_excel(_sid, _ym)
                (excel_bytes, refreshed) = _execute_with_refresh(bid, _action)
                with Session(engine) as s:
                    r = sync_monthly_excel(
                        s, bid, store_id, ym, excel_bytes,
                        triggered_by="cron",
                    )
                results.append({"business_id": bid, "year_month": ym,
                                "auth_refreshed": refreshed, **r})
            except HTTPException as he:
                results.append({"business_id": bid, "year_month": ym,
                                "error": str(he.detail), "status_code": he.status_code})
            except Exception as e:  # noqa: BLE001
                log.error("monthly-excel cron failed bid=%s ym=%s: %s",
                          bid, ym, e, exc_info=True)
                results.append({"business_id": bid, "year_month": ym, "error": str(e)})

    return {
        "ok": True,
        "today": today.isoformat(),
        "targets": targets,
        "business_count": len(cred_map),
        "results": results,
    }


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


@router.get("/debug/probe")
def debug_probe(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """디버그 — 현재 DB 쿠키 list + whoami 호출 응답 raw 노출.

    수동 쿠키 입력이 401 받을 때 정확한 원인 추적용. 쿠키 *이름*만 노출하지만
    응답 본문/헤더에 Set-Cookie 등 민감 정보가 섞일 수 있어 superadmin 한정.
    """
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
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

    # 필수 쿠키 분석 — 신/구버전 모두 인식
    cookie_names = [(c.get("name") or "").strip() for c in cookies]
    auth_cookies = [n for n in cookie_names if (
        n.upper() in ("EATS_AT", "EATS_RT", "AUTH-TOKEN")
        or n.lower() in ("unify-token", "account-id")
    )]
    akamai_cookies = [n for n in cookie_names if (
        n.lower().startswith("bm_")
        or n.lower() in ("_abck", "abck", "ak_bmsc")
    )]
    csrf_cookies = [n for n in cookie_names if "xsrf" in n.lower() or "csrf" in n.lower()]

    # 실 호출 시도 (whoami — 가장 가벼움)
    client = CoupangEatsClient(cookies)
    probe_result: dict = {}
    try:
        from services.coupang_eats_service import BASE_URL
        url = f"{BASE_URL}/api/v1/merchant/whoami"
        referer = f"{BASE_URL}/merchant/management/home/"
        r = client._session.get(
            url,
            headers=client._common_headers(referer),
            timeout=10,
        )
        probe_result = {
            "status_code": r.status_code,
            "content_type": r.headers.get("content-type"),
            "response_body_first_500": (r.text or "")[:500],
            "response_headers": dict(r.headers),
        }
    except Exception as e:  # noqa: BLE001
        probe_result = {"error": str(e)}
    finally:
        client.close()

    return {
        "cookies_total": len(cookies),
        "cookie_names": cookie_names,
        "cookie_domains": list({(c.get("domain") or "-") for c in cookies}),
        "auth_cookies_present": auth_cookies or "❌ 없음 — EATS_AT/EATS_RT 필요",
        "akamai_cookies_present": akamai_cookies or "❌ 없음 — _abck/bm_sz 필요 (Akamai 봇 검증)",
        "csrf_cookies_present": csrf_cookies or "(없음 — GET 호출엔 보통 불필요)",
        "probe": probe_result,
        "diagnosis": (
            "✅ 쿠키 구성 OK — 응답 body 확인 필요"
            if (auth_cookies and akamai_cookies)
            else f"⚠️ 쿠키 누락: " + (
                "Akamai 쿠키 (_abck, bm_sz 등) 없음 — 봇 차단 거의 확실" if not akamai_cookies
                else "인증 쿠키 (EATS_AT) 없음"
            )
        ),
    }


@router.get("/debug/settlement-detail-probe")
def debug_settlement_detail_probe(
    seller_transfer_id: Optional[int] = None,
    extra_url: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """detail endpoint URL 발굴 probe.

    `seller_transfer_id` 미지정 시 DB 의 최신 SETTLEMENT row 사용.
    `extra_url` 로 후보 URL 추가 가능 (e.g. `/api/v1/merchant/.../my-custom-path/{seller_transfer_id}`).
      → `{store_id}` / `{seller_transfer_id}` placeholder 치환됨.

    응답: 각 후보 URL 의 status / content-type / 응답 body 앞 1200자 / JSON top keys.
    """
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)

    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred or not cred.store_id:
            raise HTTPException(404, "자격증명/매장 ID 미등록")
        store_id = cred.store_id

        # seller_transfer_id 미지정 — DB 의 최신 SETTLEMENT row 자동 선택
        chosen_settlement_dto: Optional[dict] = None
        if seller_transfer_id is None:
            chosen = s.exec(
                select(CoupangEatsSettlement).where(
                    CoupangEatsSettlement.business_id == bid,
                    CoupangEatsSettlement.settlement_type == "SETTLEMENT",
                    CoupangEatsSettlement.seller_transfer_id.is_not(None),
                ).order_by(CoupangEatsSettlement.settlement_date.desc()).limit(1)
            ).first()
            if not chosen:
                raise HTTPException(
                    422,
                    "DB 에 SETTLEMENT 행이 없습니다. /sync/manual 로 먼저 정산을 수집하거나 "
                    "seller_transfer_id 를 직접 지정하세요.",
                )
            seller_transfer_id = chosen.seller_transfer_id
            chosen_settlement_dto = {
                "id": chosen.id,
                "settlement_date": chosen.settlement_date.isoformat(),
                "amount": chosen.amount,
                "balance": chosen.balance,
            }

    def _action(client: CoupangEatsClient):
        return client.probe_settlement_detail(
            store_id,
            int(seller_transfer_id),
            extra_urls=[extra_url] if extra_url else None,
        )

    try:
        (results, refreshed) = _execute_with_refresh(bid, _action)
    except HTTPException:
        raise
    except Exception as e:
        log.error("settlement-detail-probe failed: %s", e, exc_info=True)
        raise HTTPException(500, f"probe 실패: {e}") from e

    # 200 + JSON 인 결과를 맨 위로 정렬 (눈에 잘 띄게)
    def _rank(entry: dict) -> int:
        sc = entry.get("status_code") or 999
        ct = (entry.get("content_type") or "").lower()
        if sc == 200 and "json" in ct:
            return 0
        if sc == 200:
            return 1
        if sc in (401, 403):
            return 8  # 인증 이슈 — URL 자체는 맞을 수도
        return 5
    results_sorted = sorted(results, key=_rank)

    return {
        "store_id": store_id,
        "seller_transfer_id": int(seller_transfer_id),
        "chosen_settlement": chosen_settlement_dto,
        "auth_refreshed": refreshed,
        "results": results_sorted,
        "winners": [
            r["url_template"] for r in results_sorted
            if r.get("status_code") == 200
               and "json" in (r.get("content_type") or "").lower()
        ],
    }


@router.get("/debug/raw-orders")
def debug_raw_orders(
    start: Optional[str] = None,
    end: Optional[str] = None,
    page_size: int = 10,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """디버그 — fetch_orders 응답 raw 그대로 노출. 응답 구조 파악용.

    raw 응답에 고객 이름/주소/전화 등 PII 가 그대로 포함되므로 superadmin 한정.
    start/end 미지정 시 어제 하루.
    """
    if admin.role != "superadmin":
        raise HTTPException(403, "디버그 엔드포인트는 superadmin 전용입니다.")
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == bid
            )
        ).first()
        if not cred or not cred.store_id:
            raise HTTPException(404, "자격증명/매장 ID 미등록")
        store_id = cred.store_id

    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    try:
        start_d = datetime.date.fromisoformat(start) if start else yesterday
        end_d = datetime.date.fromisoformat(end) if end else yesterday
    except ValueError as e:
        raise HTTPException(400, f"날짜 형식 오류: {e}") from e
    start_dt = datetime.datetime.combine(start_d, datetime.time.min)
    end_dt = datetime.datetime.combine(end_d, datetime.time.max)

    def _action(client: CoupangEatsClient):
        return client.fetch_orders(store_id, start_dt, end_dt,
                                   page_number=0, page_size=page_size)

    try:
        (res, refreshed) = _execute_with_refresh(bid, _action)
        return {
            "store_id": store_id,
            "start": start_d.isoformat(),
            "end": end_d.isoformat(),
            "summary": {
                "total_sale_price": res.total_sale_price,
                "total_order_count": res.total_order_count,
                "avg_order_amount": res.avg_order_amount,
                "fetched_orders_in_page": len(res.orders),
            },
            "first_order": res.orders[0] if res.orders else None,
            "raw_response": res.raw,
            "auth_refreshed": refreshed,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("debug raw-orders failed: %s", e, exc_info=True)
        raise HTTPException(500, f"raw-orders 실패: {e}") from e


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
