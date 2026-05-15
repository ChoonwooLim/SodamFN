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


# 14개 카드사 — CODEF 공식 매뉴얼 (API.xlsx page 3, 2025-11-11 기준) 정정.
# 기존 코드(0361~0368)는 placeholder 였음 — 실제 CODEF organization 코드는 0301~0321.
# 0306 신한 만 우연히 일치. 나머지는 잘못된 매핑이라 현대·삼성 등 등록 시 CF-04000 발생.
_CARDS: tuple[Organization, ...] = (
    Organization("0301", "KB국민카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0302", "현대카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0303", "삼성카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0304", "NH농협카드", "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0305", "BC카드",     "card", (AuthPolicy.ID_PW,)),
    Organization("0306", "신한카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0307", "씨티카드",   "card", (AuthPolicy.ID_PW,)),
    Organization("0309", "우리카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0311", "롯데카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0313", "하나카드",   "card", (AuthPolicy.SIMPLE_AUTH, AuthPolicy.ID_PW)),
    Organization("0315", "전북카드",   "card", (AuthPolicy.ID_PW,)),
    Organization("0316", "광주카드",   "card", (AuthPolicy.ID_PW,)),
    Organization("0320", "수협카드",   "card", (AuthPolicy.ID_PW,)),
    Organization("0321", "제주카드",   "card", (AuthPolicy.ID_PW,)),
)

# 주요 은행 — CODEF 카탈로그 기준 (2026-05-13 Phase 2 확장)
# 한국 표준 은행코드와 동일. 신한·국민·하나·우리·NH·기업은 ID/PW + 공동인증서 둘 다 지원
_BANKS: tuple[Organization, ...] = (
    Organization("0002", "한국산업은행", "bank", (AuthPolicy.CERT,)),
    Organization("0003", "IBK기업은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0004", "KB국민은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH)),
    Organization("0011", "NH농협은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0020", "우리은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH)),
    Organization("0023", "SC제일은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0027", "한국씨티은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0031", "대구은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0032", "부산은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0034", "광주은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0037", "전북은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0039", "경남은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0045", "새마을금고", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0048", "신협중앙회", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0050", "저축은행중앙회", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0071", "우체국", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0081", "하나은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH)),
    Organization("0088", "신한은행", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH)),
    Organization("0089", "케이뱅크", "bank", (AuthPolicy.ID_PW, AuthPolicy.CERT)),
    Organization("0090", "카카오뱅크", "bank", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
    Organization("0092", "토스뱅크", "bank", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
)

# 주요 PG (Payment Gateway) — 2026-05-13 추가
# CODEF 카탈로그 기준. 네이버페이/카카오페이/토스페이/페이코 4종 가맹점 매출 자동수집.
# (제로페이는 CODEF 카탈로그 미등재 — Excel 정산서 업로드로 별도 처리)
_PAYMENTS: tuple[Organization, ...] = (
    Organization("0521", "네이버페이", "card", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
    Organization("0523", "페이코", "card", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
    Organization("0524", "카카오페이", "card", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
    Organization("0525", "토스페이", "card", (AuthPolicy.ID_PW, AuthPolicy.SIMPLE_AUTH)),
)

# 공공기관 — 2026-05-15 추가 (홈택스 통한 현금영수증/세금계산서/부가세 자동수집).
# CODEF 카탈로그: organization 코드는 product 별로 다름 (PDF spec 검증):
#   0002 = 전자세금계산서 (tax-invoice/*)
#   0003 = 현금영수증 (cash-receipt/*)
#   0004 = 세금 납부·환급, 사업자등록상태 (hometax/*, etc-yearend-tax/*)
#   0006 = 신용카드 매출자료 (tax-payment/credit-card-*)
# connect 시 가장 우선 product = 현금영수증(0003) 으로 connectedId 발급.
# 0001 은 존재하지 않는 코드 (CF-04033 발생) — 사용 금지.
_PUBLIC: tuple[Organization, ...] = (
    Organization(
        "0003", "국세청 홈택스 (현금영수증)", "public_tax",
        (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH),
    ),
    Organization(
        "0002", "국세청 홈택스 (전자세금계산서)", "public_tax",
        (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH),
    ),
    Organization(
        "0004", "국세청 홈택스 (세금·사업자정보)", "public_tax",
        (AuthPolicy.ID_PW, AuthPolicy.CERT, AuthPolicy.SIMPLE_AUTH),
    ),
)

_ALL: dict[str, Organization] = {o.code: o for o in (*_CARDS, *_PAYMENTS, *_BANKS, *_PUBLIC)}


def get_organizations() -> dict[str, Organization]:
    """전체 organization 사본 반환. Phase 2~5에서 은행/공공 추가."""
    return dict(_ALL)


def get_organization(code: str) -> Optional[Organization]:
    return _ALL.get(code)


def list_card_corps() -> list[Organization]:
    """카드사 14종만 (PG 4종은 _PAYMENTS 로 분리 — list_payments() 사용)."""
    return list(_CARDS)


def list_payments() -> list[Organization]:
    return list(_PAYMENTS)


def list_banks() -> list[Organization]:
    return [o for o in _ALL.values() if o.type == "bank"]


def list_public_orgs() -> list[Organization]:
    """공공기관 (현재: 국세청 홈택스 1종). Phase 6 에서 4대보험·관세청 등 확장."""
    return list(_PUBLIC)
