"""Translate a session_complete payload into a ProgressCommit row.

Kept separate from :mod:`.plugin` so the conversion is
unit-testable without spinning up a DB or PluginManager.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from . import RATING_SCALE


def _parse_iso(value: Any) -> datetime | None:
    """Tolerant ISO-8601 parser. Returns None on garbage so a
    malformed timestamp in the hook payload doesn't crash the
    writer — duration_minutes falls through to 0.
    """
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not value:
        return None
    try:
        # ``fromisoformat`` accepts ``+00:00`` and naive strings;
        # SQLAlchemy hands timezone-aware datetimes through the
        # hook so the ``Z`` shorthand isn't a concern here.
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _duration_minutes(started_at: Any, ended_at: Any) -> int:
    """Inclusive-of-zero duration. A session ending in the same
    minute it started rounds down to 0 — fine for the
    "stagnation across N sessions" cohort; a future per-minute
    accuracy refinement can switch to ``timedelta.total_seconds() // 60``.
    """
    start = _parse_iso(started_at)
    end = _parse_iso(ended_at)
    if start is None or end is None:
        return 0
    seconds = max(0.0, (end - start).total_seconds())
    return int(seconds // 60)


def _normalise_rating(value: Any) -> float:
    """Rescale a 1-5 user rating to a 0.0-1.0 float for the
    ProgressCommit Float columns. Out-of-band / missing values
    return 0.0 — the row still lands so dashboard math doesn't
    get a NULL surprise.
    """
    if not isinstance(value, (int, float)):
        return 0.0
    try:
        rescaled = float(value) / RATING_SCALE
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0
    return max(0.0, min(1.0, rescaled))


def build_commit_kwargs(session: dict[str, Any], rating: dict[str, Any]) -> dict[str, Any] | None:
    """Return the ``kwargs`` for a new ProgressCommit row, or None
    when the session payload is too incomplete to write a row.

    None outcomes happen when ``session_id`` or ``project_id`` is
    missing — those are NOT NULL columns and the row would crash
    the commit. Defensive against a future hookspec rev where the
    session shape gains optional fields.
    """
    project_id = session.get("project_id")
    session_id = session.get("id")
    method = session.get("method")
    if not isinstance(project_id, str) or not project_id:
        return None
    if not isinstance(session_id, str) or not session_id:
        return None
    if not isinstance(method, str) or not method:
        return None

    return {
        "project_id": project_id,
        "session_id": session_id,
        "method": method,
        "understanding": _normalise_rating(rating.get("understanding")),
        "stress": _normalise_rating(rating.get("stress")),
        # error_rate isn't directly captured by the v0.1.0 rating UI.
        # The session plugin computes a per-step approximation in
        # Phase 4; until then, default to 0.0 so the column stays
        # populated.
        "error_rate": 0.0,
        "duration_minutes": _duration_minutes(session.get("started_at"), session.get("ended_at")),
    }
