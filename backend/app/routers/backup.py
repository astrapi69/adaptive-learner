"""Backup + restore endpoints (Phase 15A).

Thin router: every endpoint validates input, delegates to
``app.services.backup_service``, returns the result. All business
logic lives in the service.

Storage-mode-aware: the same JSON shape is produced by
``DexieStorage.backup`` browser-side, so a backup made in either
mode can be restored in the other (modulo API keys, which are
never in the file).

Endpoints are scoped to a specific user via query parameter
(matches the existing ``/api/sync/status`` pattern). The single-
user desktop installation always passes its one user id; a future
multi-user surface picks the right one.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, status  # noqa: F401  (Body used as Body(...))
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.backup_service import (
    create_backup,
    get_backup_stats,
    restore_backup,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["backup"])


def _filename_for(user_id: str) -> str:
    """Suggested download name. ``YYYY-MM-DD`` keeps the file
    obvious in a Downloads folder, the user prefix lets multi-
    install backups coexist."""
    date = datetime.now(UTC).strftime("%Y-%m-%d")
    short = user_id[:8] if len(user_id) >= 8 else user_id
    return f"adaptive-learner-backup-{date}-{short}.json"


@router.get(
    "/export",
    summary="Export a full data backup",
    response_description=("A pretty-printed JSON backup file (Content-Disposition: attachment)."),
)
def export_backup(
    user_id: str,
    storage_mode: str = "api",
    db: Session = Depends(get_db),
) -> Response:
    """Export the user's full data set as a JSON backup file.

    Returns a JSON response with a ``Content-Disposition:
    attachment`` header so browsers offer a download dialog. The
    body is pretty-printed (indent=2) to keep the file human-
    readable; users open backups in text editors to verify
    contents before trusting a restore.
    """
    payload = create_backup(db, user_id, storage_mode=storage_mode)
    body = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
    filename = _filename_for(user_id)
    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/stats")
def backup_stats(user_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Per-table row counts for the user. Used by the UI to show
    a pre-restore comparison ("Current: X sessions; backup
    contains: Y sessions").
    """
    return get_backup_stats(db, user_id)


@router.post(
    "/import",
    status_code=status.HTTP_200_OK,
    summary="Restore from a backup",
    response_description="Per-table counts of the restored rows.",
    responses={
        400: {"description": "Malformed or incompatible backup payload"},
        404: {"description": "User not found"},
    },
)
def import_backup(
    user_id: str,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Restore a previously-exported JSON backup payload.

    The body IS the backup JSON object — the frontend reads the
    user-picked ``.json`` file client-side (FileReader.readAsText)
    and POSTs the parsed object directly. Matches the existing
    JSON-body pattern used by the other routers and avoids the
    ``python-multipart`` runtime dependency that ``UploadFile``
    drags in.

    Merge semantics: never deletes, only inserts new records or
    updates mutable rows where the backup's timestamp is newer.
    API keys are ignored even if present in the payload.
    """
    return restore_backup(db, payload, target_user_id=user_id)
