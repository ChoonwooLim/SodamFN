"""SalesGuideProgress 모델 CRUD 테스트."""
import pytest
import datetime
from sqlalchemy.exc import IntegrityError


def test_create_progress_minimal(session):
    """진행상태 row 최소 필드로 생성"""
    from models import SalesGuideProgress
    progress = SalesGuideProgress(
        business_id=1,
        item_key="permits.business_registration",
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)

    assert progress.id is not None
    assert progress.is_completed is False
    assert progress.completed_at is None
    assert progress.expires_at is None
    assert progress.notes is None


def test_unique_constraint_business_item(session):
    """같은 사업장 × 같은 item_key 중복 불가"""
    from models import SalesGuideProgress
    p1 = SalesGuideProgress(business_id=1, item_key="permits.health_certificate")
    session.add(p1)
    session.commit()

    p2 = SalesGuideProgress(business_id=1, item_key="permits.health_certificate")
    session.add(p2)
    with pytest.raises(IntegrityError):
        session.commit()


def test_progress_with_dates_and_notes(session):
    """완료일·만료일·메모 저장"""
    from models import SalesGuideProgress
    progress = SalesGuideProgress(
        business_id=1,
        item_key="permits.health_certificate",
        is_completed=True,
        completed_at=datetime.date(2026, 4, 1),
        expires_at=datetime.date(2027, 4, 1),
        notes="첫 발급",
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)

    assert progress.completed_at == datetime.date(2026, 4, 1)
    assert progress.expires_at == datetime.date(2027, 4, 1)
    assert progress.notes == "첫 발급"
    assert progress.is_completed is True


def test_query_progress_for_business(session):
    """사업장별 모든 진행 상태 조회"""
    from models import SalesGuideProgress
    from sqlmodel import select
    keys = ["permits.business_registration", "permits.restaurant_report", "delivery.baemin"]
    for k in keys:
        session.add(SalesGuideProgress(business_id=42, item_key=k))
    session.commit()

    results = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == 42)
    ).all()
    assert len(results) == 3
    assert {r.item_key for r in results} == set(keys)
