"""Cross-device sync service (Phase 13A).

Implements the protocol the ``routers/sync.py`` endpoints expose.
Two record classes:

- **Append-only** (LearningSession, SessionMessage, SessionRating,
  ProgressCommit, MethodSwitch, StepEvaluation, SessionNote):
  history rows that, once written, never change. Sync is
  idempotent — insert if the UUID is unknown, skip otherwise. No
  conflicts possible.

- **Mutable** (User, UserSettings, LearningProject, LearningProfile,
  Curriculum, LearningTopic, Lesson): rows the user edits over
  time. Sync compares ``updated_at`` vs the client's
  ``since`` timestamp:
    * Local untouched since ``since`` → accept remote.
    * Local updated since ``since`` AND remote also updated → CONFLICT.
      The conflict bundle goes back to the client for resolution.

v1.8.0 / Phase 21D — ImportedConversation + ImportedMessage are
now in the sync surface. Both are classified APPEND-ONLY (the
``analysis_result`` blob and ``analyzed`` flag are NOT updated
post-sync; each device runs its own analysis). The Pydantic
schema serialises ``analysis_result`` to/from JSON text at the
storage boundary; the wire shape stays a dict.

Identity model: the pairing flow has already aligned the
``user_id`` on both devices. Every sync call carries the same
``user_id`` and we scope every query to it so a multi-tenant
backend (future) doesn't leak rows.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models import (
    AnkiCardSuggestion,
    Badge,
    Curriculum,
    ElementError,
    ImportedConversation,
    ImportedMessage,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    LessonProgress,
    MethodSwitch,
    ProgressCommit,
    ProjectSubject,
    ProjectTag,
    SessionMessage,
    SessionNote,
    SessionRating,
    StepEvaluation,
    StudyQuestion,
    Subject,
    Tag,
    User,
    UserBadge,
    UserSettings,
    UserStreak,
    UserXP,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Table classification
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TableSpec:
    """Per-table sync metadata.

    ``order`` controls the apply order during push: parents before
    children, so a project's profile/topics/lessons land after the
    project itself. Lower numbers go first.

    ``scope`` says how to filter rows by user identity:
      - ``"self"``: the row IS the user (only ``users`` table).
      - ``"direct"``: row has a ``user_id`` column we can filter on.
      - ``"via_curriculum"``: row scopes through a Curriculum.
      - ``"via_session"``: row scopes through a LearningSession ->
        LearningProject -> user.
      - ``"via_project"``: row scopes through a LearningProject -> user.
    """

    model: type[Any]
    columns: tuple[str, ...]
    timestamp_field: str
    append_only: bool
    order: int
    scope: str = "direct"


# Common timestamp fields per table. Append-only tables use their
# "created" timestamp (started_at / committed_at / etc.) because
# they have no ``updated_at``. Mutable tables use ``updated_at``.

TABLES: dict[str, TableSpec] = {
    # Mutable, root-first.
    "users": TableSpec(
        model=User,
        columns=("id", "name", "email", "language", "created_at", "updated_at"),
        timestamp_field="updated_at",
        append_only=False,
        order=0,
        scope="self",  # the row IS the user
    ),
    "user_settings": TableSpec(
        model=UserSettings,
        columns=(
            "id",
            "user_id",
            "active_provider",
            "api_key_anthropic",
            "api_key_openai",
            "api_key_gemini",
            "model_override_anthropic",
            "model_override_openai",
            "model_override_gemini",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=1,
    ),
    "learning_projects": TableSpec(
        model=LearningProject,
        columns=(
            "id",
            "user_id",
            "topic",
            "goal",
            "timeframe",
            "daily_minutes",
            "current_problem",
            "active",
            # v1.31.0 / Phase 46F: "standard" vs "content"
            # pseudo-project; round-trips through sync so
            # both ApiStorage and DexieStorage classify rows
            # the same way.
            "kind",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=2,
    ),
    "learning_profiles": TableSpec(
        model=LearningProfile,
        columns=(
            "id",
            "user_id",
            "project_id",
            "deductive",
            "inductive",
            "error_based",
            "dialogic",
            "contextual",
            "ai_adaptive",
            "assessed_at",
            "version",
        ),
        timestamp_field="assessed_at",
        append_only=False,
        order=3,
    ),
    "curriculums": TableSpec(
        model=Curriculum,
        columns=(
            "id",
            "user_id",
            "title",
            "description",
            "language",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=4,
    ),
    "learning_topics": TableSpec(
        model=LearningTopic,
        columns=(
            "id",
            "curriculum_id",
            "parent_id",
            "title",
            "description",
            "order_index",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=5,
        scope="via_curriculum",
    ),
    "lessons": TableSpec(
        model=Lesson,
        columns=(
            "id",
            "curriculum_id",
            "title",
            "content",
            "order_index",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=6,
        scope="via_curriculum",
    ),
    # Append-only, child rows last.
    "learning_sessions": TableSpec(
        model=LearningSession,
        columns=(
            "id",
            "project_id",
            "method",
            "started_at",
            "ended_at",
            "cycle_step",
            "status",
        ),
        timestamp_field="started_at",
        append_only=True,
        order=10,
        scope="via_project",
    ),
    "session_messages": TableSpec(
        model=SessionMessage,
        columns=("id", "session_id", "role", "content", "created_at"),
        timestamp_field="created_at",
        append_only=True,
        order=11,
        scope="via_session",
    ),
    "session_ratings": TableSpec(
        model=SessionRating,
        columns=(
            "id",
            "session_id",
            "understanding",
            "stress",
            "method_fit",
            "notes",
            "created_at",
        ),
        timestamp_field="created_at",
        append_only=True,
        order=12,
        scope="via_session",
    ),
    "session_notes": TableSpec(
        model=SessionNote,
        columns=("id", "session_id", "content", "created_at", "updated_at"),
        # v1.8.0 / Phase 21B — promoted to mutable. Notes are
        # editable in the UI; the sync layer needs ``updated_at``
        # so push/pull conflicts can be resolved by timestamp.
        timestamp_field="updated_at",
        append_only=False,
        order=13,
        scope="via_session",
    ),
    "progress_commits": TableSpec(
        model=ProgressCommit,
        columns=(
            "id",
            "project_id",
            "session_id",
            "method",
            "understanding",
            "stress",
            "error_rate",
            "duration_minutes",
            "committed_at",
        ),
        timestamp_field="committed_at",
        append_only=True,
        order=14,
        scope="via_project",
    ),
    "method_switches": TableSpec(
        model=MethodSwitch,
        columns=(
            "id",
            "project_id",
            "from_method",
            "to_method",
            "reason",
            "switched_at",
        ),
        timestamp_field="switched_at",
        append_only=True,
        order=15,
        scope="via_project",
    ),
    "step_evaluations": TableSpec(
        model=StepEvaluation,
        columns=(
            "id",
            "session_id",
            "from_step",
            "to_step",
            "advance",
            "confidence",
            "applied",
            "fallback_used",
            "reason",
            "evaluated_at",
        ),
        timestamp_field="evaluated_at",
        append_only=True,
        order=16,
        scope="via_session",
    ),
    # v1.8.0 / Phase 21D — imported conversations and their
    # transcript messages join the sync surface. Both are
    # APPEND-ONLY: ``analysis_result`` and ``analyzed`` are NOT
    # synced after the row's initial push so each device runs
    # its own analysis (the spec's intentional trade-off; the
    # heavy AI call shouldn't ride the wire).
    "imported_conversations": TableSpec(
        model=ImportedConversation,
        columns=(
            "id",
            "user_id",
            "project_id",
            "source",
            "title",
            "message_count",
            "imported_at",
            "analyzed",
            "analysis_result",
            "topic_tag",
            "model",
            "source_created_at",
        ),
        timestamp_field="imported_at",
        append_only=True,
        order=17,
        scope="direct",
    ),
    "imported_messages": TableSpec(
        model=ImportedMessage,
        columns=(
            "id",
            "conversation_id",
            "role",
            "content",
            "timestamp",
            "order_index",
            "created_at",
        ),
        timestamp_field="created_at",
        append_only=True,
        order=18,
        # Scoped via the parent ImportedConversation -> user.
        # The existing scope helpers handle ``via_session`` /
        # ``via_project`` / ``via_curriculum``; ``via_imported_conversation``
        # is the new scope; the user-filter helper below adds
        # the corresponding JOIN.
        scope="via_imported_conversation",
    ),
    # v1.9.0 / Phase 22A — Subjects + Tags taxonomy joins the sync
    # surface. Subjects are GLOBAL (no user scope): every device's
    # subject tree converges on the same taxonomy. Tags are
    # per-user (direct ``user_id`` scope). Both classifications
    # are MUTABLE (the user can rename / re-parent / change
    # colour). Association rows are APPEND-ONLY (assigning or
    # unassigning is an insert/delete, never an update); they
    # scope via the parent project.
    "subjects": TableSpec(
        model=Subject,
        columns=(
            "id",
            "parent_id",
            "name",
            "description",
            "icon",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=19,
        scope="global",
    ),
    "tags": TableSpec(
        model=Tag,
        columns=("id", "user_id", "name", "color", "created_at"),
        timestamp_field="created_at",
        append_only=False,
        order=20,
        scope="direct",
    ),
    "project_subjects": TableSpec(
        model=ProjectSubject,
        columns=("id", "project_id", "subject_id", "created_at"),
        timestamp_field="created_at",
        append_only=True,
        order=21,
        scope="via_project",
    ),
    "project_tags": TableSpec(
        model=ProjectTag,
        columns=("id", "project_id", "tag_id", "created_at"),
        timestamp_field="created_at",
        append_only=True,
        order=22,
        scope="via_project",
    ),
    # v1.16.0 / Phase 29A — per-user XP and level singleton.
    # One row per user (unique ``user_id``); MUTABLE because the
    # XP counter advances on every session-end / assessment /
    # import. Conflict resolution by ``updated_at`` timestamp
    # picks the device that accumulated more recently.
    "user_xp": TableSpec(
        model=UserXP,
        columns=("id", "user_id", "total_xp", "level", "updated_at"),
        timestamp_field="updated_at",
        append_only=False,
        order=23,
        scope="direct",
    ),
    # v1.16.0 / Phase 29B — badge catalog. MUTABLE (icon, name_key,
    # description_key, category can shift between releases); the
    # seed YAML is the source of truth so post-sync the receiving
    # device re-syncs from its own seed AND the wire shape, with
    # the wire winning if the timestamp is newer.
    "badges": TableSpec(
        model=Badge,
        columns=(
            "id",
            "key",
            "name_key",
            "description_key",
            "icon",
            "category",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=24,
        scope="global",
    ),
    # v1.16.0 / Phase 29B — earned-badge record. APPEND-ONLY:
    # earning a badge is an insert; un-earning is not a supported
    # operation. Unique on (user_id, badge_id).
    "user_badges": TableSpec(
        model=UserBadge,
        columns=("id", "user_id", "badge_id", "earned_at"),
        timestamp_field="earned_at",
        append_only=True,
        order=25,
        scope="direct",
    ),
    # v1.17.0 / Phase 30B — AI-extracted flashcard candidates.
    # MUTABLE: the user accepts / edits / rejects in-place.
    # Direct user_id scope (cards belong to the learner who
    # generated them).
    "anki_card_suggestions": TableSpec(
        model=AnkiCardSuggestion,
        columns=(
            "id",
            "user_id",
            "session_id",
            "conversation_id",
            "project_id",
            "card_type",
            "front",
            "back",
            "tags",
            "accepted",
            "rejected",
            "exported_at",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=27,
        scope="direct",
    ),
    # v1.19.0 / Phase 32B — AI-generated active-recall questions.
    # MUTABLE: the user edits / deletes in-place. Direct user_id
    # scope (questions belong to the learner who generated them).
    "study_questions": TableSpec(
        model=StudyQuestion,
        columns=(
            "id",
            "user_id",
            "project_id",
            "session_id",
            "question",
            "expected_answer",
            "question_type",
            "difficulty",
            "topic",
            "edited",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=28,
        scope="direct",
    ),
    # v1.16.0 / Phase 29C — per-user streak state singleton.
    # MUTABLE: freezes earned/used and weekend-mode flag change
    # over time. Conflict resolution by ``updated_at``.
    "user_streaks": TableSpec(
        model=UserStreak,
        columns=(
            "id",
            "user_id",
            "freezes_available",
            "last_freeze_earned_on",
            "last_freeze_used_on",
            "weekend_mode",
            "current_streak_days",
            "longest_streak_days",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=26,
        scope="direct",
    ),
    # v1.28.0 / Phase 44 — content-loader lesson progress.
    # MUTABLE: every step completion bumps the score and the
    # ``step_results`` JSON map; the lesson-summary screen
    # flips ``status`` to ``completed``. Direct user_id scope
    # so multi-device syncs converge on the user's progress
    # row per lesson.
    "lesson_progress": TableSpec(
        model=LessonProgress,
        columns=(
            "id",
            "user_id",
            "source",
            "set_id",
            "lesson_filename",
            "status",
            "step_results",
            "score_correct",
            "score_total",
            "time_spent_seconds",
            "started_at",
            "updated_at",
            "completed_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=29,
        scope="direct",
    ),
    # v1.30.0 / Phase 46B / P-129 — element-level error
    # tracking. MUTABLE: every attempt upserts the matching
    # row (correct_streak / error_count / last_*_at /
    # mastered flip). Direct user_id scope; multi-device
    # syncs converge on the same row per element.
    "element_errors": TableSpec(
        model=ElementError,
        columns=(
            "id",
            "user_id",
            "set_id",
            "lesson_id",
            "exercise_id",
            "element_key",
            "element_type",
            "user_answer",
            "correct_answer",
            "error_count",
            "correct_streak",
            "last_error_at",
            "last_attempt_at",
            "mastered",
            "mastered_at",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=30,
        scope="direct",
    ),
}

APPEND_ONLY_TABLES = {name for name, spec in TABLES.items() if spec.append_only}
MUTABLE_TABLES = {name for name, spec in TABLES.items() if not spec.append_only}
ALL_SYNC_TABLES = tuple(TABLES.keys())


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _from_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def serialize_row(table: str, row: Any) -> dict[str, Any]:
    """Project an ORM row to a plain JSON dict.

    Datetime fields land as ISO 8601 strings. Booleans / strings /
    numbers pass through. We never include columns outside the
    table's declared ``columns`` tuple — that keeps any future
    sensitive column (e.g. an encrypted blob) from accidentally
    flowing across the sync wire.
    """
    spec = TABLES[table]
    out: dict[str, Any] = {}
    for col in spec.columns:
        value = getattr(row, col, None)
        if isinstance(value, datetime):
            value = _to_iso(value)
        out[col] = value
    return out


def _coerce_field(table: str, col: str, value: Any) -> Any:
    if col.endswith("_at") or col == "assessed_at":
        if isinstance(value, str):
            return _from_iso(value)
    return value


def _apply_record(table: str, record: dict[str, Any], existing: Any | None) -> Any:
    spec = TABLES[table]
    target = existing if existing is not None else spec.model()
    for col in spec.columns:
        if col == "id" and existing is not None:
            continue  # never overwrite PK
        if col in record:
            setattr(target, col, _coerce_field(table, col, record[col]))
    return target


# ---------------------------------------------------------------------------
# Push / pull
# ---------------------------------------------------------------------------


@dataclass
class ConflictBundle:
    table: str
    record_id: str
    local: dict[str, Any]
    remote: dict[str, Any]


@dataclass
class PushResult:
    accepted: list[str] = field(default_factory=list)
    conflicts: list[ConflictBundle] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def _row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Defensive check: does ``row`` belong to ``user_id``?

    For directly-scoped rows we inspect ``user_id``. For
    via_curriculum / via_project / via_session rows we trust the
    parent FK (the per-table pull/push query already JOINed
    through to the right user). UUIDs make cross-user collision
    a 1-in-2**128 event, so trusting the parent FK at this layer
    is safe.
    """
    spec = TABLES[table]
    if spec.scope == "self":
        return bool(row.id == user_id)
    if spec.scope == "global":
        # Globally-shared rows (e.g. Subjects taxonomy) are not
        # tied to a user; every device accepts every row.
        return True
    if hasattr(row, "user_id"):
        return bool(row.user_id == user_id)
    return True


def push_records(
    db: Session,
    user_id: str,
    table: str,
    records: list[dict[str, Any]],
    since: datetime | None,
) -> PushResult:
    """Apply incoming records for one table.

    For an append-only table: insert if id unknown, skip if
    known. For a mutable table: insert if unknown, update if
    local was untouched since ``since``, raise as a conflict if
    BOTH sides changed.
    """
    if table not in TABLES:
        raise ValidationError(f"Unknown sync table: {table!r}")
    spec = TABLES[table]
    model = spec.model
    result = PushResult()

    for record in records:
        record_id = record.get("id")
        if not isinstance(record_id, str) or not record_id:
            result.skipped.append("<no-id>")
            continue
        existing = db.get(model, record_id)
        if spec.append_only:
            if existing is not None:
                result.skipped.append(record_id)
                continue
            row = _apply_record(table, record, None)
            if not _row_belongs_to_user(table, row, user_id):
                # Skip rows that don't scope to this user, defensively.
                result.skipped.append(record_id)
                continue
            db.add(row)
            result.accepted.append(record_id)
            continue

        # Mutable table.
        remote_ts = _from_iso(record.get(spec.timestamp_field))
        if existing is None:
            row = _apply_record(table, record, None)
            if not _row_belongs_to_user(table, row, user_id):
                result.skipped.append(record_id)
                continue
            db.add(row)
            result.accepted.append(record_id)
            continue
        if not _row_belongs_to_user(table, existing, user_id):
            # Same id but wrong user — defensive skip. Should
            # never happen in practice because UUIDs collide
            # at 1 in 2**128.
            result.skipped.append(record_id)
            continue
        local_ts: datetime | None = getattr(existing, spec.timestamp_field, None)
        if local_ts is None:
            local_ts = datetime.min.replace(tzinfo=UTC)
        if local_ts.tzinfo is None:
            local_ts = local_ts.replace(tzinfo=UTC)

        # Local untouched since the client's last sync? Accept remote.
        if since is None or local_ts <= since:
            _apply_record(table, record, existing)
            result.accepted.append(record_id)
            continue

        # Both changed. Conflict.
        if remote_ts is not None and local_ts == remote_ts:
            # Same timestamp — treat as no-op accept (idempotent
            # second send of the same write).
            result.accepted.append(record_id)
            continue
        local_dict = serialize_row(table, existing)
        result.conflicts.append(
            ConflictBundle(
                table=table,
                record_id=record_id,
                local=local_dict,
                remote=record,
            )
        )

    if result.accepted or result.conflicts == [] and result.accepted == []:
        # Always commit even on empty acceptance so subsequent
        # cascading reads see a clean transaction.
        db.commit()
    else:
        db.flush()
    return result


def _scoped_query(db: Session, table: str, user_id: str):
    """Build a per-user-scoped query for one table.

    Handles the nesting paths:
      - ``"self"``  →  WHERE users.id = :user_id
      - ``"direct"`` →  WHERE table.user_id = :user_id
      - ``"via_curriculum"`` →  JOIN curriculums ON ...
      - ``"via_project"`` →  JOIN learning_projects ON ...
      - ``"via_session"`` →  JOIN learning_sessions ON learning_projects ON ...
      - ``"via_imported_conversation"`` →  JOIN imported_conversations
        ON ... (v1.8.0 / Phase 21D, for ``imported_messages``)
    """
    spec = TABLES[table]
    model = spec.model
    query = db.query(model)
    if spec.scope == "self":
        query = query.filter(model.id == user_id)
    elif spec.scope == "global":
        # No user scope — every row is shared across users.
        pass
    elif spec.scope == "direct":
        query = query.filter(model.user_id == user_id)
    elif spec.scope == "via_curriculum":
        query = query.join(Curriculum, Curriculum.id == model.curriculum_id).filter(
            Curriculum.user_id == user_id
        )
    elif spec.scope == "via_project":
        query = query.join(LearningProject, LearningProject.id == model.project_id).filter(
            LearningProject.user_id == user_id
        )
    elif spec.scope == "via_session":
        query = (
            query.join(LearningSession, LearningSession.id == model.session_id)
            .join(LearningProject, LearningProject.id == LearningSession.project_id)
            .filter(LearningProject.user_id == user_id)
        )
    elif spec.scope == "via_imported_conversation":
        query = query.join(
            ImportedConversation,
            ImportedConversation.id == model.conversation_id,
        ).filter(ImportedConversation.user_id == user_id)
    return query


def pull_records(
    db: Session,
    user_id: str,
    tables: Iterable[str],
    since: datetime | None,
) -> dict[str, list[dict[str, Any]]]:
    """Return every row in ``tables`` whose timestamp is greater
    than ``since`` (or all rows when ``since`` is None — first
    sync)."""
    out: dict[str, list[dict[str, Any]]] = {}
    for table in tables:
        if table not in TABLES:
            continue
        spec = TABLES[table]
        query = _scoped_query(db, table, user_id)
        if since is not None:
            ts_col = getattr(spec.model, spec.timestamp_field)
            query = query.filter(ts_col > since)
        # Order so child rows always follow parents inside one
        # batch — the client applies in order.
        ts_col = getattr(spec.model, spec.timestamp_field)
        query = query.order_by(ts_col.asc())
        out[table] = [serialize_row(table, row) for row in query.all()]
    return out


# ---------------------------------------------------------------------------
# Resolve
# ---------------------------------------------------------------------------


@dataclass
class Resolution:
    table: str
    record_id: str
    chosen: str  # "local" | "remote" | "merged"
    merged_data: dict[str, Any] | None = None


def apply_resolutions(
    db: Session, user_id: str, resolutions: list[Resolution]
) -> dict[str, list[str]]:
    """Apply user-decided conflict resolutions.

    "local" → keep the row as-is (no-op on the server).
    "remote" → overwrite with the remote payload (client must
       have re-sent the data so we keep the API symmetric).
    "merged" → overwrite with the merged payload.

    The client's choice of ``local`` on a server-side row that
    was already overwritten is a true no-op; we still record it
    in ``applied`` so the client can confirm the decision landed.
    """
    applied: list[str] = []
    skipped: list[str] = []
    for resolution in resolutions:
        spec = TABLES.get(resolution.table)
        if spec is None:
            skipped.append(resolution.record_id)
            continue
        existing = db.get(spec.model, resolution.record_id)
        if resolution.chosen == "local":
            if existing is None:
                skipped.append(resolution.record_id)
                continue
            applied.append(resolution.record_id)
            continue
        payload = resolution.merged_data or {}
        if resolution.chosen in {"remote", "merged"}:
            if not payload:
                skipped.append(resolution.record_id)
                continue
            _apply_record(resolution.table, payload, existing)
            if existing is None and payload.get("id"):
                row = _apply_record(resolution.table, payload, None)
                db.add(row)
            applied.append(resolution.record_id)
        else:
            skipped.append(resolution.record_id)
    db.commit()
    return {"applied": applied, "skipped": skipped}


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def compute_status(db: Session, user_id: str) -> dict[str, Any]:
    """Per-table row counts, scoped to the user.

    Used by the Settings sync panel + the periodic
    "is there anything to sync" check. Cheap — single COUNT(*)
    per table.
    """
    if db.get(User, user_id) is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    counts: dict[str, int] = {}
    for table in TABLES:
        counts[table] = _scoped_query(db, table, user_id).count()
    return {
        "user_id": user_id,
        "counts": counts,
        "server_time": _to_iso(datetime.now(UTC)),
    }


__all__ = [
    "ALL_SYNC_TABLES",
    "APPEND_ONLY_TABLES",
    "ConflictBundle",
    "MUTABLE_TABLES",
    "PushResult",
    "Resolution",
    "TABLES",
    "TableSpec",
    "apply_resolutions",
    "compute_status",
    "pull_records",
    "push_records",
    "serialize_row",
]
