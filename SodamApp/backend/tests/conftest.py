"""Shared pytest fixtures for sodam backend tests."""
import os
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool


@pytest.fixture
def session():
    """Fresh in-memory DB per test (StaticPool keeps the same connection alive)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Import models AFTER engine creation so SQLModel registers all tables
    import models  # noqa: F401
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
