"""PDF parser for year-end documents.

- 원천징수영수증 (별지24호) → WithholdingReceiptData
- 홈택스 간소화 자료 → SimplifiedData

기존 scripts/parse_yearend_tax.py 의 정규식을 정형화·테스트가능 형태로 재구성.
"""
from __future__ import annotations
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import pdfplumber

logger = logging.getLogger("sodam.yearend.parser")


# ─────────────────── Withholding Receipt (별지 24호) ───────────────────

@dataclass
class WithholdingReceiptData:
    name: Optional[str] = None
    resident_number_prefix: Optional[str] = None  # 앞 6자리
    work_period_from: Optional[str] = None
    work_period_to: Optional[str] = None
    total_pay: Optional[int] = None             # 총급여
    nontaxable_pay: Optional[int] = None        # 비과세소득
    decided_tax: Optional[int] = None           # 결정세액 (소득세+지방세)
    taxes_paid_at_work: Optional[int] = None    # 주현근무지 기납부
    refund_amount: Optional[int] = None         # 차감징수세액 (음수=환급)
    np_amount: Optional[int] = None
    hi_amount: Optional[int] = None
    lti_amount: Optional[int] = None
    ei_amount: Optional[int] = None
    raw_text: Optional[str] = None


def _parse_won(s: str) -> int:
    """'1,234,567' or '-1,234' → int."""
    if not s:
        return 0
    cleaned = s.replace(",", "").strip()
    return int(cleaned)


def _parse_two_amount_pair(line: str) -> Optional[tuple[int, int]]:
    """'결정세액  432,100  43,210' → (432100, 43210). 음수도 처리."""
    m = re.findall(r"-?\d[\d,]*", line)
    if len(m) >= 2:
        try:
            return _parse_won(m[-2]), _parse_won(m[-1])
        except ValueError:
            return None
    return None


def parse_withholding_receipt_text(text: str) -> WithholdingReceiptData:
    """추출된 PDF 텍스트 → WithholdingReceiptData."""
    data = WithholdingReceiptData(raw_text=text)

    m = re.search(r"성명\s+([가-힣A-Za-z]+)", text)
    if m:
        data.name = m.group(1)

    m = re.search(r"주민등록번호\s+(\d{6})", text)
    if m:
        data.resident_number_prefix = m.group(1)

    m = re.search(r"근무기간\s+([\d.]+)\s*~\s*([\d.]+)", text)
    if m:
        data.work_period_from = m.group(1)
        data.work_period_to = m.group(2)

    m = re.search(r"총급여\s+(\d{1,3}(?:,\d{3})+)", text)
    if m:
        data.total_pay = _parse_won(m.group(1))

    m = re.search(r"비과세\s*소득\s+(\d{1,3}(?:,\d{3})+)", text)
    if m:
        data.nontaxable_pay = _parse_won(m.group(1))

    for line in text.split("\n"):
        if "결정세액" in line:
            pair = _parse_two_amount_pair(line)
            if pair:
                data.decided_tax = pair[0] + pair[1]
                break

    for line in text.split("\n"):
        if "주(현)근무지" in line or re.search(r"주.현.근무지", line):
            pair = _parse_two_amount_pair(line)
            if pair:
                data.taxes_paid_at_work = pair[0] + pair[1]
                break

    for line in text.split("\n"):
        if "차감징수세액" in line or "차감징수" in line:
            pair = _parse_two_amount_pair(line)
            if pair:
                data.refund_amount = pair[0] + pair[1]
                break

    for label, attr in [
        ("국민연금보험료", "np_amount"),
        ("국민건강보험료", "hi_amount"),
        ("장기요양보험료", "lti_amount"),
        ("고용보험료", "ei_amount"),
    ]:
        m = re.search(rf"{label}[:\s]+(\d{{1,3}}(?:,\d{{3}})+)", text)
        if m:
            setattr(data, attr, _parse_won(m.group(1)))

    return data


def parse_withholding_receipt(pdf_path: str) -> WithholdingReceiptData:
    """PDF 파일 경로 → WithholdingReceiptData."""
    with pdfplumber.open(pdf_path) as pdf:
        all_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    if not all_text.strip():
        raise ValueError("pdf_text_empty")
    return parse_withholding_receipt_text(all_text)


# ─────────────────── Simplified (홈택스 간소화) ───────────────────

@dataclass
class SimplifiedData:
    staff_name: Optional[str] = None
    resident_number_prefix: Optional[str] = None
    insurance_amount: int = 0
    medical_amount: int = 0
    education_amount: int = 0
    donation_amount: int = 0
    house_loan_principal: int = 0
    house_loan_interest: int = 0
    pension_amount: int = 0
    irp_amount: int = 0
    credit_card_amount: int = 0
    debit_card_amount: int = 0
    traditional_market: int = 0
    public_transport: int = 0
    cultural_amount: int = 0
    raw_text: Optional[str] = None


SIMPLIFIED_LABELS = {
    "insurance_amount": ["보장성보험료", "보장성 보험료", "보험료 공제"],
    "medical_amount": ["의료비"],
    "education_amount": ["교육비"],
    "donation_amount": ["기부금"],
    "house_loan_principal": ["주택자금원리금", "주택자금 원리금"],
    "house_loan_interest": ["주택임차차입금이자", "주택임차차입금 이자"],
    "pension_amount": ["연금저축"],
    "irp_amount": ["퇴직연금", "IRP"],
    "credit_card_amount": ["신용카드"],
    "debit_card_amount": ["체크카드", "현금영수증"],
    "traditional_market": ["전통시장"],
    "public_transport": ["대중교통"],
    "cultural_amount": ["문화비"],
}


def parse_simplified_text(text: str) -> SimplifiedData:
    data = SimplifiedData(raw_text=text)

    m = re.search(r"성명\s+([가-힣A-Za-z]+)", text)
    if m:
        data.staff_name = m.group(1)
    m = re.search(r"주민등록번호\s+(\d{6})", text)
    if m:
        data.resident_number_prefix = m.group(1)

    for attr, labels in SIMPLIFIED_LABELS.items():
        for label in labels:
            m = re.search(rf"{label}[:\s]+(\d{{1,3}}(?:,\d{{3}})*|\d+)", text)
            if m:
                setattr(data, attr, _parse_won(m.group(1)))
                break

    return data


def parse_simplified(pdf_path: str) -> SimplifiedData:
    with pdfplumber.open(pdf_path) as pdf:
        all_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    if not all_text.strip():
        raise ValueError("pdf_text_empty")
    return parse_simplified_text(all_text)
