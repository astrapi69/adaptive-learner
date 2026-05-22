"""Alembic round-trip test for the initial domain migration.

Two guarantees:

1. ``alembic upgrade head`` against a fresh, empty SQLite file
   creates every table named in :mod:`app.models` plus the
   ``alembic_version`` row.
2. ``alembic downgrade base`` from head leaves only
   ``alembic_version`` (every domain table dropped) so the
   downgrade body is not silently incomplete.

The migration runs against a process-scoped tmp file rather than
the in-memory ``sqlite:///:memory:`` URL the rest of the suite
uses, because Alembic spawns its own SQLAlchemy connection per
``op.create_table`` call and ``StaticPool`` is the only way an
in-memory DB survives that pattern. A tmp file sidesteps the
pool-lifecycle question entirely.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

BACKEND_DIR = Path(__file__).resolve().parent.parent

EXPECTED_TABLES = {
    "users",
    "user_settings",
    "learning_projects",
    "learning_profiles",
    "curriculums",
    "learning_topics",
    "lessons",
    "learning_sessions",
    "session_messages",
    "session_ratings",
    "session_notes",
    "progress_commits",
    "step_evaluations",  # v0.5.0 / 8D — Phase 8 dual-prompt analytics
    "method_switches",
    # v0.9.0 / Phase 12C — chat-history import surface
    "imported_conversations",
    "imported_messages",
    # v1.9.0 / Phase 22A — Subjects + Tags taxonomy
    "subjects",
    "tags",
    "project_subjects",
    "project_tags",
    # v1.16.0 / Phase 29A — gamification XP singleton
    "user_xp",
    # v1.16.0 / Phase 29B — badge catalog + earned-badge record
    "badges",
    "user_badges",
    # v1.16.0 / Phase 29C — streak state singleton
    "user_streaks",
    # v1.17.0 / Phase 30B — AI-extracted flashcard candidates
    "anki_card_suggestions",
}


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


@pytest.fixture()
def fresh_db_url(tmp_path: Path) -> str:
    """Tmp sqlite file URL that does not collide with the conftest's
    in-memory engine. Each test gets its own file."""
    return f"sqlite:///{tmp_path / 'alembic-roundtrip.db'}"


def test_upgrade_head_creates_all_domain_tables(fresh_db_url: str) -> None:
    cfg = _alembic_config(fresh_db_url)
    command.upgrade(cfg, "head")

    inspector = inspect(create_engine(fresh_db_url))
    tables = set(inspector.get_table_names())
    missing = EXPECTED_TABLES - tables
    extra_domain = (tables - EXPECTED_TABLES) - {"alembic_version"}
    assert not missing, f"upgrade head did not create: {sorted(missing)}"
    assert not extra_domain, f"upgrade head created unexpected tables: {sorted(extra_domain)}"
    assert "alembic_version" in tables


def test_downgrade_base_drops_every_domain_table(fresh_db_url: str) -> None:
    cfg = _alembic_config(fresh_db_url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    inspector = inspect(create_engine(fresh_db_url))
    tables = set(inspector.get_table_names())
    domain_leftover = tables & EXPECTED_TABLES
    assert not domain_leftover, (
        f"downgrade base left domain tables behind: {sorted(domain_leftover)}. "
        f"The downgrade body is incomplete."
    )


def test_upgrade_downgrade_upgrade_is_idempotent(fresh_db_url: str) -> None:
    """Re-applying head after a full downgrade reproduces the same
    table set. Catches the regression where a missing downgrade
    leaves orphan indexes that block the next upgrade."""
    cfg = _alembic_config(fresh_db_url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

    inspector = inspect(create_engine(fresh_db_url))
    tables = set(inspector.get_table_names())
    assert EXPECTED_TABLES.issubset(tables)
