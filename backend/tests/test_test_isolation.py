# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Regression tests for the test-vs-production DB isolation contract.

These tests exist as a tripwire: if somebody reverts the env-var logic
in app/database.py or reorders imports in tests/conftest.py, at least
one of these asserts fails loudly. The April 2026 data-loss incident
(test suite dropped the user's production adaptive_learner.db) is the reason
this file exists.
"""

from __future__ import annotations

import os

from app.database import DATABASE_URL, engine
from tests.conftest import looks_like_test_database


def test_test_mode_flag_is_set() -> None:
    """conftest.py must have set ADAPTIVE_LEARNER_TEST=1 before any app import."""
    assert os.environ.get("ADAPTIVE_LEARNER_TEST") == "1"


def test_engine_points_at_test_db() -> None:
    """Live engine URL must not look like the production SQLite file.

    Reads ``url.database``, not ``str(engine.url)``: SQLAlchemy 2.1
    percent-encodes ``:memory:`` in the text rendering (#3550).
    """
    database = engine.url.database or ""
    assert "adaptive_learner.db" not in database
    assert looks_like_test_database(database)


def test_database_url_respects_test_flag() -> None:
    """DATABASE_URL was frozen at import; verify it used the test path."""
    assert "adaptive_learner.db" not in DATABASE_URL
