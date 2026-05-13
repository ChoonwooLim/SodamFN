"""CodefBankProvider 어댑터 테스트.

목적:
- 21분 자동 갱신 cron 이 CODEF connectedId 기반으로 동작하는지 확인.
- business_id 누락 / 활성 connection 없음 / API 만료 등 graceful error 검증.
"""
import datetime
from unittest.mock import patch, MagicMock

import pytest

from models import Business, CodefConnection, BankAccount


# ──────────────────────────────────────────────────────────
# 공통: CodefClient 의 __init__ 가 SDK 초기화 + env 의존이므로,
# CodefBankProvider 인스턴스화 시 CodefClient 자체를 MagicMock 으로 치환.
# 테스트 케이스마다 patch 컨텍스트에서 client.request_product 결과를 주입.
# ──────────────────────────────────────────────────────────


@pytest.fixture
def patched_provider_cls(monkeypatch):
    """CodefClient 를 MagicMock 으로 치환한 CodefBankProvider 클래스 제공."""
    mock_client = MagicMock()
    monkeypatch.setattr(
        "services.codef.bank_provider.CodefClient",
        lambda: mock_client,
    )
    from services.codef.bank_provider import CodefBankProvider
    return CodefBankProvider, mock_client


def test_search_returns_error_without_business_id(patched_provider_cls):
    CodefBankProvider, _mock = patched_provider_cls
    p = CodefBankProvider(engine="dummy")  # engine 미사용 (조기 반환)
    result = p.search(
        bank_code="0088",
        account_number="110-357-7",
        start_date=datetime.date(2026, 5, 1),
        end_date=datetime.date(2026, 5, 13),
    )
    assert not result.ok
    assert "business_id" in result.error.lower()


def test_search_returns_error_when_no_active_connection(session, patched_provider_cls):
    session.add(Business(id=1, name="X", business_number="1234567890"))
    session.commit()

    CodefBankProvider, _mock = patched_provider_cls
    p = CodefBankProvider(engine=session.bind)
    result = p.search(
        bank_code="0088",
        account_number="110-357-7",
        start_date=datetime.date(2026, 5, 1),
        end_date=datetime.date(2026, 5, 13),
        business_id=1,
    )
    assert not result.ok
    assert ("연결 없음" in result.error) or ("최초 1회" in result.error)


def test_search_uses_active_connection(session, patched_provider_cls):
    """active CodefConnection 이 있으면 CodefClient.request_product 호출 → rows 반환."""
    session.add(Business(id=1, name="X", business_number="1234567890"))
    session.add(CodefConnection(
        id=1,
        business_id=1,
        organization_type="bank",
        organization_code="0088",
        organization_label="신한은행",
        connected_id="test-connected-id-abc",
        auth_method="id_pw",
        status="active",
    ))
    # 매핑된 BankAccount 도 추가 → account_type 'P' 경로 사용 확인
    session.add(BankAccount(
        id=10,
        business_id=1,
        bank_code="0088",
        bank_name="신한은행",
        account_number="110-357-7",
        account_type="P",
    ))
    session.commit()

    # Mock CodefClient.request_product → synthetic CODEF 응답
    from services.codef.codef_client import RequestProductResult
    mock_result = RequestProductResult(
        rows=[{
            "resTrHistoryList": [
                {
                    "resAccountTrDate": "20260513",
                    "resAccountTrTime": "093215",
                    "resAccountIn": "150,000",
                    "resAccountOut": "0",
                    "resAfterTranBalance": "2,150,000",
                    "resAccountDesc1": "",
                    "resAccountDesc2": "모바일",
                    "resAccountDesc3": "백향숙",
                    "resAccountDesc4": "광장동",
                },
                {
                    "resAccountTrDate": "20260513",
                    "resAccountTrTime": "143022",
                    "resAccountIn": "0",
                    "resAccountOut": "85,000",
                    "resAfterTranBalance": "2,065,000",
                    "resAccountDesc1": "",
                    "resAccountDesc2": "ATM",
                    "resAccountDesc3": "주식회사마르스",
                    "resAccountDesc4": "건대",
                },
            ]
        }],
        raw={},
        result_code="CF-00000",
        rows_count=1,
    )

    CodefBankProvider, mock_client = patched_provider_cls
    mock_client.request_product.return_value = mock_result

    p = CodefBankProvider(engine=session.bind)
    result = p.search(
        bank_code="0088",
        account_number="110-357-7",
        start_date=datetime.date(2026, 5, 13),
        end_date=datetime.date(2026, 5, 13),
        business_id=1,
    )

    assert result.ok, f"expected ok, got error: {result.error}"
    assert len(result.rows) == 2
    assert result.rows[0].in_amount == 150000
    assert result.rows[0].remark1 == "백향숙"
    assert result.rows[1].out_amount == 85000
    assert result.rows[1].remark1 == "주식회사마르스"

    # personal path 사용 확인
    called_args = mock_client.request_product.call_args
    assert called_args[0][0] == "/v1/kr/bank/p/account/transaction-list"
    assert called_args[0][1]["connectedId"] == "test-connected-id-abc"
    assert called_args[0][1]["organization"] == "0088"


def test_search_graceful_on_auth_expired(session, patched_provider_cls):
    session.add(Business(id=1, name="X", business_number="1234567890"))
    session.add(CodefConnection(
        id=1,
        business_id=1,
        organization_type="bank",
        organization_code="0088",
        organization_label="신한은행",
        connected_id="x",
        auth_method="id_pw",
        status="active",
    ))
    session.commit()

    from services.codef.exceptions import CodefAuthExpired

    CodefBankProvider, mock_client = patched_provider_cls
    mock_client.request_product.side_effect = CodefAuthExpired(
        code="CF-12100", message="만료"
    )

    p = CodefBankProvider(engine=session.bind)
    result = p.search(
        bank_code="0088",
        account_number="x",
        start_date=datetime.date(2026, 5, 1),
        end_date=datetime.date(2026, 5, 13),
        business_id=1,
    )

    assert not result.ok
    assert ("만료" in result.error) or ("재인증" in result.error)


def test_get_provider_routes_codef_via_env(monkeypatch):
    """BANK_SYNC_PROVIDER=codef → CodefBankProvider 인스턴스 반환."""
    monkeypatch.setenv("BANK_SYNC_PROVIDER", "codef")
    # CodefBankProvider.__init__ 가 CodefClient() 를 호출하므로 mock 필요
    monkeypatch.setattr(
        "services.codef.bank_provider.CodefClient",
        lambda: MagicMock(),
    )
    from services.bank_sync_service import get_provider
    p = get_provider()
    assert p.name == "codef"
