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
    SessionMessageExchangeResult,
    SessionRating,
    SessionStartResult,
    SpacedRecommendation,
    SwitchRecommendation,
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

export interface ISettingsNamespace {
    get(userId: string): Promise<UserSettings>;
    update(userId: string, body: SettingsPatchBody): Promise<UserSettings>;
    setApiKey(userId: string, body: ApiKeySetBody): Promise<UserSettings>;
    deleteApiKey(userId: string, provider: AIProvider): Promise<UserSettings>;
    getApp(): Promise<Record<string, unknown>>;
}

export interface IAssessmentNamespace {
    questions(lang: string): Promise<AssessmentQuestion[]>;
    evaluate(body: AssessmentEvaluatePayload): Promise<LearningProfile>;
    profile(projectId: string): Promise<LearningProfile>;
}

export interface ISessionNamespace {
    start(body: SessionStartBody): Promise<SessionStartResult>;
    message(sessionId: string, body: SessionMessageBody): Promise<SessionMessageExchangeResult>;
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
}
