"""CODEF 카드 매입 Provider 테스트 — mock CodefClient 기반.

billing-list 엔드포인트 응답 구조:
  rows[i] = 청구월 묶음 (resBillType, resPaymentDueDate, ...)
  rows[i].resChargeHistoryList[] = 그 청구월의 개별 사용건
  개별 사용건 필드: resUsedDate / resMemberStoreName / resUsedAmount /
                  resInstallmentMonth / resApprovalNo (보통 빈 문자열) /
                  resUsedCard / resMemberStoreType / resMemberStoreNo
"""
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


def _billing_response(charge_list: list[dict]) -> RequestProductResult:
    """billing-list 응답 형태로 1개 청구월 묶음을 mock."""
    rows = [{
        "resBillType": "0002",
        "resPaymentDueDate": "20260514",
        "resChargeHistoryList": charge_list,
    }]
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
    charge_list = [
        {"resUsedDate": "20260514", "resMemberStoreName": "GS25 화양점",
         "resUsedAmount": "12000", "resInstallmentMonth": "0",
         "resApprovalNo": "", "resUsedCard": "본인072",
         "resMemberStoreType": "편의점"},
        {"resUsedDate": "20260514", "resMemberStoreName": "스타벅스 건대점",
         "resUsedAmount": "5500", "resInstallmentMonth": "0",
         "resApprovalNo": "", "resUsedCard": "본인072",
         "resMemberStoreType": "카페"},
    ]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _billing_response(charge_list)
    provider = _make_provider(eng, client_mock)

    result = provider.sync_one_connection(conn, months_back=3)
    assert result.error is None
    assert result.new_purchases == 2

    with Session(eng) as s:
        purchases = list(s.exec(select(CardPurchase)))
    assert len(purchases) == 2
    # 합성 key 패턴: YYYYMMDD|merchant|amount|installment (32자로 잘림)
    p1 = next(p for p in purchases if p.merchant_name == "GS25 화양점")
    assert p1.approval_number.startswith("20260514|GS25 화양점|12000|0"[:32]) \
        or p1.approval_number == "20260514|GS25 화양점|12000|0"[:32]
    assert p1.business_type == "편의점"
    assert p1.amount == 12000
    assert p1.card_corp == "신한카드"
    assert p1.card_number_masked == "본인072"
    assert p1.source == "codef"
    assert p1.connection_id == conn.id
    assert p1.status == "승인"


def test_upsert_purchases_idempotent(engine_with_conn):
    """같은 row 2번 sync — 두 번째는 0 inserted (합성 key 안정성 검증)."""
    eng, conn = engine_with_conn
    charge_list = [{
        "resUsedDate": "20260514",
        "resMemberStoreName": "Test 가맹점",
        "resUsedAmount": "10000",
        "resInstallmentMonth": "0",
        "resApprovalNo": "",
        "resUsedCard": "본인072",
    }]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _billing_response(charge_list)
    provider = _make_provider(eng, client_mock)

    r1 = provider.sync_one_connection(conn)
    r2 = provider.sync_one_connection(conn)
    assert r1.new_purchases == 1
    assert r2.new_purchases == 0

    with Session(eng) as s:
        purchases = list(s.exec(select(CardPurchase)))
    assert len(purchases) == 1


def test_upsert_uses_approval_no_when_present(engine_with_conn):
    """resApprovalNo 가 채워져 있으면 그대로 UNIQUE key 로 사용."""
    eng, conn = engine_with_conn
    charge_list = [{
        "resUsedDate": "20260514",
        "resMemberStoreName": "테스트",
        "resUsedAmount": "10000",
        "resInstallmentMonth": "0",
        "resApprovalNo": "APPR123",  # 채워진 경우
        "resUsedCard": "본인072",
    }]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _billing_response(charge_list)
    provider = _make_provider(eng, client_mock)

    provider.sync_one_connection(conn)
    with Session(eng) as s:
        p = s.exec(select(CardPurchase)).first()
    assert p is not None
    assert p.approval_number == "APPR123"
    assert p.status == "승인"


def test_upsert_skips_rows_missing_date(engine_with_conn):
    """resUsedDate 없으면 skip. 그 외에는 합성 key 로 저장."""
    eng, conn = engine_with_conn
    charge_list = [
        {"resUsedDate": "", "resMemberStoreName": "X",
         "resUsedAmount": "1000", "resInstallmentMonth": "0",
         "resApprovalNo": ""},  # missing date → skip
        {"resUsedDate": "20260514", "resMemberStoreName": "Y",
         "resUsedAmount": "2000", "resInstallmentMonth": "0",
         "resApprovalNo": ""},  # valid
    ]
    client_mock = MagicMock()
    client_mock.request_product.return_value = _billing_response(charge_list)
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


def test_build_period_params_yyyymm_format(engine_with_conn):
    """billing-list 는 startDate/endDate 가 YYYYMM 포맷이어야 함."""
    eng, conn = engine_with_conn
    provider = _make_provider(eng, MagicMock())
    params = provider._build_period_params(conn, months_back=3)
    assert "startDate" in params and "endDate" in params
    # YYYYMM 형식 (6자리 숫자)
    assert len(params["startDate"]) == 6
    assert len(params["endDate"]) == 6
    assert params["startDate"].isdigit()
    assert params["endDate"].isdigit()
    # endDate 가 startDate 보다 같거나 이후
    assert params["endDate"] >= params["startDate"]
    assert params["connectedId"] == conn.connected_id
    assert params["organization"] == conn.organization_code
