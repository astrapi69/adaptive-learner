"""Tests for the production data-dir destructive-write guard.

Origin: BACKUP-API-RESTORE-01 (2026-06-02). A diagnostic script bound
to the real ``SessionLocal`` (no ``ADAPTIVE_LEARNER_TEST`` set) ran a
bulk ``DELETE FROM <every table>`` against the production-marked data
dir. The conftest tripwire only guards pytest; this module is the
process-wide layer that would have stopped it.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from app import db_guard
from app.db_guard import ProductionDataGuardError
from app.paths import PRODUCTION_MARKER_FILENAME


@pytest.fixture()
def prod_data_dir(tmp_path, monkeypatch):
    """A throwaway dir made to LOOK production-marked, wired into the
    guard via monkeypatched ``get_data_dir`` + a forced-off app-runtime
    flag and override env."""
    (tmp_path / PRODUCTION_MARKER_FILENAME).write_text("production", encoding="utf-8")
    monkeypatch.setattr(db_guard, "get_data_dir", lambda: tmp_path)
    monkeypatch.setattr(db_guard, "_APP_RUNTIME", False)
    monkeypatch.delenv("ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE", raising=False)
    return tmp_path


@pytest.fixture()
def plain_data_dir(tmp_path, monkeypatch):
    """A throwaway dir with NO production marker."""
    monkeypatch.setattr(db_guard, "get_data_dir", lambda: tmp_path)
    monkeypatch.setattr(db_guard, "_APP_RUNTIME", False)
    monkeypatch.delenv("ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE", raising=False)
    return tmp_path


# ---- statement classification ----------------------------------------------


@pytest.mark.parametrize(
    "statement",
    [
        "DELETE FROM users",
        "delete from users",
        'DELETE FROM "user_xp"',
        "DELETE\n  FROM   user_badges",  # ORM multi-line shape
        "DROP TABLE users",
        "TRUNCATE users",
    ],
)
def test_destructive_statements_are_detected(statement):
    assert db_guard._is_destructive_statement(statement) is True


@pytest.mark.parametrize(
    "statement",
    [
        "DELETE FROM users WHERE id = ?",
        "DELETE FROM users WHERE user_id = 'x'",
        "SELECT * FROM users",
        "INSERT INTO users (id) VALUES (?)",
        "UPDATE users SET name = ? WHERE id = ?",
    ],
)
def test_scoped_and_readonly_statements_are_not_destructive(statement):
    assert db_guard._is_destructive_statement(statement) is False


# ---- is_production_data_dir -------------------------------------------------


def test_is_production_data_dir_true_when_marker_present(prod_data_dir):
    assert db_guard.is_production_data_dir() is True


def test_is_production_data_dir_false_without_marker(plain_data_dir):
    assert db_guard.is_production_data_dir() is False


# ---- assert_safe_for_destructive_use ---------------------------------------


def test_assert_raises_on_production_dir(prod_data_dir):
    with pytest.raises(ProductionDataGuardError):
        db_guard.assert_safe_for_destructive_use("wipe")


def test_assert_passes_on_plain_dir(plain_data_dir):
    # Must not raise.
    db_guard.assert_safe_for_destructive_use("wipe")


def test_assert_override_env_bypasses_production(prod_data_dir, monkeypatch):
    monkeypatch.setenv("ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE", "1")
    # Must not raise despite the production marker.
    db_guard.assert_safe_for_destructive_use("intentional wipe")


# ---- engine listener (the automatic layer) ---------------------------------


def _guarded_engine():
    engine = create_engine("sqlite:///:memory:")
    db_guard.install(engine)
    return engine


def test_engine_blocks_bulk_delete_against_production(prod_data_dir):
    engine = _guarded_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE thing (id TEXT)"))
        conn.execute(text("INSERT INTO thing (id) VALUES ('a')"))
    with engine.connect() as conn, pytest.raises(ProductionDataGuardError):
        conn.execute(text("DELETE FROM thing"))


def test_engine_allows_scoped_delete_against_production(prod_data_dir):
    engine = _guarded_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE thing (id TEXT)"))
        conn.execute(text("INSERT INTO thing (id) VALUES ('a')"))
        # A WHERE-scoped delete is the app's normal write path — allowed.
        conn.execute(text("DELETE FROM thing WHERE id = 'a'"))


def test_engine_allows_bulk_delete_when_app_runtime(prod_data_dir, monkeypatch):
    monkeypatch.setattr(db_guard, "_APP_RUNTIME", True)
    engine = _guarded_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE thing (id TEXT)"))
        # The running app may purge its own data.
        conn.execute(text("DELETE FROM thing"))


def test_engine_allows_bulk_delete_on_plain_dir(plain_data_dir):
    engine = _guarded_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE thing (id TEXT)"))
        conn.execute(text("DELETE FROM thing"))


def test_install_is_idempotent(prod_data_dir):
    engine = create_engine("sqlite:///:memory:")
    db_guard.install(engine)
    db_guard.install(engine)  # second call is a no-op, not a double-listener
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE thing (id TEXT)"))
    with engine.connect() as conn, pytest.raises(ProductionDataGuardError):
        conn.execute(text("DELETE FROM thing"))
