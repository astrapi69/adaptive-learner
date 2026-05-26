"""Plugin-side conftest (Phase 43 / EXP-002).

Pure unit tests; HTTP-touching and DB-touching tests will land
in ``backend/tests/test_content_loader_*.py`` once the routes
arrive (Phase 43 commit 6).
"""

from __future__ import annotations
