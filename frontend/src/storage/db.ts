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
}

export interface ImportedMessageRow {
    id: string;
    conversation_id: string;
    role: MessageRole;
    content: string;
    timestamp: string | null;
    order_index: number;
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
