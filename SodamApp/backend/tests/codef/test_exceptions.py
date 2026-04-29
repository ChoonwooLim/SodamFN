import pytest
from services.codef.exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefRateLimited,
    CodefAPIError,
    CodefQuotaExceeded,
)


def test_codef_auth_expired_carries_code():
    e = CodefAuthExpired(code="CF-12100", message="비밀번호 오류")
    assert e.code == "CF-12100"
    assert "비밀번호" in str(e)


def test_codef_additional_auth_carries_extra_info():
    e = CodefAdditionalAuth(method="sms", extra_info={"continue_token": "abc"})
    assert e.method == "sms"
    assert e.extra_info["continue_token"] == "abc"


def test_codef_rate_limited_default():
    e = CodefRateLimited()
    assert isinstance(e, Exception)


def test_codef_api_error_format():
    e = CodefAPIError(code="CF-99999", message="알 수 없는 오류")
    assert e.code == "CF-99999"
    assert "[CF-99999]" in str(e)


def test_codef_quota_exceeded_carries_scope():
    e = CodefQuotaExceeded(scope="daily", current=100, limit=100)
    assert e.scope == "daily"
    assert e.current == 100
    assert e.limit == 100
    assert "100/100" in str(e)
