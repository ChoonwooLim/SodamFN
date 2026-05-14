"""배민 라우터 통합 — credential CRUD + manual-cookies."""
import pytest
import httpx
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

from models import Business, User
from main import app
from database import get_session
import database


import asyncio


class _Client:
    """starlette TestClient 가 httpx>=0.28 호환 안돼서 AsyncClient + asyncio.run 으로 대체."""
    def __init__(self, app):
        self._transport = httpx.ASGITransport(app=app)
        self._base_url = "http://test"

    def _run(self, method: str, url: str, **kw):
        async def _do():
            async with httpx.AsyncClient(transport=self._transport,
                                         base_url=self._base_url) as ac:
                return await ac.request(method, url, **kw)
        return asyncio.run(_do())

    def get(self, url, **kw): return self._run("GET", url, **kw)
    def post(self, url, **kw): return self._run("POST", url, **kw)
    def delete(self, url, **kw): return self._run("DELETE", url, **kw)
    def close(self): pass


@pytest.fixture
def client(monkeypatch):
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    # 라우터가 database.engine 을 직접 import 해서 사용하므로 monkeypatch
    monkeypatch.setattr(database, "engine", eng)
    with Session(eng) as s:
        biz = Business(id=1, name="test", subscription_status="active")
        admin = User(id=1, username="admin1", email="admin@x.com", role="admin",
                     business_id=1, hashed_password="x")
        s.add(biz); s.add(admin); s.commit()
    def _override():
        with Session(eng) as s: yield s
    app.dependency_overrides[get_session] = _override

    # admin auth bypass
    from routers.auth import get_admin_user
    def _admin():
        with Session(eng) as s:
            return s.exec(select(User).where(User.id == 1)).first()
    app.dependency_overrides[get_admin_user] = _admin

    c = _Client(app)
    try:
        yield c
    finally:
        c.close()
        app.dependency_overrides.clear()


def test_credential_register_then_get(client):
    r = client.post("/api/baemin/credential", json={
        "login_id": "boss@example.com",
        "store_id": "STORE_A",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["login_id"] == "boss@example.com"
    assert body["store_id"] == "STORE_A"
    assert body["cookies_present"] is False

    r2 = client.get("/api/baemin/credential")
    assert r2.status_code == 200
    assert r2.json()["registered"] is True


def test_manual_cookies_upload(client):
    # 자격증명 없이도 쿠키 업로드만으로 동작
    cookies = [{"name": "AUTH", "value": "abc", "domain": "ceo.baemin.com"}]
    r = client.post("/api/baemin/manual-cookies", json={
        "cookies": cookies,
        "store_id": "STORE_A",
        "shop_name": "소담김밥",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["cookies_present"] is True
    assert body["status"] == "active"
    assert body["shop_name"] == "소담김밥"


def test_manual_cookies_empty_list_rejected(client):
    r = client.post("/api/baemin/manual-cookies", json={"cookies": []})
    assert r.status_code == 400


def test_credential_delete(client):
    # 자격증명 등록 후 삭제 (login_id 는 min_length=3 이므로 "xxx" 사용)
    r0 = client.post("/api/baemin/credential",
                     json={"login_id": "xxx", "store_id": "STORE_A"})
    assert r0.status_code == 200
    r = client.delete("/api/baemin/credential")
    assert r.status_code == 200
    r2 = client.get("/api/baemin/credential")
    assert r2.json()["registered"] is False


def test_sync_logs_empty(client):
    r = client.get("/api/baemin/sync/logs")
    assert r.status_code == 200
    assert r.json() == []
