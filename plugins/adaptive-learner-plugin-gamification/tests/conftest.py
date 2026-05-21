"""Plugin-side conftest.

Plugin unit tests are pure (no DB, no app.* import). End-to-end
DB + route tests live in ``backend/tests/test_gamification_*``
where the backend fixtures + in-memory SQLite are available.

This conftest exists so pytest can discover the tests/ dir; it
intentionally adds no fixtures.
"""

from __future__ import annotations
