"""Tests for the async SQLAlchemy foundation (Phase 18A).

Verifies that ``async_engine`` + ``AsyncSessionLocal`` work
alongside the existing sync setup. The sync path stays unchanged
(other test files cover that exhaustively); these tests only pin
the new infrastructure.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text

from app.database import (
    AsyncSessionLocal,
    DATABASE_URL,
    SessionLocal,
    _async_database_url,
    async_engine,
)


def test_async_database_url_translates_sqlite_to_aiosqlite():
    assert (
        _async_database_url("sqlite:///foo.db")
        == "sqlite+aiosqlite:///foo.db"
    )
    assert (
        _async_database_url("sqlite:///:memory:")
        == "sqlite+aiosqlite:///:memory:"
    )


def test_async_database_url_idempotent():
    """Already-async URLs pass through untouched."""
    url = "sqlite+aiosqlite:///foo.db"
    assert _async_database_url(url) == url


def test_async_database_url_passes_non_sqlite_through():
    """Postgres / MySQL URLs are not transformed."""
    pg = "postgresql://user@host/db"
    assert _async_database_url(pg) == pg


def test_async_engine_uses_aiosqlite_dialect():
    """The new async engine speaks aiosqlite under SQLite."""
    assert "aiosqlite" in str(async_engine.url)


def test_sync_path_still_works():
    """Defensive: confirm the sync SessionLocal still produces a
    working session after the async additions."""
    session = SessionLocal()
    try:
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        session.close()


@pytest.mark.asyncio
async def test_async_session_executes_query():
    """The new async session can execute a trivial query."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT 1"))
        value = result.scalar()
        assert value == 1
