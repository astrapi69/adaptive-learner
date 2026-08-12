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
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import (
    AnkiCardSuggestion,
    ApiKeyBackup,
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
    SetRun,
    StepEvaluation,
    StudyQuestion,
    Subject,
    Tag,
    User,
    UserBadge,
    UserMission,
    UserSettings,
    UserStreak,
    UserXP,
)

if TYPE_CHECKING:
    # Type-only import: the orchestration functions take a SyncRepository,
    # but sync_repo imports _scoped_query / TABLES from THIS module at
    # runtime (EXP-024 Option A). PEP 563 string annotations + this guard
    # keep that a one-way runtime dependency (sync_repo -> sync_service).
    from app.repositories.sync_repo import SyncRepository

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
    # Optional NATURAL unique key (a non-PK column with a UNIQUE
    # constraint, e.g. ``badges.key``). Seeded catalog tables get a
    # random ``id`` per install, so a backup row's ``id`` may not match
    # the locally-seeded row that shares the same natural key. Restore
    # matches on this key when the id lookup misses, updating the local
    # row in place instead of INSERTing a duplicate key (issue #49).
    natural_key: str | None = None


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
            "api_key_perplexity",
            "model_override_anthropic",
            "model_override_openai",
            "model_override_gemini",
            "model_override_perplexity",
            "avatar",
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
            "imported_conversation_id",
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
            "imported_conversation_id",
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
            "base_tier",
            "tier_thresholds",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=24,
        scope="global",
        # Seeded catalog: random id per install, UNIQUE on key. Restore
        # must match on key, not the (install-specific) id (issue #49).
        natural_key="key",
    ),
    # v1.16.0 / Phase 29B — earned-badge record. Unique on
    # (user_id, badge_id). v1.40.0 / Phase 57: MUTABLE (was
    # append-only) — a dynamic badge's ``tier`` climbs in place
    # (bronze -> silver -> gold). Tier is a HIGH-WATER MARK that never
    # demotes, so last-write-wins on ``updated_at`` is safe: the newer
    # write always carries the higher (or equal) tier.
    "user_badges": TableSpec(
        model=UserBadge,
        columns=("id", "user_id", "badge_id", "tier", "earned_at", "updated_at"),
        timestamp_field="updated_at",
        append_only=False,
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
            # #1007 Phase 2 — the lesson mode the run was played in.
            "lesson_mode",
            "step_results",
            "score_correct",
            "score_total",
            "time_spent_seconds",
            "current_step",
            "started_at",
            "updated_at",
            "completed_at",
            # #983 — retry tracking; carried in backup/sync so the best
            # score + improvement history survive restore + multi-device.
            "attempts",
            "best_score_correct",
            "best_score_total",
            "attempt_history",
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
            "run_id",  # EXP-051 / #2125 - Durchgang generation; part of identity
            "set_id",
            "lesson_id",
            "exercise_id",
            "element_key",
            "direction",
            "element_type",
            "user_answer",
            "correct_answer",
            "error_count",
            "correct_streak",
            "last_error_at",
            "last_attempt_at",
            "mastered",
            "mastered_at",
            # #2456 - these five existed on the model (migrations 0030/0031/
            # 0034) but were never added here, so hint economy, exam boost
            # and the attempt history silently dropped out of sync + backup.
            "hint_used",
            "hint_used_count",
            "last_attempt_exam",
            "attempt_count",
            "attempt_history",
            # #2188 - author-declared retirement (archived rows ride along).
            "retired_at",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=30,
        scope="direct",
    ),
    "user_missions": TableSpec(
        model=UserMission,
        columns=(
            "id",
            "user_id",
            "template_id",
            "assigned_date",
            "progress",
            "completed",
            "completed_at",
            "xp_awarded",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=31,
        scope="direct",
    ),
    # Phase 65 — API-key rollback cache. MUTABLE: one row per
    # (user, provider), overwritten on each successful key save.
    # Direct user scope. Carries Fernet ciphertext (same scheme as
    # UserSettings.api_key_*, which is already synced).
    "api_key_backups": TableSpec(
        model=ApiKeyBackup,
        columns=(
            "id",
            "user_id",
            "provider",
            "encrypted_key",
            "tested_at",
            "works",
            "created_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=32,
        scope="direct",
    ),
    # EXP-051 / #2125 — Durchgang bookkeeping. MUTABLE (closed_at on close).
    "set_runs": TableSpec(
        model=SetRun,
        columns=(
            "id",
            "user_id",
            "set_id",
            "run_id",
            "content_version_at_start",
            "started_at",
            "closed_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=33,
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


def row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Canonical defensive check: does ORM ``row`` belong to ``user_id``?

    This is the single source of truth for per-user ownership, shared by
    sync (push acceptance) and backup (restore). Both surfaces MUST agree,
    because a drift can leak a row across users (wrong ``True``) or drop a
    legitimately-owned row (wrong ``False``); issue #329 consolidated two
    copies that had diverged.

    Resolution per ``TableSpec.scope``:

    - ``self``: the row IS the user (``users`` table) -> ``row.id == user_id``.
    - ``global``: shared, not user-tied (Subjects taxonomy, Badge catalog)
      -> every device/user owns every row.
    - everything else (``direct`` + ``via_*``): trust the ``user_id`` column
      when present and set; otherwise trust the parent FK. The per-table
      pull/push/export query already JOINed through to the right user, so an
      absent or NULL direct column means "ownership is via the parent", not
      "foreign". UUID ids make cross-user collision a 1-in-2**128 event.

    The NULL-``user_id`` case is latent today: every model that maps a
    ``user_id`` column types it non-nullable (``Mapped[str]``), and the two
    ``global`` models map none at all, so ``getattr(row, "user_id", None)``
    only yields ``None`` for ``via_*`` rows that carry no such column. The
    explicit ``None -> True`` branch resolves the prior divergence toward
    "trust the parent FK" (the safe direction for restore: no silent data
    loss) and documents the intended behaviour should a nullable ``user_id``
    column ever be added.
    """
    spec = TABLES[table]
    if spec.scope == "self":
        return bool(row.id == user_id)
    if spec.scope == "global":
        return True
    owner = getattr(row, "user_id", None)
    if owner is None:
        return True
    return bool(owner == user_id)


def record_belongs_to_user(table: str, record: dict[str, Any], user_id: str) -> bool:
    """Canonical ownership check on a raw record dict (pre-insert).

    Dict-shaped mirror of :func:`row_belongs_to_user`, used by the backup
    restore before the ORM object exists. A missing ``user_id`` key and an
    explicit ``None`` value are treated identically (both -> trust the parent
    FK), exactly as ``getattr(row, "user_id", None)`` collapses them on the
    ORM side, so the two checks cannot disagree on the same logical row.
    """
    spec = TABLES[table]
    if spec.scope == "self":
        return record.get("id") == user_id
    if spec.scope == "global":
        return True
    owner = record.get("user_id")
    if owner is None:
        return True
    return bool(owner == user_id)


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
    repo: SyncRepository,
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
        rows = repo.scoped_rows_since(table, user_id, since)
        out[table] = [serialize_row(table, row) for row in rows]
    return out


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def compute_status(repo: SyncRepository, user_id: str) -> dict[str, Any]:
    """Per-table row counts, scoped to the user.

    Used by the Settings sync panel + the periodic
    "is there anything to sync" check. Cheap — single COUNT(*)
    per table.
    """
    if not repo.user_exists(user_id):
        raise NotFoundError(f"User {user_id!r} not found.")
    counts: dict[str, int] = {}
    for table in TABLES:
        counts[table] = repo.scoped_count(table, user_id)
    return {
        "user_id": user_id,
        "counts": counts,
        "server_time": _to_iso(datetime.now(UTC)),
    }


__all__ = [
    "ALL_SYNC_TABLES",
    "APPEND_ONLY_TABLES",
    "MUTABLE_TABLES",
    "TABLES",
    "TableSpec",
    "compute_status",
    "pull_records",
    "record_belongs_to_user",
    "row_belongs_to_user",
    "serialize_row",
]
