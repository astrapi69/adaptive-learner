"""Per-table sync metadata: TableSpec + the TABLES registry (extracted
from sync_service.py to keep it under the file-size gate's 950-line
error threshold - mirrors the frontend's own sync-tables.ts extraction
from sync-engine.ts for the identical reason, #1795).

Re-exported from sync_service.py so every existing
``from app.services.sync_service import TABLES`` (and
``sync_service.TABLES`` attribute access) keeps working unchanged;
this module is the source of truth, sync_service.py is a thin
re-export point.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

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
    SpeechRecording,
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
    # engine#68 idea 3 - speak-and-record clip storage. Mutable: a
    # re-recording overwrites the existing row (upsert), so this is not
    # append-only like an attempt log.
    "speech_recordings": TableSpec(
        model=SpeechRecording,
        columns=(
            "id",
            "user_id",
            "source",
            "set_id",
            "lesson_filename",
            "exercise_id",
            "audio_base64",
            "mime_type",
            "duration_ms",
            "recorded_at",
            "updated_at",
        ),
        timestamp_field="updated_at",
        append_only=False,
        order=34,
        scope="direct",
    ),
}

APPEND_ONLY_TABLES = {name for name, spec in TABLES.items() if spec.append_only}
MUTABLE_TABLES = {name for name, spec in TABLES.items() if not spec.append_only}
ALL_SYNC_TABLES = tuple(TABLES.keys())
