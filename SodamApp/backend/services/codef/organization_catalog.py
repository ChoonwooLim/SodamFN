"""CODEF 표준 organization 코드 ↔ 라벨 ↔ 인증정책 매핑.

CODEF API 호출 시 organization 파라미터로 사용. 환경(SANDBOX/DEMO/PRODUCT)
무관 동일 코드. 카드사·은행·공공 모두 같은 모듈에서 관리 — Phase 2~5에서 확장.

레퍼런스:
- https://developer.codef.io/api-info/organization-codes

PoC 첫 실호출(Phase 1F Task 29) 후 코드 변동 발견 시 본 파일 정정.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AuthPolicy(str, Enum):
    SIMPLE_AUTH = "simple_auth"  # 카카오/네이버/PASS/토스/페이코/삼성패스 등
    ID_PW = "id_pw"
    CERT = "cert"  # 공동인증서


@dataclass(frozen=True)
class Organization:
    code: str
    label: str
    type: str  # 'card' | 'bank' | 'public_*'
    auth_methods: tuple[AuthPolicy, ...] = field(default_factory=tuple)


# 14개 카드사 — CODEF 카탈로그 기준
_CARDS: tuple[Organization, ...] = (
    Organization("0301", "KB국민카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0302", "NH농협카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0303", "롯데카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0304", "씨티카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0305", "하나카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0306", "신한카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0307", "현대카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0309", "우리카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0361", "BC카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0364", "삼성카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0365", "광주카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0366", "수협카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0367", "제주카드", "card", (AuthPolicy.ID_PW,)),
    Organization("0368", "IBK기업카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
)

_ALL: dict[str, Organization] = {o.code: o for o in _CARDS}


def get_organizations() -> dict[str, Organization]:
    """전체 organization 사본 반환. Phase 2~5에서 은행/공공 추가."""
    return dict(_ALL)


def get_organization(code: str) -> Optional[Organization]:
    return _ALL.get(code)


def list_card_corps() -> list[Organization]:
    return [o for o in _ALL.values() if o.type == "card"]
