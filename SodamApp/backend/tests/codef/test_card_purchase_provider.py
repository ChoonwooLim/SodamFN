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


def test_billing_params_no_cardpassword_regression(engine_with_conn):
    """버그 회귀 방지 — billing-list 파라미터에 cardPassword 가 절대 들어가지 않아야 함.

    PDF page 10 (INPUT param Information) 에 cardPassword 가 없음. 과거 코드에서
    card_password_encrypted 첨부 시 현대카드 0건 응답 발생 → 54f47646 회귀로 인한
    버그였음. 본 테스트는 이를 영구적으로 방지.
    """
    eng, conn = engine_with_conn
    # 카드비번 저장된 conn (현대카드 같은 케이스 시뮬레이션)
    conn.card_password_encrypted = "ENC(1234)"
    provider = _make_provider(eng, MagicMock())
    params = provider._build_period_params(conn, months_back=3)
    assert "cardPassword" not in params
    assert "password" not in params


def test_sync_calls_approval_then_billing(engine_with_conn):
    """sync_one_connection 이 approval-list 와 billing-list 둘 다 호출하는지 확인."""
    from services.codef.card_purchase_provider import APPROVAL_LIST_URL, BILLING_LIST_URL
    eng, conn = engine_with_conn
    client_mock = MagicMock()
    # 빈 응답 (두 endpoint 다 0건)
    empty_response = RequestProductResult(rows=[], raw={}, result_code="CF-00000", rows_count=0)
    client_mock.request_product.return_value = empty_response
    provider = _make_provider(eng, client_mock)

    provider.sync_one_connection(conn, months_back=3)

    # 두 endpoint 모두 호출되었는지 확인
    called_urls = [call.args[0] for call in client_mock.request_product.call_args_list]
    assert APPROVAL_LIST_URL in called_urls
    assert BILLING_LIST_URL in called_urls


def test_approval_params_yyyymmdd_format(engine_with_conn):
    """approval-list 는 startDate/endDate 가 YYYYMMDD 일단위 포맷."""
    from services.codef.card_purchase_provider import APPROVAL_LIST_URL
    eng, conn = engine_with_conn
    client_mock = MagicMock()
    client_mock.request_product.return_value = RequestProductResult(
        rows=[], raw={}, result_code="CF-00000", rows_count=0
    )
    provider = _make_provider(eng, client_mock)
    provider.sync_one_connection(conn, months_back=3)

    # approval-list 호출 시 사용된 params 추출
    approval_call = next(
        c for c in client_mock.request_product.call_args_list
        if c.args[0] == APPROVAL_LIST_URL
    )
    params = approval_call.args[1]
    assert len(params["startDate"]) == 8   # YYYYMMDD
    assert len(params["endDate"]) == 8     # YYYYMMDD
    assert params["startDate"].isdigit()
    assert params["endDate"].isdigit()
    assert params["inquiryType"] == "1"    # 전체조회 (cardNo 불필요)
    assert params["orderBy"] == "0"        # 최신순
    assert "cardPassword" not in params    # 조회 input 에 cardPassword 없음


def test_approval_upserts_with_cancellation_status(engine_with_conn):
    """approval rows 의 resCancelYN 으로 status 분기 — '0'/'1'/'2'/'3' → 승인/취소/부분취소/거절."""
    eng, conn = engine_with_conn
    approval_rows = [
        {"resUsedDate": "20260513", "resMemberStoreName": "정상가맹",
         "resUsedAmount": "10000", "resInstallmentMonth": "0",
         "resApprovalNo": "APP001", "resCancelYN": "0", "resCardNo": "1234"},
        {"resUsedDate": "20260513", "resMemberStoreName": "취소가맹",
         "resUsedAmount": "5000", "resInstallmentMonth": "0",
         "resApprovalNo": "APP002", "resCancelYN": "1", "resCardNo": "1234"},
    ]
    client_mock = MagicMock()
    # approval-list 응답: 직접 list (resChargeHistoryList 풀기 없이)
    client_mock.request_product.side_effect = [
        RequestProductResult(rows=approval_rows, raw={}, result_code="CF-00000",
                             rows_count=len(approval_rows)),
        # billing-list 빈 응답
        RequestProductResult(rows=[], raw={}, result_code="CF-00000", rows_count=0),
    ]
    provider = _make_provider(eng, client_mock)
    result = provider.sync_one_connection(conn, months_back=3)

    assert result.error is None
    assert result.new_purchases == 2

    with Session(eng) as s:
        purchases = list(s.exec(select(CardPurchase).order_by(CardPurchase.approval_number)))
    assert len(purchases) == 2
    assert purchases[0].approval_number == "APP001"
    assert purchases[0].status == "승인"
    assert purchases[1].approval_number == "APP002"
    assert purchases[1].status == "취소"
