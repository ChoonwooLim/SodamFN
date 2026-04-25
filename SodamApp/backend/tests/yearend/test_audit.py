"""Audit log helper."""


def _make_business(session):
    from models import Business
    biz = Business(name="X", business_type="음식점")
    session.add(biz); session.commit()
    return biz


def _make_staff(session, business_id):
    """Create Staff with required NOT NULL fields (role/hourly_wage/start_date)."""
    from models import Staff
    from datetime import date
    s = Staff(name="A", business_id=business_id, role="직원",
              hourly_wage=10_000, start_date=date(2025, 1, 1))
    session.add(s); session.commit()
    return s


def test_log_action_inserts_row(session):
    from models import User, YearEndAuditLog
    from services.yearend.audit import log_action
    from sqlmodel import select

    biz = _make_business(session)
    staff = _make_staff(session, biz.id)
    u = User(username="admin1", hashed_password="x", role="admin", business_id=biz.id)
    session.add(u); session.commit()

    log_action(
        session=session,
        business_id=biz.id, staff_id=staff.id, year=2025,
        action="download", actor_user_id=u.id, actor_role="admin",
        actor_ip="127.0.0.1", user_agent="pytest",
        document_id=None, detail='{"file":"draft.pdf"}',
    )
    session.commit()

    rows = session.exec(select(YearEndAuditLog)).all()
    assert len(rows) == 1
    assert rows[0].action == "download"
    assert rows[0].actor_role == "admin"
    assert rows[0].detail == '{"file":"draft.pdf"}'


def test_extract_ip_and_ua_from_request():
    from services.yearend.audit import extract_actor_meta

    class FakeReq:
        headers = {"user-agent": "Mozilla/5.0"}
        client = type("C", (), {"host": "1.2.3.4"})()

    ip, ua = extract_actor_meta(FakeReq())
    assert ip == "1.2.3.4"
    assert ua == "Mozilla/5.0"
