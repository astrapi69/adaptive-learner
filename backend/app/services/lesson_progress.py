"""Lesson-progress service (Phase 44 / EXP-002 / P-109).

Per-user × per-lesson upsert + read. The viewer calls
``upsert_step`` every time a step finishes; the lesson-summary
screen calls ``mark_completed`` to flip status + stamp
``completed_at``.

Stores ``step_results`` as a JSON-encoded dict on the
``Text`` column. Reads parse it once on the route layer
boundary; writes merge the new entry into the existing dict
and re-serialise. Aggregate ``score_correct`` / ``score_total``
are recomputed from the merged dict each upsert so the wire
shape always reflects the latest state without a separate
recomputation step.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import LessonProgress, User

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _decode_results(row: LessonProgress) -> dict[str, Any]:
    """Parse the stored JSON map. Empty string / malformed
    JSON returns ``{}`` so a single broken row never breaks
    the page."""
    if not row.step_results:
        return {}
    try:
        parsed = json.loads(row.step_results)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _recompute_score(results: dict[str, Any]) -> tuple[int, int]:
    correct = 0
    total = 0
    for value in results.values():
        if not isinstance(value, dict):
            continue
        c = value.get("correct")
        t = value.get("total")
        if isinstance(c, int) and isinstance(t, int):
            correct += c
            total += t
    return correct, total


def _ensure_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found.")
    return user


def _find_row(
    db: Session,
    user_id: str,
    source: str,
    set_id: str,
    lesson_filename: str,
) -> LessonProgress | None:
    return (
        db.query(LessonProgress)
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.source == source,
            LessonProgress.set_id == set_id,
            LessonProgress.lesson_filename == lesson_filename,
        )
        .one_or_none()
    )


def get_progress(
    db: Session,
    user_id: str,
    source: str,
    set_id: str,
    lesson_filename: str,
) -> dict[str, Any] | None:
    """Read one lesson's progress. Returns the wire shape
    (with ``step_results`` already parsed) or ``None`` when
    no row exists yet — the viewer treats that as 'fresh
    start'."""
    _ensure_user(db, user_id)
    row = _find_row(db, user_id, source, set_id, lesson_filename)
    return _row_to_wire(row) if row else None


def list_progress(
    db: Session,
    user_id: str,
) -> list[dict[str, Any]]:
    """Every progress row for a user. The Set Browser future
    enhancements may surface per-set aggregates; for v1.28.0
    only the lesson viewer reads this."""
    _ensure_user(db, user_id)
    rows = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user_id)
        .order_by(LessonProgress.updated_at.desc())
        .all()
    )
    return [_row_to_wire(row) for row in rows]


def upsert_progress(
    db: Session,
    user_id: str,
    *,
    source: str,
    set_id: str,
    lesson_filename: str,
    step_result: dict[str, Any] | None = None,
    time_spent_seconds_delta: int = 0,
    mark_completed: bool = False,
) -> dict[str, Any]:
    """Merge a step result + optional completion flag into the
    user's progress row. Creates the row on first call."""
    _ensure_user(db, user_id)
    row = _find_row(db, user_id, source, set_id, lesson_filename)
    now = _utcnow()
    if row is None:
        row = LessonProgress(
            user_id=user_id,
            source=source,
            set_id=set_id,
            lesson_filename=lesson_filename,
            status="in_progress",
            step_results="{}",
            score_correct=0,
            score_total=0,
            time_spent_seconds=0,
            started_at=now,
            updated_at=now,
        )
        db.add(row)
        # Flush so the new id is visible if the caller looks it
        # up immediately after.
        db.flush()

    results = _decode_results(row)
    if step_result is not None:
        step_id = step_result["step_id"]
        merged: dict[str, Any] = {
            "correct": int(step_result.get("correct", 0)),
            "total": int(step_result.get("total", 0)),
            "attempts": int(step_result.get("attempts", 1)),
            "completed_at": now.isoformat(),
        }
        # Phase 52C / v1.35.0: optional user_answer field that the
        # lesson-summary diff display reads. Persisted only when the
        # client sent one (free-text + word-tiles) — matching +
        # picture-choice leave it absent.
        user_answer = step_result.get("user_answer")
        if user_answer is not None:
            merged["user_answer"] = str(user_answer)
        results[step_id] = merged
        row.step_results = json.dumps(results, sort_keys=True)
        row.score_correct, row.score_total = _recompute_score(results)

    if time_spent_seconds_delta > 0:
        row.time_spent_seconds = row.time_spent_seconds + time_spent_seconds_delta

    just_completed = False
    if mark_completed and row.status != "completed":
        row.status = "completed"
        row.completed_at = now
        just_completed = True

    row.updated_at = now
    db.commit()
    db.refresh(row)

    if just_completed:
        # v1.31.0 / Phase 46F: write a LearningSession row +
        # fire on_session_complete so the gamification +
        # tracking plugins pick up the lesson the same way
        # they pick up chat sessions. Wrapped so a
        # unification failure cannot mask the lesson-
        # completion success the user already saw.
        try:
            from app.services.lesson_session_unification import (
                record_lesson_completion_session,
            )

            record_lesson_completion_session(
                db,
                user_id=user_id,
                lesson_progress_id=row.id,
                score_correct=row.score_correct,
                score_total=row.score_total,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "lesson_session_unification failed for user=%s "
                "lesson_progress=%s; lesson completion stands",
                user_id,
                row.id,
            )

    return _row_to_wire(row)


def _row_to_wire(row: LessonProgress) -> dict[str, Any]:
    """Translate the DB row into the wire shape Pydantic expects.

    Splits decoding here so the router can pass the dict
    straight into ``LessonProgressOut.model_validate``.
    """
    return {
        "id": row.id,
        "user_id": row.user_id,
        "source": row.source,
        "set_id": row.set_id,
        "lesson_filename": row.lesson_filename,
        "status": row.status,
        "step_results": _decode_results(row),
        "score_correct": row.score_correct,
        "score_total": row.score_total,
        "time_spent_seconds": row.time_spent_seconds,
        "started_at": row.started_at,
        "updated_at": row.updated_at,
        "completed_at": row.completed_at,
    }
