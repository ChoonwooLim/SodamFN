import json
import pytest

from services.codef.codef_client import CodefClient
from services.codef.exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefRateLimited,
    CodefAPIError,
)


def test_client_init_reads_env(mock_codef_sdk):
    c = CodefClient()
    assert c.client_id == "test-client-id"
    assert c.env == "demo"
    mock_codef_sdk.set_client_info.assert_called_once_with("test-client-id", "test-secret")


def test_service_type_mapping(mock_codef_sdk, monkeypatch):
    from easycodefpy import ServiceType
    c = CodefClient()
    assert c.service_type == ServiceType.DEMO

    monkeypatch.setenv("CODEF_ENV", "sandbox")
    assert CodefClient().service_type == ServiceType.SANDBOX

    monkeypatch.setenv("CODEF_ENV", "production")
    assert CodefClient().service_type == ServiceType.PRODUCT


def test_encrypt_password_returns_non_plaintext(mock_codef_sdk):
    c = CodefClient()
    encrypted = c.encrypt_password("mypass123")
    assert isinstance(encrypted, str)
    assert encrypted != "mypass123"
    assert len(encrypted) > 0


def test_create_account_success(mock_codef_sdk):
    mock_codef_sdk.create_account.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"connectedId": "abc-123"},
    })
    c = CodefClient()
    result = c.create_account({"organization": "0306", "id": "u", "password": "p"})
    assert result.connected_id == "abc-123"


def test_create_account_additional_auth(mock_codef_sdk):
    mock_codef_sdk.create_account.return_value = json.dumps({
        "result": {
            "code": "CF-03002",
            "message": "추가본인확인",
            "extraInfo": {"method": "sms", "continueToken": "tok-1"},
        },
        "data": {},
    })
    c = CodefClient()
    with pytest.raises(CodefAdditionalAuth) as exc:
        c.create_account({"organization": "0306", "id": "u", "password": "e"})
    assert exc.value.method == "sms"


def test_request_product_auth_expired(mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-12100", "message": "비밀번호가 일치하지 않음"},
        "data": {},
    })
    c = CodefClient()
    with pytest.raises(CodefAuthExpired) as exc:
        c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})
    assert exc.value.code == "CF-12100"


def test_request_product_rate_limited(mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-00100", "message": "호출 한도 초과"},
        "data": {},
    })
    c = CodefClient()
    with pytest.raises(CodefRateLimited):
        c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})


def test_request_product_unknown_error(mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-99999", "message": "정의되지 않은 오류"},
        "data": {},
    })
    c = CodefClient()
    with pytest.raises(CodefAPIError) as exc:
        c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})
    assert exc.value.code == "CF-99999"


def test_delete_account_success(mock_codef_sdk):
    mock_codef_sdk.delete_account.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"successList": [{"organization": "0307", "connectedId": "x"}]},
    })
    c = CodefClient()
    res = c.delete_account([{
        "countryCode": "KR", "businessType": "CD", "clientType": "P",
        "organization": "0307", "connectedId": "x",
    }])
    assert res["result"]["code"] == "CF-00000"
    # SDK 가 accountList 래퍼와 함께 호출됐는지
    call_args = mock_codef_sdk.delete_account.call_args
    sent_payload = call_args.args[1]
    assert "accountList" in sent_payload
    assert sent_payload["accountList"][0]["connectedId"] == "x"


def test_delete_account_propagates_error(mock_codef_sdk):
    mock_codef_sdk.delete_account.return_value = json.dumps({
        "result": {"code": "CF-99999", "message": "삭제 실패"},
        "data": {},
    })
    c = CodefClient()
    with pytest.raises(CodefAPIError) as exc:
        c.delete_account([{"connectedId": "x"}])
    assert exc.value.code == "CF-99999"


def test_update_account_success(mock_codef_sdk):
    mock_codef_sdk.update_account.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"connectedId": "x"},
    })
    c = CodefClient()
    res = c.update_account([{
        "countryCode": "KR", "businessType": "CD", "clientType": "P",
        "organization": "0307", "connectedId": "x",
        "loginType": "1", "id": "u", "password": "encrypted-pw",
    }])
    assert res["result"]["code"] == "CF-00000"
    call_args = mock_codef_sdk.update_account.call_args
    sent_payload = call_args.args[1]
    assert sent_payload["accountList"][0]["password"] == "encrypted-pw"


def test_list_connected_ids_dict_form(mock_codef_sdk):
    mock_codef_sdk.get_connected_id_list.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"connectedIdList": ["cid-1", "cid-2", "cid-3"]},
    })
    c = CodefClient()
    ids = c.list_connected_ids()
    assert ids == ["cid-1", "cid-2", "cid-3"]


def test_list_connected_ids_dict_form_with_objects(mock_codef_sdk):
    """일부 응답은 dict 항목 — connectedId 필드만 추출."""
    mock_codef_sdk.get_connected_id_list.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {"connectedIdList": [
            {"connectedId": "cid-A", "createdAt": "2026-01-01"},
            {"connectedId": "cid-B"},
        ]},
    })
    c = CodefClient()
    assert c.list_connected_ids() == ["cid-A", "cid-B"]


def test_list_connected_ids_plain_list(mock_codef_sdk):
    """data 가 dict 가 아닌 list 인 변종 응답."""
    mock_codef_sdk.get_connected_id_list.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": ["cid-x", "cid-y"],
    })
    c = CodefClient()
    assert c.list_connected_ids() == ["cid-x", "cid-y"]


def test_list_connected_ids_empty(mock_codef_sdk):
    mock_codef_sdk.get_connected_id_list.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": {},
    })
    c = CodefClient()
    assert c.list_connected_ids() == []


def test_request_product_returns_rows(mock_codef_sdk):
    mock_codef_sdk.request_product.return_value = json.dumps({
        "result": {"code": "CF-00000", "message": "성공"},
        "data": [
            {"approvalNo": "A1", "amount": 1000},
            {"approvalNo": "A2", "amount": 2000},
        ],
    })
    c = CodefClient()
    result = c.request_product("/v1/kr/card/common/b/approval", {"connectedId": "x"})
    assert result.rows_count == 2
    assert result.rows[0]["approvalNo"] == "A1"
    assert result.result_code == "CF-00000"
