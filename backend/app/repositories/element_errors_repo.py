"""Repository for the ElementError aggregate (Phase 46B/C; EXP-024 Phase 1).

Owns the persistence primitives for per-element error tracking. The
upsert transition matrix and mastery rules live in
``app.services.element_errors``; this layer only finds, inserts, and
lists rows, plus the explicit transaction controls the bulk-upsert
route relies on (the service flushes per attempt; the caller commits
the batch atomically).
"""

from __future__ import annotations

from abc import abstractmethod
from datetime import UTC, datetime

from sqlalchemy import ColumnElement, select
from sqlalchemy.orm import Session

from app.models import ElementError, SetRun, User
from app.repositories.base import Repository


def _active_run_only() -> ColumnElement[bool]:
    """SQL predicate that keeps only the rows of each set's ACTIVE run
    (EXP-051 / #2125).

    A row is active when NO *open* ``SetRun`` (``closed_at IS NULL``)
    exists for its set under a DIFFERENT ``run_id``. This is
    backward-compatible without a backfill: a set with no ``set_runs``
    row at all (a pre-EXP-051 user, all rows ``run_id = 1``) has no open
    run, so every row is kept; and a cold-started new run (open run N,
    rows still under N-1) correctly drops the N-1 rows from the active
    scope.
    """
    open_other_run = (
        select(SetRun.id)
        .where(
            SetRun.user_id == ElementError.user_id,
            SetRun.set_id == ElementError.set_id,
            SetRun.closed_at.is_(None),
            SetRun.run_id != ElementError.run_id,
        )
        .exists()
    )
    return ~open_other_run


class ElementErrorsRepository(Repository):
    """Persistence contract for element-error rows."""

    @abstractmethod
    def get_user(self, user_id: str) -> User | None:
        """Return the user row, or ``None`` when it does not exist."""

    @abstractmethod
    def find(
        self,
        *,
        user_id: str,
        set_id: str,
        lesson_id: str,
        exercise_id: str,
        element_key: str,
        direction: str,
        run_id: int,
    ) -> ElementError | None:
        """Return the row for the composite key (incl. ``run_id``), or ``None``."""

    @abstractmethod
    def add(self, row: ElementError) -> None:
        """Stage a new row for insertion (no flush/commit)."""

    @abstractmethod
    def flush(self) -> None:
        """Flush pending changes so generated ids/state are visible."""

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction (the bulk-upsert boundary)."""

    @abstractmethod
    def list_for_user(
        self,
        user_id: str,
        *,
        set_id: str | None = None,
        include_mastered: bool = True,
        include_retired: bool = False,
        run_id: int | None = None,
    ) -> list[ElementError]:
        """Return the user's rows, newest-updated first.

        Archived rows (#2188 ``retired_at`` set) are excluded by default so
        they leave review scheduling and due counts everywhere; pass
        ``include_retired=True`` for archive views.

        ``run_id`` (EXP-051 / #2125) selects the Durchgang:

        - ``None`` (default) -> only the ACTIVE run of each set. This is
          the review-queue / current-state scope; a closed run's rows are
          never returned. Backward-compatible (a set with no ``set_runs``
          row yields all its ``run_id = 1`` rows).
        - an ``int`` -> exactly that run, including a closed one. The
          Fehlerhistorie reads a specific past run this way.
        """

    @abstractmethod
    def archive_retired(self, user_id: str, set_id: str, retired_ids: list[str]) -> int:
        """#2188: stamp ``retired_at`` on the user's active rows of ``set_id``
        whose ``exercise_id`` is in ``retired_ids``. Already-archived rows are
        left untouched (idempotent). Does not commit — the caller owns the
        transaction boundary. Returns the number of rows archived."""

    @abstractmethod
    def delete_by_set_ids(self, user_id: str, set_ids: list[str]) -> int:
        """Delete the user's rows for the given set ids; return the count (#1821)."""

    @abstractmethod
    def delete_by_lessons(self, user_id: str, lessons: list[tuple[str, str]]) -> int:
        """Delete the user's rows for the given ``(set_id, lesson_id)`` pairs.

        Lesson-scoped delete (#2064): a sibling lesson of the same set keeps its
        rows. Returns the count deleted.
        """

    @abstractmethod
    def remap_element_keys(
        self,
        user_id: str,
        remaps: list[tuple[str, str, str, str, str]],
    ) -> tuple[int, int]:
        """One-off recovery re-key (#2161): rewrite ``element_key`` from ``old``
        to ``new`` for matching rows.

        Each ``remap`` is ``(set_id, lesson_id, exercise_id, old, new)`` and is
        applied across BOTH drill directions. A remap is SKIPPED when a target
        row (same composite key incl. direction, with ``new``) already exists,
        so no two rows collapse onto one card (no double-map) and a second run
        is a no-op (idempotent). Does not commit — the caller owns the
        transaction boundary (all-or-nothing per call). Returns
        ``(applied, skipped)``.
        """

    @abstractmethod
    def remap_exercise_ids(
        self,
        user_id: str,
        remaps: list[tuple[str, str, str, str]],
    ) -> tuple[int, int]:
        """#2130 stable_id key switch: rewrite ``exercise_id`` from ``old`` to
        ``new`` for EVERY row of the exercise (all element_keys, both drill
        directions).

        Each ``remap`` is ``(set_id, lesson_id, old, new)``. A row is SKIPPED
        when a target row (same element_key + direction under ``new``) already
        exists, so no two rows collapse onto one identity and a second run is
        a no-op (idempotent). Does not commit — the caller owns the
        transaction boundary. Returns ``(applied, skipped)``.
        """


class SqlAlchemyElementErrorsRepository(ElementErrorsRepository):
    """SQLAlchemy-backed :class:`ElementErrorsRepository`."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user(self, user_id: str) -> User | None:
        """Return the user row by primary key, or ``None`` if absent."""
        return self._db.get(User, user_id)

    def find(
        self,
        *,
        user_id: str,
        set_id: str,
        lesson_id: str,
        exercise_id: str,
        element_key: str,
        direction: str,
        run_id: int,
    ) -> ElementError | None:
        """Return the row matching the full composite key (including direction
        and ``run_id``), or ``None``.

        Receptive and productive rows for the same card are distinct
        identities (EXP-018 / Phase 62); the direction is part of the key.
        A row of a different run (EXP-051 / #2125) is a distinct identity
        too — the same card in run 2 never collapses onto its run-1 row.
        """
        stmt = select(ElementError).where(
            ElementError.user_id == user_id,
            ElementError.set_id == set_id,
            ElementError.lesson_id == lesson_id,
            ElementError.exercise_id == exercise_id,
            ElementError.element_key == element_key,
            # EXP-018 / Phase 62: a card's receptive and productive
            # rows are distinct identities; never collapse them.
            ElementError.direction == direction,
            # EXP-051 / #2125: the run generation is part of the identity.
            ElementError.run_id == run_id,
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def add(self, row: ElementError) -> None:
        """Stage a new element-error row for insertion (no flush/commit)."""
        self._db.add(row)

    def flush(self) -> None:
        """Flush pending changes so generated ids/state become visible."""
        self._db.flush()

    def commit(self) -> None:
        """Commit the current transaction (the bulk-upsert boundary)."""
        self._db.commit()

    def list_for_user(
        self,
        user_id: str,
        *,
        set_id: str | None = None,
        include_mastered: bool = True,
        include_retired: bool = False,
        run_id: int | None = None,
    ) -> list[ElementError]:
        """Return the user's rows newest-updated first.

        Optionally narrow to a single ``set_id``, exclude mastered rows when
        ``include_mastered`` is ``False``, and include archived (#2188
        retired) rows when ``include_retired`` is ``True``.

        ``run_id`` selects the Durchgang (EXP-051 / #2125): ``None`` scopes
        to each set's active run (the default, review-queue scope); an
        ``int`` targets exactly that run for the Fehlerhistorie.
        """
        stmt = select(ElementError).where(ElementError.user_id == user_id)
        if set_id is not None:
            stmt = stmt.where(ElementError.set_id == set_id)
        if not include_mastered:
            stmt = stmt.where(ElementError.mastered.is_(False))
        if not include_retired:
            stmt = stmt.where(ElementError.retired_at.is_(None))
        if run_id is None:
            stmt = stmt.where(_active_run_only())
        else:
            stmt = stmt.where(ElementError.run_id == run_id)
        stmt = stmt.order_by(ElementError.updated_at.desc())
        return list(self._db.execute(stmt).scalars().all())

    def archive_retired(self, user_id: str, set_id: str, retired_ids: list[str]) -> int:
        """See the abstract contract. In-place ``retired_at`` stamp on the
        active rows of the retired identities; a second run finds none."""
        if not retired_ids:
            return 0
        rows = list(
            self._db.execute(
                select(ElementError).where(
                    ElementError.user_id == user_id,
                    ElementError.set_id == set_id,
                    ElementError.exercise_id.in_(retired_ids),
                    ElementError.retired_at.is_(None),
                    # EXP-051 / #2125: only the active run is archived; a
                    # closed run's rows are already frozen and never touched.
                    _active_run_only(),
                )
            )
            .scalars()
            .all()
        )
        now = datetime.now(UTC)
        for row in rows:
            row.retired_at = now
        return len(rows)

    def delete_by_set_ids(self, user_id: str, set_ids: list[str]) -> int:
        """Delete the user's rows for the given set ids; return the count (#1821)."""
        if not set_ids:
            return 0
        deleted = (
            self._db.query(ElementError)
            .filter(
                ElementError.user_id == user_id,
                ElementError.set_id.in_(set_ids),
            )
            .delete(synchronize_session=False)
        )
        return int(deleted)

    def delete_by_lessons(self, user_id: str, lessons: list[tuple[str, str]]) -> int:
        """Delete the user's rows for the given ``(set_id, lesson_id)`` pairs (#2064)."""
        if not lessons:
            return 0
        deleted = 0
        for set_id, lesson_id in lessons:
            deleted += (
                self._db.query(ElementError)
                .filter(
                    ElementError.user_id == user_id,
                    ElementError.set_id == set_id,
                    ElementError.lesson_id == lesson_id,
                )
                .delete(synchronize_session=False)
            )
        return int(deleted)

    def remap_element_keys(
        self,
        user_id: str,
        remaps: list[tuple[str, str, str, str, str]],
    ) -> tuple[int, int]:
        """See the abstract contract. In-place ``element_key`` rewrite (the
        row ``id`` is a stable uuid, so the identity survives); the UNIQUE
        (user, set, lesson, exercise, element_key, direction) constraint is
        respected because a pre-existing target is skipped, never overwritten."""
        applied = skipped = 0
        for set_id, lesson_id, exercise_id, old_key, new_key in remaps:
            rows = list(
                self._db.execute(
                    select(ElementError).where(
                        ElementError.user_id == user_id,
                        ElementError.set_id == set_id,
                        ElementError.lesson_id == lesson_id,
                        ElementError.exercise_id == exercise_id,
                        ElementError.element_key == old_key,
                    )
                )
                .scalars()
                .all()
            )
            for row in rows:
                target = self.find(
                    user_id=user_id,
                    set_id=set_id,
                    lesson_id=lesson_id,
                    exercise_id=exercise_id,
                    element_key=new_key,
                    direction=row.direction,
                    run_id=row.run_id,
                )
                if target is not None:
                    skipped += 1
                    continue
                row.element_key = new_key
                applied += 1
        return applied, skipped

    def remap_exercise_ids(
        self,
        user_id: str,
        remaps: list[tuple[str, str, str, str]],
    ) -> tuple[int, int]:
        """See the abstract contract. In-place ``exercise_id`` rewrite (the
        row ``id`` is a stable uuid, so the identity survives); the UNIQUE
        (user, set, lesson, exercise, element_key, direction) constraint is
        respected because a pre-existing target is skipped, never
        overwritten."""
        applied = skipped = 0
        for set_id, lesson_id, old_id, new_id in remaps:
            rows = list(
                self._db.execute(
                    select(ElementError).where(
                        ElementError.user_id == user_id,
                        ElementError.set_id == set_id,
                        ElementError.lesson_id == lesson_id,
                        ElementError.exercise_id == old_id,
                    )
                )
                .scalars()
                .all()
            )
            for row in rows:
                target = self.find(
                    user_id=user_id,
                    set_id=set_id,
                    lesson_id=lesson_id,
                    exercise_id=new_id,
                    element_key=row.element_key,
                    direction=row.direction,
                    run_id=row.run_id,
                )
                if target is not None:
                    skipped += 1
                    continue
                row.exercise_id = new_id
                applied += 1
        return applied, skipped


__all__ = ["ElementErrorsRepository", "SqlAlchemyElementErrorsRepository"]
