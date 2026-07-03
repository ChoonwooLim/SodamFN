"""쿠키 세션 만료 계산 — 단일 진실 원천(SSOT).

쿠팡이츠/배민의 manual 쿠키는 상당수가 session cookie (expires=-1) 라
`earliest_cookie_expiry()` 가 None 을 돌려주고 → cred.cookies_expires_at 이 NULL.
그 경우 만료를 추적 못해 "사전경보"가 영영 안 나가는 문제가 있었다.

발급시각(cookies_obtained_at) 기준 보수적 TTL 로 추정해 폴백한다.
어드민 UI 상태 endpoint(routers.external_integration_status) 와
알림 cron(services.collection_health) 이 **같은 로직**을 쓰도록 여기서 단일화한다.

관찰: 쿠팡이츠 unify-token 은 통상 24~36시간, 배민도 비슷. 보수적으로 30h.
"""
from __future__ import annotations

import datetime
from typing import Optional, Tuple

# 세션 쿠키(만료시각 미상) 시 발급시각 기준 보수적 추정 TTL.
ESTIMATED_COOKIE_TTL_HOURS = 30.0


def effective_cookie_expiry(
    expires_at: Optional[datetime.datetime],
    cookies_obtained_at: Optional[datetime.datetime],
) -> Tuple[Optional[datetime.datetime], bool]:
    """유효 만료시각과 그것이 추정값인지 반환.

    Returns:
        (effective_expiry, is_estimated)
        - expires_at 이 있으면 그대로 사용 (is_estimated=False).
        - 없고 cookies_obtained_at 이 있으면 +ESTIMATED_COOKIE_TTL_HOURS 로 추정
          (is_estimated=True).
        - 둘 다 없으면 (None, False).
    """
    if expires_at is not None:
        return expires_at, False
    if cookies_obtained_at is not None:
        return (
            cookies_obtained_at + datetime.timedelta(hours=ESTIMATED_COOKIE_TTL_HOURS),
            True,
        )
    return None, False
