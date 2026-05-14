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


# ───── upsert 헬퍼 단위 테스트 (Task 6) ─────

from sqlmodel import Session, SQLModel, create_engine, select
from models import Business, BaeminOrder, BaeminSettlement, DeliveryRevenue


def _seed_engine():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        s.add(Business(id=1, name="test", subscription_status="active"))
        s.commit()
    return eng


def test_upsert_orders_idempotent():
    """HAR 응답 구조 — contents: [{order:{...}, settle:{...}}]"""
    from services.baemin_service import upsert_orders
    eng = _seed_engine()
    contents = [
        {"order": {"orderNumber": "T2CH0000A1",
                   "orderDateTime": "2026-05-01T12:30:00",
                   "payAmount": 25000, "status": "CLOSED",
                   "shopNumber": 14746996, "payType": "BARO"}},
        {"order": {"orderNumber": "T2CH0000A2",
                   "orderDateTime": "2026-05-01T13:00:00",
                   "payAmount": 18000, "status": "CLOSED",
                   "shopNumber": 14746996, "payType": "BARO"}},
    ]
    with Session(eng) as s:
        r1 = upsert_orders(s, business_id=1, shop_number="14746996",
                           orders_contents=contents)
        assert r1["inserted"] == 2
        # 같은 응답 다시 → 0 inserted
        r2 = upsert_orders(s, business_id=1, shop_number="14746996",
                           orders_contents=contents)
        assert r2["inserted"] == 0
        assert r2["updated"] == 2  # 같은 orderNumber 다시 → 모두 update 처리


def test_upsert_orders_handles_cancelled_status():
    from services.baemin_service import upsert_orders
    eng = _seed_engine()
    contents = [
        {"order": {"orderNumber": "T2CH_DEL",
                   "orderDateTime": "2026-05-01T10:00:00",
                   "payAmount": 12000, "status": "DELIVERY_CANCELED",
                   "shopNumber": 14746996, "payType": "BARO"}},
        {"order": {"orderNumber": "T2CH_OK",
                   "orderDateTime": "2026-05-01T11:00:00",
                   "payAmount": 25000, "status": "CLOSED",
                   "shopNumber": 14746996, "payType": "BARO"}},
    ]
    with Session(eng) as s:
        upsert_orders(s, business_id=1, shop_number="14746996",
                      orders_contents=contents)
        rows = s.exec(select(BaeminOrder)).all()
        cancelled = [o for o in rows if o.cancelled]
        ok = [o for o in rows if not o.cancelled]
        assert len(cancelled) == 1 and cancelled[0].order_id == "T2CH_DEL"
        assert len(ok) == 1 and ok[0].order_id == "T2CH_OK"


def test_upsert_settlements_idempotent():
    """HAR 응답 — contents: [{giveId, depositDueDate, giveStatus, giveAmount, ...}]"""
    from services.baemin_service import upsert_settlements
    eng = _seed_engine()
    rows = [
        {"giveId": 518740754, "depositDueDate": "2026-05-15",
         "settleCode": "FOOD", "settleCodeName": "음식배달",
         "giveStatus": "REQUEST", "giveStatusName": "입금요청",
         "giveAmount": 110000},
        {"giveId": 518573009, "depositDueDate": "2026-05-14",
         "settleCode": "FOOD", "settleCodeName": "음식배달",
         "giveStatus": "COMPLETE", "giveStatusName": "입금완료",
         "giveAmount": 4116},
    ]
    with Session(eng) as s:
        r1 = upsert_settlements(s, business_id=1, shop_number="14746996",
                                settlements_contents=rows)
        assert r1["inserted"] == 2
        r2 = upsert_settlements(s, business_id=1, shop_number="14746996",
                                settlements_contents=rows)
        assert r2["inserted"] == 0
        assert r2["updated"] == 2
        st_rows = s.exec(select(BaeminSettlement)).all()
        # giveId int → str 변환 확인
        ids = {r.seller_transfer_id for r in st_rows}
        assert "518740754" in ids


def test_upsert_revenue_from_orders_daily_aggregate():
    """주문 합계 → DeliveryRevenue(channel='배달의민족') upsert."""
    from services.baemin_service import upsert_orders, upsert_revenue_from_orders
    eng = _seed_engine()
    contents = [
        {"order": {"orderNumber": "X1", "orderDateTime": "2026-05-01T10:00:00",
                   "payAmount": 25000, "status": "CLOSED",
                   "shopNumber": 14746996, "payType": "BARO"}},
        {"order": {"orderNumber": "X2", "orderDateTime": "2026-05-01T11:00:00",
                   "payAmount": 18000, "status": "CLOSED",
                   "shopNumber": 14746996, "payType": "BARO"}},
        {"order": {"orderNumber": "X3", "orderDateTime": "2026-05-01T12:00:00",
                   "payAmount": 12000, "status": "DELIVERY_CANCELED",
                   "shopNumber": 14746996, "payType": "BARO"}},
    ]
    with Session(eng) as s:
        upsert_orders(s, business_id=1, shop_number="14746996",
                      orders_contents=contents)
        total = upsert_revenue_from_orders(s, business_id=1,
                                           date=datetime.date(2026, 5, 1))
        # cancelled 제외 → 25000 + 18000 = 43000
        assert total == 43000
        dr = s.exec(
            select(DeliveryRevenue).where(
                DeliveryRevenue.business_id == 1,
                DeliveryRevenue.year == 2026,
                DeliveryRevenue.month == 5,
                DeliveryRevenue.channel == "배달의민족",
            )
        ).first()
        assert dr is not None
        assert dr.total_sales == 43000
        assert dr.order_count == 2
