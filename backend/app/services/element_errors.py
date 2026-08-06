"""ElementError service - record attempts + mastery detection
(Phase 46B / C5 / P-129; EXP-024 repository migration).

The service owns the upsert transition matrix for the
``element_errors`` table. Persistence goes through
:class:`ElementErrorsRepository`. Routes (commit C6) delegate to
``record_attempts`` for the bulk-upsert endpoint and own the
transaction boundary (``repo.commit()`` after the batch); the SRS
queue computation (commit C11) reads via ``list_for_user``.

Transition matrix:

    state in       attempt        state out
    -----------------------------------------------------------
    no row         correct=True   correct_streak=1, error_count=0
    no row         correct=False  error_count=1, last_error_at=now
    wrong-only     correct=True   correct_streak=1
    correct-only   correct=True   correct_streak++
    streak >= MASTERY_THRESHOLD-1 + correct  → flip mastered=True
    any            correct=False  correct_streak=0, error_count++,
                                  last_error_at=now
    mastered=True  correct=False  flip mastered=False,
                                  mastered_at=None (re-enter
                                  review queue — pedagogically a
                                  failed master is a forgotten
                                  master)

Mastery threshold is hardcoded to 3 per D4 (Phase 46 plan).
Making this configurable is a documented future-phase change;
no plugin setting yet because nobody asked.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import UTC, datetime

from app.models import ElementError
from app.repositories.element_errors_repo import ElementErrorsRepository
from app.schemas import ElementAttemptIn

# D4 (Phase 46 plan): 3 consecutive correct = mastered. The
# constant lives here at the service layer (not in a global
# settings module) because the rule is intrinsic to the
# tracking semantics — a different mastery rule would be a
# different SRS algorithm, not a configuration tweak.
MASTERY_THRESHOLD: int = 3

# #603 Smart Review Queue — keep the last N attempts per element so the
# UI can show the trajectory without unbounded row growth.
MAX_ATTEMPT_HISTORY: int = 10


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _append_attempt_history(
    existing_json: str | None,
    *,
    correct: bool,
    hint_used: bool,
    now: datetime,
) -> str:
    """Append one attempt to the JSON ring buffer, capped at the last
    ``MAX_ATTEMPT_HISTORY`` entries. Returns the new JSON string."""
    history: list[dict[str, object]] = []
    if existing_json:
        try:
            parsed = json.loads(existing_json)
            if isinstance(parsed, list):
                history = parsed
        except (ValueError, TypeError):
            history = []
    history.append({"correct": correct, "hint_used": hint_used, "at": now.isoformat()})
    return json.dumps(history[-MAX_ATTEMPT_HISTORY:])


def _find_row(
    repo: ElementErrorsRepository,
    user_id: str,
    attempt: ElementAttemptIn,
) -> ElementError | None:
    """Return the existing element-error row for the
    composite key, or ``None`` if first attempt."""
    return repo.find(
        user_id=user_id,
        set_id=attempt.set_id,
        lesson_id=attempt.lesson_id,
        exercise_id=attempt.exercise_id,
        element_key=attempt.element_key,
        direction=attempt.direction,
    )


def record_attempt(
    repo: ElementErrorsRepository,
    user_id: str,
    attempt: ElementAttemptIn,
) -> ElementError:
    """Upsert one attempt; apply the transition matrix.

    Flushes BUT does not commit — the caller (route layer)
    owns the transaction boundary so a bulk upsert is atomic.
    Returns the post-state row.
    """
    now = _utcnow()
    row = _find_row(repo, user_id, attempt)

    if row is None:
        # First time we see this element for this user.
        row = ElementError(
            user_id=user_id,
            set_id=attempt.set_id,
            lesson_id=attempt.lesson_id,
            exercise_id=attempt.exercise_id,
            element_key=attempt.element_key,
            direction=attempt.direction,
            element_type=attempt.element_type,
            user_answer=attempt.user_answer,
            correct_answer=attempt.correct_answer,
            error_count=0 if attempt.correct else 1,
            correct_streak=1 if attempt.correct else 0,
            last_attempt_at=now,
            last_error_at=None if attempt.correct else now,
            mastered=False,
            mastered_at=None,
            # #594 Hint Economy — latest hint flag + lifetime count.
            hint_used=attempt.hint_used,
            hint_used_count=1 if attempt.hint_used else 0,
            # #1040 Exam-Mode SRS boost — only a CORRECT exam answer is
            # stronger evidence; a wrong exam answer must not be delayed.
            last_attempt_exam=attempt.exam and attempt.correct,
            # #603 Smart Review Queue — first attempt + history seed.
            attempt_count=1,
            attempt_history=_append_attempt_history(
                None,
                correct=attempt.correct,
                hint_used=attempt.hint_used,
                now=now,
            ),
            created_at=now,
            updated_at=now,
        )
        repo.add(row)
        repo.flush()
        return row

    # Existing row — apply the transition matrix.
    row.element_type = attempt.element_type or row.element_type
    row.user_answer = attempt.user_answer
    row.correct_answer = attempt.correct_answer
    row.last_attempt_at = now
    # #594 Hint Economy — the latest attempt's hint flag drives the SRS
    # interval; the count accumulates for the statistic.
    row.hint_used = attempt.hint_used
    if attempt.hint_used:
        row.hint_used_count = int(row.hint_used_count) + 1
    # #1040 Exam-Mode SRS boost — the latest attempt drives the flag; only
    # a CORRECT exam answer earns the lengthened interval.
    row.last_attempt_exam = attempt.exam and attempt.correct
    # #603 Smart Review Queue — bump the attempt count + ring buffer.
    row.attempt_count = int(row.attempt_count) + 1
    row.attempt_history = _append_attempt_history(
        row.attempt_history,
        correct=attempt.correct,
        hint_used=attempt.hint_used,
        now=now,
    )

    if attempt.correct:
        row.correct_streak += 1
        # Mastery flip — once correct_streak reaches the
        # threshold, the element is "mastered" for SRS
        # purposes (excluded from the review queue).
        if row.correct_streak >= MASTERY_THRESHOLD and not row.mastered:
            row.mastered = True
            row.mastered_at = now
    else:
        # Pedagogical decision: a wrong answer on a mastered
        # element demotes it back to unmastered. A failed
        # master is a forgotten master; SRS should re-schedule.
        if row.mastered:
            row.mastered = False
            row.mastered_at = None
        row.correct_streak = 0
        row.error_count += 1
        row.last_error_at = now

    repo.flush()
    return row


def record_attempts(
    repo: ElementErrorsRepository,
    user_id: str,
    attempts: list[ElementAttemptIn],
) -> list[ElementError]:
    """Bulk upsert; preserves input order in the return list.

    All attempts share a single transaction — the caller's
    commit lands them atomically (or rolls them all back on
    error). Empty input returns an empty list without touching
    the DB.
    """
    if not attempts:
        return []
    return [record_attempt(repo, user_id, a) for a in attempts]


def remap_element_keys(
    repo: ElementErrorsRepository,
    user_id: str,
    remaps: list[tuple[str, str, str, str, str]],
) -> tuple[int, int]:
    """Apply the one-off ja/ko/zh recovery remaps (#2161) in a single
    transaction: all remaps in this call land together or roll back together
    (all-or-nothing; the caller passes one set's remaps per call). Returns
    ``(applied, skipped)``."""
    if not remaps:
        return (0, 0)
    applied, skipped = repo.remap_element_keys(user_id, remaps)
    repo.commit()
    return (applied, skipped)


def remap_exercise_ids(
    repo: ElementErrorsRepository,
    user_id: str,
    remaps: list[tuple[str, str, str, str]],
) -> tuple[int, int]:
    """Apply the #2130 stable_id key-switch remaps in a single transaction:
    every row of each ``(set_id, lesson_id, old)`` exercise moves to ``new``,
    all-or-nothing per call (the caller passes one set's remaps per call).
    Returns ``(applied, skipped)``."""
    if not remaps:
        return (0, 0)
    applied, skipped = repo.remap_exercise_ids(user_id, remaps)
    repo.commit()
    return (applied, skipped)


def list_for_user(
    repo: ElementErrorsRepository,
    user_id: str,
    *,
    set_id: str | None = None,
    include_mastered: bool = True,
) -> list[ElementError]:
    """Read all element-error rows for a user.

    Used by the debug / list endpoint (commit C6) and as
    the data source for the review-queue computation
    (commit C11; that path passes ``include_mastered=False``
    since mastered elements are excluded from review).
    """
    return repo.list_for_user(user_id, set_id=set_id, include_mastered=include_mastered)


def is_fully_mastered(rows: Iterable[ElementError]) -> bool:
    """EXP-018 / Phase 62: a card is FULLY mastered only when BOTH
    its receptive (``target_to_source``) and productive
    (``source_to_target``) rows exist AND are mastered.

    ``rows`` are the per-direction ElementError rows for ONE element
    (same set / lesson / exercise / element_key, differing
    ``direction``). A card that has only ever been drilled
    receptively is NOT fully mastered — production was never
    demonstrated. This is why the dashboard reports the receptive
    and productive mastery counts separately.
    """
    by_direction = {row.direction: row for row in rows}
    receptive = by_direction.get("target_to_source")
    productive = by_direction.get("source_to_target")
    return bool(
        receptive is not None
        and receptive.mastered
        and productive is not None
        and productive.mastered
    )
