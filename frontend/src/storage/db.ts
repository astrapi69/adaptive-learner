/**
 * Dexie database schema (Phase 10B).
 *
 * Mirrors the 14 SQLAlchemy models in ``backend/app/models/`` 1:1
 * so DexieStorage can store the same row shapes the backend would
 * have persisted. Field names match the wire JSON (snake_case)
 * because the IStorageService consumers expect the same domain
 * types from ``types/domain.ts``.
 *
 * Schema version starts at 1. Bump + add a ``stores()`` chain on
 * every breaking schema change; Dexie's migration system handles
 * the upgrade transparently for already-populated browsers.
 */

import Dexie, {type EntityTable} from "dexie";

import type {AIProvider, LearningMethod, MessageRole, SessionStatus} from "../lib/constants";

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
    created_at: string;
    updated_at: string;
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
    created_at: string;
    updated_at: string;
}

/** Earned-badge record (Phase 29B). Unique on (user_id, badge_id). */
export interface UserBadgeRow {
    id: string;
    user_id: string;
    badge_id: string;
    earned_at: string;
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
    language: string;
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
    status: "in_progress" | "completed";
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
        }
    >;
    score_correct: number;
    score_total: number;
    time_spent_seconds: number;
    started_at: string;
    updated_at: string;
    completed_at: string | null;
}

/**
 * Phase 46B / EXP-007 / P-129 — per-element error +
 * mastery tracking. Dexie schema v18.
 *
 * Composite primary key
 * ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
 * mirrors the backend's UNIQUE constraint so a duplicate
 * upsert through either storage backend converges on the
 * same row.
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
    element_type: string;
    user_answer: string;
    correct_answer: string;
    error_count: number;
    correct_streak: number;
    last_error_at: string | null;
    last_attempt_at: string;
    mastered: boolean;
    mastered_at: string | null;
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

// ---- Dexie database ---------------------------------------------------

export class AdaptiveLearnerDB extends Dexie {
    users!: EntityTable<UserRow, "id">;
    userSettings!: EntityTable<UserSettingsRow, "id">;
    learningProjects!: EntityTable<LearningProjectRow, "id">;
    learningProfiles!: EntityTable<LearningProfileRow, "id">;
    curricula!: EntityTable<CurriculumRow, "id">;
    learningTopics!: EntityTable<LearningTopicRow, "id">;
    lessons!: EntityTable<LessonRow, "id">;
    learningSessions!: EntityTable<LearningSessionRow, "id">;
    sessionMessages!: EntityTable<SessionMessageRow, "id">;
    sessionRatings!: EntityTable<SessionRatingRow, "id">;
    sessionNotes!: EntityTable<SessionNoteRow, "id">;
    progressCommits!: EntityTable<ProgressCommitRow, "id">;
    methodSwitches!: EntityTable<MethodSwitchRow, "id">;
    stepEvaluations!: EntityTable<StepEvaluationRow, "id">;
    importedConversations!: EntityTable<ImportedConversationRow, "id">;
    importedMessages!: EntityTable<ImportedMessageRow, "id">;
    subjects!: EntityTable<SubjectRow, "id">;
    tags!: EntityTable<TagRow, "id">;
    projectSubjects!: EntityTable<ProjectSubjectRow, "id">;
    projectTags!: EntityTable<ProjectTagRow, "id">;
    userXp!: EntityTable<UserXPRow, "id">;
    badges!: EntityTable<BadgeRow, "id">;
    userBadges!: EntityTable<UserBadgeRow, "id">;
    userStreaks!: EntityTable<UserStreakRow, "id">;
    ankiCards!: EntityTable<AnkiCardRow, "id">;
    studyQuestions!: EntityTable<StudyQuestionRow, "id">;
    // Phase 43 / EXP-002 — Content-Loader cache. The Set
    // Browser (commit 7) reads ``contentSets``; the lesson
    // viewer (Phase 44) reads ``contentSetFiles``.
    contentSets!: EntityTable<ContentSetRow, "id">;
    contentSetFiles!: EntityTable<ContentSetFileRow, "id">;
    // Phase 44 / EXP-002 / P-109 — per-user lesson progress.
    // Composite key (``{user_id}#{source-slug}#{set_id}#{filename}``)
    // matches the backend's UniqueConstraint so the row shape
    // round-trips identically across modes.
    lessonProgress!: EntityTable<LessonProgressRow, "id">;
    // Phase 46B / EXP-007 / P-129 — element-level error +
    // mastery tracking. Composite key
    // ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
    // mirrors the backend UNIQUE constraint.
    elementErrors!: EntityTable<ElementErrorRow, "id">;
    // Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
    // per-plugin settings round-trip. One row per plugin
    // name; lazy-created on first ``update``. Reads against
    // a missing row fall back to the bundled YAML defaults
    // at ``frontend/src/data/plugin-config/{name}.json``.
    pluginSettings!: EntityTable<PluginSettingsRow, "name">;
    // EXP-010 / Phase 56 — daily missions. One row per
    // {user_id, template_id, assigned_date}; indexes support the
    // per-user "today" query + the assigned_date scan.
    userMissions!: EntityTable<UserMissionRow, "id">;

    constructor(name = "adaptive-learner") {
        super(name);
        this.version(1).stores({
            users: "id, email",
            userSettings: "id, user_id",
            learningProjects: "id, user_id, active",
            learningProfiles: "id, project_id, user_id, assessed_at",
            curricula: "id, user_id",
            learningTopics: "id, curriculum_id, parent_id, order_index",
            lessons: "id, curriculum_id, order_index",
            learningSessions: "id, project_id, status, started_at",
            sessionMessages: "id, session_id, created_at",
            sessionRatings: "id, session_id, created_at",
            sessionNotes: "id, session_id, created_at",
            progressCommits: "id, project_id, session_id, committed_at",
            methodSwitches: "id, project_id, switched_at",
            stepEvaluations: "id, session_id, created_at",
        });
        // Schema v2 — v0.9.0 Phase 12C: chat-history import surface.
        this.version(2).stores({
            importedConversations:
                "id, user_id, project_id, imported_at, source, analyzed",
            importedMessages: "id, conversation_id, order_index",
        });
        // Schema v3 — v1.8.0 Phase 21A: step_evaluations column
        // alignment with the backend. ``suggested_step`` and
        // ``created_at`` rename to ``to_step`` and
        // ``evaluated_at`` so the sync surface uses one
        // vocabulary on both sides. The upgrade callback maps
        // each existing row in place.
        this.version(3)
            .stores({
                stepEvaluations: "id, session_id, evaluated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("stepEvaluations")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if ("suggested_step" in row) {
                            const sug = row.suggested_step as number;
                            const applied = row.applied as boolean;
                            const fromStep = row.from_step as number;
                            // Match the backend semantics:
                            //   to_step = applied ? suggested_step : from_step
                            row.to_step = applied ? sug : fromStep;
                            delete row.suggested_step;
                        }
                        if ("created_at" in row && !("evaluated_at" in row)) {
                            row.evaluated_at = row.created_at;
                            delete row.created_at;
                        }
                    });
            });
        // Schema v4 — v1.8.0 Phase 21B: session_notes promoted
        // from append-only to mutable for the sync surface.
        // ``updated_at`` is added; existing rows get
        // ``updated_at = created_at`` (the same back-fill the
        // backend's Alembic migration 0006 applies).
        this.version(4)
            .stores({
                sessionNotes: "id, session_id, updated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("sessionNotes")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("updated_at" in row)) {
                            row.updated_at = row.created_at;
                        }
                    });
            });
        // Schema v5 — v1.8.0 Phase 21D: imported_messages joins
        // the sync surface. ``created_at`` is added per row;
        // existing rows get ``created_at = parent.imported_at``
        // (matches the back-fill in Alembic 0007). The index
        // switches to ``created_at`` so the sync filter can
        // page through "since last sync" efficiently.
        this.version(5)
            .stores({
                importedMessages: "id, conversation_id, created_at",
            })
            .upgrade(async (tx) => {
                const conversations = await tx
                    .table("importedConversations")
                    .toArray();
                const importedAt = new Map<string, string>(
                    conversations.map((c: Record<string, unknown>) => [
                        String(c.id),
                        String(c.imported_at),
                    ]),
                );
                await tx
                    .table("importedMessages")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("created_at" in row)) {
                            const parentTs = importedAt.get(
                                String(row.conversation_id),
                            );
                            // Fall back to "now" if the parent
                            // somehow doesn't exist (orphan
                            // message; shouldn't happen but
                            // guards the migration anyway).
                            row.created_at =
                                parentTs ?? new Date().toISOString();
                        }
                    });
            });
        // Schema v6 — v1.9.0 Phase 22A: Subjects + Tags taxonomy.
        // Four new tables; no data migration needed (clean adds).
        this.version(6).stores({
            subjects: "id, parent_id, name, updated_at",
            tags: "id, user_id, name, created_at",
            projectSubjects: "id, project_id, subject_id, created_at",
            projectTags: "id, project_id, tag_id, created_at",
        });
        // Schema v7 — v1.16.0 Phase 29A: gamification XP singleton.
        // One new table; clean add, no data migration needed.
        this.version(7).stores({
            userXp: "id, user_id, updated_at",
        });
        // Schema v8 — v1.16.0 Phase 29B: badge catalog + earned
        // records. Two clean-add tables; no data migration.
        this.version(8).stores({
            badges: "id, key, category, updated_at",
            userBadges: "id, user_id, badge_id, earned_at",
        });
        // Schema v9 — v1.16.0 Phase 29C: per-user streak state
        // singleton (freezes, weekend mode, longest streak).
        this.version(9).stores({
            userStreaks: "id, user_id, updated_at",
        });
        // Schema v10 — v1.17.0 Phase 30B: Anki flashcard
        // suggestions. Indexed by user_id (primary read path)
        // + project_id + updated_at for sync.
        this.version(10).stores({
            ankiCards:
                "id, user_id, project_id, conversation_id, session_id, updated_at",
        });
        // Schema v11 — v1.19.0 Phase 32B: AI-generated study
        // questions. Indexed by user_id + project_id +
        // updated_at for sync; difficulty + topic are
        // free-text filters served by ``.filter()``.
        this.version(11).stores({
            studyQuestions:
                "id, user_id, project_id, session_id, updated_at",
        });
        // Schema v12 — v1.21.1 Phase 36 Bug 1: content_hash for
        // duplicate-import detection. Adds a secondary index so
        // the per-user dedup check on create is O(log n). The
        // upgrade back-fills the digest for every existing row by
        // reading its messages — mirrors the Alembic 0014
        // back-fill exactly so API + Dexie modes stay in lockstep.
        this.version(12)
            .stores({
                importedConversations:
                    "id, user_id, project_id, imported_at, source, analyzed, content_hash",
            })
            .upgrade(async (tx) => {
                const convs = await tx.table("importedConversations").toArray();
                for (const conv of convs) {
                    const messages = await tx
                        .table("importedMessages")
                        .where("conversation_id")
                        .equals(conv.id)
                        .sortBy("order_index");
                    const payload = messages
                        .map(
                            (m: Record<string, unknown>) =>
                                `${String(m.role).toLowerCase()}:${String(
                                    m.content,
                                ).trim()}`,
                        )
                        .join("\n");
                    const data = new TextEncoder().encode(payload);
                    const digest = await crypto.subtle.digest("SHA-256", data);
                    const bytes = new Uint8Array(digest);
                    let hex = "";
                    for (const b of bytes) {
                        hex += b.toString(16).padStart(2, "0");
                    }
                    await tx
                        .table("importedConversations")
                        .update(conv.id, {content_hash: hex});
                }
            });
        // Schema v13 — v1.21.1 Phase 36 Bug 3: children-side FK
        // from a generated curriculum back to the imported
        // conversation that produced it. New secondary index for
        // the per-conversation lookup. No back-fill: pre-v13 rows
        // were all free-form (no FK existed yet) so ``null`` is
        // correct for the historic set.
        this.version(13).stores({
            curricula: "id, user_id, imported_conversation_id",
        });
        // Schema v14 — v1.21.1 Phase 36 Bug 4: children-side FK
        // from a learning session back to the imported
        // conversation it was started from. New secondary index
        // for the "is there an active session for this
        // conversation?" lookup. No back-fill: pre-v14 sessions
        // were all free-form so ``null`` is correct historically.
        this.version(14).stores({
            learningSessions:
                "id, project_id, status, started_at, imported_conversation_id",
        });
        // Schema v15 — v1.26.0 Phase 42 (BL-30 prerequisite):
        // ``session_notes.kind`` joins the row shape. Mirrors
        // the backend Alembic 0017 migration. Existing rows
        // back-fill to ``"note"`` (matches the server_default).
        // No new index — kind is filtered in-memory by the
        // learning-repo renderer, not paged.
        this.version(15)
            .stores({
                sessionNotes: "id, session_id, updated_at",
            })
            .upgrade(async (tx) => {
                await tx
                    .table("sessionNotes")
                    .toCollection()
                    .modify((row: Record<string, unknown>) => {
                        if (!("kind" in row)) {
                            row.kind = "note";
                        }
                    });
            });
        // Schema v16 — Phase 43 / EXP-002. Content-Loader
        // cache for Dexie-mode (GitHub Pages) users.
        // ``contentSets`` carries one row per downloaded set
        // (cache_key = "{source-slug}/{set_id}/{version}");
        // ``contentSetFiles`` carries the raw text/bytes of
        // each lesson + asset.
        this.version(16).stores({
            contentSets: "id, source, set_id, version, downloaded_at",
            contentSetFiles: "id, set_pk, filename",
        });
        // Schema v17 — Phase 44 / EXP-002 / P-109. Lesson
        // progress. Composite primary key
        // ``{user_id}#{source-slug}#{set_id}#{filename}``;
        // ``user_id`` index for the per-user list query.
        this.version(17).stores({
            lessonProgress: "id, user_id, set_id, status, updated_at",
        });
        // Schema v18 — Phase 46B / EXP-007 / P-129.
        // Element-level error + mastery tracking. Composite
        // primary key
        // ``{user_id}#{set_id}#{lesson_id}#{exercise_id}#{element_key}``
        // mirrors the backend's UNIQUE constraint so
        // duplicate upserts converge through either backend.
        // Indexes: ``user_id`` for the per-user list query,
        // ``[user_id+set_id]`` for set-filtered listing,
        // ``mastered`` for the review-queue "exclude
        // mastered" predicate.
        this.version(18).stores({
            elementErrors:
                "id, user_id, [user_id+set_id], mastered, updated_at",
        });
        // Schema v19 — Phase 49 / v1.32.0 / PHASE-42-STORAGE-
        // ABSTRACTION-01: per-plugin settings round-trip.
        // Single primary key ``name`` (plugin slug); no
        // secondary indexes — the table only ever supports
        // get-by-name + upsert, never a multi-row scan.
        this.version(19).stores({
            pluginSettings: "&name",
        });
        // Schema v20 — EXP-010 / Phase 56: daily missions.
        // Indexes: ``user_id`` + ``[user_id+assigned_date]`` for
        // the per-user "today" query, ``assigned_date`` for the
        // midnight-rollover scan, ``template_id`` for repeat
        // avoidance across days.
        this.version(20).stores({
            userMissions:
                "id, user_id, [user_id+assigned_date], assigned_date, template_id",
        });
    }
}

/**
 * Singleton database handle. ``getDb()`` is the only allowed way
 * to reach it — tests reset via ``_resetDbForTests``.
 */
let _db: AdaptiveLearnerDB | null = null;

export function getDb(): AdaptiveLearnerDB {
    if (_db === null) {
        _db = new AdaptiveLearnerDB();
    }
    return _db;
}

/**
 * Test-only hook: close the current handle and forget it so the
 * next ``getDb()`` opens a fresh instance. Used to point Dexie
 * at fake-indexeddb between Vitest cases.
 */
export async function _resetDbForTests(): Promise<void> {
    if (_db !== null) {
        await _db.close();
        _db = null;
    }
}

/**
 * ISO timestamp helper. Centralised so a future ``Date.now()``
 * mock during tests reaches every callsite.
 */
export function nowIso(): string {
    return new Date().toISOString();
}

/**
 * UUID v4 generator. Browsers + happy-dom + fake-indexeddb all
 * ship ``crypto.randomUUID``; tests run under those runtimes.
 * Pinned in a helper so tests can mock it deterministically.
 */
export function newId(): string {
    return crypto.randomUUID();
}
