"""외부 연동 통합 상태 — 쿠팡이츠/배민 등 자동수집 채널의 쿠키 만료 모니터링.

목적: 어드민 헤더 종 알림 + 외부연동 페이지 상단 카드의 데이터 소스.
사장님이 어드민 열 때마다 "쿠팡이츠 쿠키 N시간 후 만료" 같은 임박 알림 표시.

채널별 상태 모델:
  not_configured: 자격증명 미등록
  expired:        쿠키 만료 시점 경과
  expiring_soon:  만료까지 ≤ 12시간
  failed:         연속 실패 ≥ 3 OR status=cookie_invalid
  unknown:        쿠키는 있지만 만료시간 미상 (session cookie / -1)
  healthy:        만료까지 > 12시간 + 실패 없음

다음 작업:
- 텔레그램/카카오 알림 추가 (외출 시 푸시 — 사장님 결정 시)
- EasyPos/CODEF 등 다른 채널 통합
"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from database import engine
from models import BaeminCredential, CoupangEatsCredential, User
from routers.auth import get_admin_user
from utils.datetime_utils import utc_iso


router = APIRouter(prefix="/api/external-integration", tags=["external-integration"])


EXPIRING_SOON_HOURS = 12.0
FAILED_THRESHOLD = 3   # consecutive_failures ≥ 3 → failed

# 휴리스틱: 쿠팡이츠/배민의 manual 쿠키 중 일부가 session cookie (expires=-1)
# 라 cookies_expires_at 가 NULL 인 경우가 흔함. 그러면 만료를 추적 못해
# 사전 알림이 안 됨. cookies_obtained_at 기준 보수적 TTL 로 추정.
# 관찰: 쿠팡이츠 unify-token 은 통상 24~36시간, 배민도 비슷. 보수적 30h.
ESTIMATED_COOKIE_TTL_HOURS = 30.0


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


def _classify_status(*,
                     configured: bool,
                     expires_at: Optional[datetime.datetime],
                     consecutive_failures: int,
                     cred_status: Optional[str],
                     now: datetime.datetime,
                     cookies_obtained_at: Optional[datetime.datetime] = None,
                     ) -> tuple[str, Optional[float], bool]:
    """채널 상태 분류 + 만료까지 남은 시간(h) + 만료시간이 추정값인지 반환.

    expires_at 가 NULL 인 경우 (쿠팡이츠/배민의 session 쿠키 다수) →
    cookies_obtained_at + ESTIMATED_COOKIE_TTL_HOURS 로 추정.
    추정이라도 사장님이 갱신 타이밍 알 수 있도록 ESTIMATED 마커 함께 반환.
    """
    if not configured:
        return "not_configured", None, False

    # 명시적 실패 상태 우선
    if cred_status in ("cookie_invalid", "failed", "expired"):
        return "failed", None, False
    if consecutive_failures and consecutive_failures >= FAILED_THRESHOLD:
        return "failed", None, False

    effective_expires = expires_at
    is_estimated = False
    if effective_expires is None and cookies_obtained_at is not None:
        effective_expires = cookies_obtained_at + datetime.timedelta(
            hours=ESTIMATED_COOKIE_TTL_HOURS
        )
        is_estimated = True

    if effective_expires is None:
        return "unknown", None, False

    delta = (effective_expires - now).total_seconds() / 3600.0
    if delta <= 0:
        return "expired", delta, is_estimated
    if delta <= EXPIRING_SOON_HOURS:
        return "expiring_soon", delta, is_estimated
    return "healthy", delta, is_estimated


def _build_coupang_eats_status(session: Session,
                               business_id: int,
                               now: datetime.datetime) -> dict:
    cred = session.exec(
        select(CoupangEatsCredential).where(
            CoupangEatsCredential.business_id == business_id
        )
    ).first()
    configured = cred is not None

    status, hours_left, is_estimated = _classify_status(
        configured=configured,
        expires_at=cred.cookies_expires_at if cred else None,
        cookies_obtained_at=cred.cookies_obtained_at if cred else None,
        consecutive_failures=cred.consecutive_failures if cred else 0,
        cred_status=cred.status if cred else None,
        now=now,
    )

    return {
        "channel": "쿠팡이츠",
        "channel_key": "coupang_eats",
        "configured": configured,
        "status": status,
        "expires_at": utc_iso(cred.cookies_expires_at) if cred else None,
        "expires_in_hours": round(hours_left, 1) if hours_left is not None else None,
        "expires_estimated": is_estimated,
        "cookies_obtained_at": utc_iso(cred.cookies_obtained_at) if cred else None,
        "last_verified_at": utc_iso(cred.last_verified_at) if cred else None,
        "last_failed_at": utc_iso(cred.last_failed_at) if cred else None,
        "last_error_message": (cred.last_error_message if cred else None),
        "consecutive_failures": cred.consecutive_failures if cred else 0,
        "login_method": cred.login_method if cred else None,
        "refresh_guide": (
            "어드민 [외부연동 → 쿠팡이츠] 에서 브라우저로 store.coupangeats.com 로그인 후 "
            "쿠키를 복사해 [수동 쿠키 입력] 으로 저장하세요. (1~3일 만료)"
        ),
        "refresh_path": "/외부연동/쿠팡이츠",
    }


def _build_baemin_status(session: Session,
                         business_id: int,
                         now: datetime.datetime) -> dict:
    cred = session.exec(
        select(BaeminCredential).where(
            BaeminCredential.business_id == business_id
        )
    ).first()
    configured = cred is not None

    status, hours_left, is_estimated = _classify_status(
        configured=configured,
        expires_at=cred.cookies_expires_at if cred else None,
        cookies_obtained_at=cred.cookies_obtained_at if cred else None,
        consecutive_failures=cred.consecutive_failures if cred else 0,
        cred_status=cred.status if cred else None,
        now=now,
    )

    return {
        "channel": "배달의민족",
        "channel_key": "baemin",
        "configured": configured,
        "status": status,
        "expires_at": utc_iso(cred.cookies_expires_at) if cred else None,
        "expires_in_hours": round(hours_left, 1) if hours_left is not None else None,
        "expires_estimated": is_estimated,
        "cookies_obtained_at": utc_iso(cred.cookies_obtained_at) if cred else None,
        "last_verified_at": utc_iso(cred.last_verified_at) if cred else None,
        "last_failed_at": utc_iso(cred.last_failed_at) if cred else None,
        "last_error_message": (cred.last_error_message if cred else None),
        "consecutive_failures": cred.consecutive_failures if cred else 0,
        "login_method": None,   # BaeminCredential 은 manual cookie only
        "refresh_guide": (
            "어드민 [외부연동 → 배달의민족] 에서 브라우저로 ceo.baemin.com 로그인 후 "
            "쿠키를 복사해 [수동 쿠키 입력] 으로 저장하세요."
        ),
        "refresh_path": "/외부연동/배민",
    }


ALERTABLE_STATUSES = {"expiring_soon", "expired", "failed", "stale"}

# 상태 정렬: 위험한 것 위로
_STATUS_ORDER = {
    "expired": 0, "failed": 1, "expiring_soon": 2, "stale": 2,
    "unknown": 3, "not_configured": 4, "skipping": 4, "healthy": 5,
}


def build_all_channels(session: Session, business_id: int,
                       now: datetime.datetime) -> list[dict]:
    """쿠팡/배민(쿠키 상세) + easypos/codef(건강 판정) 통합 채널 목록."""
    from services import collection_health
    channels = [
        _build_coupang_eats_status(session, business_id, now),
        _build_baemin_status(session, business_id, now),
    ]
    have = {c["channel_key"] for c in channels}
    for h in collection_health.evaluate_channels(session, business_id, now):
        if h.channel_key in have:
            continue
        channels.append({
            "channel": h.label,
            "channel_key": h.channel_key,
            "configured": h.status != "skipping",
            "status": h.status,
            "last_data_date": h.last_data_date.isoformat() if h.last_data_date else None,
            "last_error_message": h.detail,
        })
    return channels


@router.get("/status")
def get_integration_status(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """모든 외부 연동 채널의 쿠키 만료/실패 상태 통합 조회.

    프론트 헤더 종 컴포넌트 + 외부연동 페이지 상단 카드가 폴링.

    alert_count: 사장님 주의 필요한 채널 수 (expiring_soon / expired / failed / stale).
    skipping(미등록 채널)은 배지 카운트 제외 — 정보 표시용으로만 channels[] 에 포함.
    어드민 종 뱃지 숫자로 사용.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    now = datetime.datetime.utcnow()

    with Session(engine) as s:
        channels = build_all_channels(s, bid, now)

    alert_count = sum(1 for c in channels if c["status"] in ALERTABLE_STATUSES)
    channels.sort(key=lambda c: _STATUS_ORDER.get(c["status"], 9))

    return {
        "as_of": utc_iso(now),
        "business_id": bid,
        "channels": channels,
        "alert_count": alert_count,
        "alertable_statuses": sorted(ALERTABLE_STATUSES),
    }
