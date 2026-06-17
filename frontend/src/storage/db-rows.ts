/**
 * Dexie row shapes (extracted from db.ts, #391).
 *
 * One interface per Dexie table, mirroring the SQLAlchemy models in
 * ``backend/app/models/`` 1:1 so DexieStorage stores the same row shapes
 * the backend would have persisted. Field names match the wire JSON
 * (snake_case) because the IStorageService consumers expect the same
 * domain types from ``types/domain.ts``. These types are consumed by the
 * ``AdaptiveLearnerDB`` table declarations in db.ts (which re-exports
 * them for backward compatibility).
 */

import type {AIProvider, LearningMethod, MessageRole, SessionStatus} from "../lib/constants";
import type {AttemptRecord} from "./types/element-errors";

// ---- Row shapes (mirror backend Pydantic Out-schemas) -----------------

export interface UserRow {
    id: string;
    name: string;
    email: string | null;
    language: string;
    created_at: string;
    updated_at: string;
}

export interface UserSettingsRow {
    id: string;
    user_id: string;
    language: string;
    active_provider: AIProvider;
    /**
     * Cleartext API keys. Acceptable per v0.7.0 design: data
     * sits in the user's own IndexedDB on their own device, no
     * server roundtrip. ApiStorage / backend never sees these.
     */
    api_key_anthropic: string | null;
    api_key_openai: string | null;
    api_key_gemini: string | null;
    model_override_anthropic: string | null;
    model_override_openai: string | null;
    model_override_gemini: string | null;
    /** #508 — base64 data URL of the profile picture, or null (use the
     *  generated initials avatar). */
    avatar: string | null;
    created_at: string;
    updated_at: string;
}

/** Phase 65 — last-known-good API-key backup (rollback cache).
 *  One row per (user_id, provider); ``id`` is ``{user_id}#{provider}``
 *  so the upsert converges. The key is stored as-is (Dexie data is
 *  browser-local, like the cleartext keys on UserSettingsRow). */
export interface ApiKeyBackupRow {
    id: string;
    user_id: string;
    provider: AIProvider;
    key: string;
    tested_at: string;
    works: boolean;
}

export interface LearningProjectRow {
    id: string;
    user_id: string;
    topic: string;
    goal: string;
    timeframe: string;
    daily_minutes: number;
    current_problem: string | null;
    active: boolean;
    // v1.31.0 / Phase 46F: "standard" | "content". Free-text
    // at the Dexie layer so future kinds don't need a schema
    // bump. Pre-v1.31.0 rows back-fill to "standard" via the
    // rowToProject mapper.
    kind?: string;
    created_at: string;
    updated_at: string;
}

export interface LearningProfileRow {
    id: string;
    user_id: string;
    project_id: string;
    deductive: number;
    inductive: number;
    error_based: number;
    dialogic: number;
    contextual: number;
    ai_adaptive: number;
    assessed_at: string;
    version: number;
}

export interface CurriculumRow {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    language: string;
    created_at: string;
    updated_at: string;
    /**
     * Phase 36 Bug 3 — children-side FK back to the imported
     * conversation that produced this curriculum. ``null`` for
     * free-form curricula. Dexie schema v13 adds the secondary
     * index so the "did this conversation already produce a
     * curriculum?" lookup is O(log n).
     */
    imported_conversation_id: string | null;
}

export interface LearningTopicRow {
    id: string;
    curriculum_id: string;
    parent_id: string | null;
    title: string;
    description: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface LessonRow {
    id: string;
    curriculum_id: string;
    title: string;
    content: string;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface LearningSessionRow {
    id: string;
    project_id: string;
    method: LearningMethod;
    started_at: string;
    ended_at: string | null;
    cycle_step: number;
    status: SessionStatus;
    /**
     * Phase 36 Bug 4 — children-side FK back to the imported
     * conversation this session was started from. ``null`` for
     * free-form sessions. Dexie schema v14 adds the secondary
     * index so the "is there an active session for this
     * conversation?" lookup is O(log n).
     */
    imported_conversation_id: string | null;
}

export interface SessionMessageRow {
    id: string;
    session_id: string;
    role: MessageRole;
    content: string;
    created_at: string;
}

export interface SessionRatingRow {
    id: string;
    session_id: string;
    understanding: number;
    stress: number;
    method_fit: number;
    notes: string | null;
    created_at: string;
}

export interface SessionNoteRow {
    id: string;
    session_id: string;
    content: string;
    /**
     * v1.26.0 / Phase 42 — free-text kind discriminator.
     * Canonical values: ``"note"`` (default, free-form) and
     * ``"meta_learning"`` (Article-3 "Meta-Learning Insight",
     * surfaced as its own section by the learning-repo
     * plugin renderer). Plugins may extend with their own
     * kinds without a schema change.
     */
    kind: string;
    created_at: string;
    /**
     * v1.8.0 / Phase 21B — sync surface promoted SessionNote
     * from append-only to mutable. ``updated_at`` is set on
     * creation (== ``created_at``) and on every edit, so the
     * sync push/pull conflict layer can pick a winner by
     * timestamp.
     */
    updated_at: string;
}

export interface ProgressCommitRow {
    id: string;
    project_id: string;
    session_id: string;
    method: LearningMethod;
    understanding: number;
    stress: number;
    error_rate: number;
    duration_minutes: number;
    committed_at: string;
}

export interface MethodSwitchRow {
    id: string;
    project_id: string;
    session_id: string | null;
    from_method: LearningMethod;
    to_method: LearningMethod;
    reason: string;
    switched_at: string;
}

export interface ImportedConversationRow {
    id: string;
    user_id: string;
    project_id: string | null;
    source: string;
    title: string;
    message_count: number;
    imported_at: string;
    analyzed: boolean;
    analysis_result: Record<string, unknown> | null;
    topic_tag: string | null;
    model: string | null;
    source_created_at: string | null;
    /**
     * Phase 36 Bug 1 — SHA-256 of role-prefixed normalised messages.
     * Title-independent so re-imports with a fresh display title
     * still detect as duplicates. Nullable because Dexie schema v12
     * back-fills lazily — rows created before the upgrade can carry
     * ``null`` if the upgrade hasn't reached them yet.
     */
    content_hash: string | null;
    /**
     * v1.54.0 — language pair captured at IMPORT time and flowed
     * through analysis -> save-as-lesson -> share. ``source_language``
     * is the chat language (what the learner speaks); ``target_language``
     * is what they learn. Nullable: imports created before Dexie v25
     * carry ``null`` and fall back to the app-language default in the UI.
     */
    source_language: string | null;
    target_language: string | null;
}

export interface ImportedMessageRow {
    id: string;
    conversation_id: string;
    role: MessageRole;
    content: string;
    timestamp: string | null;
    order_index: number;
    /**
     * v1.8.0 / Phase 21D — per-row timestamp for sync surface
     * inclusion. Matches the backend column added in Alembic
     * migration 0007; back-filled from the parent
     * ``ImportedConversationRow.imported_at`` via the Dexie v5
     * schema upgrade.
     */
    created_at: string;
}

export interface SubjectRow {
    id: string;
    parent_id: string | null;
    name: string;
    description: string | null;
    icon: string | null;
    created_at: string;
    updated_at: string;
}

export interface TagRow {
    id: string;
    user_id: string;
    name: string;
    color: string | null;
    created_at: string;
}

export interface ProjectSubjectRow {
    id: string;
    project_id: string;
    subject_id: string;
    created_at: string;
}

export interface ProjectTagRow {
    id: string;
    project_id: string;
    tag_id: string;
    created_at: string;
}

/**
 * Per-user XP / level singleton (Phase 29A / v1.16.0).
 *
 * One row per user (unique ``user_id``). Mirrors the backend
 * ``user_xp`` table (Alembic 0009). Both storage backings
 * (ApiStorage + DexieStorage) maintain the row through the
 * gamification namespace; the Dexie path runs the XP calculator
 * client-side because there is no backend in github-pages mode.
 */
export interface UserXPRow {
    id: string;
    user_id: string;
    total_xp: number;
    level: number;
    updated_at: string;
}

/** Badge catalog row (Phase 29B). */
export interface BadgeRow {
    id: string;
    key: string;
    name_key: string;
    description_key: string;
    icon: string;
    category: string;
    // Phase 57 / v1.40.0. Fixed visual tier; DYNAMIC-badge thresholds
    // ({tier: {threshold, xp_bonus}}) or null for static/flat badges.
    base_tier?: string;
    tier_thresholds?: Record<
        string,
        {threshold: number; xp_bonus: number}
    > | null;
    created_at: string;
    updated_at: string;
}

/**
 * Earned-badge record (Phase 29B). Unique on (user_id, badge_id).
 * Phase 57 / v1.40.0: ``tier`` (high-water mark, never demotes) +
 * ``updated_at`` (advances on tier upgrade for sync LWW).
 */
export interface UserBadgeRow {
    id: string;
    user_id: string;
    badge_id: string;
    tier?: string;
    earned_at: string;
    updated_at?: string;
}

/** AI-generated study question (Phase 32B / v1.19.0). */
export interface StudyQuestionRow {
    id: string;
    user_id: string;
    project_id: string;
    session_id: string | null;
    question: string;
    expected_answer: string;
    /** "open" | "fill_blank" | "explain" | "compare" */
    question_type: string;
    /** "easy" | "medium" | "hard" */
    difficulty: string;
    topic: string;
    edited: boolean;
    created_at: string;
    updated_at: string;
}

/** Anki flashcard suggestion (Phase 30B). */
export interface AnkiCardRow {
    id: string;
    user_id: string;
    session_id: string | null;
    conversation_id: string | null;
    project_id: string | null;
    card_type: "basic" | "cloze";
    front: string;
    back: string;
    /** JSON-encoded array of tag strings, mirroring the backend
     *  shape so the sync layer can ship the row verbatim. */
    tags: string;
    accepted: boolean;
    rejected: boolean;
    exported_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Phase 43 / EXP-002 — Content-Loader cache. One row per
 * downloaded set version. ``id`` is a composite cache key
 * ``"{source-slug}/{set_id}/{version}"`` so Dexie indexes
 * cheaply and the file-table foreign key
 * (``contentSetFiles.set_pk``) stays human-readable in dev
 * tools.
 *
 * The row stores the full ``SetEntry``-shaped metadata so
 * the Set Browser can render the listing without joining
 * files. Lesson + asset bytes live in ``contentSetFiles``.
 */
export interface ContentSetRow {
    /** Composite cache key. See class doc. */
    id: string;
    source: string;
    branch: string;
    set_id: string;
    version: string;
    /** Mirrors the backend SetEntryResponse shape so the
     *  Set Browser renders cached + upstream sets the same
     *  way. */
    title: string;
    /** Optional title in the target language (native script).
     *  Added in v1.44.0; optional so no migration backfill is
     *  needed (reads default to null). */
    title_native?: string | null;
    /** Legacy alias for ``target_language`` — kept for the
     *  Set Browser's existing reads. Always equals
     *  ``target_language`` for rows written at v22+. */
    language: string;
    /** Phase 60 / v1.44.0 — BCP-47 code of the language the
     *  learner is LEARNING. Backfilled from ``language`` for
     *  rows written before the schema-v22 upgrade. */
    target_language: string;
    /** Phase 60 / v1.44.0 — BCP-47 code of the language the
     *  learner already SPEAKS. Backfilled to ``"en"`` for
     *  pre-v22 rows. */
    source_language: string;
    level: string;
    domain: string;
    lesson_count: number;
    description: string | null;
    tags: string;  // JSON-encoded array
    cover_image: string | null;
    /** ISO-8601 timestamp of the most recent download. */
    downloaded_at: string;
    /** Cached repo-level manifest YAML (verbatim, for
     *  re-parsing after a schema upgrade). */
    manifest_yaml: string;
}

/**
 * Phase 44 / EXP-002 / P-109 — per-user lesson progress.
 *
 * Composite ``id`` is
 * ``{user_id}#{source-slug}#{set_id}#{lesson_filename}``;
 * Dexie indexes on ``user_id`` for the list query.
 * ``step_results`` is the parsed object (NOT a JSON string;
 * Dexie handles structured cloning natively).
 *
 * Wire shape parity: a row converts to the ApiStorage
 * ``LessonProgress`` type 1:1 — the conversion lives in
 * ``dexie-storage.ts``.
 */
export interface LessonProgressRow {
    id: string;
    user_id: string;
    source: string;
    set_id: string;
    lesson_filename: string;
    /** Phase 63A — widened from in_progress|completed. */
    status: "in_progress" | "paused" | "abandoned" | "completed";
    step_results: Record<
        string,
        {
            correct: number;
            total: number;
            attempts: number;
            completed_at: string;
            /** Phase 52C / v1.35.0 — see ``LessonStepResultStored``
             *  in storage/types.ts. Free-text + word-tiles populate
             *  this; matching + picture-choice leave it absent. */
            user_answer?: string | null;
            /** BUG P1 / Problem 2 — the persisted raw answer
             *  (type-discriminated), used to re-render a revisited
             *  step's exact locked visual. See ``RawAnswer`` in
             *  storage/types.ts. Absent on pre-feature rows. */
            raw_answer?: import("./types").RawAnswer | null;
        }
    >;
    score_correct: number;
    score_total: number;
    time_spent_seconds: number;
    /** BUG #41 — the step the user is on, so a paused lesson resumes
     *  at the exact step. Non-indexed, so no Dexie version bump is
     *  needed; pre-feature rows read back as undefined → coalesced
     *  to 0 (start of lesson, the old behaviour). */
    current_step?: number;
    started_at: string;
    updated_at: string;
    completed_at: string | null;
    /** Phase 63A — set on pause, cleared on resume + completion. */
    paused_at: string | null;
    /** Phase 63A — set on abandon, cleared on completion. */
    abandoned_at: string | null;
}

/**
 * Phase 46B / EXP-007 / P-129 — per-element error +
 * mastery tracking. Dexie schema v18.
 *
 * Composite primary key
 * ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}#{direction}``
 * mirrors the backend's UNIQUE constraint so a duplicate
 * upsert through either storage backend converges on the
 * same row. EXP-018 / Phase 62 added ``direction`` as the
 * sixth key segment so a card's receptive and productive
 * rows stay independent.
 *
 * The mastered-flag + correct_streak + error_count semantics
 * mirror ``app.services.element_errors``. The DexieStorage
 * adapter (``element-errors-dexie.ts``) re-implements the
 * transition matrix client-side so GH-Pages users get the
 * same SRS feedback loop the backend ships.
 */
export interface ElementErrorRow {
    /** Composite key. See the class docstring. */
    id: string;
    user_id: string;
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    element_key: string;
    /** EXP-018 / Phase 62 — drill direction this row tracks.
     *  ``"target_to_source"`` (receptive) | ``"source_to_target"``
     *  (productive). Part of the composite ``id``. Always written
     *  by the adapter + the v23 backfill; optional in the type so
     *  pre-62 fixtures still type-check. */
    direction?: string;
    element_type: string;
    user_answer: string;
    correct_answer: string;
    error_count: number;
    correct_streak: number;
    last_error_at: string | null;
    last_attempt_at: string;
    mastered: boolean;
    mastered_at: string | null;
    /** #594 Hint Economy — whether the most recent attempt used a hint
     *  (drives the shortened SRS interval). Optional so pre-#594 rows
     *  read back as ``undefined`` (treated as false). */
    hint_used?: boolean;
    /** #594 Hint Economy — lifetime count of hint-assisted attempts on
     *  this element (feeds the "answers with hint" statistic). */
    hint_used_count?: number;
    /** #603 Smart Review Queue — total attempts (correct or wrong). */
    attempt_count?: number;
    /** #603 Smart Review Queue — the last 10 attempts (ring buffer).
     *  Stored inline (non-indexed) so no Dexie version bump is needed. */
    attempt_history?: AttemptRecord[];
    created_at: string;
    updated_at: string;
}

/**
 * One file (lesson JSON or asset) inside a cached set. The
 * Phase 44 viewer reads lessons via this table. ``filename``
 * matches the backend cache layout
 * (``lessons/{lesson_id}.json`` or
 * ``assets/{rel_path}``).
 */
export interface ContentSetFileRow {
    /** Composite key: ``"{set_pk}#{filename}"``. */
    id: string;
    /** FK to ``contentSets.id``. */
    set_pk: string;
    filename: string;
    /** Body. Most files are text (lesson JSON); the viewer
     *  decodes when needed. Binary assets are base64 in
     *  this column (the asset loader handles decoding). */
    body: string;
    /** ``text`` or ``binary``; the viewer picks the right
     *  decoder. */
    encoding: "text" | "base64";
}

/** Per-user streak state (Phase 29C). One row per user. */
export interface UserStreakRow {
    id: string;
    user_id: string;
    freezes_available: number;
    last_freeze_earned_on: string | null;
    last_freeze_used_on: string | null;
    weekend_mode: boolean;
    current_streak_days: number;
    longest_streak_days: number;
    updated_at: string;
}

export interface StepEvaluationRow {
    id: string;
    session_id: string;
    from_step: number;
    /**
     * Where the session ACTUALLY went after this evaluation
     * (= ``suggested_step`` when ``applied=true``, else
     * ``from_step``). Matches the backend column name for
     * sync-surface parity since v1.8.0 / Phase 21A. The raw AI
     * verdict (``suggested_step`` from the dataclass) is no
     * longer persisted to Dexie — when needed for analytics,
     * recover it from ``to_step`` + ``applied`` + ``from_step``.
     */
    to_step: number;
    advance: boolean;
    applied: boolean;
    confidence: number;
    reason: string;
    fallback_used: boolean;
    /**
     * Wall-clock seconds the user spent on ``from_step`` before
     * this evaluation. Dexie-local (the tracking summary uses
     * it for the time-per-step chart); NOT in the sync column
     * set since the backend has no equivalent column.
     */
    duration_seconds: number;
    /**
     * Backend column name since v1.8.0. The v0.5.0 → v1.7.x
     * Dexie column ``created_at`` migrates to ``evaluated_at``
     * via the v3 schema upgrade in AdaptiveLearnerDB.
     */
    evaluated_at: string;
}

// ---- Plugin-settings row (Phase 49 / v1.32.0) -------------------------

/**
 * One row per plugin name. Lazy-created on first
 * ``DexieStorage.pluginSettings.update`` — ``get`` for a missing
 * row falls back to the bundled YAML defaults at
 * ``frontend/src/data/plugin-config/{name}.json``.
 *
 * ``settings`` is the raw JSON blob the
 * IPluginSettingsNamespace contract round-trips. It mirrors the
 * shape of the backend's ``api.pluginSettings.get/update``
 * payload's ``settings`` field, so the DexieStorage and
 * ApiStorage implementations of the same namespace yield
 * structurally identical responses.
 */
export interface PluginSettingsRow {
    /** Plugin slug, e.g. "learning-repo". Primary key. */
    name: string;
    /** JSON-serialised settings dict — Dexie stores arbitrary
     *  JSON natively, but we keep the wire shape uniform with
     *  the API so a future per-key migration script needs zero
     *  parsing. */
    settings: Record<string, unknown>;
    /** ISO datetime of the most recent ``update`` call. Local
     *  bookkeeping; not exposed in the namespace contract. */
    updated_at: string;
}

/** EXP-033 / AIV-04 — a cached set-wide AI content-check report.
 *  One row per ``{source-slug}#{set_id}``; overwritten on each re-check.
 *  ``set_version`` is the set's ``cached_version`` at check time — the
 *  cache is treated as stale when the current download differs. */
export interface AiValidationResultRow {
    /** ``{source-slug}#{set_id}``. Primary key. */
    id: string;
    source: string;
    set_id: string;
    /** The set's ``cached_version`` when the check ran (invalidation). */
    set_version: string | null;
    /** AIV-09 content hash of the checked cards (set in AIV-08/09). */
    content_hash: string | null;
    /** Per-card results (only cards the model returned). */
    results: import("../lib/ai/content-validator").ValidationResult[];
    /** Provider response ids (AIV-09 signature). */
    response_ids: string[];
    provider: string;
    model: string;
    card_count: number;
    issue_count: number;
    /** ISO timestamp the check completed. */
    checked_at: string;
}

/** EXP-010 / Phase 56 — a daily mission assigned to a user.
 *  Mirrors the backend ``UserMission`` model + the sync surface.
 *  ``assigned_date`` is a ``YYYY-MM-DD`` string. */
export interface UserMissionRow {
    id: string;
    user_id: string;
    template_id: string;
    assigned_date: string;
    progress: number;
    completed: boolean;
    completed_at: string | null;
    xp_awarded: boolean;
    created_at: string;
    updated_at: string;
}
