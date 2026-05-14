import datetime
import json
import pytest
from unittest.mock import MagicMock
from sqlmodel import Session, SQLModel, create_engine

from services.codef.connection_service import CodefConnectionService
from services.codef.codef_client import CreateAccountResult
from services.codef.exceptions import CodefAdditionalAuth, CodefAPIError
from models import CodefConnection, Business, PendingCodefAuth


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
def fake_client():
    c = MagicMock()
    c.encrypt_password = MagicMock(return_value="encrypted-pw")
    c.create_account = MagicMock(
        return_value=CreateAccountResult(connected_id="conn-001", raw={})
    )
    return c


@pytest.fixture
def svc(db_engine, fake_client):
    return CodefConnectionService(engine=db_engine, client=fake_client)


def test_register_card_id_pw(svc, fake_client, biz_id):
    conn = svc.register_card(
        business_id=biz_id,
        card_corp_code="0306",  # 신한
        auth_payload={"id": "myuser", "password": "mypass"},
    )
    assert conn.connected_id == "conn-001"
    assert conn.organization_label == "신한카드"
    assert conn.auth_method == "id_pw"
    assert conn.status == "active"
    fake_client.encrypt_password.assert_called_once_with("mypass")


def test_register_card_simple_auth(svc, fake_client, biz_id):
    conn = svc.register_card(
        business_id=biz_id,
        card_corp_code="0306",
        auth_payload={"loginType": "kakao", "identity": "홍길동",
                      "birthDate": "19800101", "telecom": "1"},
    )
    assert conn.auth_method == "simple_auth"


def test_register_card_unknown_corp(svc, biz_id):
    with pytest.raises(ValueError, match="알 수 없는 카드사"):
        svc.register_card(business_id=biz_id, card_corp_code="9999",
                          auth_payload={"id": "x", "password": "y"})


def test_register_card_invalid_payload(svc, biz_id):
    with pytest.raises(ValueError, match="ID/PW 또는 간편인증"):
        svc.register_card(business_id=biz_id, card_corp_code="0306",
                          auth_payload={"random": "stuff"})


def test_register_propagates_additional_auth(db_engine, biz_id):
    fake = MagicMock()
    fake.encrypt_password = MagicMock(return_value="x")
    fake.create_account = MagicMock(
        side_effect=CodefAdditionalAuth(method="sms",
                                         extra_info={"continueToken": "tok-1"})
    )
    svc = CodefConnectionService(engine=db_engine, client=fake)
    with pytest.raises(CodefAdditionalAuth) as exc:
        svc.register_card(business_id=biz_id, card_corp_code="0306",
                          auth_payload={"id": "u", "password": "p"})
    assert exc.value.method == "sms"


def test_reverify_updates_existing(db_engine, biz_id, fake_client):
    # 먼저 expired 상태로 row 생성
    with Session(db_engine) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="old-cid", auth_method="id_pw", status="expired",
                            last_error_code="CF-12100", last_error_message="비번 오류")
        s.add(c); s.commit(); s.refresh(c)
        cid = c.id

    fake_client.create_account.return_value = CreateAccountResult(
        connected_id="new-conn", raw={}
    )
    svc = CodefConnectionService(engine=db_engine, client=fake_client)
    updated = svc.reverify(connection_id=cid,
                           auth_payload={"id": "u", "password": "newpass"})
    assert updated.connected_id == "new-conn"
    assert updated.status == "active"
    assert updated.last_verified_at is not None
    assert updated.last_error_code is None


def test_deactivate(db_engine, biz_id):
    with Session(db_engine) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한",
                            connected_id="x", auth_method="id_pw")
        s.add(c); s.commit(); s.refresh(c)
        cid = c.id

    svc = CodefConnectionService(engine=db_engine, client=MagicMock())
    svc.deactivate(connection_id=cid)
    with Session(db_engine) as s:
        c = s.get(CodefConnection, cid)
        assert c.status == "deactivated"
        assert c.deactivated_at is not None


def test_mark_failed(db_engine, biz_id):
    with Session(db_engine) as s:
        c = CodefConnection(business_id=biz_id, organization_type="card",
                            organization_code="0306", organization_label="신한",
                            connected_id="x", auth_method="id_pw", status="active")
        s.add(c); s.commit(); s.refresh(c)
        cid = c.id

    svc = CodefConnectionService(engine=db_engine, client=MagicMock())
    svc.mark_failed(connection_id=cid, status="expired",
                    error_code="CF-12100", error_message="비번 오류")
    with Session(db_engine) as s:
        c = s.get(CodefConnection, cid)
        assert c.status == "expired"
        assert c.last_failed_at is not None
        assert c.last_error_code == "CF-12100"


def test_list_active_filters_by_type_and_status(db_engine, biz_id, fake_client):
    with Session(db_engine) as s:
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0306", organization_label="신한",
                              connected_id="a", auth_method="id_pw", status="active"))
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0307", organization_label="현대",
                              connected_id="b", auth_method="id_pw", status="expired"))
        s.add(CodefConnection(business_id=biz_id, organization_type="bank",
                              organization_code="0004", organization_label="국민",
                              connected_id="c", auth_method="cert", status="active"))
        s.commit()

    svc = CodefConnectionService(engine=db_engine, client=fake_client)
    cards = svc.list_active(business_id=biz_id, organization_type="card")
    assert len(cards) == 1  # active 만, expired 제외
    assert cards[0].organization_code == "0306"


def test_list_all_excludes_deactivated_only(db_engine, biz_id, fake_client):
    with Session(db_engine) as s:
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0306", organization_label="신한",
                              connected_id="a", auth_method="id_pw", status="active"))
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0307", organization_label="현대",
                              connected_id="b", auth_method="id_pw", status="expired"))
        s.add(CodefConnection(business_id=biz_id, organization_type="card",
                              organization_code="0364", organization_label="삼성",
                              connected_id="c", auth_method="id_pw", status="deactivated"))
        s.commit()

    svc = CodefConnectionService(engine=db_engine, client=fake_client)
    all_cards = svc.list_all(business_id=biz_id, organization_type="card")
    assert len(all_cards) == 2  # active + expired
    statuses = {c.status for c in all_cards}
    assert statuses == {"active", "expired"}


# ─────────────────────────────────────────────────────────────
# 간편인증 2-step 흐름 — start_simple_auth / complete_simple_auth
# ─────────────────────────────────────────────────────────────


def _make_simple_auth_client(extra_info=None, code="CF-03002",
                              second_step_connected_id="conn-simple-1"):
    """간편인증 2-step 흐름 SDK 모의."""
    c = MagicMock()
    c.encrypt_password = MagicMock(return_value="encrypted-pw")
    c.create_account_raw = MagicMock(
        return_value={
            "result": {"code": code, "message": "추가인증요청"},
            "data": {"extraInfo": extra_info or {"reqSeqNo": "seq-xyz",
                                                  "message": "카카오톡에서 인증해주세요"}},
        }
    )
    c.create_account = MagicMock(
        return_value=CreateAccountResult(
            connected_id=second_step_connected_id, raw={}
        )
    )
    return c


def test_start_simple_auth_returns_pending(db_engine, biz_id):
    fake = _make_simple_auth_client()
    svc = CodefConnectionService(engine=db_engine, client=fake)
    res = svc.start_simple_auth(
        business_id=biz_id,
        card_corp_code="0307",
        auth_payload={
            "loginType": "kakao",
            "userName": "홍지연",
            "phoneNo": "01071391796",
            "birthDate": "19800101",
            "telecom": "0",
        },
        connection_type="card_purchase",
    )
    assert res["status"] == "additional_auth_required"
    assert res["method"] == "simple_kakao"
    assert res["auth_pending_id"] > 0
    assert "extra_info" in res
    assert "expires_at" in res

    # DB 에 PendingCodefAuth row 가 저장되었는지 확인
    with Session(db_engine) as s:
        p = s.get(PendingCodefAuth, res["auth_pending_id"])
        assert p is not None
        assert p.business_id == biz_id
        assert p.organization_code == "0307"
        assert p.connection_type == "card_purchase"
        assert p.auth_method == "simple_kakao"
        payload = json.loads(p.payload_json)
        assert payload["accountList"][0]["organization"] == "0307"
        assert payload["accountList"][0]["loginType"] == "5"

    fake.create_account_raw.assert_called_once()


def test_start_simple_auth_rejects_unknown_login_type(db_engine, biz_id):
    fake = _make_simple_auth_client()
    svc = CodefConnectionService(engine=db_engine, client=fake)
    with pytest.raises(ValueError, match="간편인증 미지원 loginType"):
        svc.start_simple_auth(
            business_id=biz_id,
            card_corp_code="0307",
            auth_payload={"loginType": "wechat", "userName": "x"},
        )


def test_start_simple_auth_rejects_unexpected_response_code(db_engine, biz_id):
    fake = _make_simple_auth_client(code="CF-99999")
    svc = CodefConnectionService(engine=db_engine, client=fake)
    with pytest.raises(CodefAPIError):
        svc.start_simple_auth(
            business_id=biz_id,
            card_corp_code="0307",
            auth_payload={
                "loginType": "kakao",
                "userName": "홍",
                "phoneNo": "01000000000",
                "birthDate": "19800101",
                "telecom": "0",
            },
        )


def test_complete_simple_auth_creates_connection(db_engine, biz_id):
    fake = _make_simple_auth_client(second_step_connected_id="conn-simple-OK")
    svc = CodefConnectionService(engine=db_engine, client=fake)
    start_res = svc.start_simple_auth(
        business_id=biz_id,
        card_corp_code="0307",
        auth_payload={
            "loginType": "kakao",
            "userName": "홍",
            "phoneNo": "01000000000",
            "birthDate": "19800101",
            "telecom": "0",
        },
        connection_type="card_purchase",
    )
    conn = svc.complete_simple_auth(auth_pending_id=start_res["auth_pending_id"])
    assert conn.connected_id == "conn-simple-OK"
    assert conn.auth_method == "simple_kakao"
    assert conn.connection_type == "card_purchase"
    assert conn.status == "active"

    # 2단계 SDK 호출 시 is2Way + twoWayInfo 가 첨부되어야 함
    sent_payload = fake.create_account.call_args.args[0]
    account = sent_payload["accountList"][0]
    assert account.get("is2Way") == "true"
    assert "twoWayInfo" in account

    # pending row 가 삭제되었는지
    with Session(db_engine) as s:
        assert s.get(PendingCodefAuth, start_res["auth_pending_id"]) is None


def test_complete_simple_auth_rejects_unknown_id(db_engine, biz_id):
    fake = _make_simple_auth_client()
    svc = CodefConnectionService(engine=db_engine, client=fake)
    with pytest.raises(ValueError, match="pending auth .* 없음"):
        svc.complete_simple_auth(auth_pending_id=99999)


def test_complete_simple_auth_rejects_expired(db_engine, biz_id):
    # 만료된 pending row 를 직접 삽입
    with Session(db_engine) as s:
        expired = PendingCodefAuth(
            business_id=biz_id,
            organization_code="0307",
            connection_type="card_purchase",
            auth_method="simple_kakao",
            payload_json=json.dumps({"accountList": [{"organization": "0307"}]}),
            extra_info_json="{}",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
            expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=5),
        )
        s.add(expired); s.commit(); s.refresh(expired)
        pending_id = expired.id

    fake = _make_simple_auth_client()
    svc = CodefConnectionService(engine=db_engine, client=fake)
    with pytest.raises(ValueError, match="간편인증 만료"):
        svc.complete_simple_auth(auth_pending_id=pending_id)

    # 만료 row 는 삭제되었어야 함
    with Session(db_engine) as s:
        assert s.get(PendingCodefAuth, pending_id) is None
