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
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.exceptions import NotFoundError, ValidationError
from app.models import LessonProgress, User
from app.repositories.lesson_progress_repo import LessonProgressRepository
from app.repositories.lesson_session_unification_repo import (
    LessonSessionUnificationRepository,
)

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


def _ensure_user(repo: LessonProgressRepository, user_id: str) -> User:
    user = repo.get_user(user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found.")
    return user


def _find_row(
    repo: LessonProgressRepository,
    user_id: str,
    source: str,
    set_id: str,
    lesson_filename: str,
) -> LessonProgress | None:
    return repo.find(
        user_id=user_id,
        source=source,
        set_id=set_id,
        lesson_filename=lesson_filename,
    )


def get_progress(
    repo: LessonProgressRepository,
    user_id: str,
    source: str,
    set_id: str,
    lesson_filename: str,
) -> dict[str, Any] | None:
    """Read one lesson's progress. Returns the wire shape
    (with ``step_results`` already parsed) or ``None`` when
    no row exists yet — the viewer treats that as 'fresh
    start'."""
    _ensure_user(repo, user_id)
    row = _find_row(repo, user_id, source, set_id, lesson_filename)
    return _row_to_wire(row) if row else None


def list_progress(
    repo: LessonProgressRepository,
    user_id: str,
) -> list[dict[str, Any]]:
    """Every progress row for a user. The Set Browser future
    enhancements may surface per-set aggregates; for v1.28.0
    only the lesson viewer reads this."""
    _ensure_user(repo, user_id)
    rows = repo.list_for_user(user_id)
    return [_row_to_wire(row) for row in rows]


@dataclass(frozen=True)
class ProgressUpdate:
    """The 'what to write' for :func:`upsert_progress`.

    Bundles the lesson-row identity (``source`` / ``set_id`` /
    ``lesson_filename``) with the mutation intent: an optional
    ``step_result``, a time delta, the live ``current_step``, and at
    most one lifecycle flag. Replaces a 14-argument call site with a
    single cohesive context object (coding-standards.md "Data between
    functions").
    """

    source: str
    set_id: str
    lesson_filename: str
    step_result: dict[str, Any] | None = None
    time_spent_seconds_delta: int = 0
    current_step: int | None = None
    mark_completed: bool = False
    mark_paused: bool = False
    mark_abandoned: bool = False
    mark_resumed: bool = False
    mark_restarted: bool = False


def upsert_progress(
    repo: LessonProgressRepository,
    unification_repo: LessonSessionUnificationRepository,
    user_id: str,
    update: ProgressUpdate,
) -> dict[str, Any]:
    """Merge a step result + optional lifecycle flag into the
    user's progress row. Creates the row on first call.

    Lifecycle flags (Phase 63A/C):

    - ``mark_paused`` flips ``status`` to ``paused`` and stamps
      ``paused_at``. ``step_results`` stay intact for the resume.
    - ``mark_abandoned`` flips ``status`` to ``abandoned``,
      stamps ``abandoned_at``, and clears ``step_results``
      (ElementErrors from completed steps stay in their own
      table — what was learned stays learned).
    - ``mark_resumed`` flips a ``paused`` row back to
      ``in_progress`` and clears ``paused_at``.
    - ``mark_restarted`` (Phase 63C) clears ``step_results`` and
      resets ``status`` to ``in_progress`` from any prior state.
      Used by the resume-dialog "Start Over" path.

    At most one of the five ``mark_*`` flags may be true per
    call; a ``ValidationError`` is raised otherwise.
    """
    _validate_single_lifecycle_flag(update)
    _ensure_user(repo, user_id)
    now = _utcnow()
    row = _get_or_create_row(repo, user_id, update, now)

    if update.step_result is not None:
        _apply_step_result(row, update.step_result, now)

    if update.time_spent_seconds_delta > 0:
        row.time_spent_seconds = row.time_spent_seconds + update.time_spent_seconds_delta

    # Track the live navigation position so a paused lesson resumes where the
    # user left off. Persisted on every autosave / step / pause; clamped to >= 0.
    if update.current_step is not None:
        row.current_step = max(0, update.current_step)

    just_completed = _apply_lifecycle_flags(row, update, now)

    row.updated_at = now
    repo.commit()
    repo.refresh(row)

    if just_completed:
        _record_completion_unification(unification_repo, user_id, row)

    return _row_to_wire(row)


def _validate_single_lifecycle_flag(update: ProgressUpdate) -> None:
    """Reject more than one ``mark_*`` lifecycle flag set per call."""
    flag_count = sum(
        1
        for f in (
            update.mark_completed,
            update.mark_paused,
            update.mark_abandoned,
            update.mark_resumed,
            update.mark_restarted,
        )
        if f
    )
    if flag_count > 1:
        raise ValidationError(
            "At most one of mark_completed / mark_paused / "
            "mark_abandoned / mark_resumed / mark_restarted "
            "may be true per call."
        )


def _get_or_create_row(
    repo: LessonProgressRepository,
    user_id: str,
    update: ProgressUpdate,
    now: datetime,
) -> LessonProgress:
    """Find the user's progress row for this lesson, creating it on first call."""
    row = _find_row(repo, user_id, update.source, update.set_id, update.lesson_filename)
    if row is not None:
        return row
    row = LessonProgress(
        user_id=user_id,
        source=update.source,
        set_id=update.set_id,
        lesson_filename=update.lesson_filename,
        status="in_progress",
        step_results="{}",
        score_correct=0,
        score_total=0,
        time_spent_seconds=0,
        started_at=now,
        updated_at=now,
    )
    repo.add(row)
    # Flush so the new id is visible if the caller looks it up immediately after.
    repo.flush()
    return row


def _apply_step_result(row: LessonProgress, step_result: dict[str, Any], now: datetime) -> None:
    """Merge one graded step result into the row's step_results + recompute score."""
    merged: dict[str, Any] = {
        "correct": int(step_result.get("correct", 0)),
        "total": int(step_result.get("total", 0)),
        "attempts": int(step_result.get("attempts", 1)),
        "completed_at": now.isoformat(),
    }
    # Phase 52C / v1.35.0: optional user_answer field that the lesson-summary
    # diff display reads. Persisted only when the client sent one (free-text +
    # word-tiles) — matching + picture-choice leave it absent.
    user_answer = step_result.get("user_answer")
    if user_answer is not None:
        merged["user_answer"] = str(user_answer)
    # The raw answer (a type-discriminated dict) is persisted verbatim so a
    # revisited step re-renders its exact locked visual. Stored only when the
    # client sent one (every freshly-graded step does).
    raw_answer = step_result.get("raw_answer")
    if isinstance(raw_answer, dict):
        merged["raw_answer"] = raw_answer
    results = _decode_results(row)
    results[step_result["step_id"]] = merged
    row.step_results = json.dumps(results, sort_keys=True)
    row.score_correct, row.score_total = _recompute_score(results)


def _apply_lifecycle_flags(row: LessonProgress, update: ProgressUpdate, now: datetime) -> bool:
    """Apply the at-most-one ``mark_*`` transition. Returns whether the row just
    completed (so the caller fires the session-unification hook)."""
    just_completed = False
    if update.mark_completed and row.status != "completed":
        row.status = "completed"
        row.completed_at = now
        # A completion clears any pending pause/abandon stamps so the row's
        # terminal state is unambiguous.
        row.paused_at = None
        row.abandoned_at = None
        just_completed = True

    # Phase 63A — pause / abandon / resume transitions.
    if update.mark_paused and row.status not in ("paused", "completed", "abandoned"):
        row.status = "paused"
        row.paused_at = now
    elif update.mark_abandoned and row.status != "abandoned":
        row.status = "abandoned"
        row.abandoned_at = now
        row.paused_at = None
        # Discard the in-flight attempt. ElementErrors are kept because they
        # live in a separate table — what was learned stays learned.
        row.step_results = "{}"
        row.score_correct = 0
        row.score_total = 0
        row.current_step = 0
    elif update.mark_resumed and row.status == "paused":
        row.status = "in_progress"
        row.paused_at = None
    elif update.mark_restarted:
        # Phase 63C — "Start Over" from the resume dialog. Unconditional reset
        # regardless of prior status.
        row.status = "in_progress"
        row.step_results = "{}"
        row.score_correct = 0
        row.score_total = 0
        row.current_step = 0
        row.paused_at = None
        row.abandoned_at = None
    return just_completed


def _record_completion_unification(
    unification_repo: LessonSessionUnificationRepository,
    user_id: str,
    row: LessonProgress,
) -> None:
    """Fire the lesson -> LearningSession unification hook (v1.31.0 / Phase 46F).

    Writes a LearningSession row + fires on_session_complete so the
    gamification + tracking plugins pick up the lesson the same way they pick
    up chat sessions. Wrapped so a unification failure cannot mask the
    lesson-completion success the user already saw.
    """
    try:
        from app.services.lesson_session_unification import (
            record_lesson_completion_session,
        )

        record_lesson_completion_session(
            unification_repo,
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
        "current_step": row.current_step,
        "started_at": row.started_at,
        "updated_at": row.updated_at,
        "completed_at": row.completed_at,
        "paused_at": row.paused_at,
        "abandoned_at": row.abandoned_at,
    }
