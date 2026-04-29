import datetime
import pytest
from unittest.mock import MagicMock
from sqlmodel import Session, SQLModel, create_engine

from services.codef.connection_service import CodefConnectionService
from services.codef.codef_client import CreateAccountResult
from services.codef.exceptions import CodefAdditionalAuth
from models import CodefConnection, Business


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
