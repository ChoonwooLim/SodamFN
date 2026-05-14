"""CODEF 카드 매입 Provider 테스트 — mock CodefClient 기반."""
import datetime
import pytest
from unittest.mock import MagicMock

from sqlmodel import Session, SQLModel, create_engine, select

from models import Business, CodefConnection, CardPurchase
from services.codef.card_purchase_provider import CodefCardPurchaseProvider
from services.codef.codef_client import RequestProductResult
from services.codef.exceptions import CodefAuthExpired, CodefRateLimited


@pytest.fixture
def engine_with_conn():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        b = Business(name="t", business_number="1234567890")
        s.add(b)
        s.commit()
        s.refresh(b)
        conn = CodefConnection(
            business_id=b.id,
            organization_type="card",
            organization_code="0306",
            organization_label="신한카드",
            connected_id="test-cid",
            auth_method="id_pw",
            connection_type="card_purchase",
            status="active",
        )
        s.add(conn)
        s.commit()
        s.refresh(conn)
    yield eng, conn


def _response(rows: list[dict]) -> RequestProductResult:
    return RequestProductResult(rows=rows, raw={}, result_code="CF-00000",
                                 rows_count=len(rows))


def _make_provider(engine, client_mock):
    quota_mock = MagicMock()
    quota_mock.check_before_call.return_value = None
    quota_mock.record_call.return_value = None
    conn_svc_mock = MagicMock()
    return CodefCardPurchaseProvider(
        engine, client=client_mock, quota=quota_mock, connections=conn_svc_mock
    )


def test_upsert_purchases_new(engine_with_conn):
    eng, conn = engine_with_conn
    rows = [
        {"approvedDate": "20260514", "approvalNo": "12345678",
         "amount": "12000", "merchantName": "GS25 화양점",
         "businessType": "편의점", "cardNo": "1234-****-****-5678",
         "approvedTime": "120130", "status": "1"},
        {"approvedDate": "20260514", "approvalNo": "12345679",
         "amount": "5500", "merchantName": "스타벅스 건대점",
         "businessType": "카페", "status": "1"},
    ]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _response(rows)
    provider = _make_provider(eng, client_mock)

    result = provider.sync_one_connection(conn, days_back=7)
    assert result.error is None
    assert result.new_purchases == 2

    with Session(eng) as s:
        purchases = list(s.exec(select(CardPurchase)))
    assert len(purchases) == 2
    p1 = next(p for p in purchases if p.approval_number == "12345678")
    assert p1.merchant_name == "GS25 화양점"
    assert p1.business_type == "편의점"
    assert p1.amount == 12000
    assert p1.card_corp == "신한카드"
    assert p1.card_number_masked == "1234-****-****-5678"
    assert p1.source == "codef"
    assert p1.connection_id == conn.id
    assert p1.status == "승인"


def test_upsert_purchases_idempotent(engine_with_conn):
    """같은 row 2번 sync — 두 번째는 0 inserted."""
    eng, conn = engine_with_conn
    rows = [{"approvedDate": "20260514", "approvalNo": "X1",
             "amount": "10000", "merchantName": "Test", "status": "1"}]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _response(rows)
    provider = _make_provider(eng, client_mock)

    r1 = provider.sync_one_connection(conn)
    r2 = provider.sync_one_connection(conn)
    assert r1.new_purchases == 1
    assert r2.new_purchases == 0

    with Session(eng) as s:
        purchases = list(s.exec(select(CardPurchase)))
    assert len(purchases) == 1


def test_upsert_purchases_cancelled_status(engine_with_conn):
    eng, conn = engine_with_conn
    rows = [{"approvedDate": "20260514", "approvalNo": "Y1",
             "amount": "10000", "status": "2", "merchantName": "Cancel"}]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _response(rows)
    provider = _make_provider(eng, client_mock)

    provider.sync_one_connection(conn)
    with Session(eng) as s:
        p = s.exec(select(CardPurchase)).first()
    assert p is not None
    assert p.status == "취소"


def test_upsert_skips_rows_missing_required_fields(engine_with_conn):
    """approval_number 또는 approval_date 가 없으면 skip."""
    eng, conn = engine_with_conn
    rows = [
        {"approvedDate": "20260514", "approvalNo": "", "amount": "1000",
         "status": "1"},  # missing approvalNo
        {"approvedDate": "", "approvalNo": "Z1", "amount": "1000",
         "status": "1"},  # missing date
        {"approvedDate": "20260514", "approvalNo": "Z2", "amount": "2000",
         "status": "1"},  # valid
    ]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _response(rows)
    provider = _make_provider(eng, client_mock)

    result = provider.sync_one_connection(conn)
    assert result.new_purchases == 1


def test_sync_one_connection_handles_auth_expired(engine_with_conn):
    eng, conn = engine_with_conn
    client_mock = MagicMock()
    client_mock.request_product.side_effect = CodefAuthExpired(
        code="CF-12100", message="비밀번호 오류"
    )
    provider = _make_provider(eng, client_mock)
    result = provider.sync_one_connection(conn)
    assert result.error_code == "CF-12100"
    assert "12100" in (result.error or "")
    # mark_failed 가 호출됐는지 확인
    provider._connections.mark_failed.assert_called_once()


def test_sync_one_connection_handles_rate_limited(engine_with_conn):
    eng, conn = engine_with_conn
    client_mock = MagicMock()
    client_mock.request_product.side_effect = CodefRateLimited("한도 초과")
    provider = _make_provider(eng, client_mock)
    result = provider.sync_one_connection(conn)
    assert result.error_code == "rate_limited"


def test_parse_helpers():
    p = CodefCardPurchaseProvider
    assert p._parse_date("20260514") == datetime.date(2026, 5, 14)
    assert p._parse_date("2026-05-14") == datetime.date(2026, 5, 14)
    assert p._parse_date("2026/05/14") == datetime.date(2026, 5, 14)
    assert p._parse_date("") is None
    assert p._parse_date(None) is None
    assert p._parse_int("12,000") == 12000
    assert p._parse_int("1500.0") == 1500
    assert p._parse_int(None) == 0
    assert p._parse_int("") == 0
