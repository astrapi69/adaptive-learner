/**
 * Typed Adaptive Learner API client (Phase 4A).
 *
 * Every fetch on the frontend MUST go through one of the
 * ``api.*`` namespaces below — components never call ``fetch``
 * directly. The single ``apiCall`` helper:
 *
 *   1. Builds the URL from the resolved ``API_BASE`` (env-
 *      overridable via ``VITE_API_BASE``, default ``/api`` and
 *      proxied by Vite to the backend on :18001).
 *   2. JSON-serialises the body, sets ``Content-Type`` for any
 *      non-GET/DELETE call with a body.
 *   3. Throws :class:`ApiError` on any non-2xx response, carrying
 *      the parsed ``detail`` + ``stacktrace`` (debug mode) so
 *      toast handlers can render actionable messages.
 *
 * Endpoint coverage maps 1:1 to the project-reference §7 table
 * plus the four plugin route tables (assessment / session /
 * tracking / tools).
 */

import {API_BASE, type AIProvider, type LearningMethod, type MessageRole} from "../lib/constants";
import type {
    AssessmentEvaluatePayload,
    AssessmentQuestion,
    LearningProfile,
    LearningProject,
    ProgressCommit,
    ProgressSummary,
    SessionEndResult,
    SessionMessageExchangeResult,
    SessionRating,
    SessionStartResult,
    SwitchRecommendation,
    ToolRecommendation,
    User,
    UserSettings,
} from "../types/domain";

// --- Error class --------------------------------------------------------

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly detail: string,
        public readonly endpoint?: string,
        public readonly method?: string,
        public readonly stacktrace?: string,
    ) {
        super(detail);
        this.name = "ApiError";
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }
    get isValidation(): boolean {
        return this.status === 400 || this.status === 422;
    }
    get isConflict(): boolean {
        return this.status === 409;
    }
    get isServerError(): boolean {
        return this.status >= 500;
    }
}

// --- Core helper --------------------------------------------------------

interface CallOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
}

/**
 * Make a typed HTTP call against the backend. Caller passes the
 * typed result shape; the helper handles URL building, body
 * serialisation, and error wrapping.
 */
async function apiCall<T>(path: string, opts: CallOptions = {}): Promise<T> {
    const method = opts.method ?? "GET";
    const url = buildUrl(path, opts.query);
    const init: RequestInit = {method};
    if (opts.body !== undefined && opts.body !== null) {
        init.headers = {"Content-Type": "application/json"};
        init.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, init);
    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        let stacktrace: string | undefined;
        try {
            const errBody = await response.json();
            if (typeof errBody?.detail === "string") {
                detail = errBody.detail;
            } else if (Array.isArray(errBody?.detail)) {
                // Pydantic validation errors come as a list of
                // {loc, msg, type} dicts; flatten them so toasts
                // surface something legible.
                detail = errBody.detail
                    .map((e: {loc?: unknown[]; msg?: string}) => {
                        const where = (e.loc ?? []).slice(1).join(".");
                        return where ? `${where}: ${e.msg ?? ""}` : (e.msg ?? "");
                    })
                    .filter(Boolean)
                    .join("; ");
            }
            if (typeof errBody?.stacktrace === "string") {
                stacktrace = errBody.stacktrace;
            }
        } catch {
            /* non-JSON error body — keep generic detail */
        }
        throw new ApiError(response.status, detail, path, method, stacktrace);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return (await response.json()) as T;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const base = `${API_BASE}${path}`;
    if (!query) return base;
    const qs = Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(
            ([k, v]) =>
                `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
        )
        .join("&");
    return qs ? `${base}?${qs}` : base;
}

// --- Request payload shapes --------------------------------------------

export interface UserCreateBody {
    name: string;
    email?: string | null;
    language?: string;
}

export interface UserUpdateBody {
    name?: string;
    email?: string | null;
    language?: string;
}

export interface LearningProjectCreateBody {
    topic: string;
    goal: string;
    timeframe: string;
    daily_minutes: number;
    current_problem?: string | null;
    active?: boolean;
}

export interface LearningProjectUpdateBody {
    topic?: string;
    goal?: string;
    timeframe?: string;
    daily_minutes?: number;
    current_problem?: string | null;
    active?: boolean;
}

export interface SettingsPatchBody {
    active_provider?: AIProvider;
    language?: string;
}

export interface ApiKeySetBody {
    provider: AIProvider;
    key: string;
}

export interface SessionStartBody {
    project_id: string;
    method?: LearningMethod;
    cycle_step?: number;
    lang?: string;
}

export interface SessionMessageBody {
    role: MessageRole;
    content: string;
}

export interface SessionRatingBody {
    understanding: number;
    stress: number;
    method_fit: number;
    notes?: string | null;
}

// --- Curriculum bodies -------------------------------------------------

export interface CurriculumCreateBody {
    title: string;
    description?: string | null;
    language?: string;
}

export interface CurriculumUpdateBody {
    title?: string;
    description?: string | null;
    language?: string;
}

export interface TopicCreateBody {
    title: string;
    description?: string | null;
    parent_id?: string | null;
    order_index?: number;
}

export interface TopicUpdateBody {
    title?: string;
    description?: string | null;
    parent_id?: string | null;
    order_index?: number;
}

// --- Public namespaces --------------------------------------------------

export const api = {
    health: () =>
        apiCall<{status: string; version: string; debug: boolean}>("/health"),

    i18n: {
        get: (lang: string) =>
            apiCall<Record<string, unknown>>(`/i18n/${encodeURIComponent(lang)}`),
    },

    // --- Users -----------------------------------------------------------

    users: {
        create: (body: UserCreateBody) =>
            apiCall<User>("/users", {method: "POST", body}),
        get: (userId: string) => apiCall<User>(`/users/${encodeURIComponent(userId)}`),
        update: (userId: string, body: UserUpdateBody) =>
            apiCall<User>(`/users/${encodeURIComponent(userId)}`, {method: "PATCH", body}),

        // User-scoped projects -- nested under the user prefix.
        projects: {
            list: (userId: string) =>
                apiCall<LearningProject[]>(
                    `/users/${encodeURIComponent(userId)}/projects`,
                ),
            create: (userId: string, body: LearningProjectCreateBody) =>
                apiCall<LearningProject>(
                    `/users/${encodeURIComponent(userId)}/projects`,
                    {method: "POST", body},
                ),
        },
    },

    // --- Projects (project-scoped, no user prefix) ----------------------

    projects: {
        get: (projectId: string) =>
            apiCall<LearningProject>(`/projects/${encodeURIComponent(projectId)}`),
        update: (projectId: string, body: LearningProjectUpdateBody) =>
            apiCall<LearningProject>(
                `/projects/${encodeURIComponent(projectId)}`,
                {method: "PATCH", body},
            ),
    },

    // --- Settings -------------------------------------------------------

    settings: {
        /**
         * Settings for a specific user. PATCH the active provider
         * + language via ``update``; manage api keys via
         * ``setApiKey`` / ``deleteApiKey`` (the encrypted-write
         * path is intentionally separate).
         */
        get: (userId: string) =>
            apiCall<UserSettings>(`/settings/${encodeURIComponent(userId)}`),
        update: (userId: string, body: SettingsPatchBody) =>
            apiCall<UserSettings>(`/settings/${encodeURIComponent(userId)}`, {
                method: "PATCH",
                body,
            }),
        setApiKey: (userId: string, body: ApiKeySetBody) =>
            apiCall<UserSettings>(
                `/settings/${encodeURIComponent(userId)}/api-key`,
                {method: "POST", body},
            ),
        deleteApiKey: (userId: string, provider: AIProvider) =>
            apiCall<UserSettings>(
                `/settings/${encodeURIComponent(userId)}/api-key/${encodeURIComponent(provider)}`,
                {method: "DELETE"},
            ),

        /**
         * Placeholder for app-wide config (default language, etc.).
         * Phase 1A skeleton has no backing endpoint, so the
         * I18n provider falls back to its hardcoded default
         * language without erroring. Kept stub-typed so
         * useI18n.ts keeps compiling unchanged.
         */
        getApp: async (): Promise<Record<string, unknown>> => ({}),
    },

    // --- Assessment plugin ----------------------------------------------

    assessment: {
        questions: (lang: string) =>
            apiCall<AssessmentQuestion[]>(`/plugins/assessment/questions`, {
                query: {lang},
            }),
        evaluate: (body: AssessmentEvaluatePayload) =>
            apiCall<LearningProfile>(`/plugins/assessment/evaluate`, {
                method: "POST",
                body,
            }),
        profile: (projectId: string) =>
            apiCall<LearningProfile>(
                `/plugins/assessment/profile/${encodeURIComponent(projectId)}`,
            ),
    },

    // --- Session plugin --------------------------------------------------

    session: {
        start: (body: SessionStartBody) =>
            apiCall<SessionStartResult>(`/plugins/session/start`, {
                method: "POST",
                body,
            }),
        message: (sessionId: string, body: SessionMessageBody) =>
            apiCall<SessionMessageExchangeResult>(
                `/plugins/session/${encodeURIComponent(sessionId)}/message`,
                {method: "POST", body},
            ),
        rate: (sessionId: string, body: SessionRatingBody) =>
            apiCall<SessionRating>(
                `/plugins/session/${encodeURIComponent(sessionId)}/rate`,
                {method: "POST", body},
            ),
        end: (sessionId: string) =>
            apiCall<SessionEndResult>(
                `/plugins/session/${encodeURIComponent(sessionId)}/end`,
                {method: "POST"},
            ),
        /**
         * v0.2.0: GET the current ``recommend_method_switch`` hook
         * output. Returns ``{recommended:false}`` when no
         * recommendation; the matching backend impl is in the
         * session plugin (``switching.recommend``).
         */
        switchRecommendation: (sessionId: string) =>
            apiCall<SwitchRecommendation>(
                `/plugins/session/switch-recommendation/${encodeURIComponent(sessionId)}`,
            ),
        /**
         * Accept a method-switch suggestion. Records a MethodSwitch
         * audit row and flips the active session's method in
         * place. Returns the updated LearningSession.
         */
        acceptSwitch: (
            sessionId: string,
            body: {to_method: LearningMethod; reason: string},
        ) =>
            apiCall<import("../types/domain").LearningSession>(
                `/plugins/session/${encodeURIComponent(sessionId)}/switch`,
                {method: "POST", body},
            ),
    },

    // --- Tracking plugin -------------------------------------------------

    tracking: {
        progress: (projectId: string) =>
            apiCall<ProgressSummary>(
                `/plugins/tracking/progress/${encodeURIComponent(projectId)}`,
            ),
        commits: (projectId: string) =>
            apiCall<ProgressCommit[]>(
                `/plugins/tracking/commits/${encodeURIComponent(projectId)}`,
            ),
    },

    // --- Tools plugin ----------------------------------------------------

    tools: {
        recommendations: (projectId: string, lang: string) =>
            apiCall<ToolRecommendation[]>(
                `/plugins/tools/recommendations/${encodeURIComponent(projectId)}`,
                {query: {lang}},
            ),
    },

    // --- Curriculum + topics (core, not plugin) -------------------------

    curricula: {
        /** List every curriculum owned by ``user_id``. */
        list: (userId: string) =>
            apiCall<import("../types/domain").Curriculum[]>(
                `/users/${encodeURIComponent(userId)}/curricula`,
            ),
        create: (userId: string, body: CurriculumCreateBody) =>
            apiCall<import("../types/domain").Curriculum>(
                `/users/${encodeURIComponent(userId)}/curricula`,
                {method: "POST", body},
            ),
        get: (curriculumId: string) =>
            apiCall<import("../types/domain").Curriculum>(
                `/curricula/${encodeURIComponent(curriculumId)}`,
            ),
        update: (curriculumId: string, body: CurriculumUpdateBody) =>
            apiCall<import("../types/domain").Curriculum>(
                `/curricula/${encodeURIComponent(curriculumId)}`,
                {method: "PATCH", body},
            ),
        remove: (curriculumId: string) =>
            apiCall<void>(`/curricula/${encodeURIComponent(curriculumId)}`, {
                method: "DELETE",
            }),
        listTopics: (curriculumId: string) =>
            apiCall<import("../types/domain").LearningTopic[]>(
                `/curricula/${encodeURIComponent(curriculumId)}/topics`,
            ),
        createTopic: (curriculumId: string, body: TopicCreateBody) =>
            apiCall<import("../types/domain").LearningTopic>(
                `/curricula/${encodeURIComponent(curriculumId)}/topics`,
                {method: "POST", body},
            ),
    },

    topics: {
        get: (topicId: string) =>
            apiCall<import("../types/domain").LearningTopic>(
                `/topics/${encodeURIComponent(topicId)}`,
            ),
        update: (topicId: string, body: TopicUpdateBody) =>
            apiCall<import("../types/domain").LearningTopic>(
                `/topics/${encodeURIComponent(topicId)}`,
                {method: "PATCH", body},
            ),
        remove: (topicId: string) =>
            apiCall<void>(`/topics/${encodeURIComponent(topicId)}`, {
                method: "DELETE",
            }),
    },

    // --- Plugin discovery / health --------------------------------------

    plugins: {
        manifests: () => apiCall<Record<string, unknown>>("/plugins/manifests"),
        health: () => apiCall<Record<string, unknown>>("/plugins/health"),
        errors: () => apiCall<Record<string, string>>("/plugins/errors"),
    },
};

// --- Re-exports for callers that want the typed payload shapes ---------

export type {
    AssessmentEvaluatePayload,
    AssessmentQuestion,
    LearningProfile,
    LearningProject,
    ProgressCommit,
    ProgressSummary,
    SessionEndResult,
    SessionMessage,
    SessionMessageExchangeResult,
    SessionRating,
    SessionStartResult,
    SwitchRecommendation,
    ToolRecommendation,
    User,
    UserSettings,
} from "../types/domain";
