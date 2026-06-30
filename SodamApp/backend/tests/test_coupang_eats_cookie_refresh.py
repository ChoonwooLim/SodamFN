from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select


def test_successful_call_persists_rotated_cookies(monkeypatch):
    import models  # noqa: F401

    from models import CoupangEatsCredential
    from services.crypto_util import decrypt_text, encrypt_text
    from services.coupang_eats_service import deserialize_cookies, serialize_cookies
    from routers import coupang_eats

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(coupang_eats, "engine", engine)

    initial_cookies = [
        {
            "name": "unify-token",
            "value": "old-token",
            "domain": ".coupangeats.com",
            "path": "/",
            "expires": -1,
        }
    ]
    rotated_cookies = [
        {
            "name": "unify-token",
            "value": "new-token",
            "domain": ".coupangeats.com",
            "path": "/",
            "expires": -1,
        },
        {
            "name": "bm_sz",
            "value": "new-akamai",
            "domain": ".coupangeats.com",
            "path": "/",
            "expires": 1_800_000_000,
        },
    ]

    with Session(engine) as s:
        s.add(
            CoupangEatsCredential(
                business_id=1,
                status="active",
                login_method="manual",
                cookies_encrypted=encrypt_text(serialize_cookies(initial_cookies)),
                consecutive_failures=2,
            )
        )
        s.commit()

    class FakeClient:
        def __init__(self, cookies):
            self.cookies = cookies

        def get_cookies(self):
            return rotated_cookies

        def close(self):
            pass

    monkeypatch.setattr(coupang_eats, "CoupangEatsClient", FakeClient)

    result, refreshed = coupang_eats._execute_with_refresh(1, lambda client: "ok")

    assert result == "ok"
    assert refreshed is False

    with Session(engine) as s:
        cred = s.exec(
            select(CoupangEatsCredential).where(
                CoupangEatsCredential.business_id == 1
            )
        ).one()
        stored = deserialize_cookies(decrypt_text(cred.cookies_encrypted))

    assert stored == rotated_cookies
    assert cred.status == "active"
    assert cred.consecutive_failures == 0
