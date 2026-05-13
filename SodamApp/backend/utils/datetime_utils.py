"""datetime 직렬화 헬퍼.

컨테이너 TZ=UTC. 모델은 datetime.utcnow() (또는 컨테이너 시각 = UTC) 로
naive UTC datetime 을 저장한다. ISO 직렬화 시 timezone 정보가 없으면
프론트 `new Date(isoString)` 이 로컬 TZ(KST 등) 로 잘못 해석 → 9시간 어긋남.

utc_iso() 는 naive datetime 에 UTC tzinfo 를 부착해 `...+00:00` 으로 출력.
date 객체(시간대 무관)는 그대로 isoformat 반환.
"""
from __future__ import annotations

import datetime
from typing import Optional, Union


def utc_iso(value: Union[datetime.datetime, datetime.date, None]) -> Optional[str]:
    """naive datetime → UTC-tagged ISO. date 는 그대로 ISO. None → None."""
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        return value.isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return None
