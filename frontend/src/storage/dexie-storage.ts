/**
 * DexieStorage — IStorageService backed by IndexedDB via Dexie.
 *
 * Phase 10B ships the storage shell: users, projects, settings,
 * curricula / topics / lessons CRUD all writeable. Assessment,
 * session, tracking and tools land in 10C / 10D / 10E.
 *
 * Notes on the design:
 *   - Every row is keyed by ``id`` (UUID). ``crypto.randomUUID()``
 *     supplies fresh ids on create. Timestamps come from
 *     ``nowIso()`` so future test-mocks can pin them.
 *   - Removed rows cascade by hand. Dexie has no built-in foreign
 *     keys; when a curriculum is removed we also drop its topics
 *     and lessons. The same applies to project / session removal
 *     once those routes exist.
 *   - UserSettings has one row per user. ``settings.get`` creates
 *     a default row on first call so the page never sees a 404.
 *   - Cleartext API keys land in ``userSettings.api_key_*``. The
 *     return shape strips them down to ``has_*_key: boolean`` to
 *     match the wire schema (the backend never returns cleartext
 *     either).
 */

import type {EntityTable} from "dexie";

import {calculateProfile, questionsForLang} from "./assessment";
import {
    createAnkiCard,
    deleteAnkiCard,
    extractFromConversationDexie,
    extractFromSessionDexie,
    listAnkiCards,
    markAnkiCardsExported,
    updateAnkiCard,
} from "./anki";
import {evaluateBadgesForUser, listBadgesWithProgress} from "./badges";
import {awardXPFlat, awardXPForSession, getXPState} from "./gamification";
import {
    calendarHeatmap,
    getStreakState,
    setWeekendMode as setWeekendModeStorage,
    updateStreakState,
} from "./streaks";
import {
    getDb,
    newId,
    nowIso,
    type AdaptiveLearnerDB,
    type CurriculumRow,
    type ImportedConversationRow,
    type ImportedMessageRow,
    type LearningProfileRow,
    type LearningProjectRow,
    type LearningSessionRow,
    type LearningTopicRow,
    type LessonRow,
    type MethodSwitchRow,
    type SessionRatingRow,
    type SubjectRow,
    type UserRow,
    type UserSettingsRow,
} from "./db";
import {
    clearAllAutoBackups,
    maybeRunAutoBackup,
    recordCompletedSession,
} from "./auto-backup";
import {
    createDexieBackup,
    getDexieBackupStats,
    restoreDexieBackup,
} from "./backup";
import {
    buildCurriculumOverview as dexieBuildCurriculumOverview,
    buildProgressReport as dexieBuildProgressReport,
    buildSessionDetail as dexieBuildSessionDetail,
} from "./export-builder";
import {
    createStudyQuestion,
    deleteStudyQuestion,
    generateFromProjectDexie,
    generateFromSessionDexie,
    listStudyQuestions,
    studyGuideDexie,
    updateStudyQuestion,
} from "./notebooklm";
import {fetchAvailableModels} from "./model-discovery";
import {sendMessage, sendMessageStream, startSession} from "./session-flow";
import {
    aggregateProgress,
    buildCommitFromSession,
    rowToCommit,
} from "./tracking";
import {buildSpacedRecommendations, rankTools, recencyFromCommits} from "./tools";
import {ApiError} from "../api/client";
import {computeContentHash} from "../chat_import/content-hash";
import type {AIProvider, LearningMethod} from "../lib/constants";
import type {
    ApiKeySetBody,
    CurriculumCreateBody,
    CurriculumUpdateBody,
    LearningProjectCreateBody,
    LearningProjectUpdateBody,
    LessonCreateBody,
    LessonUpdateBody,
    SessionMessageBody,
    SessionRatingBody,
    SessionStartBody,
    SettingsPatchBody,
    SubjectCreateBody,
    SubjectUpdateBody,
    TagCreateBody,
    TagUpdateBody,
    TopicCreateBody,
    TopicUpdateBody,
    UserCreateBody,
    UserUpdateBody,
} from "../api/client";
import type {
    AssessmentEvaluatePayload,
    AssessmentQuestion,
    ConversationAnalysisResult,
    Curriculum,
    ImportedConversation,
    ImportedConversationAnalysis,
    ImportedConversationCreateBody,
    ImportedConversationDetail,
    ImportedConversationSource,
    ImportedConversationUpdateBody,
    ImportedMessage,
    LearningProfile,
    LearningProject,
    LearningSession,
    LearningTopic,
    Lesson,
    ProgressCommit,
    ProgressSummary,
    SessionEndResult,
    SessionMessage,
    SessionMessageExchangeResult,
    SessionRating,
    SessionStartResult,
    SpacedRecommendation,
    Subject,
    SwitchRecommendation,
    Tag,
    ToolRecommendation,
    User,
    UserSettings,
} from "../types/domain";
import type {AvailableModel, IStorageService} from "./types";

// ---- Row <-> wire mappers --------------------------------------------

function rowToUser(row: UserRow): User {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        language: row.language,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function rowToProject(row: LearningProjectRow): LearningProject {
    return {
        id: row.id,
        user_id: row.user_id,
        topic: row.topic,
        goal: row.goal,
        timeframe: row.timeframe,
        daily_minutes: row.daily_minutes,
        current_problem: row.current_problem,
        active: row.active,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function rowToSettings(row: UserSettingsRow): UserSettings {
    // Phase 34 (v1.20.0) — Dexie mode is desktop-only via PWA;
    // there is no filesystem access from the browser sandbox, so
    // ``secrets.yaml`` never applies here. Every key source
    // collapses to either "settings" (when present in IndexedDB)
    // or "none" (when absent). The UI renders identical
    // affordances in both modes; in Dexie mode the user never
    // sees the externally-managed warning because they can't
    // hit that state.
    return {
        id: row.id,
        user_id: row.user_id,
        language: row.language,
        active_provider: row.active_provider,
        has_anthropic_key: !!row.api_key_anthropic,
        has_openai_key: !!row.api_key_openai,
        has_gemini_key: !!row.api_key_gemini,
        model_override_anthropic: row.model_override_anthropic,
        model_override_openai: row.model_override_openai,
        model_override_gemini: row.model_override_gemini,
        key_source_anthropic: row.api_key_anthropic ? "settings" : "none",
        key_source_openai: row.api_key_openai ? "settings" : "none",
        key_source_gemini: row.api_key_gemini ? "settings" : "none",
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function rowToCurriculum(row: CurriculumRow): Curriculum {
    return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        language: row.language,
        created_at: row.created_at,
        updated_at: row.updated_at,
        imported_conversation_id: row.imported_conversation_id ?? null,
    };
}

function rowToTopic(row: LearningTopicRow): LearningTopic {
    return {
        id: row.id,
        curriculum_id: row.curriculum_id,
        parent_id: row.parent_id,
        title: row.title,
        description: row.description,
        order_index: row.order_index,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function rowToProfile(row: LearningProfileRow): LearningProfile {
    const weights = {
        deductive: row.deductive,
        inductive: row.inductive,
        error_based: row.error_based,
        dialogic: row.dialogic,
        contextual: row.contextual,
        ai_adaptive: row.ai_adaptive,
    };
    // Alphabetical tie-break, matches LearningProfile.dominant_method on backend.
    const sortedKeys = (Object.keys(weights) as (keyof typeof weights)[]).sort();
    let dominant = sortedKeys[0];
    let bestVal = -Infinity;
    for (const k of sortedKeys) {
        if (weights[k] > bestVal) {
            dominant = k;
            bestVal = weights[k];
        }
    }
    return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        deductive: row.deductive,
        inductive: row.inductive,
        error_based: row.error_based,
        dialogic: row.dialogic,
        contextual: row.contextual,
        ai_adaptive: row.ai_adaptive,
        assessed_at: row.assessed_at,
        version: row.version,
        dominant_method: dominant,
    };
}

function rowToLesson(row: LessonRow): Lesson {
    return {
        id: row.id,
        curriculum_id: row.curriculum_id,
        title: row.title,
        content: row.content,
        order_index: row.order_index,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function rowToImportedConversation(
    row: ImportedConversationRow,
): ImportedConversation {
    return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        source: row.source as ImportedConversationSource,
        title: row.title,
        message_count: row.message_count,
        imported_at: row.imported_at,
        analyzed: row.analyzed,
        topic_tag: row.topic_tag,
        model: row.model,
        source_created_at: row.source_created_at,
        analysis_result: row.analysis_result as ConversationAnalysisResult | null,
        content_hash: row.content_hash ?? null,
    };
}

function rowToImportedMessage(row: ImportedMessageRow): ImportedMessage {
    return {
        id: row.id,
        conversation_id: row.conversation_id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        order_index: row.order_index,
    };
}

// ---- Helpers ----------------------------------------------------------

async function requireRow<T extends {id: string}>(
    table: EntityTable<T, "id">,
    id: string,
    label: string,
): Promise<T> {
    // Dexie's IDType<T, "id"> is a conditional type that doesn't
    // reduce to ``string`` even when the row's id field IS a
    // string. Cast at this single boundary so the call sites
    // stay legible.
    const row = await table.get(id as unknown as Parameters<typeof table.get>[0]);
    if (!row) {
        throw new ApiError(404, `${label} ${id} not found`);
    }
    return row;
}

/**
 * Ensure a UserSettings row exists for ``userId``. Used by every
 * settings.* method so a fresh-install browser doesn't 404 on the
 * first read.
 */
async function ensureSettings(
    db: AdaptiveLearnerDB,
    userId: string,
    language: string,
): Promise<UserSettingsRow> {
    const existing = await db.userSettings.where("user_id").equals(userId).first();
    if (existing) return existing;
    const ts = nowIso();
    const row: UserSettingsRow = {
        id: newId(),
        user_id: userId,
        language,
        active_provider: "anthropic",
        api_key_anthropic: null,
        api_key_openai: null,
        api_key_gemini: null,
        model_override_anthropic: null,
        model_override_openai: null,
        model_override_gemini: null,
        created_at: ts,
        updated_at: ts,
    };
    await db.userSettings.add(row);
    return row;
}

// ---- Storage object ---------------------------------------------------

function notImplemented(label: string): never {
    throw new ApiError(
        501,
        `DexieStorage: ${label} not implemented in this build`,
    );
}

export const dexieStorage: IStorageService = {
    mode: "dexie",

    health: async () => ({
        status: "ok",
        version: "dexie-local",
        debug: false,
    }),

    i18n: {
        /**
         * Dexie mode has no backend, so the bundled JSON
         * catalogs under ``frontend/src/data/i18n/`` are the
         * source of truth at runtime. Mirrors what the backend's
         * ``GET /api/i18n/{lang}`` returns in API mode.
         *
         * The JSON files are regenerated from
         * ``backend/config/i18n/*.yaml`` via
         * ``scripts/sync_i18n_to_frontend.py`` — a Vitest pin
         * (``i18n-sync.test.ts``) catches drift.
         */
        get: async (lang: string) => {
            const catalogs = import.meta.glob<Record<string, unknown>>(
                "../data/i18n/*.json",
                {eager: true, import: "default"},
            );
            const path = `../data/i18n/${lang}.json`;
            return catalogs[path] ?? catalogs["../data/i18n/en.json"] ?? {};
        },
    },

    users: {
        async create(body: UserCreateBody): Promise<User> {
            const db = getDb();
            const ts = nowIso();
            const row: UserRow = {
                id: newId(),
                name: body.name,
                email: body.email ?? null,
                language: body.language ?? "de",
                created_at: ts,
                updated_at: ts,
            };
            await db.users.add(row);
            await ensureSettings(db, row.id, row.language);
            return rowToUser(row);
        },
        async get(userId: string): Promise<User> {
            const db = getDb();
            const row = await requireRow(db.users, userId, "User");
            return rowToUser(row);
        },
        async update(userId: string, body: UserUpdateBody): Promise<User> {
            const db = getDb();
            const row = await requireRow(db.users, userId, "User");
            const updated: UserRow = {
                ...row,
                ...(body.name !== undefined ? {name: body.name} : {}),
                ...(body.email !== undefined ? {email: body.email} : {}),
                ...(body.language !== undefined ? {language: body.language} : {}),
                updated_at: nowIso(),
            };
            await db.users.put(updated);
            return rowToUser(updated);
        },
        projects: {
            async list(userId: string): Promise<LearningProject[]> {
                const db = getDb();
                const rows = await db.learningProjects
                    .where("user_id")
                    .equals(userId)
                    .toArray();
                rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
                return rows.map(rowToProject);
            },
            async create(
                userId: string,
                body: LearningProjectCreateBody,
            ): Promise<LearningProject> {
                const db = getDb();
                await requireRow(db.users, userId, "User");
                const ts = nowIso();
                const row: LearningProjectRow = {
                    id: newId(),
                    user_id: userId,
                    topic: body.topic,
                    goal: body.goal,
                    timeframe: body.timeframe,
                    daily_minutes: body.daily_minutes,
                    current_problem: body.current_problem ?? null,
                    active: body.active ?? true,
                    created_at: ts,
                    updated_at: ts,
                };
                await db.learningProjects.add(row);
                return rowToProject(row);
            },
        },
        async findMostRecent() {
            // Phase 41B: Dexie-mode recovery. When localStorage is
            // empty but IndexedDB still carries learner data (a
            // localStorage-only wipe, not a full browser clear), we
            // can re-seed Landing.tsx from the most recent users row
            // + their currently-active project.
            const db = getDb();
            const rows = await db.users.toArray();
            if (rows.length === 0) {
                return null;
            }
            // Sort by updated_at desc; ties broken by created_at desc.
            rows.sort((a, b) => {
                const u = b.updated_at.localeCompare(a.updated_at);
                return u !== 0 ? u : b.created_at.localeCompare(a.created_at);
            });
            const user = rows[0];
            // Pick the user's currently-active project; fall back to
            // the most-recent project when no row is marked active
            // (legacy seed data, partial imports, etc.).
            const projects = await db.learningProjects
                .where("user_id")
                .equals(user.id)
                .toArray();
            const active = projects.find((p) => p.active) ?? null;
            const fallback = projects
                .slice()
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            const project = active ?? fallback ?? null;
            return {
                userId: user.id,
                projectId: project?.id ?? null,
                language: user.language,
            };
        },
    },

    projects: {
        async get(projectId: string): Promise<LearningProject> {
            const db = getDb();
            const row = await requireRow(db.learningProjects, projectId, "Project");
            return rowToProject(row);
        },
        async update(
            projectId: string,
            body: LearningProjectUpdateBody,
        ): Promise<LearningProject> {
            const db = getDb();
            const row = await requireRow(db.learningProjects, projectId, "Project");
            const updated: LearningProjectRow = {
                ...row,
                ...(body.topic !== undefined ? {topic: body.topic} : {}),
                ...(body.goal !== undefined ? {goal: body.goal} : {}),
                ...(body.timeframe !== undefined ? {timeframe: body.timeframe} : {}),
                ...(body.daily_minutes !== undefined
                    ? {daily_minutes: body.daily_minutes}
                    : {}),
                ...(body.current_problem !== undefined
                    ? {current_problem: body.current_problem}
                    : {}),
                ...(body.active !== undefined ? {active: body.active} : {}),
                updated_at: nowIso(),
            };
            await db.learningProjects.put(updated);
            return rowToProject(updated);
        },
    },

    settings: {
        async get(userId: string): Promise<UserSettings> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const row = await ensureSettings(db, userId, user.language);
            return rowToSettings(row);
        },
        async update(
            userId: string,
            body: SettingsPatchBody,
        ): Promise<UserSettings> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const row = await ensureSettings(db, userId, user.language);
            const updated: UserSettingsRow = {
                ...row,
                ...(body.active_provider !== undefined
                    ? {active_provider: body.active_provider}
                    : {}),
                ...(body.language !== undefined ? {language: body.language} : {}),
                ...(body.model_override_anthropic !== undefined
                    ? {
                          model_override_anthropic:
                              body.model_override_anthropic === ""
                                  ? null
                                  : body.model_override_anthropic,
                      }
                    : {}),
                ...(body.model_override_openai !== undefined
                    ? {
                          model_override_openai:
                              body.model_override_openai === ""
                                  ? null
                                  : body.model_override_openai,
                      }
                    : {}),
                ...(body.model_override_gemini !== undefined
                    ? {
                          model_override_gemini:
                              body.model_override_gemini === ""
                                  ? null
                                  : body.model_override_gemini,
                      }
                    : {}),
                updated_at: nowIso(),
            };
            await db.userSettings.put(updated);
            return rowToSettings(updated);
        },
        async setApiKey(
            userId: string,
            body: ApiKeySetBody,
        ): Promise<UserSettings> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const row = await ensureSettings(db, userId, user.language);
            const field = `api_key_${body.provider}` as const;
            const updated: UserSettingsRow = {
                ...row,
                [field]: body.key,
                updated_at: nowIso(),
            };
            await db.userSettings.put(updated);
            return rowToSettings(updated);
        },
        async deleteApiKey(
            userId: string,
            provider: AIProvider,
        ): Promise<UserSettings> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const row = await ensureSettings(db, userId, user.language);
            const field = `api_key_${provider}` as const;
            const updated: UserSettingsRow = {
                ...row,
                [field]: null,
                updated_at: nowIso(),
            };
            await db.userSettings.put(updated);
            return rowToSettings(updated);
        },
        getApp: async () => ({}),
        async getAvailableModels(
            userId: string,
            provider: AIProvider,
        ): Promise<AvailableModel[]> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const row = await ensureSettings(db, userId, user.language);
            const field = `api_key_${provider}` as const;
            const apiKey = (row as unknown as Record<string, unknown>)[field];
            if (typeof apiKey !== "string" || apiKey.length === 0) {
                return [];
            }
            const models = await fetchAvailableModels(provider, apiKey);
            return models.map((m) => ({
                id: m.id,
                name: m.name,
                context_window: m.context_window,
                description: m.description,
            }));
        },
    },

    assessment: {
        questions: async (lang: string): Promise<AssessmentQuestion[]> =>
            questionsForLang(lang),
        async evaluate(body: AssessmentEvaluatePayload): Promise<LearningProfile> {
            const db = getDb();
            const project = await requireRow(
                db.learningProjects,
                body.project_id,
                "Project",
            );
            const weights = calculateProfile(body.answers);
            const ts = nowIso();
            // One-profile-per-project: replace any existing row so
            // re-running the assessment overwrites cleanly. Bump
            // ``version`` so consumers can detect rewrites.
            const existing = await db.learningProfiles
                .where("project_id")
                .equals(body.project_id)
                .first();
            const row: LearningProfileRow = {
                id: existing ? existing.id : newId(),
                user_id: project.user_id,
                project_id: project.id,
                ...weights,
                assessed_at: ts,
                version: existing ? existing.version + 1 : 1,
            };
            await db.learningProfiles.put(row);
            return rowToProfile(row);
        },
        async profile(projectId: string): Promise<LearningProfile> {
            const db = getDb();
            const row = await db.learningProfiles
                .where("project_id")
                .equals(projectId)
                .first();
            if (!row) {
                throw new ApiError(404, `Profile for project ${projectId} not found`);
            }
            return rowToProfile(row);
        },
    },

    session: {
        async start(body: SessionStartBody): Promise<SessionStartResult> {
            return startSession({
                projectId: body.project_id,
                method: body.method,
                cycleStep: body.cycle_step,
                lang: body.lang,
                importedConversationId: body.imported_conversation_id ?? null,
            });
        },
        /**
         * Phase 36 Bug 4 — find the most recent active session
         * started from this conversation. ImportDetail uses the
         * result to flip "Start session" into "Continue session".
         */
        async getActiveForConversation(
            conversationId: string,
        ): Promise<LearningSession | null> {
            const db = getDb();
            const rows = await db.learningSessions
                .where("imported_conversation_id")
                .equals(conversationId)
                .filter((row) => row.status === "active")
                .sortBy("started_at");
            if (rows.length === 0) return null;
            // sortBy is ascending; pick the latest.
            const latest = rows[rows.length - 1];
            return {
                id: latest.id,
                project_id: latest.project_id,
                method: latest.method,
                started_at: latest.started_at,
                ended_at: latest.ended_at,
                cycle_step: latest.cycle_step,
                status: latest.status,
                imported_conversation_id: latest.imported_conversation_id ?? null,
            };
        },
        async message(
            sessionId: string,
            body: SessionMessageBody,
        ): Promise<SessionMessageExchangeResult> {
            return sendMessage({
                sessionId,
                role: body.role,
                content: body.content,
            });
        },
        async streamMessage(
            sessionId: string,
            body: SessionMessageBody,
            handlers: {
                onStart?: (userMessage: SessionMessage) => void;
                onChunk: (delta: string) => void;
                onDone: (result: SessionMessageExchangeResult) => void;
                signal?: AbortSignal;
            },
        ): Promise<void> {
            // v1.6.0 / Phase 19B-2 — browser-direct streaming via
            // the provider's SDK SSE wire (Anthropic
            // /v1/messages?stream=true, OpenAI /chat/completions
            // ?stream=true, Gemini :streamGenerateContent?alt=sse).
            // ``sendMessageStream`` accumulates the full text
            // internally + emits each delta through ``onChunk``,
            // so the SessionChat bubble fills incrementally while
            // we still get the full ``SendMessageResult`` to hand
            // to ``onDone``.
            const result = await sendMessageStream({
                sessionId,
                role: body.role,
                content: body.content,
                onStart: handlers.onStart,
                onChunk: handlers.onChunk,
                signal: handlers.signal,
            });
            handlers.onDone(result);
        },
        async rate(
            sessionId: string,
            body: SessionRatingBody,
        ): Promise<SessionRating> {
            const db = getDb();
            const sess = await db.learningSessions.get(sessionId);
            if (!sess) {
                throw new ApiError(404, `Session ${sessionId} not found`);
            }
            const row: SessionRatingRow = {
                id: newId(),
                session_id: sessionId,
                understanding: body.understanding,
                stress: body.stress,
                method_fit: body.method_fit,
                notes: body.notes ?? null,
                created_at: nowIso(),
            };
            await db.sessionRatings.add(row);
            return {
                id: row.id,
                session_id: row.session_id,
                understanding: row.understanding,
                stress: row.stress,
                method_fit: row.method_fit,
                notes: row.notes,
                created_at: row.created_at,
            };
        },
        async end(sessionId: string): Promise<SessionEndResult> {
            const db = getDb();
            const sess = await db.learningSessions.get(sessionId);
            if (!sess) {
                throw new ApiError(404, `Session ${sessionId} not found`);
            }
            const ts = nowIso();
            await db.learningSessions.update(sessionId, {
                status: "completed",
                ended_at: ts,
            });
            const fresh = await db.learningSessions.get(sessionId);
            if (!fresh) {
                throw new ApiError(500, "Session disappeared after end");
            }
            // Mirror the backend's ``on_session_complete`` fan-out:
            // pull the latest SessionRating for this session and
            // write a ProgressCommit so tracking aggregates pick
            // it up. No-op when the user ended without rating.
            const ratings = await db.sessionRatings
                .where("session_id")
                .equals(sessionId)
                .toArray();
            ratings.sort((a, b) => a.created_at.localeCompare(b.created_at));
            const latestRating = ratings.length > 0 ? ratings[ratings.length - 1] : null;
            const commit = buildCommitFromSession(fresh, latestRating);
            if (commit) {
                await db.progressCommits.add(commit);
            }
            // v1.16.0 / Phase 29A — mirror the backend's
            // gamification ``on_session_complete``: award XP for
            // the closed session. Errors MUST NOT break session
            // end — log and continue.
            const projectForXP = await db.learningProjects.get(fresh.project_id);
            if (projectForXP) {
                try {
                    await awardXPForSession({
                        userId: projectForXP.user_id,
                        sessionId: fresh.id,
                        method: fresh.method,
                        cycleStep: fresh.cycle_step,
                        cycleCount: 1,
                    });
                    // 29C — refresh persisted streak state so the
                    // dashboard widget + the streak-milestone
                    // badges see the new ``current_streak_days``.
                    await updateStreakState(projectForXP.user_id);
                    // 29B — evaluate badges after the XP + streak
                    // update so level-/streak-/method-gated badges
                    // fire.
                    await evaluateBadgesForUser(projectForXP.user_id);
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.warn("gamification (session-end) failed", err);
                }
            }
            // Auto-backup: bump the session counter and, if the
            // threshold is crossed, fire-and-forget a backup into
            // the auto-backup ring. Failures here MUST NOT break
            // session end — ``maybeRunAutoBackup`` swallows errors.
            const trigger = recordCompletedSession();
            if (trigger !== null) {
                const session = await db.learningSessions.get(sessionId);
                if (session !== undefined) {
                    const project = await db.learningProjects.get(session.project_id);
                    if (project !== undefined) {
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        maybeRunAutoBackup(project.user_id, __APP_VERSION__, trigger);
                    }
                }
            }
            return {
                session: {
                    id: fresh.id,
                    project_id: fresh.project_id,
                    method: fresh.method,
                    started_at: fresh.started_at,
                    ended_at: fresh.ended_at,
                    cycle_step: fresh.cycle_step,
                    status: fresh.status,
                },
            };
        },
        async switchRecommendation(
            _sessionId: string,
        ): Promise<SwitchRecommendation> {
            // Stagnation-based method-switch recommendation is
            // deferred. Dexie mode returns "no recommendation"
            // until enough rating data accumulates for a
            // server-style heuristic to fire.
            return {recommended: false, to_method: null, reason: null};
        },
        async acceptSwitch(
            sessionId: string,
            body: {to_method: LearningMethod; reason: string},
        ): Promise<LearningSession> {
            const db = getDb();
            const sess = await db.learningSessions.get(sessionId);
            if (!sess) {
                throw new ApiError(404, `Session ${sessionId} not found`);
            }
            const from = sess.method;
            await db.learningSessions.update(sessionId, {method: body.to_method});
            const switchRow: MethodSwitchRow = {
                id: newId(),
                project_id: sess.project_id,
                session_id: sessionId,
                from_method: from,
                to_method: body.to_method,
                reason: body.reason,
                switched_at: nowIso(),
            };
            await db.methodSwitches.add(switchRow);
            const fresh = await db.learningSessions.get(sessionId);
            if (!fresh) {
                throw new ApiError(500, "Session disappeared after switch");
            }
            return {
                id: fresh.id,
                project_id: fresh.project_id,
                method: fresh.method,
                started_at: fresh.started_at,
                ended_at: fresh.ended_at,
                cycle_step: fresh.cycle_step,
                status: fresh.status,
            };
        },
        /**
         * Phase 38 Bug 7 — fetch a session record by ID for
         * the resume path. ImportDetail navigates to
         * ``/session?session=<id>`` and Session.tsx reads
         * the existing record + messages via these two
         * methods instead of calling ``start()``.
         */
        async get(sessionId: string): Promise<LearningSession> {
            const db = getDb();
            const row = await db.learningSessions.get(sessionId);
            if (!row) {
                throw new ApiError(404, `Session ${sessionId} not found`);
            }
            return {
                id: row.id,
                project_id: row.project_id,
                method: row.method,
                started_at: row.started_at,
                ended_at: row.ended_at,
                cycle_step: row.cycle_step,
                status: row.status,
            };
        },
        /**
         * Phase 38 Bug 7 — list the chat history for a
         * session, oldest-first. Mirrors the backend's
         * ``GET /plugins/session/{id}/messages`` shape.
         */
        async getMessages(sessionId: string): Promise<SessionMessage[]> {
            const db = getDb();
            await db.learningSessions.get(sessionId).then((sess) => {
                if (!sess) {
                    throw new ApiError(
                        404,
                        `Session ${sessionId} not found`,
                    );
                }
            });
            const rows = await db.sessionMessages
                .where("session_id")
                .equals(sessionId)
                .toArray();
            rows.sort((a, b) =>
                a.created_at.localeCompare(b.created_at),
            );
            return rows.map((r) => ({
                id: r.id,
                session_id: r.session_id,
                role: r.role,
                content: r.content,
                created_at: r.created_at,
            }));
        },
    },

    tracking: {
        async progress(projectId: string): Promise<ProgressSummary> {
            const db = getDb();
            const commits = await db.progressCommits
                .where("project_id")
                .equals(projectId)
                .toArray();
            commits.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
            const trackingSlice = aggregateProgress(commits);
            return {tracking: trackingSlice};
        },
        async commits(projectId: string): Promise<ProgressCommit[]> {
            const db = getDb();
            const rows = await db.progressCommits
                .where("project_id")
                .equals(projectId)
                .toArray();
            rows.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
            // v1.14.0 / Phase 27B — join each commit with its
            // session's rating notes. Mirrors the backend route's
            // LEFT JOIN so both storage modes return the same
            // wire shape. Sessions without a rating row produce
            // ``notes: null``.
            const sessionIds = rows.map((r) => r.session_id);
            const ratings = await db.sessionRatings
                .where("session_id")
                .anyOf(sessionIds)
                .toArray();
            const notesBySession = new Map<string, string | null>(
                ratings.map((r) => [r.session_id, r.notes ?? null]),
            );
            return rows.map((row) =>
                rowToCommit(row, notesBySession.get(row.session_id) ?? null),
            );
        },
    },

    tools: {
        async recommendations(
            projectId: string,
            lang: string,
        ): Promise<ToolRecommendation[]> {
            const db = getDb();
            const profile = await db.learningProfiles
                .where("project_id")
                .equals(projectId)
                .first();
            const weights = profile
                ? {
                      deductive: profile.deductive,
                      inductive: profile.inductive,
                      error_based: profile.error_based,
                      dialogic: profile.dialogic,
                      contextual: profile.contextual,
                      ai_adaptive: profile.ai_adaptive,
                  }
                : {};
            return rankTools(weights, lang);
        },
        async spaced(
            projectId: string,
            lang: string,
        ): Promise<SpacedRecommendation[]> {
            const db = getDb();
            const profile = await db.learningProfiles
                .where("project_id")
                .equals(projectId)
                .first();
            if (!profile) return [];
            const commits = await db.progressCommits
                .where("project_id")
                .equals(projectId)
                .toArray();
            commits.sort((a, b) => a.committed_at.localeCompare(b.committed_at));
            const recency = recencyFromCommits(commits);
            const weights = {
                deductive: profile.deductive,
                inductive: profile.inductive,
                error_based: profile.error_based,
                dialogic: profile.dialogic,
                contextual: profile.contextual,
                ai_adaptive: profile.ai_adaptive,
            };
            return buildSpacedRecommendations(weights, recency, lang);
        },
    },

    curricula: {
        async list(userId: string): Promise<Curriculum[]> {
            const db = getDb();
            const rows = await db.curricula.where("user_id").equals(userId).toArray();
            rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return rows.map(rowToCurriculum);
        },
        async create(
            userId: string,
            body: CurriculumCreateBody,
        ): Promise<Curriculum> {
            const db = getDb();
            const user = await requireRow(db.users, userId, "User");
            const ts = nowIso();
            const row: CurriculumRow = {
                id: newId(),
                user_id: userId,
                title: body.title,
                description: body.description ?? null,
                language: body.language ?? user.language,
                created_at: ts,
                updated_at: ts,
                imported_conversation_id: body.imported_conversation_id ?? null,
            };
            await db.curricula.add(row);
            return rowToCurriculum(row);
        },
        /**
         * Phase 36 Bug 3 — return the curriculum auto-generated
         * from this conversation, or ``null`` if none exists.
         * ImportDetail uses the answer to flip the "Create
         * curriculum" CTA into a "Go to curriculum" navigate.
         */
        async getForConversation(
            conversationId: string,
        ): Promise<Curriculum | null> {
            const db = getDb();
            const row = await db.curricula
                .where("imported_conversation_id")
                .equals(conversationId)
                .first();
            return row ? rowToCurriculum(row) : null;
        },
        async get(curriculumId: string): Promise<Curriculum> {
            const db = getDb();
            const row = await requireRow(db.curricula, curriculumId, "Curriculum");
            return rowToCurriculum(row);
        },
        async update(
            curriculumId: string,
            body: CurriculumUpdateBody,
        ): Promise<Curriculum> {
            const db = getDb();
            const row = await requireRow(db.curricula, curriculumId, "Curriculum");
            const updated: CurriculumRow = {
                ...row,
                ...(body.title !== undefined ? {title: body.title} : {}),
                ...(body.description !== undefined
                    ? {description: body.description}
                    : {}),
                ...(body.language !== undefined ? {language: body.language} : {}),
                updated_at: nowIso(),
            };
            await db.curricula.put(updated);
            return rowToCurriculum(updated);
        },
        async remove(curriculumId: string): Promise<void> {
            const db = getDb();
            await db.transaction(
                "rw",
                [db.curricula, db.learningTopics, db.lessons],
                async () => {
                    await db.lessons
                        .where("curriculum_id")
                        .equals(curriculumId)
                        .delete();
                    await db.learningTopics
                        .where("curriculum_id")
                        .equals(curriculumId)
                        .delete();
                    await db.curricula.delete(curriculumId);
                },
            );
        },
        async listTopics(curriculumId: string): Promise<LearningTopic[]> {
            const db = getDb();
            const rows = await db.learningTopics
                .where("curriculum_id")
                .equals(curriculumId)
                .toArray();
            rows.sort((a, b) => a.order_index - b.order_index);
            return rows.map(rowToTopic);
        },
        async createTopic(
            curriculumId: string,
            body: TopicCreateBody,
        ): Promise<LearningTopic> {
            const db = getDb();
            await requireRow(db.curricula, curriculumId, "Curriculum");
            const ts = nowIso();
            const row: LearningTopicRow = {
                id: newId(),
                curriculum_id: curriculumId,
                parent_id: body.parent_id ?? null,
                title: body.title,
                description: body.description ?? null,
                order_index: body.order_index ?? 0,
                created_at: ts,
                updated_at: ts,
            };
            await db.learningTopics.add(row);
            return rowToTopic(row);
        },
        async listLessons(curriculumId: string): Promise<Lesson[]> {
            const db = getDb();
            const rows = await db.lessons
                .where("curriculum_id")
                .equals(curriculumId)
                .toArray();
            rows.sort((a, b) => a.order_index - b.order_index);
            return rows.map(rowToLesson);
        },
        async createLesson(
            curriculumId: string,
            body: LessonCreateBody,
        ): Promise<Lesson> {
            const db = getDb();
            await requireRow(db.curricula, curriculumId, "Curriculum");
            const ts = nowIso();
            const row: LessonRow = {
                id: newId(),
                curriculum_id: curriculumId,
                title: body.title,
                content: body.content ?? "",
                order_index: body.order_index ?? 0,
                created_at: ts,
                updated_at: ts,
            };
            await db.lessons.add(row);
            return rowToLesson(row);
        },
    },

    topics: {
        async get(topicId: string): Promise<LearningTopic> {
            const db = getDb();
            const row = await requireRow(db.learningTopics, topicId, "Topic");
            return rowToTopic(row);
        },
        async update(
            topicId: string,
            body: TopicUpdateBody,
        ): Promise<LearningTopic> {
            const db = getDb();
            const row = await requireRow(db.learningTopics, topicId, "Topic");
            const updated: LearningTopicRow = {
                ...row,
                ...(body.title !== undefined ? {title: body.title} : {}),
                ...(body.description !== undefined
                    ? {description: body.description}
                    : {}),
                ...(body.parent_id !== undefined
                    ? {parent_id: body.parent_id}
                    : {}),
                ...(body.order_index !== undefined
                    ? {order_index: body.order_index}
                    : {}),
                updated_at: nowIso(),
            };
            await db.learningTopics.put(updated);
            return rowToTopic(updated);
        },
        async remove(topicId: string): Promise<void> {
            const db = getDb();
            await db.learningTopics.delete(topicId);
        },
    },

    lessons: {
        async get(lessonId: string): Promise<Lesson> {
            const db = getDb();
            const row = await requireRow(db.lessons, lessonId, "Lesson");
            return rowToLesson(row);
        },
        async update(
            lessonId: string,
            body: LessonUpdateBody,
        ): Promise<Lesson> {
            const db = getDb();
            const row = await requireRow(db.lessons, lessonId, "Lesson");
            const updated: LessonRow = {
                ...row,
                ...(body.title !== undefined ? {title: body.title} : {}),
                ...(body.content !== undefined ? {content: body.content} : {}),
                ...(body.order_index !== undefined
                    ? {order_index: body.order_index}
                    : {}),
                updated_at: nowIso(),
            };
            await db.lessons.put(updated);
            return rowToLesson(updated);
        },
        async remove(lessonId: string): Promise<void> {
            const db = getDb();
            await db.lessons.delete(lessonId);
        },
    },

    plugins: {
        manifests: async () => ({}),
        health: async () => ({}),
        errors: async () => ({}),
    },

    // ---- Imported conversations (v0.9.0 / Phase 12C) ------------------

    imports: {
        async list(userId: string): Promise<ImportedConversation[]> {
            const db = getDb();
            const rows = await db.importedConversations
                .where("user_id")
                .equals(userId)
                .toArray();
            rows.sort((a, b) =>
                a.imported_at < b.imported_at ? 1 : a.imported_at > b.imported_at ? -1 : 0,
            );
            return rows.map(rowToImportedConversation);
        },
        async create(
            userId: string,
            body: ImportedConversationCreateBody,
        ): Promise<ImportedConversation> {
            if (!body.messages || body.messages.length === 0) {
                throw new ApiError(
                    422,
                    "ImportedConversation requires at least one message",
                    "/users/.../imports",
                    "POST",
                );
            }
            const db = getDb();
            const user = await db.users.get(userId);
            if (!user) {
                throw new ApiError(
                    404,
                    `User ${userId} not found.`,
                    "/users/.../imports",
                    "POST",
                );
            }
            if (body.project_id) {
                const project = await db.learningProjects.get(body.project_id);
                if (!project) {
                    throw new ApiError(
                        404,
                        `LearningProject ${body.project_id} not found.`,
                        "/users/.../imports",
                        "POST",
                    );
                }
                if (project.user_id !== userId) {
                    throw new ApiError(
                        400,
                        `Project ${body.project_id} does not belong to user ${userId}.`,
                        "/users/.../imports",
                        "POST",
                    );
                }
            }
            // Phase 36 Bug 1 — compute the same SHA-256 the
            // backend computes (see content-hash.ts) so the per-
            // user duplicate check matches the API path's 409.
            const contentHash = await computeContentHash(body.messages);
            const existing = await db.importedConversations
                .where("content_hash")
                .equals(contentHash)
                .filter((row) => row.user_id === userId)
                .first();
            if (existing) {
                const err = new ApiError(
                    409,
                    "Conversation already imported with the same content.",
                    "/users/.../imports",
                    "POST",
                    undefined,
                    {existing_id: existing.id},
                );
                throw err;
            }
            const conversationId = newId();
            const now = nowIso();
            const conv: ImportedConversationRow = {
                id: conversationId,
                user_id: userId,
                project_id: body.project_id ?? null,
                source: body.source,
                title: body.title,
                message_count: body.messages.length,
                imported_at: now,
                analyzed: false,
                analysis_result: null,
                topic_tag: body.topic_tag ?? null,
                model: body.model ?? null,
                source_created_at: body.source_created_at ?? null,
                content_hash: contentHash,
            };
            await db.importedConversations.put(conv);
            // v1.8.0 / Phase 21D — every imported message now
            // carries ``created_at`` for sync timestamp filtering.
            // We use the parent's ``imported_at`` so every
            // message of a single import shares the same wall-
            // clock moment (matches the backend's Alembic 0007
            // back-fill).
            const messageRows: ImportedMessageRow[] = body.messages.map(
                (msg, idx) => ({
                    id: newId(),
                    conversation_id: conversationId,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp ?? null,
                    order_index: idx,
                    created_at: conv.imported_at,
                }),
            );
            await db.importedMessages.bulkPut(messageRows);
            return rowToImportedConversation(conv);
        },
        async get(conversationId: string): Promise<ImportedConversationDetail> {
            const db = getDb();
            const conv = await db.importedConversations.get(conversationId);
            if (!conv) {
                throw new ApiError(
                    404,
                    `ImportedConversation ${conversationId} not found.`,
                    `/imports/${conversationId}`,
                    "GET",
                );
            }
            const messages = await db.importedMessages
                .where("conversation_id")
                .equals(conversationId)
                .sortBy("order_index");
            return {
                ...rowToImportedConversation(conv),
                messages: messages.map(rowToImportedMessage),
            };
        },
        async update(
            conversationId: string,
            body: ImportedConversationUpdateBody,
        ): Promise<ImportedConversation> {
            const db = getDb();
            const conv = await db.importedConversations.get(conversationId);
            if (!conv) {
                throw new ApiError(
                    404,
                    `ImportedConversation ${conversationId} not found.`,
                    `/imports/${conversationId}`,
                    "PATCH",
                );
            }
            if (body.project_id !== undefined && body.project_id !== null) {
                const project = await db.learningProjects.get(body.project_id);
                if (!project) {
                    throw new ApiError(
                        404,
                        `LearningProject ${body.project_id} not found.`,
                        `/imports/${conversationId}`,
                        "PATCH",
                    );
                }
                if (project.user_id !== conv.user_id) {
                    throw new ApiError(
                        400,
                        `Project ${body.project_id} does not belong to user ${conv.user_id}.`,
                        `/imports/${conversationId}`,
                        "PATCH",
                    );
                }
            }
            const updated: ImportedConversationRow = {
                ...conv,
                project_id:
                    body.project_id !== undefined ? body.project_id : conv.project_id,
                topic_tag:
                    body.topic_tag !== undefined ? body.topic_tag : conv.topic_tag,
                title: body.title ?? conv.title,
            };
            await db.importedConversations.put(updated);
            return rowToImportedConversation(updated);
        },
        async remove(conversationId: string): Promise<void> {
            const db = getDb();
            await db.importedMessages
                .where("conversation_id")
                .equals(conversationId)
                .delete();
            await db.importedConversations.delete(conversationId);
        },
        async saveAnalysis(
            conversationId: string,
            analysis: ImportedConversationAnalysis,
        ): Promise<ImportedConversationDetail> {
            const db = getDb();
            const conv = await db.importedConversations.get(conversationId);
            if (!conv) {
                throw new ApiError(
                    404,
                    `ImportedConversation ${conversationId} not found.`,
                    `/imports/${conversationId}/analysis`,
                    "POST",
                );
            }
            const updated: ImportedConversationRow = {
                ...conv,
                analyzed: true,
                analysis_result: analysis.analysis_result as Record<string, unknown>,
            };
            await db.importedConversations.put(updated);
            const messages = await db.importedMessages
                .where("conversation_id")
                .equals(conversationId)
                .sortBy("order_index");
            return {
                ...rowToImportedConversation(updated),
                messages: messages.map(rowToImportedMessage),
            };
        },
        async analyze(conversationId: string): Promise<ImportedConversationDetail> {
            // Dexie mode runs the analysis browser-side because the
            // cleartext API key lives in the local Dexie row. The
            // caller (Import.tsx) branches on storage.mode and uses
            // ``analyzeConversation`` + ``saveAnalysis`` instead;
            // calling this method in Dexie mode is a wiring bug.
            throw new ApiError(
                501,
                "Server-side analyze is API-mode only. Use the browser-direct path in Dexie mode.",
                `/imports/${conversationId}/analyze`,
                "POST",
            );
        },
    },

    // ---- System info (v1.1.0 / Phase 14B) -----------------------------

    system: {
        async info() {
            // In Dexie mode there is no backend to query. We
            // synthesise the same SystemInfo shape so the About
            // tab renders without conditional branches; fields
            // we can't know browser-side (Python version, backend
            // dep versions, server-side build hash) come through
            // as ``null`` / ``"unknown"`` and the UI hides the
            // matching rows.
            return {
                app: {
                    name: "Adaptive Learner",
                    version: __APP_VERSION__,
                    license: "MIT",
                    authors: ["Asterios Raptis"],
                    repository_url:
                        "https://github.com/astrapi69/adaptive-learner",
                    issues_url:
                        "https://github.com/astrapi69/adaptive-learner/issues",
                    docs_url:
                        "https://astrapi69.github.io/adaptive-learner/docs/",
                    build_hash: "unknown",
                    build_date: "unknown",
                },
                runtime: {
                    python_version: null,
                    platform_system:
                        typeof navigator !== "undefined"
                            ? navigator.platform || "browser"
                            : "browser",
                    platform_release:
                        typeof navigator !== "undefined"
                            ? navigator.userAgent.slice(0, 80)
                            : "",
                    platform_machine: "",
                },
                dependencies: {
                    fastapi: null,
                    sqlalchemy: null,
                    pydantic: null,
                    pluginforge: null,
                },
                paths: {
                    database_path: "Local Browser Storage (IndexedDB)",
                    data_directory: "Local Browser Storage (IndexedDB)",
                },
            };
        },
    },

    // ---- Backup / restore (v1.2.0 / Phase 15B) -------------------------

    backup: {
        export: (userId) => createDexieBackup(userId, __APP_VERSION__),
        import: (userId, payload) => restoreDexieBackup(userId, payload),
        stats: (userId) => getDexieBackupStats(userId),
    },

    export: {
        progress: (userId, lang) => dexieBuildProgressReport(getDb(), userId, lang),
        session: (sessionId, lang) =>
            dexieBuildSessionDetail(getDb(), sessionId, lang),
        curriculum: (curriculumId, lang) =>
            dexieBuildCurriculumOverview(getDb(), curriculumId, lang),
    },

    // ---- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) -------------------

    subjects: {
        async list(): Promise<Subject[]> {
            const db = getDb();
            const rows = await db.subjects.toArray();
            rows.sort((a, b) => a.name.localeCompare(b.name));
            return rows;
        },
        async get(subjectId: string): Promise<Subject> {
            const db = getDb();
            const row = await db.subjects.get(subjectId);
            if (!row) {
                throw new ApiError(
                    404,
                    `Subject ${subjectId} not found`,
                    `/subjects/${subjectId}`,
                    "GET",
                );
            }
            return row;
        },
        async create(body: SubjectCreateBody): Promise<Subject> {
            const db = getDb();
            if (body.parent_id) {
                const parent = await db.subjects.get(body.parent_id);
                if (!parent) {
                    throw new ApiError(
                        404,
                        `Parent subject ${body.parent_id} not found`,
                        "/subjects",
                        "POST",
                    );
                }
            }
            const ts = nowIso();
            const row: Subject = {
                id: newId(),
                parent_id: body.parent_id ?? null,
                name: body.name,
                description: body.description ?? null,
                icon: body.icon ?? null,
                created_at: ts,
                updated_at: ts,
            };
            await db.subjects.add(row);
            return row;
        },
        async update(subjectId: string, body: SubjectUpdateBody): Promise<Subject> {
            const db = getDb();
            const existing = await db.subjects.get(subjectId);
            if (!existing) {
                throw new ApiError(
                    404,
                    `Subject ${subjectId} not found`,
                    `/subjects/${subjectId}`,
                    "PATCH",
                );
            }
            if (body.parent_id !== undefined && body.parent_id === subjectId) {
                throw new ApiError(
                    400,
                    "Subject cannot be its own parent.",
                    `/subjects/${subjectId}`,
                    "PATCH",
                );
            }
            if (body.parent_id) {
                const parent = await db.subjects.get(body.parent_id);
                if (!parent) {
                    throw new ApiError(
                        404,
                        `Parent subject ${body.parent_id} not found`,
                        `/subjects/${subjectId}`,
                        "PATCH",
                    );
                }
            }
            const next: Subject = {
                ...existing,
                ...(body.name !== undefined && {name: body.name}),
                ...(body.parent_id !== undefined && {parent_id: body.parent_id}),
                ...(body.description !== undefined && {
                    description: body.description,
                }),
                ...(body.icon !== undefined && {icon: body.icon}),
                updated_at: nowIso(),
            };
            await db.subjects.put(next);
            return next;
        },
        async remove(subjectId: string): Promise<void> {
            const db = getDb();
            await db.transaction(
                "rw",
                [db.subjects, db.projectSubjects],
                async () => {
                    // Detach children (SET NULL behaviour).
                    await db.subjects
                        .where("parent_id")
                        .equals(subjectId)
                        .modify({parent_id: null, updated_at: nowIso()});
                    await db.projectSubjects
                        .where("subject_id")
                        .equals(subjectId)
                        .delete();
                    await db.subjects.delete(subjectId);
                },
            );
        },
    },

    tags: {
        async list(userId: string): Promise<Tag[]> {
            const db = getDb();
            const rows = await db.tags.where("user_id").equals(userId).toArray();
            rows.sort((a, b) => a.name.localeCompare(b.name));
            return rows;
        },
        async create(userId: string, body: TagCreateBody): Promise<Tag> {
            const db = getDb();
            const existing = await db.tags
                .where("user_id")
                .equals(userId)
                .and((row) => row.name === body.name)
                .first();
            if (existing) {
                throw new ApiError(
                    409,
                    `Tag '${body.name}' already exists for this user.`,
                    `/users/${userId}/tags`,
                    "POST",
                );
            }
            const row: Tag = {
                id: newId(),
                user_id: userId,
                name: body.name,
                color: body.color ?? null,
                created_at: nowIso(),
            };
            await db.tags.add(row);
            return row;
        },
        async update(tagId: string, body: TagUpdateBody): Promise<Tag> {
            const db = getDb();
            const existing = await db.tags.get(tagId);
            if (!existing) {
                throw new ApiError(
                    404,
                    `Tag ${tagId} not found`,
                    `/tags/${tagId}`,
                    "PATCH",
                );
            }
            if (body.name !== undefined && body.name !== existing.name) {
                const clash = await db.tags
                    .where("user_id")
                    .equals(existing.user_id)
                    .and((row) => row.name === body.name && row.id !== tagId)
                    .first();
                if (clash) {
                    throw new ApiError(
                        409,
                        `Tag '${body.name}' already exists for this user.`,
                        `/tags/${tagId}`,
                        "PATCH",
                    );
                }
            }
            const next: Tag = {
                ...existing,
                ...(body.name !== undefined && {name: body.name}),
                ...(body.color !== undefined && {color: body.color}),
            };
            await db.tags.put(next);
            return next;
        },
        async remove(tagId: string): Promise<void> {
            const db = getDb();
            await db.transaction("rw", [db.tags, db.projectTags], async () => {
                await db.projectTags.where("tag_id").equals(tagId).delete();
                await db.tags.delete(tagId);
            });
        },
    },

    projectTaxonomy: {
        async listSubjects(projectId: string): Promise<Subject[]> {
            const db = getDb();
            const assocs = await db.projectSubjects
                .where("project_id")
                .equals(projectId)
                .toArray();
            const subjectIds = assocs.map((a) => a.subject_id);
            const subjects = await db.subjects.bulkGet(subjectIds);
            const out = subjects.filter((s): s is Subject => s !== undefined);
            out.sort((a, b) => a.name.localeCompare(b.name));
            return out;
        },
        async assignSubject(
            projectId: string,
            subjectId: string,
        ): Promise<Subject> {
            const db = getDb();
            const project = await db.learningProjects.get(projectId);
            if (!project) {
                throw new ApiError(
                    404,
                    `Project ${projectId} not found`,
                    `/projects/${projectId}/subjects`,
                    "POST",
                );
            }
            const subject = await db.subjects.get(subjectId);
            if (!subject) {
                throw new ApiError(
                    404,
                    `Subject ${subjectId} not found`,
                    `/projects/${projectId}/subjects`,
                    "POST",
                );
            }
            const existing = await db.projectSubjects
                .where("project_id")
                .equals(projectId)
                .and((row) => row.subject_id === subjectId)
                .first();
            if (!existing) {
                await db.projectSubjects.add({
                    id: newId(),
                    project_id: projectId,
                    subject_id: subjectId,
                    created_at: nowIso(),
                });
            }
            return subject;
        },
        async unassignSubject(
            projectId: string,
            subjectId: string,
        ): Promise<void> {
            const db = getDb();
            const existing = await db.projectSubjects
                .where("project_id")
                .equals(projectId)
                .and((row) => row.subject_id === subjectId)
                .first();
            if (!existing) {
                throw new ApiError(
                    404,
                    `Subject ${subjectId} not assigned to project ${projectId}`,
                    `/projects/${projectId}/subjects/${subjectId}`,
                    "DELETE",
                );
            }
            await db.projectSubjects.delete(existing.id);
        },
        async listTags(projectId: string): Promise<Tag[]> {
            const db = getDb();
            const assocs = await db.projectTags
                .where("project_id")
                .equals(projectId)
                .toArray();
            const tagIds = assocs.map((a) => a.tag_id);
            const tags = await db.tags.bulkGet(tagIds);
            const out = tags.filter((t): t is Tag => t !== undefined);
            out.sort((a, b) => a.name.localeCompare(b.name));
            return out;
        },
        async assignTag(projectId: string, tagId: string): Promise<Tag> {
            const db = getDb();
            const project = await db.learningProjects.get(projectId);
            if (!project) {
                throw new ApiError(
                    404,
                    `Project ${projectId} not found`,
                    `/projects/${projectId}/tags`,
                    "POST",
                );
            }
            const tag = await db.tags.get(tagId);
            if (!tag) {
                throw new ApiError(
                    404,
                    `Tag ${tagId} not found`,
                    `/projects/${projectId}/tags`,
                    "POST",
                );
            }
            if (tag.user_id !== project.user_id) {
                throw new ApiError(
                    400,
                    "Tag and project belong to different users.",
                    `/projects/${projectId}/tags`,
                    "POST",
                );
            }
            const existing = await db.projectTags
                .where("project_id")
                .equals(projectId)
                .and((row) => row.tag_id === tagId)
                .first();
            if (!existing) {
                await db.projectTags.add({
                    id: newId(),
                    project_id: projectId,
                    tag_id: tagId,
                    created_at: nowIso(),
                });
            }
            return tag;
        },
        async unassignTag(projectId: string, tagId: string): Promise<void> {
            const db = getDb();
            const existing = await db.projectTags
                .where("project_id")
                .equals(projectId)
                .and((row) => row.tag_id === tagId)
                .first();
            if (!existing) {
                throw new ApiError(
                    404,
                    `Tag ${tagId} not assigned to project ${projectId}`,
                    `/projects/${projectId}/tags/${tagId}`,
                    "DELETE",
                );
            }
            await db.projectTags.delete(existing.id);
        },
    },

    gamification: {
        getState: (userId) => getXPState(userId),
        awardAssessment: async (userId) => {
            const award = await awardXPFlat(
                userId,
                100,
                "assessment_complete",
            );
            try {
                await evaluateBadgesForUser(userId);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn("badge evaluate (assessment) failed", err);
            }
            return award;
        },
        awardImport: async (userId) => {
            const award = await awardXPFlat(
                userId,
                75,
                "conversation_imported",
            );
            try {
                await evaluateBadgesForUser(userId);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn("badge evaluate (import) failed", err);
            }
            return award;
        },
        listBadges: (userId) => listBadgesWithProgress(userId),
        evaluateBadges: async (userId) => {
            const earned = await evaluateBadgesForUser(userId);
            return {earned};
        },
        getStreak: (userId) => getStreakState(userId),
        getStreakHeatmap: (userId, days) => calendarHeatmap(userId, days ?? 365),
        setWeekendMode: (userId, enabled) =>
            setWeekendModeStorage(userId, enabled),
        async resetProgress(userId) {
            const db = getDb();
            const xp = await db.userXp.where({user_id: userId}).toArray();
            const badges = await db.userBadges
                .where({user_id: userId})
                .toArray();
            const streak = await db.userStreaks
                .where({user_id: userId})
                .toArray();
            const xpDeleted = await db.userXp
                .where({user_id: userId})
                .delete();
            const badgesDeleted = await db.userBadges
                .where({user_id: userId})
                .delete();
            const streakDeleted = await db.userStreaks
                .where({user_id: userId})
                .delete();
            return {
                xp_deleted: xpDeleted || xp.length,
                badges_deleted: badgesDeleted || badges.length,
                streak_deleted: streakDeleted || streak.length,
            };
        },
    },

    notebooklm: {
        listQuestions: (userId, filters) =>
            listStudyQuestions(userId, filters),
        createQuestion: (userId, body) =>
            createStudyQuestion(userId, body),
        updateQuestion: (questionId, body) =>
            updateStudyQuestion(questionId, body),
        deleteQuestion: (questionId) => deleteStudyQuestion(questionId),
        generateFromSession: () => generateFromSessionDexie(),
        generateFromProject: () => generateFromProjectDexie(),
        studyGuide: () => studyGuideDexie(),
    },

    pronunciation: {
        async eligibility(projectId) {
            // Walk the project's subjects + every parent chain
            // looking for a "Languages" (or "Sprachen") node.
            const db = getDb();
            const assocs = await db.projectSubjects
                .where({project_id: projectId})
                .toArray();
            if (assocs.length === 0) return {eligible: false};
            const visited = new Set<string>();
            for (const a of assocs) {
                let cursor: string | null = a.subject_id;
                while (cursor !== null && !visited.has(cursor)) {
                    visited.add(cursor);
                    const subj: SubjectRow | undefined = await db.subjects.get(cursor);
                    if (!subj) break;
                    if (
                        subj.name.toLowerCase() === "languages" ||
                        subj.name.toLowerCase() === "sprachen"
                    ) {
                        return {eligible: true};
                    }
                    cursor = subj.parent_id;
                }
            }
            return {eligible: false};
        },
        phrase: async () => {
            throw new ApiError(
                501,
                "Pronunciation practice requires API mode for the AI calls. " +
                    "Switch to API mode in Settings.",
            );
        },
        judge: async () => {
            throw new ApiError(
                501,
                "Pronunciation practice requires API mode for the AI calls. " +
                    "Switch to API mode in Settings.",
            );
        },
    },

    anki: {
        list: (userId, filters) => listAnkiCards(userId, filters),
        create: (userId, body) => createAnkiCard(userId, body),
        update: (cardId, body) => updateAnkiCard(cardId, body),
        remove: (cardId) => deleteAnkiCard(cardId),
        extractFromSession: (sessionId) => extractFromSessionDexie(sessionId),
        extractFromConversation: (conversationId) =>
            extractFromConversationDexie(conversationId),
        markExported: (cardIds) => markAnkiCardsExported(cardIds),
    },

    // Phase 41F Danger Zone: typed-confirm reset for Dexie mode.
    // Clears every table on the main Dexie DB plus the separate
    // auto-backup ring (kept in its own Dexie database by
    // auto-backup.ts). The confirmation gate matches the backend
    // server-side check (CONFIRMATION_TOKEN === "RESET"), enforced
    // here so the UI's typed-confirm pattern behaves identically
    // across modes; reject with ApiError(400) for parity with the
    // API-mode 400 response.
    reset: async (confirmation) => {
        if (confirmation !== "RESET") {
            throw new ApiError(400, "Confirmation token mismatch.");
        }
        const db = getDb();
        // Clear every store on the main Dexie DB. Listing them
        // explicitly rather than iterating ``db.tables`` so a
        // future contributor who renames a table sees a clear
        // diff here instead of a silently expanded reset.
        const tableNames = [
            "users",
            "userSettings",
            "learningProjects",
            "learningProfiles",
            "curricula",
            "learningTopics",
            "lessons",
            "learningSessions",
            "sessionMessages",
            "sessionRatings",
            "sessionNotes",
            "progressCommits",
            "methodSwitches",
            "stepEvaluations",
            "importedConversations",
            "importedMessages",
            "subjects",
            "tags",
            "projectSubjects",
            "projectTags",
            "userXP",
            "badges",
            "userBadges",
            "userStreaks",
            "ankiCards",
            "studyQuestions",
        ];
        let cleared = 0;
        for (const name of tableNames) {
            const table = (db as unknown as Record<string, unknown>)[name];
            if (table && typeof table === "object" && "clear" in table) {
                try {
                    await (table as {clear(): Promise<void>}).clear();
                    cleared += 1;
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.warn(`Dexie reset: clear(${name}) failed:`, err);
                }
            }
        }
        await clearAllAutoBackups();
        return {reset: true, tables_cleared: cleared};
    },
};
