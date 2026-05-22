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
