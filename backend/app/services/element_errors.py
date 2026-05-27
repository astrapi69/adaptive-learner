"""ElementError service — record attempts + mastery detection
(Phase 46B / C5 / P-129).

The service owns the upsert transition matrix for the
``element_errors`` table. Routes (commit C6) delegate to
``record_attempts`` for the bulk-upsert endpoint; the SRS
queue computation (commit C11) reads ``ElementError`` rows
directly via SQLAlchemy.

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

The service is decoupled from the route layer: takes a
``Session`` + plain Python values, returns ORM rows. Tests
can call it directly without HTTP.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ElementError
from app.schemas import ElementAttemptIn

# D4 (Phase 46 plan): 3 consecutive correct = mastered. The
# constant lives here at the service layer (not in a global
# settings module) because the rule is intrinsic to the
# tracking semantics — a different mastery rule would be a
# different SRS algorithm, not a configuration tweak.
MASTERY_THRESHOLD: int = 3


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _find_row(
    db: Session,
    user_id: str,
    attempt: ElementAttemptIn,
) -> ElementError | None:
    """Return the existing element-error row for the
    composite key, or ``None`` if first attempt."""
    stmt = select(ElementError).where(
        ElementError.user_id == user_id,
        ElementError.set_id == attempt.set_id,
        ElementError.lesson_id == attempt.lesson_id,
        ElementError.exercise_id == attempt.exercise_id,
        ElementError.element_key == attempt.element_key,
    )
    return db.execute(stmt).scalar_one_or_none()


def record_attempt(
    db: Session,
    user_id: str,
    attempt: ElementAttemptIn,
) -> ElementError:
    """Upsert one attempt; apply the transition matrix.

    Flushes BUT does not commit — the caller (route layer)
    owns the transaction boundary so a bulk upsert is atomic.
    Returns the post-state row.
    """
    now = _utcnow()
    row = _find_row(db, user_id, attempt)

    if row is None:
        # First time we see this element for this user.
        row = ElementError(
            user_id=user_id,
            set_id=attempt.set_id,
            lesson_id=attempt.lesson_id,
            exercise_id=attempt.exercise_id,
            element_key=attempt.element_key,
            element_type=attempt.element_type,
            user_answer=attempt.user_answer,
            correct_answer=attempt.correct_answer,
            error_count=0 if attempt.correct else 1,
            correct_streak=1 if attempt.correct else 0,
            last_attempt_at=now,
            last_error_at=None if attempt.correct else now,
            mastered=False,
            mastered_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        db.flush()
        return row

    # Existing row — apply the transition matrix.
    row.element_type = attempt.element_type or row.element_type
    row.user_answer = attempt.user_answer
    row.correct_answer = attempt.correct_answer
    row.last_attempt_at = now

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

    db.flush()
    return row


def record_attempts(
    db: Session,
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
    return [record_attempt(db, user_id, a) for a in attempts]


def list_for_user(
    db: Session,
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
    stmt = select(ElementError).where(ElementError.user_id == user_id)
    if set_id is not None:
        stmt = stmt.where(ElementError.set_id == set_id)
    if not include_mastered:
        stmt = stmt.where(ElementError.mastered.is_(False))
    stmt = stmt.order_by(ElementError.updated_at.desc())
    return list(db.execute(stmt).scalars().all())
