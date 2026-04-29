import datetime
import pytest
from unittest.mock import MagicMock
from sqlmodel import Session, SQLModel, create_engine, select

from services.codef.card_provider import CodefCardProvider
from services.codef.codef_client import RequestProductResult
from services.codef.exceptions import CodefAuthExpired, CodefRateLimited
from models import (
    CodefConnection,
    CardSalesApproval,
    CardPayment,
    CardMerchant,
    Business,
)


@pytest.fixture
def db_engine():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    yield e


@pytest.fixture
def biz_id(db_engine):
    with Session(db_engine) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        return b.id


@pytest.fixture
def conn(db_engine, biz_id):
    with Session(db_engine) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="conn-x", auth_method="id_pw", status="active")
        s.add(c); s.commit(); s.refresh(c)
        return c


@pytest.fixture
def provider(db_engine, monkeypatch):
    monkeypatch.setenv("CODEF_DEMO_DAILY_LIMIT", "100")
    monkeypatch.setenv("CODEF_ENV", "demo")
    fake_client = MagicMock()
    return CodefCardProvider(engine=db_engine, client=fake_client)


def _approval_response(rows: list[dict]) -> RequestProductResult:
    return RequestProductResult(rows=rows, raw={}, result_code="CF-00000",
                                rows_count=len(rows))


def test_sync_approval_inserts_codef_rows(provider, conn, db_engine):
    provider._client.request_product.return_value = _approval_response([
        {"approvedDate": "20260429", "approvedTime": "120130",
         "cardNo": "1234-****-5678", "approvalNo": "AP001",
         "amount": "15000", "installment": "00",
         "merchantName": "소담김밥 강남점", "status": "1"},
        {"approvedDate": "20260429", "approvedTime": "180530",
         "cardNo": "1234-****-5678", "approvalNo": "AP002",
         "amount": "8000", "installment": "00",
         "merchantName": "소담김밥 강남점", "status": "1"},
    ])
    new = provider._sync_approval(conn, triggered_by="cron", triggered_user_id=None)
    assert new == 2
    with Session(db_engine) as s:
        rows = list(s.exec(select(CardSalesApproval).order_by(CardSalesApproval.id)))
        assert len(rows) == 2
        assert rows[0].source == "codef"
        assert rows[0].connection_id == conn.id
        assert rows[0].amount == 15000
        assert rows[0].status == "승인"


def test_sync_approval_skips_already_codef(provider, conn, db_engine):
    """이미 CODEF 행이 있으면 신규 적재 0"""
    with Session(db_engine) as s:
        s.add(CardSalesApproval(
            business_id=conn.business_id, approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드", approval_number="AP001", amount=15000, source="codef",
        ))
        s.commit()

    provider._client.request_product.return_value = _approval_response([
        {"approvedDate": "20260429", "approvedTime": "120130",
         "approvalNo": "AP001", "amount": "15000", "installment": "00",
         "cardNo": "x", "merchantName": "m", "status": "1"}
    ])
    new = provider._sync_approval(conn, triggered_by="cron", triggered_user_id=None)
    assert new == 0
    with Session(db_engine) as s:
        rows = list(s.exec(select(CardSalesApproval)))
        assert len(rows) == 1


def test_sync_approval_marks_excel_overridden_when_amount_matches(provider, conn, db_engine):
    """기존 Excel row 와 amount 일치 → excel → excel_overridden"""
    with Session(db_engine) as s:
        s.add(CardSalesApproval(
            business_id=conn.business_id, approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드", approval_number="AP001", amount=15000, source="excel",
        ))
        s.commit()

    provider._client.request_product.return_value = _approval_response([
        {"approvedDate": "20260429", "approvedTime": "120130",
         "approvalNo": "AP001", "amount": "15000", "installment": "00",
         "cardNo": "x", "merchantName": "m", "status": "1"}
    ])
    provider._sync_approval(conn, triggered_by="cron", triggered_user_id=None)

    with Session(db_engine) as s:
        rows = list(s.exec(select(CardSalesApproval).order_by(CardSalesApproval.id)))
        assert len(rows) == 2
        assert rows[0].source == "excel_overridden"  # 기존 excel
        assert rows[1].source == "codef"             # 신규 codef


def test_sync_approval_keeps_both_when_amount_differs(provider, conn, db_engine):
    """amount 다르면 둘 다 보존 (UI 차이 경고용)"""
    with Session(db_engine) as s:
        s.add(CardSalesApproval(
            business_id=conn.business_id, approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드", approval_number="AP001", amount=15000, source="excel",
        ))
        s.commit()

    provider._client.request_product.return_value = _approval_response([
        {"approvedDate": "20260429", "approvedTime": "120130",
         "approvalNo": "AP001", "amount": "20000",  # 다른 amount
         "installment": "00", "cardNo": "x", "merchantName": "m", "status": "1"}
    ])
    provider._sync_approval(conn, triggered_by="cron", triggered_user_id=None)

    with Session(db_engine) as s:
        rows = list(s.exec(select(CardSalesApproval).order_by(CardSalesApproval.id)))
        assert len(rows) == 2
        assert rows[0].source == "excel"  # 보존
        assert rows[1].source == "codef"


def test_sync_billing_inserts_payments(provider, conn, db_engine):
    provider._client.request_product.return_value = _approval_response([
        {"paymentDate": "20260415", "salesAmount": "1500000",
         "fee": "27000", "vatOnFees": "0",
         "netDeposit": "1473000", "depositBank": "신한은행"}
    ])
    new = provider._sync_billing(conn, triggered_by="cron", triggered_user_id=None)
    assert new == 1
    with Session(db_engine) as s:
        rows = list(s.exec(select(CardPayment)))
        assert len(rows) == 1
        assert rows[0].source == "codef"
        assert rows[0].net_deposit == 1473000
        assert rows[0].fees == 27000


def test_sync_member_store_inserts_with_fee_rate(provider, conn, db_engine):
    provider._client.request_product.return_value = _approval_response([
        {"merchantNo": "M001", "merchantName": "소담김밥 강남점",
         "feeRate": "1.8", "registeredDate": "20240101", "status": "Y"}
    ])
    upserted = provider._sync_member_store(conn, triggered_by="cron",
                                            triggered_user_id=None)
    assert upserted == 1
    with Session(db_engine) as s:
        rows = list(s.exec(select(CardMerchant)))
        assert len(rows) == 1
        assert abs(rows[0].fee_rate - 0.018) < 1e-9
        assert rows[0].status == "active"


def test_sync_member_store_updates_existing(provider, conn, db_engine):
    """동일 merchant_id 발견 시 update (수수료율 갱신)"""
    with Session(db_engine) as s:
        s.add(CardMerchant(business_id=conn.business_id, card_corp="신한카드",
                           merchant_id="M001", fee_rate=0.020))
        s.commit()

    provider._client.request_product.return_value = _approval_response([
        {"merchantNo": "M001", "merchantName": "변경된 가맹점명",
         "feeRate": "1.5", "status": "Y"}
    ])
    provider._sync_member_store(conn, triggered_by="cron", triggered_user_id=None)
    with Session(db_engine) as s:
        merchants = list(s.exec(select(CardMerchant)))
        assert len(merchants) == 1
        assert abs(merchants[0].fee_rate - 0.015) < 1e-9
        assert merchants[0].merchant_name == "변경된 가맹점명"


def test_sync_one_connection_full_cycle(provider, conn, db_engine):
    """3종 API 모두 실행 + SyncResult 집계"""
    # 첫 호출: approval
    # 두 번째 호출: billing
    # 세 번째 호출: member_store
    provider._client.request_product.side_effect = [
        _approval_response([
            {"approvedDate": "20260429", "approvalNo": "A1", "amount": "1000",
             "approvedTime": "120000", "installment": "00", "cardNo": "x",
             "merchantName": "shop", "status": "1"}
        ]),
        _approval_response([
            {"paymentDate": "20260415", "salesAmount": "1000",
             "fee": "20", "vatOnFees": "0", "netDeposit": "980", "depositBank": "신한"}
        ]),
        _approval_response([
            {"merchantNo": "M1", "merchantName": "shop", "feeRate": "2.0", "status": "Y"}
        ]),
    ]
    result = provider.sync_one_connection(conn)
    assert result.new_approvals == 1
    assert result.new_payments == 1
    assert result.new_merchants == 1
    assert result.error is None


def test_sync_one_connection_handles_auth_expired(provider, conn, db_engine):
    """비번 만료 → connection.status='expired' + result.error 기록"""
    provider._client.request_product.side_effect = CodefAuthExpired(
        code="CF-12100", message="비밀번호 오류"
    )
    result = provider.sync_one_connection(conn)
    assert result.error_code == "CF-12100"
    assert "12100" in (result.error or "")

    with Session(db_engine) as s:
        c = s.get(CodefConnection, conn.id)
        assert c.status == "expired"
        assert c.last_error_code == "CF-12100"


def test_sync_one_connection_handles_rate_limited(provider, conn):
    provider._client.request_product.side_effect = CodefRateLimited("한도 초과")
    result = provider.sync_one_connection(conn)
    assert result.error_code == "rate_limited"


def test_member_store_skipped_if_synced_this_month(provider, conn, db_engine):
    """이번 달 이미 동기화한 경우 member_store skip"""
    now = datetime.datetime.utcnow()
    with Session(db_engine) as s:
        s.add(CardMerchant(business_id=conn.business_id, card_corp="신한카드",
                           merchant_id="M1", fee_rate=0.018,
                           last_synced_at=now))
        s.commit()

    # approval, billing 만 mock 응답 (member_store 는 호출 안 됨)
    provider._client.request_product.side_effect = [
        _approval_response([]),  # approval — 0건
        _approval_response([]),  # billing — 0건
    ]
    result = provider.sync_one_connection(conn)
    assert result.new_merchants == 0
    # request_product 가 정확히 2회만 호출됨 (member_store 건너뜀)
    assert provider._client.request_product.call_count == 2


def test_parse_helpers():
    """date / int / fee_rate 파서"""
    p = CodefCardProvider
    assert p._parse_date("20260429") == datetime.date(2026, 4, 29)
    assert p._parse_date("2026-04-29") == datetime.date(2026, 4, 29)
    assert p._parse_date("") is None
    assert p._parse_date(None) is None
    assert p._parse_int("15,000") == 15000
    assert p._parse_int(None) == 0
    assert abs(p._parse_fee_rate("1.8") - 0.018) < 1e-9
    assert abs(p._parse_fee_rate("0.018") - 0.018) < 1e-9
    assert p._parse_fee_rate(None) is None
