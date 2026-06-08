"""Export endpoints (Phase 16A).

Thin router: every endpoint validates input, delegates to
``app.services.export_service``, returns the aggregated payload.
All business logic lives in the service.

The payloads are format-agnostic structured dicts. The Markdown
+ PDF renderers live in the frontend (``frontend/src/lib/export/``);
the backend only assembles the data.

Storage-mode-aware: the same dict shape is produced by
``frontend/src/storage/export-builder.ts`` browser-side so the
Markdown + PDF output is identical in API and Dexie modes.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.deps import get_export_repo
from app.repositories.export_repo import ExportRepository
from app.services.export_service import (
    build_curriculum_overview,
    build_progress_report,
    build_session_detail,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/progress")
def export_progress_report(
    user_id: str,
    lang: str = "de",
    repo: ExportRepository = Depends(get_export_repo),
) -> dict[str, Any]:
    """Aggregate the user's full learning journey.

    Returns a structured dict (see
    ``app.services.export_service.build_progress_report``). The
    frontend renders Markdown or PDF from this payload.
    """
    return build_progress_report(repo, user_id, lang=lang)


@router.get("/session/{session_id}")
def export_session_detail(
    session_id: str,
    lang: str = "de",
    repo: ExportRepository = Depends(get_export_repo),
) -> dict[str, Any]:
    """Aggregate one session with its full transcript + ratings
    + step-evaluation timeline."""
    return build_session_detail(repo, session_id, lang=lang)


@router.get("/curriculum/{curriculum_id}")
def export_curriculum_overview(
    curriculum_id: str,
    lang: str = "de",
    repo: ExportRepository = Depends(get_export_repo),
) -> dict[str, Any]:
    """Aggregate a curriculum with its topic tree + lessons."""
    return build_curriculum_overview(repo, curriculum_id, lang=lang)
