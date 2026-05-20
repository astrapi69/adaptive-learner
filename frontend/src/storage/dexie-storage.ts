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
    type UserRow,
    type UserSettingsRow,
} from "./db";
import {
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
import {sendMessage, startSession} from "./session-flow";
import {
    aggregateProgress,
    buildCommitFromSession,
    rowToCommit,
} from "./tracking";
import {buildSpacedRecommendations, rankTools, recencyFromCommits} from "./tools";
import {ApiError} from "../api/client";
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
    SwitchRecommendation,
    ToolRecommendation,
    User,
    UserSettings,
} from "../types/domain";
import type {IStorageService} from "./types";

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
         * Local mode has no server catalog; ``useI18n`` falls back
         * to the inline fallback strings in ``i18n/fallbacks.ts``
         * when the resolved object is empty. Returning ``{}`` is
         * therefore the right shape, NOT throwing.
         */
        get: async () => ({}),
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
            });
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
            // Phase 19B-1: Dexie-mode streaming lives in the
            // dedicated browser-direct path in Phase 19B-2. For
            // now, fall back to the non-streaming ``message`` and
            // emit the assistant response as a single chunk so
            // consumers in Dexie mode keep working unchanged.
            const result = await sendMessage({
                sessionId,
                role: body.role,
                content: body.content,
            });
            if (handlers.onStart) {
                handlers.onStart(result.user_message);
            }
            if (result.assistant_message?.content) {
                handlers.onChunk(result.assistant_message.content);
            }
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
            return rows.map(rowToCommit);
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
            };
            await db.curricula.add(row);
            return rowToCurriculum(row);
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
            };
            await db.importedConversations.put(conv);
            const messageRows: ImportedMessageRow[] = body.messages.map(
                (msg, idx) => ({
                    id: newId(),
                    conversation_id: conversationId,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp ?? null,
                    order_index: idx,
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
};
