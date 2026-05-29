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
    /**
     * Recover the most recent locally-known user identity, or null
     * when storage carries no recoverable trace (Phase 41B).
     *
     * - ``ApiStorage``: reads ~/.config/adaptive_learner/identity.yaml
     *   via ``GET /api/identity``. Returns null on 404.
     * - ``DexieStorage``: queries the most recent ``users`` row and
     *   its currently-active ``projects`` row. Returns null when the
     *   users table is empty.
     *
     * The caller (Landing.tsx) verifies the returned ``userId`` still
     * exists in the relevant backend before restoring localStorage.
     */
    findMostRecent(): Promise<RecoveryHint | null>;
}

/**
 * Recovery hint returned by :meth:`IUsersNamespace.findMostRecent`
 * (Phase 41B). The shape matches what ``Landing.tsx`` needs to
 * restore localStorage after a browser data wipe: which user, which
 * project they were on, which UI language. Wire-format conversion
 * (``active_project_id`` -> ``projectId``) happens inside each
 * storage implementation so Landing.tsx is mode-agnostic.
 */
export interface RecoveryHint {
    userId: string;
    projectId: string | null;
    language: string | null;
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
    /**
     * Phase 36 Bug 4 — return the most recent active session
     * started from the given imported conversation, or ``null`` if
     * none. ImportDetail uses this to flip "Start session" into
     * "Continue session" before the user clicks.
     */
    getActiveForConversation(conversationId: string): Promise<LearningSession | null>;
    /**
     * Phase 38 Bug 7 — return a session record by ID. Used by the
     * Session route's resume path (``?session=<id>``): the page
     * fetches the existing session + its messages instead of
     * calling ``start()`` and creating a new one.
     */
    get(sessionId: string): Promise<LearningSession>;
    /**
     * Phase 38 Bug 7 — return the chat history for a session
     * (oldest-first; the system-prompt message lands as the
     * first entry). Used by the resume path so SessionChat
     * remounts with the prior conversation visible.
     */
    getMessages(sessionId: string): Promise<SessionMessage[]>;
}

export interface ITrackingNamespace {
    progress(projectId: string): Promise<ProgressSummary>;
    commits(projectId: string): Promise<ProgressCommit[]>;
}

// --- Content-Loader (Phase 43 / EXP-002) -----------------------------------

/**
 * One row in the Set Browser. Mirrors the backend's
 * ``SetEntryResponse`` 1:1 so the wire shape stays in lockstep
 * across ApiStorage + DexieStorage.
 */
export interface ContentSetEntry {
    source: string;
    branch: string;
    id: string;
    title: string;
    language: string;
    level: string;
    domain: string;
    version: string;
    lesson_count: number;
    description: string | null;
    tags: string[];
    cover_image: string | null;
    cached_version: string | null;
    update_available: boolean;
}

export interface ContentSetSource {
    source: string;
    branch: string;
}

export interface ContentSetsList {
    sets: ContentSetEntry[];
    sources: ContentSetSource[];
}

export interface ContentLessonList {
    set_id: string;
    source: string;
    version: string | null;
    lessons: string[];
}

/**
 * Lesson shape mirrored from the backend's
 * ``adaptive_learner_content_loader.schema.Lesson``. The
 * viewer (Phase 44) renders these directly. Optional fields
 * stay nullable / optional so the type-checker matches the
 * Pydantic JSON output exactly.
 */
export interface ContentLessonStep {
    id: string;
    type: "theory" | "exercise";
    title?: string | null;
    body?: string | null;
    exercise?: ContentLessonExercise | null;
}

/** Phase 52D / v1.35.0 / P-127 — one blank inside a CLOZE
 * exercise's ``sentence``. Mirror of ``schema.ClozeBlank``. */
export interface ContentLessonClozeBlank {
    accept: string[];
    hint?: string | null;
    placeholder?: string | null;
}

export interface ContentLessonExercise {
    id: string;
    type:
        | "matching"
        | "picture_choice"
        | "free_text"
        | "word_tiles"
        | "cloze";
    prompt: string;
    card_ids: string[];
    pairs?: Array<{left: string; right: string}> | null;
    images?:
        | Array<{src: string; label: string; is_correct?: string}>
        | null;
    accept?: string[] | null;
    tiles?: string[] | null;
    accept_orderings?: number[][] | null;
    distractors: string[];
    hint?: string | null;
    /** Phase 52D / v1.35.0 — CLOZE: sentence with visible ``___``
     *  markers at each blank position. */
    sentence?: string | null;
    /** Phase 52D / v1.35.0 — CLOZE: per-marker metadata in
     *  left-to-right order. ``blanks.length === sentence
     *  .count("___")`` enforced upstream. */
    blanks?: ContentLessonClozeBlank[] | null;
    /** Phase 52D / v1.35.0 — CLOZE: render mode. Default
     *  ``"type"`` when omitted. ``"select"`` requires
     *  non-empty ``distractors``. */
    cloze_mode?: "type" | "select" | null;
}

/** Phase 52I / v1.35.0 / P-130 — closed grammatical-role enum
 * mirror. Annotates tokens inside a card's ``front`` so the
 * cloze generator can pick a semantically-meaningful blank.
 * Adding a role is a minor schema bump. */
export type ContentLessonCardTokenRoleName =
    | "article"
    | "verb"
    | "noun"
    | "adjective"
    | "preposition"
    | "gender_marker"
    | "tense_marker";

export interface ContentLessonCardTokenRole {
    token: string;
    role: ContentLessonCardTokenRoleName;
}

export interface ContentLessonCard {
    id: string;
    front: string;
    back: string;
    notes?: string | null;
    image?: string | null;
    audio?: string | null;
    tags: string[];
    /** Phase 52I / v1.35.0 / P-130 — optional token-role
     * annotations on ``front``. Absent → cloze generator
     * falls back to a positional heuristic. */
    token_roles?: ContentLessonCardTokenRole[] | null;
}

export interface ContentLesson {
    id: string;
    title: string;
    description?: string | null;
    estimated_minutes: number;
    cards: ContentLessonCard[];
    steps: ContentLessonStep[];
}

/**
 * Content-Loader namespace. ApiStorage delegates to
 * ``/api/plugins/content-loader/*``; DexieStorage runs the
 * GitHub fetcher + IndexedDB cache client-side so GH Pages
 * users get the same surface without a backend.
 *
 * ``listSets`` MUST tolerate offline gracefully: a failed
 * upstream fetch returns the cached sets (if any) instead
 * of throwing — the Set Browser stays usable on a flaky
 * connection.
 */
export interface IContentLoaderNamespace {
    listSets(): Promise<ContentSetsList>;
    downloadSet(source: string, setId: string): Promise<ContentSetEntry>;
    listLessons(source: string, setId: string): Promise<ContentLessonList>;
    getLesson(
        source: string,
        setId: string,
        filename: string,
    ): Promise<ContentLesson>;
    /** Phase 54 / v1.37.0 — fetch one cached asset by relative
     *  path (e.g. ``img/sunrise.png``). Returns ``null`` when
     *  the asset isn't cached so the asset resolver hook can
     *  fall back to a placeholder SVG or text-only display
     *  without throwing.
     *
     *  ApiStorage routes to the backend proxy endpoint added in
     *  Phase 54F; DexieStorage reads the asset bytes out of
     *  IndexedDB (stored as part of ``contentSetFiles`` during
     *  ``downloadSet``).
     *
     *  The caller is responsible for ``URL.createObjectURL``
     *  on the returned Blob and the matching
     *  ``URL.revokeObjectURL`` on component unmount. The
     *  ``useAsset`` hook in Phase 54B handles that contract. */
    getAsset(
        source: string,
        setId: string,
        assetPath: string,
    ): Promise<Blob | null>;
}


// --- LessonProgress (Phase 44 / EXP-002 / P-109) ---------------------------

export interface LessonStepResult {
    step_id: string;
    correct: number;
    total: number;
    attempts?: number;
    /** Phase 52C / v1.35.0 — the user's text-form answer for the
     *  step, when applicable. Free-text + word-tiles populate
     *  it; matching + picture-choice leave it undefined. Powers
     *  the lesson-summary token-diff display. */
    user_answer?: string | null;
}

export interface LessonProgressUpsertBody {
    source: string;
    set_id: string;
    lesson_filename: string;
    step_result?: LessonStepResult;
    time_spent_seconds_delta?: number;
    mark_completed?: boolean;
}

/**
 * One stored step result inside ``LessonProgress.step_results``.
 * Mirrors what the backend service writes per step.
 */
export interface LessonStepResultStored {
    correct: number;
    total: number;
    attempts: number;
    completed_at: string;
    /** Phase 52C / v1.35.0 — see ``LessonStepResult.user_answer``.
     *  Old rows without this field surface as ``undefined`` and the
     *  summary falls back to the canonical-answer-only line. */
    user_answer?: string | null;
}

export interface LessonProgress {
    id: string;
    user_id: string;
    source: string;
    set_id: string;
    lesson_filename: string;
    status: "in_progress" | "completed";
    /** Map of step_id → result. Parsed JSON; never a string. */
    step_results: Record<string, LessonStepResultStored>;
    score_correct: number;
    score_total: number;
    time_spent_seconds: number;
    started_at: string;
    updated_at: string;
    completed_at: string | null;
}

/**
 * Per-user × per-lesson progress tracking. Parallel to the
 * session-plugin's ``ITrackingNamespace`` (sessions stay
 * separate from content-loader lessons in v1.28.0; Phase 46
 * unifies them when SRS lands).
 */
export interface ILessonProgressNamespace {
    list(userId: string): Promise<LessonProgress[]>;
    get(
        userId: string,
        source: string,
        setId: string,
        lessonFilename: string,
    ): Promise<LessonProgress | null>;
    upsert(
        userId: string,
        body: LessonProgressUpsertBody,
    ): Promise<LessonProgress>;
}

/**
 * One element attempt — the unit the recording endpoint
 * consumes. Multiple attempts per exercise submit for
 * matching (one per pair); single attempt per submit for
 * picture-choice / free-text / word-tiles. The exercise-side
 * deriver (C9) builds these from ``(exercise, userInput)``.
 *
 * Phase 46B / EXP-007 / P-129.
 */
export interface ElementAttempt {
    set_id: string;
    lesson_id: string;
    exercise_id: string;
    element_key: string;
    element_type?: string;
    user_answer?: string;
    correct_answer?: string;
    correct: boolean;
}

/**
 * Server-side element-error payload. Identical shape on both
 * ApiStorage and DexieStorage so the review-queue UI in
 * Phase 46C can render either source uniformly.
 */
export interface ElementError {
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
 * One row of the SRS review queue (Phase 46C / P-129).
 * Mirrors the backend ``ReviewQueueItemOut`` schema 1:1.
 */
export interface ReviewQueueItem {
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
    suggested_review_at: string;
    overdue: boolean;
}

/**
 * Element-error namespace on IStorageService. ApiStorage
 * delegates to /api/users/{user_id}/element-errors;
 * DexieStorage runs the transition matrix + SRS scheduling
 * client-side via ``element-errors-dexie.ts``.
 */
export interface IElementErrorsNamespace {
    list(
        userId: string,
        opts?: {setId?: string; includeMastered?: boolean},
    ): Promise<ElementError[]>;
    recordBulk(
        userId: string,
        attempts: readonly ElementAttempt[],
    ): Promise<ElementError[]>;
    /** Projected review queue: active (non-mastered)
     *  elements with computed suggested_review_at + overdue
     *  flag, sorted by urgency (overdue → error_count desc →
     *  last_error_at desc). */
    reviewQueue(
        userId: string,
        opts?: {setId?: string},
    ): Promise<ReviewQueueItem[]>;
}

// EXP-010 / Phase 56 — daily missions. ``getDaily`` assigns the
// day's missions on first call (deterministic) and re-evaluates
// live progress on every call; ``regenerate`` reshuffles today's
// set (Settings reset). Both work in API + Dexie mode.
export interface IMissionsNamespace {
    getDaily(
        userId: string,
        options?: MissionDailyOptions,
    ): Promise<MissionDailyResult>;
    regenerate(
        userId: string,
        options?: MissionDailyOptions,
    ): Promise<MissionDailyResult>;
}

export interface MissionDailyOptions {
    count?: number;
    difficultyMix?: import("../lib/missions/types").DifficultyMix;
    todayIso?: string;
}

export interface MissionDailyResult {
    missions: import("../lib/missions/types").DailyMission[];
    newlyCompleted: import("../lib/missions/types").DailyMission[];
}

/** Wire shape from the backend (snake_case ``newly_completed``);
 *  ApiStorage maps it to the camelCase ``MissionDailyResult``. */
export interface MissionDailyResultWire {
    missions: import("../lib/missions/types").DailyMission[];
    newly_completed: import("../lib/missions/types").DailyMission[];
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
    /**
     * Phase 36 Bug 3 — return the curriculum auto-generated from
     * the given imported conversation, or ``null`` if none exists.
     * ImportDetail uses the answer to flip its "Create curriculum"
     * CTA into a "Go to curriculum" navigate.
     */
    getForConversation(conversationId: string): Promise<Curriculum | null>;
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

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * Learning Repository render + ZIP export. Mirrors the
 * backend's ``/api/plugins/learning-repo/render`` +
 * ``/export-zip`` endpoints (v1.26.0 / Phase 42) so the
 * LearningRepo page works in BOTH storage modes.
 *
 * In Dexie mode, the renderer is the TypeScript port at
 * ``frontend/src/lib/learning-repo/`` (49B-D); the
 * implementation builds the RenderContext from IndexedDB
 * via ``loadDexieContext`` and writes the ZIP with JSZip
 * client-side.
 *
 * The ``persist`` endpoint (git commit + tag) is NOT in
 * this namespace by design: it needs a server-side
 * filesystem + git binary, so it stays on
 * ``api.learningRepo.persist`` only. The LearningRepo page
 * gates the "Persist to git" button on storage mode.
 */
export interface ILearningRepoNamespace {
    render(
        projectId: string,
        language?: string,
    ): Promise<{
        project_id: string;
        language: string;
        rendered_at: string;
        files: Record<string, string>;
    }>;
    exportZip(projectId: string, language?: string): Promise<Blob>;
}

/**
 * Phase 49 / v1.32.0 (PHASE-42-STORAGE-ABSTRACTION-01) —
 * per-plugin settings round-trip. Mirrors the backend's
 * generic ``GET / PATCH /api/plugin-settings/{plugin_name}``
 * endpoints (v1.26.0 / Phase 42) so that every plugin's
 * user-visible settings UI can run in BOTH storage modes
 * without branching.
 *
 * Return shape is the API response 1:1: ``{plugin, settings}``.
 *
 * In Dexie mode, the ``pluginSettings`` IndexedDB table holds
 * one row per plugin name; the first ``get`` for a plugin that
 * has no row yet returns the bundled YAML defaults from
 * ``frontend/src/data/plugin-config/{name}.json`` (regenerated
 * from ``backend/config/plugins/*.yaml`` via
 * ``scripts/sync_plugin_config_to_frontend.py``). ``update``
 * upserts the merged settings into the table.
 */
export interface IPluginSettingsNamespace {
    get(pluginName: string): Promise<{
        plugin: string;
        settings: Record<string, unknown>;
    }>;
    update(
        pluginName: string,
        body: {settings: Record<string, unknown>},
    ): Promise<{plugin: string; settings: Record<string, unknown>}>;
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
 * Study question (Phase 32B / v1.19.0) — AI-generated active-
 * recall flashcard candidate. User reviews, edits, deletes.
 */
export type StudyQuestionType = "open" | "fill_blank" | "explain" | "compare";
export type StudyQuestionDifficulty = "easy" | "medium" | "hard";

export interface StudyQuestion {
    id: string;
    user_id: string;
    project_id: string;
    session_id: string | null;
    question: string;
    expected_answer: string;
    question_type: StudyQuestionType;
    difficulty: StudyQuestionDifficulty;
    topic: string;
    edited: boolean;
    created_at: string;
    updated_at: string;
}

export interface StudyQuestionCreateBody {
    project_id: string;
    session_id?: string | null;
    question: string;
    expected_answer?: string;
    question_type?: StudyQuestionType;
    difficulty?: StudyQuestionDifficulty;
    topic?: string;
}

export interface StudyQuestionUpdateBody {
    question?: string;
    expected_answer?: string;
    question_type?: StudyQuestionType;
    difficulty?: StudyQuestionDifficulty;
    topic?: string;
}

export interface StudyQuestionListFilters {
    projectId?: string;
    difficulty?: StudyQuestionDifficulty;
    topic?: string;
}

export interface INotebookLMNamespace {
    listQuestions(
        userId: string,
        filters?: StudyQuestionListFilters,
    ): Promise<StudyQuestion[]>;
    createQuestion(
        userId: string,
        body: StudyQuestionCreateBody,
    ): Promise<StudyQuestion>;
    updateQuestion(
        questionId: string,
        body: StudyQuestionUpdateBody,
    ): Promise<StudyQuestion>;
    deleteQuestion(questionId: string): Promise<void>;
    generateFromSession(sessionId: string): Promise<StudyQuestion[]>;
    generateFromProject(projectId: string): Promise<StudyQuestion[]>;
    studyGuide(projectId: string): Promise<string>;
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
    // Phase 57 / v1.40.0. ``tier`` is the user's earned tier when
    // earned, else the badge's locked ``base_tier``. ``tier_thresholds``
    // drives the next-tier progress bar for DYNAMIC badges.
    base_tier: string;
    tier: string;
    tier_thresholds: Record<
        string,
        {threshold: number; xp_bonus: number}
    > | null;
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
    notebooklm: INotebookLMNamespace;
    contentLoader: IContentLoaderNamespace;
    lessonProgress: ILessonProgressNamespace;
    elementErrors: IElementErrorsNamespace;
    pluginSettings: IPluginSettingsNamespace;
    learningRepo: ILearningRepoNamespace;
    missions: IMissionsNamespace;

    /**
     * Phase 41F Danger Zone reset. Wipes every piece of learner
     * state this storage backend owns:
     *
     * - ``ApiStorage``: POSTs ``{confirmation}`` to /api/reset.
     *   The backend truncates every SQLite table, clears
     *   ~/.config/adaptive_learner/identity.yaml, and scrubs
     *   ``ai.*`` from secrets.yaml (preserving secret_key).
     * - ``DexieStorage``: clears every store in the main IndexedDB
     *   DB plus the separate auto-backup ring. localStorage +
     *   sessionStorage are cleared by the calling component
     *   (DangerZoneSection), not here.
     *
     * Both implementations require the literal ``"RESET"`` token;
     * ApiStorage forwards it to the backend gate, DexieStorage
     * checks it locally and rejects with an ApiError(400) so the
     * UI's typed-confirm pattern is enforced uniformly across
     * modes.
     */
    reset(confirmation: string): Promise<{reset: true; tables_cleared: number}>;
}
