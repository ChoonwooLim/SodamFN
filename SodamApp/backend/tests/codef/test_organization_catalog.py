from services.codef.organization_catalog import (
    get_organizations,
    get_organization,
    list_card_corps,
    AuthPolicy,
)


def test_list_14_card_corps():
    cards = list_card_corps()
    assert len(cards) == 14
    codes = {c.code for c in cards}
    # 셈하나 실제 운영 카드사 핵심 4종
    assert "0306" in codes  # 신한
    assert "0301" in codes  # KB국민
    assert "0364" in codes  # 삼성
    assert "0307" in codes  # 현대


def test_get_organization_returns_label_and_policy():
    org = get_organization("0306")
    assert org is not None
    assert org.label == "신한카드"
    assert org.type == "card"
    assert AuthPolicy.SIMPLE_AUTH in org.auth_methods
    assert AuthPolicy.ID_PW in org.auth_methods


def test_get_organization_unknown_returns_none():
    assert get_organization("9999") is None


def test_card_corp_id_pw_only():
    """일부 카드사는 ID/PW only — 간편인증 미지원"""
    bc = get_organization("0361")  # BC
    assert bc is not None
    assert AuthPolicy.ID_PW in bc.auth_methods
    assert AuthPolicy.SIMPLE_AUTH not in bc.auth_methods


def test_get_organizations_returns_copy():
    """get_organizations 가 mutate 가능한 사본을 반환하는지"""
    orgs = get_organizations()
    orgs["XXXX"] = "garbage"
    # 다시 호출했을 때 영향 없어야 함
    fresh = get_organizations()
    assert "XXXX" not in fresh
