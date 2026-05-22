/**
 * Storage abstraction layer (Phase 10A).
 *
 * ``IStorageService`` is the implementation-agnostic contract that
 * pages and components consume. Two implementations satisfy it:
 *
 *   - ``ApiStorage`` (10A): delegates to the FastAPI backend via
 *     ``api/client.ts``. Existing behaviour, unchanged.
 *   - ``DexieStorage`` (10B-10E): stores everything in IndexedDB
 *     via Dexie.js, calls AI providers directly from the browser.
 *
 * Pages MUST import from the storage layer (`getStorage()`), not
 * from ``api/client.ts`` directly. The factory in
 * ``storage/index.ts`` picks the right backend based on build-time
 * configuration and runtime preference.
 *
 * The method names mirror the ``api.*`` namespaces 1:1 so that
 * ApiStorage can be a thin pass-through. The argument lists are
 * the same as the existing api/client; the return shapes are the
 * same domain types from ``types/domain.ts``.
 */

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
    Curriculum,
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

export interface IUsersNamespace {
    create(body: UserCreateBody): Promise<User>;
    get(userId: string): Promise<User>;
    update(userId: string, body: UserUpdateBody): Promise<User>;
    projects: {
        list(userId: string): Promise<LearningProject[]>;
        create(userId: string, body: LearningProjectCreateBody): Promise<LearningProject>;
    };
}

export interface IProjectsNamespace {
    get(projectId: string): Promise<LearningProject>;
    update(projectId: string, body: LearningProjectUpdateBody): Promise<LearningProject>;
}

export interface AvailableModel {
    id: string;
    name: string;
    context_window: number | null;
    description: string | null;
}

export interface ISettingsNamespace {
    get(userId: string): Promise<UserSettings>;
    update(userId: string, body: SettingsPatchBody): Promise<UserSettings>;
    setApiKey(userId: string, body: ApiKeySetBody): Promise<UserSettings>;
    deleteApiKey(userId: string, provider: AIProvider): Promise<UserSettings>;
    getApp(): Promise<Record<string, unknown>>;
    /**
     * v1.11.0 / Phase 24 — provider model discovery. Returns
     * the chat-capable models the user has access to from the
     * provider's official models endpoint. Returns ``[]`` when
     * no API key for the provider is configured. Throws
     * ``ApiError`` on auth / network failure.
     */
    getAvailableModels(userId: string, provider: AIProvider): Promise<AvailableModel[]>;
}

export interface IAssessmentNamespace {
    questions(lang: string): Promise<AssessmentQuestion[]>;
    evaluate(body: AssessmentEvaluatePayload): Promise<LearningProfile>;
    profile(projectId: string): Promise<LearningProfile>;
}

export interface StreamMessageHandlers {
    onStart?: (userMessage: SessionMessage) => void;
    onChunk: (delta: string) => void;
    onDone: (result: SessionMessageExchangeResult) => void;
    signal?: AbortSignal;
}

export interface ISessionNamespace {
    start(body: SessionStartBody): Promise<SessionStartResult>;
    message(sessionId: string, body: SessionMessageBody): Promise<SessionMessageExchangeResult>;
    /**
     * v1.6.0 / Phase 19 — streaming variant of ``message``. Same
     * input + same exchange result, but the assistant text streams
     * back via the ``onChunk`` callback as it arrives. ``onDone``
     * fires once with the full exchange (assistant message + step
     * eval + topic transition + timings) when the stream closes.
     */
    streamMessage(
        sessionId: string,
        body: SessionMessageBody,
        handlers: StreamMessageHandlers,
    ): Promise<void>;
    rate(sessionId: string, body: SessionRatingBody): Promise<SessionRating>;
    end(sessionId: string): Promise<SessionEndResult>;
    switchRecommendation(sessionId: string): Promise<SwitchRecommendation>;
    acceptSwitch(
        sessionId: string,
        body: {to_method: LearningMethod; reason: string},
    ): Promise<LearningSession>;
}

export interface ITrackingNamespace {
    progress(projectId: string): Promise<ProgressSummary>;
    commits(projectId: string): Promise<ProgressCommit[]>;
}

export interface IToolsNamespace {
    recommendations(projectId: string, lang: string): Promise<ToolRecommendation[]>;
    spaced(projectId: string, lang: string): Promise<SpacedRecommendation[]>;
}

export interface ICurriculaNamespace {
    list(userId: string): Promise<Curriculum[]>;
    create(userId: string, body: CurriculumCreateBody): Promise<Curriculum>;
    get(curriculumId: string): Promise<Curriculum>;
    update(curriculumId: string, body: CurriculumUpdateBody): Promise<Curriculum>;
    remove(curriculumId: string): Promise<void>;
    listTopics(curriculumId: string): Promise<LearningTopic[]>;
    createTopic(curriculumId: string, body: TopicCreateBody): Promise<LearningTopic>;
    listLessons(curriculumId: string): Promise<Lesson[]>;
    createLesson(curriculumId: string, body: LessonCreateBody): Promise<Lesson>;
}

export interface ITopicsNamespace {
    get(topicId: string): Promise<LearningTopic>;
    update(topicId: string, body: TopicUpdateBody): Promise<LearningTopic>;
    remove(topicId: string): Promise<void>;
}

export interface ILessonsNamespace {
    get(lessonId: string): Promise<Lesson>;
    update(lessonId: string, body: LessonUpdateBody): Promise<Lesson>;
    remove(lessonId: string): Promise<void>;
}

export interface II18nNamespace {
    get(lang: string): Promise<Record<string, unknown>>;
}

export interface IPluginsNamespace {
    manifests(): Promise<Record<string, unknown>>;
    health(): Promise<Record<string, unknown>>;
    errors(): Promise<Record<string, string>>;
}

// --- Imports (v0.9.0 / Phase 12C) --------------------------------------

import type {
    BackupPayload,
    BackupStats,
    ImportedConversation,
    ImportedConversationDetail,
    ImportedConversationCreateBody,
    ImportedConversationUpdateBody,
    ImportedConversationAnalysis,
    RestoreSummary,
    SystemInfo,
} from "../types/domain";

export interface ISystemNamespace {
    info(): Promise<SystemInfo>;
}

/**
 * Backup namespace (v1.2.0 / Phase 15). Both storage modes
 * implement the same shape so the Settings UI doesn't branch.
 *
 * - In API mode: delegates to ``/api/backup/*``.
 * - In Dexie mode: runs the same logic browser-side using the
 *   IndexedDB tables directly. The wire format is identical so
 *   a backup created in either mode can be restored in either.
 */
export interface IBackupNamespace {
    export(userId: string): Promise<BackupPayload>;
    import(userId: string, payload: BackupPayload): Promise<RestoreSummary>;
    stats(userId: string): Promise<BackupStats & {user_id: string}>;
}

/**
 * Export namespace (v1.3.0 / Phase 16). Produces the structured
 * payload that ``lib/export/markdown-renderer`` and the PDF
 * renderer consume. Same shape in both storage modes.
 */
export interface IExportNamespace {
    progress(
        userId: string,
        lang: string,
    ): Promise<import("./export-builder").ProgressReport>;
    session(
        sessionId: string,
        lang: string,
    ): Promise<import("./export-builder").SessionDetail>;
    curriculum(
        curriculumId: string,
        lang: string,
    ): Promise<import("./export-builder").CurriculumOverview>;
}

// --- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) ---------------------

export interface ISubjectsNamespace {
    list(): Promise<Subject[]>;
    get(subjectId: string): Promise<Subject>;
    create(body: SubjectCreateBody): Promise<Subject>;
    update(subjectId: string, body: SubjectUpdateBody): Promise<Subject>;
    remove(subjectId: string): Promise<void>;
}

export interface ITagsNamespace {
    list(userId: string): Promise<Tag[]>;
    create(userId: string, body: TagCreateBody): Promise<Tag>;
    update(tagId: string, body: TagUpdateBody): Promise<Tag>;
    remove(tagId: string): Promise<void>;
}

export interface IProjectTaxonomyNamespace {
    listSubjects(projectId: string): Promise<Subject[]>;
    assignSubject(projectId: string, subjectId: string): Promise<Subject>;
    unassignSubject(projectId: string, subjectId: string): Promise<void>;
    listTags(projectId: string): Promise<Tag[]>;
    assignTag(projectId: string, tagId: string): Promise<Tag>;
    unassignTag(projectId: string, tagId: string): Promise<void>;
}

/**
 * Anki flashcard suggestion (Phase 30B / v1.17.0).
 *
 * AI-extracted candidate that the user reviews + accepts +
 * edits before .apkg export. Mirrors the backend
 * ``AnkiCardSuggestionOut`` schema.
 */
export interface AnkiCardSuggestion {
    id: string;
    user_id: string;
    session_id: string | null;
    conversation_id: string | null;
    project_id: string | null;
    card_type: "basic" | "cloze";
    front: string;
    back: string;
    tags: string[];
    accepted: boolean;
    rejected: boolean;
    exported_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AnkiCardCreateBody {
    session_id?: string | null;
    conversation_id?: string | null;
    project_id?: string | null;
    card_type?: "basic" | "cloze";
    front: string;
    back: string;
    tags?: string[];
    accepted?: boolean;
}

export interface AnkiCardUpdateBody {
    card_type?: "basic" | "cloze";
    front?: string;
    back?: string;
    tags?: string[];
    accepted?: boolean;
    rejected?: boolean;
}

export interface AnkiCardListFilters {
    projectId?: string;
    acceptedOnly?: boolean;
    includeRejected?: boolean;
}

/**
 * Pronunciation practice (Phase 31C / v1.18.0).
 *
 * ``eligibility`` works in both storage modes — it just walks
 * the project's subject taxonomy looking for a ``Languages``
 * ancestor.
 *
 * ``phrase`` + ``judge`` require an active AI provider with a
 * stored API key; the API-mode path is the backend's
 * ``/plugins/session/pronunciation/*`` routes, and the
 * Dexie-mode path throws ``ApiError(501)`` for v1.18.0 (browser-
 * direct AI for pronunciation deferred to a polish patch). The
 * Pronunciation page surfaces a clear "switch to API mode"
 * hint when the throw fires.
 */
export interface PronunciationVerdict {
    matches: boolean;
    score: number;
    feedback: string;
    missed_sounds: string[];
}

export interface IPronunciationNamespace {
    eligibility(projectId: string): Promise<{eligible: boolean}>;
    phrase(args: {
        project_id: string;
        language: string;
        level?: string;
        focus?: string;
        previous?: string[];
    }): Promise<{phrase: string; language: string}>;
    judge(args: {
        project_id: string;
        target: string;
        actual: string;
        language: string;
    }): Promise<PronunciationVerdict>;
}

export interface IAnkiNamespace {
    list(
        userId: string,
        filters?: AnkiCardListFilters,
    ): Promise<AnkiCardSuggestion[]>;
    create(
        userId: string,
        body: AnkiCardCreateBody,
    ): Promise<AnkiCardSuggestion>;
    update(
        cardId: string,
        body: AnkiCardUpdateBody,
    ): Promise<AnkiCardSuggestion>;
    remove(cardId: string): Promise<void>;
    extractFromSession(sessionId: string): Promise<AnkiCardSuggestion[]>;
    extractFromConversation(
        conversationId: string,
    ): Promise<AnkiCardSuggestion[]>;
    markExported(cardIds: string[]): Promise<{updated: number}>;
}

/**
 * Per-user XP / level state (Phase 29A / v1.16.0).
 *
 * ``state`` returns the current ``UserXP`` row plus derived
 * ``xp_into_level`` + ``xp_to_next_level`` so the dashboard
 * progress bar doesn't have to recompute the threshold curve.
 *
 * ``awardSession`` is invoked from session-end in Dexie mode
 * only — in API mode the gamification plugin's hook handles
 * the award server-side. Returns the breakdown so the floating
 * "+50 XP" animation can render without a follow-up roundtrip.
 *
 * ``awardAssessment`` / ``awardImport`` are flat earns from
 * the assessment + import flows; both modes call them.
 */
export interface XPState {
    user_id: string;
    total_xp: number;
    level: number;
    xp_into_level: number;
    xp_to_next_level: number;
    next_level_threshold: number;
    updated_at?: string;
}

export interface XPAwardResult {
    xp_earned: number;
    xp_total: number;
    level: number;
    level_up: boolean;
    multiplier: number;
    breakdown: Record<string, number>;
    reason: string;
}

/**
 * Badge catalog + earn state combined (Phase 29B). The frontend
 * receives the full catalog with per-user ``earned`` + ``earned_at``
 * fields so the showcase can render locked + unlocked badges in
 * one roundtrip.
 */
export interface BadgeWithProgress {
    key: string;
    name_key: string;
    description_key: string;
    icon: string;
    category: string;
    earned: boolean;
    earned_at: string | null;
    progress: string | null;
}

export interface StreakStateOut {
    user_id: string;
    current_streak_days: number;
    longest_streak_days: number;
    freezes_available: number;
    weekend_mode: boolean;
    last_freeze_earned_on: string | null;
    last_freeze_used_on: string | null;
}

export interface HeatmapEntryOut {
    date: string;
    count: number;
}

export interface IGamificationNamespace {
    getState(userId: string): Promise<XPState>;
    awardAssessment(userId: string): Promise<XPAwardResult>;
    awardImport(userId: string): Promise<XPAwardResult>;
    listBadges(userId: string): Promise<BadgeWithProgress[]>;
    evaluateBadges(userId: string): Promise<{earned: string[]}>;
    getStreak(userId: string): Promise<StreakStateOut>;
    getStreakHeatmap(userId: string, days?: number): Promise<HeatmapEntryOut[]>;
    setWeekendMode(userId: string, enabled: boolean): Promise<StreakStateOut>;
    /** Destructive: wipes XP, badges, streak. Used by Settings. */
    resetProgress(userId: string): Promise<{
        xp_deleted: number;
        badges_deleted: number;
        streak_deleted: number;
    }>;
}

export interface IImportsNamespace {
    list(userId: string): Promise<ImportedConversation[]>;
    create(
        userId: string,
        body: ImportedConversationCreateBody,
    ): Promise<ImportedConversation>;
    get(conversationId: string): Promise<ImportedConversationDetail>;
    update(
        conversationId: string,
        body: ImportedConversationUpdateBody,
    ): Promise<ImportedConversation>;
    remove(conversationId: string): Promise<void>;
    saveAnalysis(
        conversationId: string,
        analysis: ImportedConversationAnalysis,
    ): Promise<ImportedConversationDetail>;
    /**
     * Server-side analyze. API mode dispatches the analysis call
     * server-side because the user's cleartext API key never
     * leaves the backend. Dexie mode keeps the browser-direct
     * path (the cleartext key lives in the local Dexie row), so
     * this method throws there — callers must branch on
     * ``storage.mode``.
     */
    analyze(conversationId: string): Promise<ImportedConversationDetail>;
}

/**
 * Marker for the backing store. Pages don't typically need to
 * branch on this, but Settings (and a few tests) do.
 */
export type StorageMode = "api" | "dexie";

/**
 * The full storage contract. Mirrors ``api.*`` in api/client.ts;
 * every namespace's methods take the same arguments and return
 * the same domain types.
 */
export interface IStorageService {
    readonly mode: StorageMode;

    health(): Promise<{status: string; version: string; debug: boolean}>;

    i18n: II18nNamespace;
    users: IUsersNamespace;
    projects: IProjectsNamespace;
    settings: ISettingsNamespace;
    assessment: IAssessmentNamespace;
    session: ISessionNamespace;
    tracking: ITrackingNamespace;
    tools: IToolsNamespace;
    curricula: ICurriculaNamespace;
    topics: ITopicsNamespace;
    lessons: ILessonsNamespace;
    plugins: IPluginsNamespace;
    imports: IImportsNamespace;
    system: ISystemNamespace;
    backup: IBackupNamespace;
    export: IExportNamespace;
    subjects: ISubjectsNamespace;
    tags: ITagsNamespace;
    projectTaxonomy: IProjectTaxonomyNamespace;
    gamification: IGamificationNamespace;
    anki: IAnkiNamespace;
    pronunciation: IPronunciationNamespace;
}
