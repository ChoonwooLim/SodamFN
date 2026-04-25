"""영업관리 테스트 픽스처."""
import pytest
import datetime


@pytest.fixture
def sample_business(session):
    from models import Business
    biz = Business(name="소담김밥 본점", business_number="123-45-67890")
    session.add(biz)
    session.commit()
    session.refresh(biz)
    return biz


@pytest.fixture
def sample_business_no_tax_id(session):
    from models import Business
    biz = Business(name="신규 매장", business_number=None)
    session.add(biz)
    session.commit()
    session.refresh(biz)
    return biz


@pytest.fixture
def sample_staff_5(session, sample_business):
    """활성 직원 5명: 4명 보건증 등록, 3명 4대보험 가입, 모두 status='재직'"""
    from models import Staff
    staff_list = []
    for i in range(5):
        s = Staff(
            business_id=sample_business.id,
            name=f"직원{i}",
            role="아르바이트",
            hourly_wage=10000,
            start_date=datetime.date(2026, 1, 1),
            status="재직",
            doc_health_cert=(i < 4),       # 4명만 True
            insurance_4major=(i < 3),       # 3명만 True
        )
        session.add(s)
        staff_list.append(s)
    session.commit()
    for s in staff_list:
        session.refresh(s)
    return staff_list


@pytest.fixture
def sample_staff_inactive(session, sample_business):
    """퇴사 직원 1명 — total 카운트에서 제외되어야 함"""
    from models import Staff
    s = Staff(
        business_id=sample_business.id,
        name="퇴사자",
        role="아르바이트",
        hourly_wage=10000,
        start_date=datetime.date(2025, 1, 1),
        status="퇴사",
        doc_health_cert=True,
        insurance_4major=True,
    )
    session.add(s)
    session.commit()
    return s
