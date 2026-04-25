"""Parser tests: withholding receipt (별지24) + simplified (간소화)."""
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def _read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_parse_withholding_receipt_text():
    from services.yearend.parser import parse_withholding_receipt_text
    text = _read_fixture("sample_withholding.txt")

    data = parse_withholding_receipt_text(text)

    assert data.name == "김금순"
    assert data.resident_number_prefix == "850101"
    assert data.work_period_from == "2025.01.01"
    assert data.work_period_to == "2025.12.31"
    assert data.total_pay == 33_600_000
    assert data.decided_tax == 432_100 + 43_210
    assert data.taxes_paid_at_work == 477_300 + 47_730
    assert data.refund_amount == -(45_200 + 4_520)
    assert data.np_amount == 1_512_000
    assert data.hi_amount == 1_188_000
    assert data.lti_amount == 156_000
    assert data.ei_amount == 268_800


def test_parse_simplified_text():
    from services.yearend.parser import parse_simplified_text
    text = _read_fixture("sample_simplified.txt")

    data = parse_simplified_text(text)

    assert data.staff_name == "김금순"
    assert data.resident_number_prefix == "850101"
    assert data.insurance_amount == 720_000
    assert data.medical_amount == 1_250_000
    assert data.education_amount == 0
    assert data.donation_amount == 100_000
    assert data.pension_amount == 3_000_000
    assert data.credit_card_amount == 12_400_000
    assert data.debit_card_amount == 3_200_000
    assert data.traditional_market == 480_000
    assert data.public_transport == 720_000
    assert data.cultural_amount == 350_000


def test_parse_withholding_missing_field_returns_none():
    """결정세액 라인이 누락된 PDF → decided_tax=None, 다른 필드는 정상."""
    from services.yearend.parser import parse_withholding_receipt_text
    text = "성명 홍길동\n주민등록번호 900101-1******\n총급여 25,000,000\n"
    data = parse_withholding_receipt_text(text)
    assert data.name == "홍길동"
    assert data.total_pay == 25_000_000
    assert data.decided_tax is None
