/**
 * TypeScript domain types matching the backend Pydantic ``Out``
 * schemas in ``backend/app/schemas/__init__.py``. ISO-8601
 * timestamp fields stay typed as ``string`` (the wire format)
 * rather than ``Date`` — caller-side hydration to ``Date`` only
 * happens where the consumer actually needs date arithmetic
 * (e.g. timeline charts).
 *
 * The frontend has no equivalent for the backend's
 * ``XxxCreate`` / ``XxxUpdate`` schemas: bodies are constructed
 * inline at the api/client.ts call site with a typed request
 * object, not from a stored DTO.
 */

import type {
    AIProvider,
    LearningMethod,
    MessageRole,
    SessionStatus,
} from "../lib/constants";

// --- User ---------------------------------------------------------------

export interface User {
    id: string;
    name: string;
    email: string | null;
    language: string;
    created_at: string;
    updated_at: string;
}

// --- UserSettings -------------------------------------------------------

/**
 * Phase 34 (v1.20.0) — per-provider key-source enum surfaced to
 * the Settings UI so it can render "Key from: secrets.yaml" /
 * "Key from: environment" / "Key from: Settings" and gate the
 * Save button when the key is externally managed.
 *
 * Mirrors ``backend/app/schemas/__init__.py:ApiKeySource``.
 */
export type ApiKeySource = "env" | "secrets_yaml" | "settings" | "none";

export interface UserSettings {
    id: string;
    user_id: string;
    language: string;
    active_provider: AIProvider;
    has_anthropic_key: boolean;
    has_openai_key: boolean;
    has_gemini_key: boolean;
    // v0.4.0 — per-provider model override. ``null`` means
    // "use the session plugin's DEFAULT_MODELS pick"; a string
    // replaces it.
    model_override_anthropic: string | null;
    model_override_openai: string | null;
    model_override_gemini: string | null;
    // Phase 34 — per-provider key-source attribution.
    key_source_anthropic: ApiKeySource;
    key_source_openai: ApiKeySource;
    key_source_gemini: ApiKeySource;
    created_at: string;
    updated_at: string;
}

// --- LearningProject ----------------------------------------------------

/**
 * Phase 46F (v1.31.0) — kind discriminator. ``standard`` is
 * the wizard-created project; ``content`` is the auto-managed
 * pseudo-project that owns LearningSession rows for completed
 * content lessons. Frontend project pickers (Dashboard,
 * Onboarding, LearningRepoSettings) filter out ``content`` so
 * the pseudo-project never appears as a legit learning goal.
 *
 * Helper: see ``isStandardProject`` in
 * ``frontend/src/lib/learning-project.ts``.
 */
export type LearningProjectKind = "standard" | "content";

export interface LearningProject {
    id: string;
    user_id: string;
    topic: string;
    goal: string;
    timeframe: string;
    daily_minutes: number;
    current_problem: string | null;
    active: boolean;
    // v1.31.0 / Phase 46F — defaults to "standard" for
    // older responses that predate the migration.
    kind: LearningProjectKind;
    created_at: string;
    updated_at: string;
}

// --- LearningProfile ----------------------------------------------------

/**
 * Output of ``POST /api/plugins/assessment/evaluate`` and
 * ``GET /api/plugins/assessment/profile/{project_id}``. The six
 * weights all sit in ``[0.0, 1.0]``; ``dominant_method`` is the
 * computed property tie-broken alphabetically (see
 * ``app.models.LearningProfile.dominant_method``).
 */
export interface LearningProfile {
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
    dominant_method: LearningMethod;
}

// --- LearningSession + messages + ratings -------------------------------

export interface LearningSession {
    id: string;
    project_id: string;
    method: LearningMethod;
    started_at: string;
    ended_at: string | null;
    cycle_step: number;
    status: SessionStatus;
    // v1.4.0 — auto-loop: cycles count from 1; cycle_topics is a
    // list of {cycle, topic, summary, next_topic} entries appended
    // when the topic-transition evaluator advances the session
    // into a new cycle.
    cycle_count?: number;
    cycle_topics?: {
        cycle: number;
        topic: string;
        summary: string;
        next_topic: string;
    }[];
    /**
     * Phase 36 Bug 4 — children-side FK back to the imported
     * conversation this session was started from. ImportDetail
     * uses this to detect an existing active session and flip
     * the "Start session" CTA into a "Continue session" navigate.
     */
    imported_conversation_id?: string | null;
}

export interface SessionMessage {
    id: string;
    session_id: string;
    role: MessageRole;
    content: string;
    created_at: string;
}

export interface SessionRating {
    id: string;
    session_id: string;
    understanding: number;
    stress: number;
    method_fit: number;
    notes: string | null;
    created_at: string;
}

/**
 * Composite returned by ``POST /api/plugins/session/start``: the
 * fresh session row plus the composed system prompt the frontend
 * ships to the AI provider on the first message.
 */
export interface SessionStartResult {
    session: LearningSession;
    system_prompt: string;
}

/**
 * Wrapper returned by ``POST /api/plugins/session/{id}/end``.
 * The route returns the same session row (now closed) inside a
 * ``session`` key; matching the wire shape keeps the call sites
 * destructure-friendly.
 */
export interface SessionEndResult {
    session: LearningSession;
}

/**
 * Shape for ``POST /api/plugins/session/{id}/message`` since
 * v0.2.0 (AI orchestration) plus v0.4.0 (cycle-step advance).
 *
 * The backend orchestrates AI server-side: route saves the user
 * message, fires the ``ai_complete`` hook against the active
 * provider's API key + default model, persists the assistant
 * reply, returns the composite. ``assistant_message`` is ``null``
 * when AI couldn't reply (no API key, no provider matched,
 * provider raised); ``ai_error`` carries a one-line explanation.
 *
 * v0.4.0: ``session`` carries the LearningSession row AFTER
 * the cycle-step advance has been applied. The frontend reads
 * ``session.cycle_step`` to drive CycleProgress without a
 * separate fetch. Successful round-trips bump cycle_step by 1
 * (capped at 7); failed-AI round-trips leave it unchanged.
 */
/**
 * v0.5.0 — AI-driven step-transition verdict carried on every
 * /message response (Phase 8B dual-prompt architecture).
 *
 * ``advance`` / ``confidence`` / ``reason`` / ``suggested_step``
 * are the evaluator's raw verdict. ``applied`` is the route's
 * derived decision (true iff ``session.cycle_step`` was
 * actually updated to ``suggested_step``). ``from_step`` is the
 * cycle_step BEFORE the suggestion — the frontend uses it to
 * detect a real transition and trigger the CycleProgress
 * animation. ``fallback_used=true`` means the AI returned
 * non-JSON and the route fell back to the deterministic +1
 * advance.
 *
 * ``null`` on the response when the route short-circuited
 * before the evaluator ran (no API key, no provider, role!=user)
 * OR when step_evaluation is disabled in the session plugin's
 * config (v0.4.x compat).
 */
export interface StepEvaluationVerdict {
    advance: boolean;
    confidence: number;
    reason: string;
    suggested_step: number;
    fallback_used: boolean;
    applied: boolean;
    from_step: number;
}

export interface SessionMessageExchangeResult {
    user_message: SessionMessage;
    assistant_message: SessionMessage | null;
    ai_error: string | null;
    /** Machine-readable classification of ``ai_error`` (Dexie session
     *  flow) so the UI maps known cases to a friendly localized
     *  message. ``null``/absent for unclassified or backend errors. */
    ai_error_code?: "no_api_key" | "no_provider" | null;
    session: LearningSession;
    /** v0.5.0 — Phase 8B dual-prompt verdict (null when disabled / not reached). */
    step_evaluation: StepEvaluationVerdict | null;
    /**
     * v1.4.0 — auto-loop topic transition. Populated only when the
     * step evaluator just advanced the session into step 7 with
     * advance=true. ``looped`` is true iff a new cycle was actually
     * started (cycle_step reset to 1, cycle_count incremented).
     */
    topic_transition?: TopicTransitionVerdict | null;
    /**
     * v1.5.0 — per-message latency breakdown. ``null`` for legacy
     * routes that don't populate it.
     */
    timings?: MessageTimings | null;
}

export interface MessageTimings {
    learning_ms: number | null;
    evaluation_ms: number | null;
    topic_transition_ms: number | null;
    total_ms: number | null;
    parallel_saved_ms: number | null;
}

export interface TopicTransitionVerdict {
    cycle_complete: boolean;
    summary: string;
    next_topic: string | null;
    next_topic_rationale: string;
    difficulty_adjustment: "same" | "easier" | "harder";
    continue_recommended: boolean;
    fallback_used: boolean;
    looped: boolean;
    new_cycle_count: number;
}

/**
 * Shape of ``GET /api/plugins/session/switch-recommendation/{id}``.
 * ``recommended=false`` is the no-op case; the other fields are
 * populated only when ``recommended=true``.
 */
export interface SwitchRecommendation {
    recommended: boolean;
    to_method?: LearningMethod | null;
    reason?: string | null;
}

// --- ProgressCommit -----------------------------------------------------

export interface ProgressCommit {
    id: string;
    project_id: string;
    session_id: string;
    method: LearningMethod;
    understanding: number;
    stress: number;
    error_rate: number;
    duration_minutes: number;
    committed_at: string;
    // v1.14.0 / Phase 27B — joined from SessionRating. Carries
    // legacy plain text or a serialised TipTap JSON document;
    // ``content-utils.parseEditorContent`` handles both shapes.
    notes?: string | null;
}

// --- Curriculum + LearningTopic ----------------------------------------

export interface Curriculum {
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
     * free-form curricula. ImportDetail uses this to flip its
     * "Create curriculum" CTA into a "Go to curriculum" navigate
     * when a curriculum already exists for the conversation.
     */
    imported_conversation_id: string | null;
}

export interface LearningTopic {
    id: string;
    curriculum_id: string;
    parent_id: string | null;
    title: string;
    description: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface Lesson {
    id: string;
    curriculum_id: string;
    title: string;
    content: string;
    order_index: number;
    created_at: string;
    updated_at: string;
}

// --- MethodSwitch -------------------------------------------------------

export interface MethodSwitch {
    id: string;
    project_id: string;
    from_method: LearningMethod;
    to_method: LearningMethod;
    reason: string;
    switched_at: string;
}

// --- Assessment ---------------------------------------------------------

/**
 * Question shape returned by
 * ``GET /api/plugins/assessment/questions?lang=…``. Matches the
 * plugin's ``questions_for_lang`` output.
 */
export interface AssessmentAnswer {
    id: string;
    text: string;
    /**
     * Weight contribution for each method this answer scores
     * toward. Keys are a subset of ``LearningMethod``; values
     * sit in ``[0.0, 1.0]``. Not every answer contributes to
     * every method — the dict is typically sparse.
     */
    weights: Partial<Record<LearningMethod, number>>;
}

export interface AssessmentQuestion {
    id: string;
    /**
     * v0.4.0 — ``"single"`` renders radio buttons (exactly one
     * answer); ``"multi"`` renders checkboxes (one or more
     * answers). Backend defaults to "single" for any question
     * that doesn't declare it.
     */
    type: "single" | "multi";
    text: string;
    answers: AssessmentAnswer[];
}

/**
 * Payload of ``POST /api/plugins/assessment/evaluate``. The
 * answers array carries one entry per question; the plugin
 * validates ``min_length=1`` (every question must be answered).
 *
 * v0.4.0 supports both shapes:
 *   - ``answer_id: string`` for single-select (legacy)
 *   - ``answer_ids: string[]`` for multi-select
 * The backend's Pydantic validator requires at least one to be set.
 */
export interface AssessmentEvaluatePayload {
    project_id: string;
    answers: {
        question_id: string;
        answer_id?: string;
        answer_ids?: string[];
    }[];
}

// --- Tracking / progress summary ---------------------------------------

/**
 * ``GET /api/plugins/tracking/progress/{project_id}`` returns a
 * shallow-merge of every ``get_progress_summary`` plugin's
 * namespace slice. Only ``tracking`` is wired in v0.1.0; future
 * plugins (stagnation, analytics) stack their own keys here.
 *
 * The shape under ``tracking`` matches
 * ``plugins/.../tracking/summary.py:aggregate``.
 */
export interface MethodDistributionEntry {
    method: LearningMethod;
    count: number;
    percentage: number;
}

export interface RecentSessionEntry {
    id: string;
    method: LearningMethod;
    understanding: number;
    stress: number;
    duration_minutes: number;
    committed_at: string;
}

export interface TrackingSummary {
    total_sessions: number;
    total_minutes: number;
    streak_days: number;
    sessions_per_method: Partial<Record<LearningMethod, number>>;
    method_distribution: MethodDistributionEntry[];
    recent_understanding: number[];
    recent_stress: number[];
    mean_understanding: number;
    mean_stress: number;
    recent_sessions: RecentSessionEntry[];
}

/**
 * v0.5.0 / 8D — step-evaluation analytics namespace produced by
 * the tracking plugin's ``get_progress_summary`` from
 * ``StepEvaluation`` rows joined to the project's sessions.
 *
 * ``evaluations_per_step`` and ``time_seconds_per_step`` use
 * STRING keys ("1".."7") because JSON does not preserve integer
 * keys over the wire. The aggregator's ``aggregate_step_evaluations``
 * function produces integer keys internally; the route's JSON
 * serialiser stringifies them.
 *
 * Empty state when the project has no evaluations yet is
 * "all-zeros" — never ``null`` or ``undefined`` — so the
 * frontend can map over the fields without conditional
 * fallbacks.
 */
export interface StepEvaluationSummary {
    total_evaluations: number;
    average_confidence: number;
    advance_count: number;
    repeat_count: number;
    backward_count: number;
    fallback_count: number;
    evaluations_per_step: Record<string, number>;
    time_seconds_per_step: Record<string, number>;
}

export interface ProgressSummary {
    tracking?: TrackingSummary;
    step_evaluation?: StepEvaluationSummary;
    [namespace: string]: unknown;
}

// --- Tool recommendations ----------------------------------------------

/**
 * Shape of one entry in the
 * ``GET /api/plugins/tools/recommendations/{project_id}``
 * response list. Matches the tools plugin's
 * ``rank_tools`` output.
 */
export interface ToolRecommendation {
    name: string;
    url: string;
    why: string;
    weight_keys: LearningMethod[];
    score: number;
}

/**
 * v0.4.0 spaced-repetition card from
 * ``GET /api/plugins/tools/spaced/{project_id}``. ``id`` is
 * stable across requests so the frontend can persist
 * dismissals in localStorage. ``urgency`` is informational —
 * the server has already sorted by it.
 */
export interface SpacedRecommendation {
    id: string;
    method: LearningMethod;
    interval_days: number;
    action: string;
    title: string;
    urgency: number;
}

// --- Imported conversations (v0.9.0 / Phase 12C) -------------------------

export type ImportedConversationSource =
    | "chatgpt"
    | "claude"
    | "gemini"
    | "manual"
    | "unknown";

/**
 * Shape of the AI-analysis blob produced by Phase 12D.
 * Every field is optional so a partial / malformed model
 * response still renders something instead of throwing.
 */
export interface AnalysisSuggestedLesson {
    title: string;
    description: string;
    priority: number;
}

/**
 * Vocabulary entry (Phase 30D / v1.17.0).
 *
 * Optional field on a conversation's ``analysis_result`` that
 * the Anki plugin consumes via ``extract_from_conversation``
 * to produce vocabulary flashcards directly — no extra AI call
 * required. Languages-learning projects benefit most; other
 * projects normally won't have this field present.
 */
export interface VocabularyEntry {
    word: string;
    translation: string;
    example?: string;
    phonetic?: string;
    tags?: string[];
}

export interface ConversationAnalysisResult {
    topic?: string;
    subtopics?: string[];
    user_level?: "beginner" | "intermediate" | "advanced";
    strengths?: string[];
    weaknesses?: string[];
    error_patterns?: string[];
    recommended_method?: LearningMethod;
    recommended_focus?: string;
    suggested_curriculum?: AnalysisSuggestedLesson[];
    summary?: string;
    chunk_summaries?: string[];
    fallback_used?: boolean;
    /**
     * Phase 30D — vocabulary entries the AI extracted from the
     * conversation. Optional; only language-learning analyses
     * tend to carry it. Consumed by the Anki plugin to generate
     * cloze cards with ``front = example with word blanked,
     * back = translation``.
     */
    vocabulary?: VocabularyEntry[];
}

export interface ImportedMessage {
    id: string;
    conversation_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string | null;
    order_index: number;
}

export interface ImportedConversation {
    id: string;
    user_id: string;
    project_id: string | null;
    source: ImportedConversationSource;
    title: string;
    message_count: number;
    imported_at: string;
    analyzed: boolean;
    topic_tag: string | null;
    model: string | null;
    source_created_at: string | null;
    analysis_result: ConversationAnalysisResult | null;
    /**
     * Phase 36 Bug 1 — SHA-256 of role-prefixed normalised messages.
     * Title-independent so re-imports with a fresh display title
     * still detect as duplicates. Nullable because pre-migration
     * rows haven't been hashed yet (back-fill runs in Alembic 0014
     * and Dexie schema v12).
     */
    content_hash: string | null;
    /**
     * v1.54.0 — language pair captured at IMPORT time and flowed
     * downstream (analysis -> save-as-lesson -> share). ``source`` =
     * chat language / what the learner speaks; ``target`` = what they
     * learn. Nullable: old imports fall back to the app language.
     */
    source_language?: string | null;
    target_language?: string | null;
}

export interface ImportedConversationDetail extends ImportedConversation {
    messages: ImportedMessage[];
}

export interface ImportedConversationCreateBody {
    source: ImportedConversationSource;
    title: string;
    project_id?: string | null;
    topic_tag?: string | null;
    model?: string | null;
    source_created_at?: string | null;
    source_language?: string | null;
    target_language?: string | null;
    messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
        timestamp?: string | null;
    }>;
}

export interface ImportedConversationUpdateBody {
    project_id?: string | null;
    topic_tag?: string | null;
    title?: string;
    source_language?: string | null;
    target_language?: string | null;
}

export interface ImportedConversationAnalysis {
    analysis_result: ConversationAnalysisResult;
}

// --- System info (v1.1.0 / Phase 14A) ------------------------------------

/**
 * Aggregated About-tab payload. Returned by ``/api/system/info`` in
 * API mode; ``DexieStorage.system.info()`` synthesises the same shape
 * in browser-only mode. Fields the browser-only path can't know (Python
 * version, backend dep versions) come through as null so the UI hides
 * those rows in Dexie mode.
 */
export interface SystemInfo {
    app: {
        name: string;
        version: string;
        license: string;
        authors: string[];
        repository_url: string;
        issues_url: string;
        docs_url: string;
        build_hash: string;
        build_date: string;
    };
    runtime: {
        python_version: string | null;
        platform_system: string;
        platform_release: string;
        platform_machine: string;
    };
    dependencies: {
        fastapi: string | null;
        sqlalchemy: string | null;
        pydantic: string | null;
        pluginforge: string | null;
    };
    paths: {
        database_path: string;
        data_directory: string;
    };
}


// --- Backup / restore (v1.2.0 / Phase 15) -----------------------------

/**
 * Per-table row count + total. Used by the Settings UI to show
 * a pre-restore comparison ("Current: X; backup contains: Y").
 */
export interface BackupStats {
    total_records: number;
    tables: Record<string, number>;
    /** Number of downloaded content sets carried in the backup (#130). */
    content_sets?: number;
}

/**
 * Wire shape exported by ``GET /api/backup/export`` and produced
 * locally in Dexie mode by ``storage/backup.ts``. Same shape in
 * both modes so a backup made in one mode can be restored in the
 * other.
 *
 * ``data`` carries one entry per backup table; each row is a
 * snake_case dict mirroring the SQLAlchemy column list, minus the
 * three ``api_key_*`` fields on ``user_settings`` (security).
 */
/** One file inside a backed-up content set (#130). ``filename`` is the
 *  relative path inside the set version dir (``manifest.yaml``,
 *  ``lessons/01.json``, ``assets/img/x.png``) — the same keying the FS
 *  cache and Dexie ``contentSetFiles`` both use. */
export interface ContentSetBackupFile {
    filename: string;
    body: string;
    encoding: "text" | "base64";
}

/** A downloaded content set carried in a backup (#130). ``meta`` holds
 *  the Dexie ``contentSetRow`` fields when the backup was made in Dexie
 *  mode (absent for an API-origin backup, where the row is synthesised
 *  from the manifest on import). */
export interface ContentSetBackupEntry {
    source: string;
    set_id: string;
    version: string;
    branch?: string;
    meta?: Record<string, unknown>;
    files: ContentSetBackupFile[];
}

export interface BackupPayload {
    format: "adaptive-learner-backup";
    version: string;
    app_version?: string;
    created_at: string;
    user_id: string;
    storage_mode: "api" | "dexie";
    data: Record<string, Record<string, unknown>[]>;
    /** Downloaded lesson content (#130). Absent in pre-1.3.0 backups. */
    content_sets?: ContentSetBackupEntry[];
    stats: BackupStats;
}

export interface RestoreTableSummary {
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export interface RestoreSummary {
    user_id: string;
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
    tables: Record<string, RestoreTableSummary>;
    /** Content-set cache restore counts (#130). Absent for pre-1.3.0
     *  backups / older backends. */
    content_sets?: {restored: number; skipped: number; errors: string[]};
}

// --- Taxonomy: Subject + Tag (Phase 22) ---------------------------------

export interface Subject {
    id: string;
    parent_id: string | null;
    name: string;
    description: string | null;
    icon: string | null;
    created_at: string;
    updated_at: string;
}

export interface Tag {
    id: string;
    user_id: string;
    name: string;
    color: string | null;
    created_at: string;
}
