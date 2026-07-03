"""manual-cookies 즉시 검증 플로우 테스트.

기존 test_coupang_eats_cookie_refresh.py 패턴:
sqlite in-memory + monkeypatch(coupang_eats.engine / CoupangEatsClient)
+ 엔드포인트 함수 직접 호출 (FastAPI DI 미사용).
"""
import datetime
import types

import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select


ADMIN = types.SimpleNamespace(business_id=1, role="admin")

COOKIES = [
    {"name": "unify-token", "value": "tok", "domain": ".coupangeats.com",
     "path": "/", "expires": -1},
    {"name": "bm_sz", "value": "aka", "domain": ".coupangeats.com",
     "path": "/", "expires": 1_800_000_000},
]


def _setup_engine(monkeypatch):
    import models  # noqa: F401  (SQLModel 테이블 등록)
    from routers import coupang_eats

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(coupang_eats, "engine", engine)
    return engine


# ─── Task 1: 헬퍼 단위 테스트 ─────────────────────────────

def test_normalize_stores_absorbs_key_variants():
    from routers.coupang_eats import _normalize_stores

    out = _normalize_stores([
        {"storeId": 823245, "shopName": "소담김밥"},
        {"id": "99", "name": "장인김밥"},
        {"store_id": 7, "storeName": "강동점"},
        {"storeId": "abc"},          # int 변환 불가 → 제외
        {"shopName": "ID없음"},       # store_id 없음 → 제외
    ])
    assert out == [
        {"store_id": 823245, "store_name": "소담김밥"},
        {"store_id": 99, "store_name": "장인김밥"},
        {"store_id": 7, "store_name": "강동점"},
    ]


def test_normalize_stores_empty():
    from routers.coupang_eats import _normalize_stores
    assert _normalize_stores([]) == []
    assert _normalize_stores(None) == []


def test_last_success_sync_date(monkeypatch):
    from models import CoupangEatsSyncLog
    from routers.coupang_eats import _last_success_sync_date

    engine = _setup_engine(monkeypatch)
    with Session(engine) as s:
        s.add(CoupangEatsSyncLog(business_id=1, status="success",
                                 target_start=datetime.date(2026, 6, 20),
                                 target_end=datetime.date(2026, 6, 20)))
        s.add(CoupangEatsSyncLog(business_id=1, status="success",
                                 target_start=datetime.date(2026, 6, 21),
                                 target_end=datetime.date(2026, 6, 21)))
        s.add(CoupangEatsSyncLog(business_id=1, status="failed",
                                 target_start=datetime.date(2026, 6, 22),
                                 target_end=datetime.date(2026, 6, 22)))
        s.add(CoupangEatsSyncLog(business_id=2, status="success",
                                 target_start=datetime.date(2026, 6, 30),
                                 target_end=datetime.date(2026, 6, 30)))
        s.commit()

        assert _last_success_sync_date(s, 1) == datetime.date(2026, 6, 21)
        assert _last_success_sync_date(s, 99) is None
