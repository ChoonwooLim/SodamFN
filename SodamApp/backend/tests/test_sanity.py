def test_sanity():
    assert 1 + 1 == 2


def test_session_fixture(session):
    """Verify in-memory DB fixture works."""
    from models import Business
    biz = Business(name="테스트사업장", business_type="음식점")
    session.add(biz)
    session.commit()
    assert biz.id is not None
