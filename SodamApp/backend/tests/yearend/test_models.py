"""Smoke tests for YearEnd* SQLModel tables."""
import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select


def test_yearend_report_unique_staff_year(session):
    from models import YearEndReport
    r1 = YearEndReport(business_id=1, staff_id=10, year=2025)
    r2 = YearEndReport(business_id=1, staff_id=10, year=2025)
    session.add(r1)
    session.commit()
    session.add(r2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_yearend_document_unique_quad(session):
    """동일 staff×year×kind×hash 중복 방지."""
    from models import YearEndDocument
    d1 = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="https://r2/a.pdf", original_filename="a.pdf",
        file_size=1024, file_hash="abc123", uploaded_by_user_id=1,
    )
    session.add(d1)
    session.commit()
    d2 = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="https://r2/a.pdf", original_filename="a.pdf",
        file_size=1024, file_hash="abc123", uploaded_by_user_id=1,
    )
    session.add(d2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_yearend_simplified_default_zeros(session):
    from models import YearEndDocument, YearEndSimplified
    doc = YearEndDocument(
        business_id=1, staff_id=10, year=2025, kind="simplified",
        file_url="x", original_filename="x", file_size=1, file_hash="h",
        uploaded_by_user_id=1,
    )
    session.add(doc)
    session.commit()
    s = YearEndSimplified(document_id=doc.id, staff_id=10, year=2025)
    session.add(s)
    session.commit()
    assert s.medical_amount == 0
    assert s.credit_card_amount == 0
