"""BaeminClient 기본 동작 — HAR 없이 검증 가능한 부분."""
import datetime
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from services.baemin_service import (
    BaeminClient, BaeminError, CookieInvalidError,
    OrderFetchResult, SettlementFetchResult,
    serialize_cookies, deserialize_cookies, earliest_cookie_expiry,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_serialize_roundtrip():
    cookies = [{"name": "AUTH", "value": "abc", "domain": "ceo.baemin.com"}]
    blob = serialize_cookies(cookies)
    assert deserialize_cookies(blob) == cookies


def test_deserialize_invalid_returns_empty():
    assert deserialize_cookies("") == []
    assert deserialize_cookies("not-json") == []


def test_earliest_expiry_skips_session_cookies():
    cookies = [
        {"name": "A", "value": "1", "expires": -1},
        {"name": "B", "value": "2", "expires": 1750000000.0},
        {"name": "C", "value": "3", "expires": 1700000000.0},
    ]
    earliest = earliest_cookie_expiry(cookies)
    assert earliest == datetime.datetime.fromtimestamp(1700000000.0, tz=datetime.timezone.utc)


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


# ───── HAR fixture 기반 단위 테스트 ─────


def _mock_json_response(data: dict):
    """200 JSON response stub."""
    m = MagicMock()
    m.status_code = 200
    m.headers = {"content-type": "application/json"}
    m.json.return_value = data
    m.text = json.dumps(data)
    return m


def test_fetch_orders_parses_har_sample():
    sample = json.loads((FIXTURE_DIR / "orders_sample.json").read_text(encoding="utf-8"))
    c = BaeminClient(cookies=[])
    with patch.object(c._session, "get", return_value=_mock_json_response(sample)):
        result = c.fetch_orders(
            shop_owner_number="202504230008",
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 30),
        )
    assert isinstance(result, OrderFetchResult)
    assert result.total_order_count == sample.get("totalSize")
    assert result.total_sale_price == sample.get("totalPayAmount")
    assert result.orders == sample.get("contents")
    # 첫 주문 구조 검증
    if result.orders:
        first = result.orders[0]
        assert "order" in first
        assert "orderNumber" in first["order"]
        assert "payAmount" in first["order"]
        assert "orderDateTime" in first["order"]
    c.close()


def test_fetch_settlements_parses_har_sample():
    sample = json.loads((FIXTURE_DIR / "settlements_sample.json").read_text(encoding="utf-8"))
    c = BaeminClient(cookies=[])
    with patch.object(c._session, "get", return_value=_mock_json_response(sample)):
        result = c.fetch_settlements(
            shop_owner_number="202504230008",
            start_date=datetime.date(2026, 5, 14),
            end_date=datetime.date(2026, 5, 17),
        )
    assert isinstance(result, SettlementFetchResult)
    assert result.total_elements == sample.get("totalSize")
    assert isinstance(result.contents, list)
    if result.contents:
        first = result.contents[0]
        assert "giveId" in first
        assert "giveAmount" in first
        assert "depositDueDate" in first
    c.close()


def test_whoami_url_uses_session_user_profile():
    """whoami 가 /v1/session/user-profile 호출하는지 + 응답 그대로 반환."""
    c = BaeminClient(cookies=[])
    sample = {"memNo": "x", "memName": "Test", "shopOwnerNumber": "202504230008"}
    with patch.object(c._session, "get", return_value=_mock_json_response(sample)) as mg:
        result = c.whoami()
    assert result == sample
    # 호출 URL 검증
    args, kwargs = mg.call_args
    called_url = args[0] if args else kwargs.get("url")
    assert "/v1/session/user-profile" in called_url
    c.close()
