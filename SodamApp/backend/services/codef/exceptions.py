"""CODEF 통합 표준 예외.

result.code 매핑은 codef_client.py 가 담당.
이 모듈은 예외 형태(carry data)만 정의.
"""
from typing import Optional


class CodefAuthExpired(Exception):
    """비밀번호/인증서 만료 — 사장님 재인증 필요."""

    def __init__(self, code: str = "", message: str = ""):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}" if code else message)


class CodefAdditionalAuth(Exception):
    """추가 본인확인 요구 — SMS 코드/캡차 등 추가 입력 필요."""

    def __init__(self, method: str = "sms", extra_info: Optional[dict] = None):
        self.method = method  # 'sms' | 'captcha' | 'email' | ...
        self.extra_info = extra_info or {}
        super().__init__(f"추가 본인확인 필요: {method}")


class CodefRateLimited(Exception):
    """CODEF 측 한도 초과."""
    pass


class CodefAPIError(Exception):
    """기타 CODEF API 에러."""

    def __init__(self, code: str = "", message: str = ""):
        self.code = code
        self.message = message
        super().__init__(f"[{code}] {message}")


class CodefQuotaExceeded(Exception):
    """셈하나 측 한도/예산 초과."""

    def __init__(self, scope: str, current: int, limit: int):
        self.scope = scope  # 'daily' | 'monthly_budget' | 'cooldown'
        self.current = current
        self.limit = limit
        super().__init__(f"{scope} 한도 초과: {current}/{limit}")
