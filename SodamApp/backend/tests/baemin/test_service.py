"""BaeminClient 기본 동작 — HAR 없이 검증 가능한 부분."""
import json
import pytest
from services.baemin_service import (
    BaeminClient, BaeminError, CookieInvalidError,
    serialize_cookies, deserialize_cookies, earliest_cookie_expiry,
)


def test_serialize_roundtrip():
    cookies = [{"name": "AUTH", "value": "abc", "domain": "ceo.baemin.com"}]
    blob = serialize_cookies(cookies)
    assert deserialize_cookies(blob) == cookies


def test_deserialize_invalid_returns_empty():
    assert deserialize_cookies("") == []
    assert deserialize_cookies("not-json") == []


def test_earliest_expiry_skips_session_cookies():
    import datetime
    cookies = [
        {"name": "A", "value": "1", "expires": -1},
        {"name": "B", "value": "2", "expires": 1750000000.0},
        {"name": "C", "value": "3", "expires": 1700000000.0},
    ]
    earliest = earliest_cookie_expiry(cookies)
    assert earliest == datetime.datetime.utcfromtimestamp(1700000000.0)


def test_client_can_be_constructed_with_no_cookies():
    c = BaeminClient(cookies=[])
    assert c is not None
    c.close()


def test_client_loads_cookies_without_error():
    cookies = [{"name": "AUTH", "value": "abc"}]
    c = BaeminClient(cookies=cookies)
    out = c.get_cookies()
    assert any(x["name"] == "AUTH" for x in out)
    c.close()
