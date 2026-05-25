"""FastAPI routes for the Learning Repository plugin (Phase 42 / BL-30).

Scaffold stub — concrete endpoints land in commits 3-4 of the
BL-30 chain:

  GET    /api/plugins/learning-repo/render/{project_id}      meta-files JSON
  POST   /api/plugins/learning-repo/export-zip/{project_id}  zipped on-disk tree

Router is mounted today (commit 2) with no endpoints so the
plugin discovery + mount path is exercised by integration tests
before the renderer arrives.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(
    prefix="/plugins/learning-repo",
    tags=["learning-repo"],
)
