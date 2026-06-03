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

import {
  API_BASE,
  type AIProvider,
  type LearningMethod,
  type MessageRole,
} from "../lib/constants";
import type {
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

// --- Error class --------------------------------------------------------

export class ApiError extends Error {
  /** Phase 37 — ISO 8601 capture time. The ErrorReportDialog
   *  embeds it in the GitHub issue body so developers can
   *  correlate against backend logs. Auto-set by the constructor;
   *  callers don't pass it.
   */
  public readonly timestamp: string;

  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly endpoint?: string,
    public readonly method?: string,
    public readonly stacktrace?: string,
    /**
     * Phase 36 — structured context fields the backend's
     * ``AdaptiveLearnerError.extra`` attaches to the JSON
     * response alongside ``detail``. Example: a 409 duplicate
     * import surfaces ``{existing_id: "<uuid>"}`` here so the
     * caller can navigate to the existing record.
     */
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = "ApiError";
    this.timestamp = new Date().toISOString();
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
  const init: RequestInit = { method };
  if (opts.body !== undefined && opts.body !== null) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  // Phase 37 — record every API call (success + error + network
  // failure) into the in-memory ring buffer. The recorder
  // sanitizes the endpoint (strips query) and never sees the
  // body. Dynamic import keeps the dependency graph one-way at
  // module evaluation time.
  const startTime = performance.now();
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    try {
      const { eventRecorder } = await import("../utils/eventRecorder");
      eventRecorder.add({
        type: "api_error",
        timestamp: startTime,
        method,
        endpoint: path,
        message: String(networkError).substring(0, 200),
      });
    } catch {
      /* recorder not available */
    }
    throw networkError;
  }
  const durationMs = Math.round(performance.now() - startTime);
  try {
    const { eventRecorder } = await import("../utils/eventRecorder");
    eventRecorder.add({
      type: "api_call",
      timestamp: startTime,
      method,
      endpoint: path,
      status: response.status,
      durationMs,
    });
  } catch {
    /* recorder not available */
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    let stacktrace: string | undefined;
    const extra: Record<string, unknown> = {};
    try {
      const errBody = await response.json();
      if (typeof errBody?.detail === "string") {
        detail = errBody.detail;
      } else if (Array.isArray(errBody?.detail)) {
        // Pydantic validation errors come as a list of
        // {loc, msg, type} dicts; flatten them so toasts
        // surface something legible.
        detail = errBody.detail
          .map((e: { loc?: unknown[]; msg?: string }) => {
            const where = (e.loc ?? []).slice(1).join(".");
            return where ? `${where}: ${e.msg ?? ""}` : (e.msg ?? "");
          })
          .filter(Boolean)
          .join("; ");
      }
      if (typeof errBody?.stacktrace === "string") {
        stacktrace = errBody.stacktrace;
      }
      // Phase 36 — carry any extra fields the backend
      // attached via ``AdaptiveLearnerError.extra``. Strips
      // the keys handled above so the caller doesn't see
      // them twice.
      if (errBody && typeof errBody === "object") {
        for (const [key, value] of Object.entries(errBody)) {
          if (key === "detail" || key === "stacktrace") continue;
          extra[key] = value;
        }
      }
    } catch {
      /* non-JSON error body — keep generic detail */
    }
    throw new ApiError(
      response.status,
      detail,
      path,
      method,
      stacktrace,
      extra,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const base = `${API_BASE}${path}`;
  if (!query) return base;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

// --- Response payload shapes -------------------------------------------

/**
 * Wire shape of GET /api/identity (Phase 41A). Mirrors backend's
 * ``IdentityOut`` schema. ``user_id`` is always present; the other
 * three fields are nullable because the identity file is written
 * BEFORE the user creates their first project (so active_project_id
 * may be null) and ``last_seen`` is auto-set on every write.
 */
export interface IdentityPayload {
  user_id: string;
  active_project_id: string | null;
  language: string | null;
  last_seen: string | null;
}

/**
 * Wire shape of GET /api/identity/status (Phase 41D). Diagnostic
 * surface for the Settings > About > Identity panel. Always returns
 * 200 (even when the file does not exist) so the UI can show a
 * "Not found" badge with the path the file would live at.
 */
export interface IdentityStatusPayload {
  exists: boolean;
  path: string;
  last_seen: string | null;
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
  // v0.4.0 — per-provider model override. ``""`` (empty string)
  // clears the override; a non-empty string sets it; field
  // omitted leaves the existing column alone.
  model_override_anthropic?: string;
  model_override_openai?: string;
  model_override_gemini?: string;
}

export interface ApiKeySetBody {
  provider: AIProvider;
  key: string;
}

export interface AvailableModelResponse {
  id: string;
  name: string;
  context_window: number | null;
  description: string | null;
}

/**
 * PLUGINFORGE-LIFECYCLE-UI-01: lifecycle metadata for one plugin,
 * mirroring the backend ``/api/plugins/inspect/{name}`` response.
 * ``state.activated_at`` and ``state.last_config_change`` are
 * ISO-8601 strings (or null when never set). ``state.source`` is
 * ``"entry_point"`` for installed plugins, ``"direct_register"``
 * for programmatically-registered ones.
 */
export interface PluginInspection {
  name: string;
  version: string;
  target_application: string | null;
  state: {
    activated: boolean;
    activated_at: string | null;
    last_config_change: string | null;
    source: "entry_point" | "direct_register" | null;
    filter_reason: string | null;
    load_error: string | null;
  };
}

export interface SessionStartBody {
  project_id: string;
  method?: LearningMethod;
  cycle_step?: number;
  lang?: string;
  /**
   * Phase 36 Bug 4 — optional FK back to the imported
   * conversation that started this session. The backend resumes
   * an existing active session for the same conversation
   * instead of creating a new one when this is set.
   */
  imported_conversation_id?: string | null;
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
  /**
   * Phase 36 Bug 3 — optional FK back to the imported conversation
   * this curriculum was generated from. Lets ImportDetail flip
   * the "Create curriculum" CTA into a "Go to curriculum"
   * navigation so users do not generate duplicates.
   */
  imported_conversation_id?: string | null;
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

export interface LessonCreateBody {
  title: string;
  content?: string;
  order_index?: number;
}

export interface LessonUpdateBody {
  title?: string;
  content?: string;
  order_index?: number;
}

// --- Taxonomy (Phase 22) -----------------------------------------------

export interface SubjectCreateBody {
  name: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface SubjectUpdateBody {
  name?: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
}

export interface TagCreateBody {
  name: string;
  color?: string | null;
}

export interface TagUpdateBody {
  name?: string;
  color?: string | null;
}

// --- Public namespaces --------------------------------------------------

export const api = {
  health: () =>
    apiCall<{ status: string; version: string; debug: boolean }>("/health"),

  i18n: {
    get: (lang: string) =>
      apiCall<Record<string, unknown>>(`/i18n/${encodeURIComponent(lang)}`),
  },

  // --- Identity (Phase 41A) -------------------------------------------
  // Recovery surface for the post-browser-wipe Landing flow. Backed by
  // ~/.config/adaptive_learner/identity.yaml; GET returns 404 when the
  // file is missing (genuine first visit), 200 with the payload when
  // a prior session left a trace on disk. The wrapper translates the
  // 404 into a null return so callers don't have to catch ApiError
  // just to distinguish "missing" from real failures.

  identity: {
    get: async (): Promise<IdentityPayload | null> => {
      try {
        return await apiCall<IdentityPayload>("/identity");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    status: () => apiCall<IdentityStatusPayload>("/identity/status"),
    delete: () => apiCall<void>("/identity", { method: "DELETE" }),
  },

  // --- Reset (Phase 41F Danger Zone) ----------------------------------
  // The body's ``confirmation`` field must equal the literal "RESET";
  // anything else 400s server-side. Surfaced via storage.reset.

  reset: (confirmation: string) =>
    apiCall<{ reset: true; tables_cleared: number }>("/reset", {
      method: "POST",
      body: { confirmation },
    }),

  // --- Users -----------------------------------------------------------

  users: {
    create: (body: UserCreateBody) =>
      apiCall<User>("/users", { method: "POST", body }),
    get: (userId: string) =>
      apiCall<User>(`/users/${encodeURIComponent(userId)}`),
    update: (userId: string, body: UserUpdateBody) =>
      apiCall<User>(`/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body,
      }),

    // User-scoped projects -- nested under the user prefix.
    projects: {
      list: (userId: string) =>
        apiCall<LearningProject[]>(
          `/users/${encodeURIComponent(userId)}/projects`,
        ),
      create: (userId: string, body: LearningProjectCreateBody) =>
        apiCall<LearningProject>(
          `/users/${encodeURIComponent(userId)}/projects`,
          { method: "POST", body },
        ),
    },
  },

  // --- Projects (project-scoped, no user prefix) ----------------------

  projects: {
    get: (projectId: string) =>
      apiCall<LearningProject>(`/projects/${encodeURIComponent(projectId)}`),
    update: (projectId: string, body: LearningProjectUpdateBody) =>
      apiCall<LearningProject>(`/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        body,
      }),
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
      apiCall<UserSettings>(`/settings/${encodeURIComponent(userId)}/api-key`, {
        method: "POST",
        body,
      }),
    deleteApiKey: (userId: string, provider: AIProvider) =>
      apiCall<UserSettings>(
        `/settings/${encodeURIComponent(userId)}/api-key/${encodeURIComponent(provider)}`,
        { method: "DELETE" },
      ),

    /**
     * Phase 65 — live API-key test. Fires a minimal completion at
     * the provider and returns ``{success, kind}`` (kind: ok /
     * invalid / rate_limit / network / error / no_key). When
     * ``key`` is omitted the backend tests the configured key.
     * Does NOT save anything.
     */
    testApiKey: (
      userId: string,
      body: { provider: AIProvider; key?: string },
    ) =>
      apiCall<{ success: boolean; kind: string }>(
        `/settings/${encodeURIComponent(userId)}/test-api-key`,
        { method: "POST", body },
      ),

    /** Phase 65 — rollback cache: store a tested-good key as the
     *  last-known-good backup. */
    backupApiKey: (
      userId: string,
      body: { provider: AIProvider; key: string },
    ) =>
      apiCall<UserSettings>(
        `/settings/${encodeURIComponent(userId)}/api-key-backup`,
        { method: "POST", body },
      ),
    getApiKeyBackup: (userId: string, provider: AIProvider) =>
      apiCall<{ has: boolean; tested_at: string | null }>(
        `/settings/${encodeURIComponent(userId)}/api-key-backup/${encodeURIComponent(provider)}`,
      ),
    restoreApiKeyBackup: (userId: string, provider: AIProvider) =>
      apiCall<UserSettings>(
        `/settings/${encodeURIComponent(userId)}/api-key-backup/${encodeURIComponent(provider)}/restore`,
        { method: "POST" },
      ),

    /**
     * Placeholder for app-wide config (default language, etc.).
     * Phase 1A skeleton has no backing endpoint, so the
     * I18n provider falls back to its hardcoded default
     * language without erroring. Kept stub-typed so
     * useI18n.ts keeps compiling unchanged.
     */
    getApp: async (): Promise<Record<string, unknown>> => ({}),

    /**
     * v1.11.0 / Phase 24A — list chat-capable models for the
     * requested provider. The backend decrypts the user's
     * stored API key and forwards it to the provider's
     * ``/models`` endpoint; results are cached server-side
     * for one hour. Returns ``[]`` when no key for the
     * provider is configured.
     */
    getAvailableModels: (userId: string, provider: AIProvider) =>
      apiCall<AvailableModelResponse[]>(
        `/settings/${encodeURIComponent(userId)}/available-models`,
        { query: { provider } },
      ),
  },

  // --- GitHub integration (community PR automation) -------------------

  github: {
    /** Token status: configured + source (env / secrets.yaml / none).
     *  The token itself is never returned. */
    getStatus: () =>
      apiCall<{ configured: boolean; source: string }>(`/github/token`),
    /** Store a GitHub PAT (Fernet-encrypted in secrets.yaml). */
    setToken: (token: string) =>
      apiCall<{ configured: boolean; source: string }>(`/github/token`, {
        method: "POST",
        body: { token },
      }),
    clearToken: () =>
      apiCall<{ configured: boolean; source: string }>(`/github/token`, {
        method: "DELETE",
      }),
    /** Verify a token (or the configured one when omitted). */
    verifyToken: (token?: string) =>
      apiCall<{ valid: boolean; username: string | null; kind: string }>(
        `/github/verify-token`,
        { method: "POST", body: { token: token ?? null } },
      ),
    /** Run the fork -> branch -> commit -> PR flow server-side. */
    createPr: (body: {
      upstream: string;
      base_branch: string;
      branch_name: string;
      file_path: string;
      file_content: string;
      commit_message: string;
      pr_title: string;
      pr_body: string;
      manifest_update?: { set_path: string; lesson_filename: string } | null;
    }) =>
      apiCall<{ url: string; number: number; manifest_updated: boolean }>(
        `/github/create-pr`,
        { method: "POST", body },
      ),
  },

  // --- Assessment plugin ----------------------------------------------

  assessment: {
    questions: (lang: string) =>
      apiCall<AssessmentQuestion[]>(`/plugins/assessment/questions`, {
        query: { lang },
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
        { method: "POST", body },
      ),
    /**
     * v1.6.0 / Phase 19 — streaming variant of ``message``.
     *
     * Opens an SSE stream over ``POST /message/stream``. Calls
     * ``onChunk`` for every text delta and ``onDone`` with the
     * full exchange result (assistant message + step
     * evaluation + topic transition + timings) when the stream
     * closes. Resolves on clean close; rejects on transport
     * errors. The user-message persistence happens server-side
     * before the stream opens, so even on a mid-stream error
     * the conversation record is intact.
     */
    streamMessage: (
      sessionId: string,
      body: SessionMessageBody,
      handlers: {
        onStart?: (userMessage: SessionMessage) => void;
        onChunk: (delta: string) => void;
        onDone: (result: SessionMessageExchangeResult) => void;
        signal?: AbortSignal;
      },
    ) =>
      import("../lib/sse-reader").then(({ streamSse }) =>
        streamSse({
          url: `${API_BASE}/plugins/session/${encodeURIComponent(sessionId)}/message/stream`,
          body,
          signal: handlers.signal,
          onEvent: (event) => {
            if (event.event === "start" && handlers.onStart) {
              handlers.onStart(
                (event.data as { user_message: SessionMessage }).user_message,
              );
            } else if (event.event === "chunk") {
              handlers.onChunk((event.data as { delta: string }).delta);
            } else if (event.event === "done") {
              handlers.onDone(event.data as SessionMessageExchangeResult);
            }
          },
        }),
      ),
    rate: (sessionId: string, body: SessionRatingBody) =>
      apiCall<SessionRating>(
        `/plugins/session/${encodeURIComponent(sessionId)}/rate`,
        { method: "POST", body },
      ),
    end: (sessionId: string) =>
      apiCall<SessionEndResult>(
        `/plugins/session/${encodeURIComponent(sessionId)}/end`,
        { method: "POST" },
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
      body: { to_method: LearningMethod; reason: string },
    ) =>
      apiCall<import("../types/domain").LearningSession>(
        `/plugins/session/${encodeURIComponent(sessionId)}/switch`,
        { method: "POST", body },
      ),
    /**
     * Phase 38 Bug 7 — fetch a session record by ID
     * (resume path). Throws ApiError (404) on missing.
     */
    get: (sessionId: string) =>
      apiCall<import("../types/domain").LearningSession>(
        `/plugins/session/${encodeURIComponent(sessionId)}`,
      ),
    /**
     * Phase 38 Bug 7 — fetch the chat history for a
     * session, oldest-first. The system-prompt message
     * appears as the first entry.
     */
    getMessages: (sessionId: string) =>
      apiCall<SessionMessage[]>(
        `/plugins/session/${encodeURIComponent(sessionId)}/messages`,
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
        { query: { lang } },
      ),
    /** v0.4.0 spaced-repetition action cards. */
    spaced: (projectId: string, lang: string) =>
      apiCall<import("../types/domain").SpacedRecommendation[]>(
        `/plugins/tools/spaced/${encodeURIComponent(projectId)}`,
        { query: { lang } },
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
        { method: "POST", body },
      ),
    get: (curriculumId: string) =>
      apiCall<import("../types/domain").Curriculum>(
        `/curricula/${encodeURIComponent(curriculumId)}`,
      ),
    update: (curriculumId: string, body: CurriculumUpdateBody) =>
      apiCall<import("../types/domain").Curriculum>(
        `/curricula/${encodeURIComponent(curriculumId)}`,
        { method: "PATCH", body },
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
        { method: "POST", body },
      ),
    listLessons: (curriculumId: string) =>
      apiCall<import("../types/domain").Lesson[]>(
        `/curricula/${encodeURIComponent(curriculumId)}/lessons`,
      ),
    createLesson: (curriculumId: string, body: LessonCreateBody) =>
      apiCall<import("../types/domain").Lesson>(
        `/curricula/${encodeURIComponent(curriculumId)}/lessons`,
        { method: "POST", body },
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
        { method: "PATCH", body },
      ),
    remove: (topicId: string) =>
      apiCall<void>(`/topics/${encodeURIComponent(topicId)}`, {
        method: "DELETE",
      }),
  },

  lessons: {
    get: (lessonId: string) =>
      apiCall<import("../types/domain").Lesson>(
        `/lessons/${encodeURIComponent(lessonId)}`,
      ),
    update: (lessonId: string, body: LessonUpdateBody) =>
      apiCall<import("../types/domain").Lesson>(
        `/lessons/${encodeURIComponent(lessonId)}`,
        { method: "PATCH", body },
      ),
    remove: (lessonId: string) =>
      apiCall<void>(`/lessons/${encodeURIComponent(lessonId)}`, {
        method: "DELETE",
      }),
  },

  // --- Taxonomy: Subjects + Tags (v1.9.0 / Phase 22) ------------------

  subjects: {
    list: () => apiCall<import("../types/domain").Subject[]>("/subjects"),
    get: (subjectId: string) =>
      apiCall<import("../types/domain").Subject>(
        `/subjects/${encodeURIComponent(subjectId)}`,
      ),
    create: (body: SubjectCreateBody) =>
      apiCall<import("../types/domain").Subject>("/subjects", {
        method: "POST",
        body,
      }),
    update: (subjectId: string, body: SubjectUpdateBody) =>
      apiCall<import("../types/domain").Subject>(
        `/subjects/${encodeURIComponent(subjectId)}`,
        { method: "PATCH", body },
      ),
    remove: (subjectId: string) =>
      apiCall<void>(`/subjects/${encodeURIComponent(subjectId)}`, {
        method: "DELETE",
      }),
  },

  tags: {
    list: (userId: string) =>
      apiCall<import("../types/domain").Tag[]>(
        `/users/${encodeURIComponent(userId)}/tags`,
      ),
    create: (userId: string, body: TagCreateBody) =>
      apiCall<import("../types/domain").Tag>(
        `/users/${encodeURIComponent(userId)}/tags`,
        { method: "POST", body },
      ),
    update: (tagId: string, body: TagUpdateBody) =>
      apiCall<import("../types/domain").Tag>(
        `/tags/${encodeURIComponent(tagId)}`,
        { method: "PATCH", body },
      ),
    remove: (tagId: string) =>
      apiCall<void>(`/tags/${encodeURIComponent(tagId)}`, {
        method: "DELETE",
      }),
  },

  projectTaxonomy: {
    listSubjects: (projectId: string) =>
      apiCall<import("../types/domain").Subject[]>(
        `/projects/${encodeURIComponent(projectId)}/subjects`,
      ),
    assignSubject: (projectId: string, subjectId: string) =>
      apiCall<import("../types/domain").Subject>(
        `/projects/${encodeURIComponent(projectId)}/subjects`,
        { method: "POST", body: { subject_id: subjectId } },
      ),
    unassignSubject: (projectId: string, subjectId: string) =>
      apiCall<void>(
        `/projects/${encodeURIComponent(projectId)}/subjects/` +
          encodeURIComponent(subjectId),
        { method: "DELETE" },
      ),
    listTags: (projectId: string) =>
      apiCall<import("../types/domain").Tag[]>(
        `/projects/${encodeURIComponent(projectId)}/tags`,
      ),
    assignTag: (projectId: string, tagId: string) =>
      apiCall<import("../types/domain").Tag>(
        `/projects/${encodeURIComponent(projectId)}/tags`,
        { method: "POST", body: { tag_id: tagId } },
      ),
    unassignTag: (projectId: string, tagId: string) =>
      apiCall<void>(
        `/projects/${encodeURIComponent(projectId)}/tags/` +
          encodeURIComponent(tagId),
        { method: "DELETE" },
      ),
  },

  // --- Plugin discovery / health --------------------------------------

  plugins: {
    manifests: () => apiCall<Record<string, unknown>>("/plugins/manifests"),
    health: () => apiCall<Record<string, unknown>>("/plugins/health"),
    errors: () => apiCall<Record<string, string>>("/plugins/errors"),
    // PLUGINFORGE-LIFECYCLE-UI-01: surfaces the v0.9.0 lifecycle
    // metadata for one plugin. Used by the (future) Settings →
    // Plugins panel; backend endpoint shipped first so the panel
    // can be built on top of a typed contract.
    inspect: (name: string) =>
      apiCall<PluginInspection>(`/plugins/inspect/${encodeURIComponent(name)}`),
  },

  // --- System info (v1.1.0 / Phase 14A) -------------------------------

  system: {
    info: () => apiCall<import("../types/domain").SystemInfo>("/system/info"),
  },

  // --- Export (v1.3.0 / Phase 16A) -------------------------------------

  export: {
    /**
     * Aggregate the user's full learning journey into a
     * structured payload ready for Markdown / PDF rendering.
     */
    progress: (userId: string, lang: string) =>
      apiCall<import("../storage/export-builder").ProgressReport>(
        `/export/progress?user_id=${encodeURIComponent(userId)}` +
          `&lang=${encodeURIComponent(lang)}`,
      ),
    session: (sessionId: string, lang: string) =>
      apiCall<import("../storage/export-builder").SessionDetail>(
        `/export/session/${encodeURIComponent(sessionId)}` +
          `?lang=${encodeURIComponent(lang)}`,
      ),
    curriculum: (curriculumId: string, lang: string) =>
      apiCall<import("../storage/export-builder").CurriculumOverview>(
        `/export/curriculum/${encodeURIComponent(curriculumId)}` +
          `?lang=${encodeURIComponent(lang)}`,
      ),
  },

  // --- Backup / restore (v1.2.0 / Phase 15A) --------------------------

  backup: {
    /**
     * Trigger the JSON download endpoint and return the
     * parsed payload. The endpoint sets a
     * ``Content-Disposition: attachment`` header so the
     * browser also offers a save dialog when the caller is
     * a page navigation rather than this fetch.
     */
    export: (userId: string) =>
      apiCall<import("../types/domain").BackupPayload>(
        `/backup/export?user_id=${encodeURIComponent(userId)}`,
      ),
    stats: (userId: string) =>
      apiCall<import("../types/domain").BackupStats & { user_id: string }>(
        `/backup/stats?user_id=${encodeURIComponent(userId)}`,
      ),
    import: (
      userId: string,
      payload: import("../types/domain").BackupPayload,
    ) =>
      apiCall<import("../types/domain").RestoreSummary>(
        `/backup/import?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body: payload },
      ),
  },

  // --- NotebookLM plugin (v1.19.0 / Phase 32) -------------------------

  notebooklm: {
    listQuestions: (
      userId: string,
      filters?: import("../storage/types").StudyQuestionListFilters,
    ) => {
      const query: Record<string, string> = {};
      if (filters?.projectId) query.project_id = filters.projectId;
      if (filters?.difficulty) query.difficulty = filters.difficulty;
      if (filters?.topic) query.topic = filters.topic;
      return apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/${encodeURIComponent(userId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    createQuestion: (
      userId: string,
      body: import("../storage/types").StudyQuestionCreateBody,
    ) =>
      apiCall<import("../storage/types").StudyQuestion>(
        `/plugins/notebooklm/questions?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body },
      ),
    updateQuestion: (
      questionId: string,
      body: import("../storage/types").StudyQuestionUpdateBody,
    ) =>
      apiCall<import("../storage/types").StudyQuestion>(
        `/plugins/notebooklm/questions/${encodeURIComponent(questionId)}`,
        { method: "PATCH", body },
      ),
    deleteQuestion: (questionId: string) =>
      apiCall<{ deleted: string }>(
        `/plugins/notebooklm/questions/${encodeURIComponent(questionId)}`,
        { method: "DELETE" },
      ),
    generateFromSession: (sessionId: string) =>
      apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/generate/session/${encodeURIComponent(sessionId)}`,
        { method: "POST", body: {} },
      ),
    generateFromProject: (projectId: string) =>
      apiCall<import("../storage/types").StudyQuestion[]>(
        `/plugins/notebooklm/questions/generate/project/${encodeURIComponent(projectId)}`,
        { method: "POST", body: {} },
      ),
    studyGuide: async (projectId: string) => {
      // Returns text/markdown — bypass apiCall (which
      // parses JSON) and call fetch directly.
      const res = await fetch(
        `${API_BASE}/plugins/notebooklm/study-guide/${encodeURIComponent(projectId)}`,
        { method: "POST", body: "" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "" }));
        throw new ApiError(
          res.status,
          body.detail || `Study guide failed (HTTP ${res.status})`,
        );
      }
      return await res.text();
    },
  },

  // --- Plugin settings round-trip (v1.26.0 / generic) -----------------

  pluginSettings: {
    /** GET /api/plugin-settings/{plugin_name} */
    get: (pluginName: string) =>
      apiCall<{ plugin: string; settings: Record<string, unknown> }>(
        `/plugin-settings/${encodeURIComponent(pluginName)}`,
      ),
    /** PATCH /api/plugin-settings/{plugin_name} */
    update: (pluginName: string, body: { settings: Record<string, unknown> }) =>
      apiCall<{ plugin: string; settings: Record<string, unknown> }>(
        `/plugin-settings/${encodeURIComponent(pluginName)}`,
        { method: "PATCH", body },
      ),
  },

  // --- Learning Repository plugin (v1.26.0 / Phase 42 / BL-30) -------

  learningRepo: {
    /** GET /api/plugins/learning-repo/render/{project_id} */
    render: (projectId: string, language?: string) => {
      const query: Record<string, string> = {};
      if (language) query.language = language;
      return apiCall<{
        project_id: string;
        language: string;
        rendered_at: string;
        files: Record<string, string>;
      }>(
        `/plugins/learning-repo/render/${encodeURIComponent(projectId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    /** POST /api/plugins/learning-repo/export-zip/{project_id}
     *  Returns the raw zip Blob — caller usually pipes it into
     *  a download anchor. */
    exportZip: async (projectId: string, language?: string): Promise<Blob> => {
      const qs = language ? `?language=${encodeURIComponent(language)}` : "";
      const res = await fetch(
        `${API_BASE}/plugins/learning-repo/export-zip/${encodeURIComponent(projectId)}${qs}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "" }));
        throw new ApiError(
          res.status,
          body.detail || `Export-zip failed (HTTP ${res.status})`,
        );
      }
      return await res.blob();
    },
    /** POST /api/plugins/learning-repo/persist/{project_id} */
    persist: (projectId: string, language?: string) => {
      const qs = language ? `?language=${encodeURIComponent(language)}` : "";
      return apiCall<{
        project_id: string;
        language: string;
        rendered_at: string;
        files_written: number;
        repo_path: string;
        commit_sha: string;
        tag: string | null;
      }>(
        `/plugins/learning-repo/persist/${encodeURIComponent(projectId)}${qs}`,
        { method: "POST" },
      );
    },
  },

  // --- Lesson Progress (Phase 44 / EXP-002 / P-109) ------------------

  lessonProgress: {
    /** GET /api/users/{user_id}/lesson-progress */
    list: (userId: string) =>
      apiCall<import("../storage/types").LessonProgress[]>(
        `/users/${encodeURIComponent(userId)}/lesson-progress`,
      ),
    /** GET /api/users/{user_id}/lesson-progress/{src}/{set}/{lesson}
     *  Translates the 404 into a ``null`` return so callers
     *  treat "never started" as a fresh-start case, not an
     *  error. */
    get: async (
      userId: string,
      source: string,
      setId: string,
      lessonFilename: string,
    ): Promise<import("../storage/types").LessonProgress | null> => {
      const slug = source.replace(/\//g, "--");
      try {
        return await apiCall<import("../storage/types").LessonProgress>(
          `/users/${encodeURIComponent(userId)}/lesson-progress/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/${encodeURIComponent(lessonFilename)}`,
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    /** POST /api/users/{user_id}/lesson-progress */
    upsert: (
      userId: string,
      body: import("../storage/types").LessonProgressUpsertBody,
    ) =>
      apiCall<import("../storage/types").LessonProgress>(
        `/users/${encodeURIComponent(userId)}/lesson-progress`,
        { method: "POST", body },
      ),
  },

  // --- Element Errors (Phase 46B / EXP-007 / P-129) ------------------

  elementErrors: {
    /** GET /api/users/{user_id}/element-errors */
    list: (
      userId: string,
      opts: { setId?: string; includeMastered?: boolean } = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.setId !== undefined) params.set("set_id", opts.setId);
      if (opts.includeMastered === false) {
        params.set("include_mastered", "false");
      }
      const qs = params.toString();
      const path = qs
        ? `/users/${encodeURIComponent(userId)}/element-errors?${qs}`
        : `/users/${encodeURIComponent(userId)}/element-errors`;
      return apiCall<import("../storage/types").ElementError[]>(path);
    },
    /** POST /api/users/{user_id}/element-errors */
    recordBulk: (
      userId: string,
      attempts: readonly import("../storage/types").ElementAttempt[],
    ) =>
      apiCall<import("../storage/types").ElementError[]>(
        `/users/${encodeURIComponent(userId)}/element-errors`,
        { method: "POST", body: { attempts } },
      ),
    /** GET /api/users/{user_id}/element-errors/review-queue */
    reviewQueue: (userId: string, opts: { setId?: string } = {}) => {
      const params = new URLSearchParams();
      if (opts.setId !== undefined) params.set("set_id", opts.setId);
      const qs = params.toString();
      const path = qs
        ? `/users/${encodeURIComponent(userId)}/element-errors/review-queue?${qs}`
        : `/users/${encodeURIComponent(userId)}/element-errors/review-queue`;
      return apiCall<import("../storage/types").ReviewQueueItem[]>(path);
    },
  },

  // --- Missions plugin (EXP-010 / Phase 56) ---------------------------

  missions: {
    getDaily: (
      userId: string,
      opts: import("../storage/types").MissionDailyOptions = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.count !== undefined) params.set("count", String(opts.count));
      if (opts.difficultyMix !== undefined) {
        params.set("difficulty_mix", opts.difficultyMix);
      }
      if (opts.todayIso !== undefined) params.set("today", opts.todayIso);
      const qs = params.toString();
      const path = qs
        ? `/plugins/missions/today/${encodeURIComponent(userId)}?${qs}`
        : `/plugins/missions/today/${encodeURIComponent(userId)}`;
      return apiCall<import("../storage/types").MissionDailyResultWire>(path);
    },
    regenerate: (
      userId: string,
      opts: import("../storage/types").MissionDailyOptions = {},
    ) => {
      const params = new URLSearchParams();
      if (opts.count !== undefined) params.set("count", String(opts.count));
      if (opts.difficultyMix !== undefined) {
        params.set("difficulty_mix", opts.difficultyMix);
      }
      if (opts.todayIso !== undefined) params.set("today", opts.todayIso);
      const qs = params.toString();
      const path = qs
        ? `/plugins/missions/regenerate/${encodeURIComponent(userId)}?${qs}`
        : `/plugins/missions/regenerate/${encodeURIComponent(userId)}`;
      return apiCall<import("../storage/types").MissionDailyResultWire>(path, {
        method: "POST",
      });
    },
  },

  // --- Content-Loader plugin (Phase 43 / EXP-002) ---------------------

  contentLoader: {
    /** GET /api/plugins/content-loader/sets */
    listSets: () =>
      apiCall<import("../storage/types").ContentSetsList>(
        "/plugins/content-loader/sets",
      ),
    /** POST /api/plugins/content-loader/sets/{src}/{id}/download */
    downloadSet: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentSetEntry>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/download`,
        { method: "POST" },
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/lessons */
    listLessons: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentLessonList>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/lessons`,
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/lessons/{filename} */
    getLesson: (source: string, setId: string, filename: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<import("../storage/types").ContentLesson>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/lessons/${encodeURIComponent(filename)}`,
      );
    },
    /** GET /api/plugins/content-loader/sets/{src}/{id}/assets/{asset_path}
     *
     *  Phase 54 / v1.37.0 — returns the raw asset bytes as a
     *  Blob, OR ``null`` on 404 so the caller can fall back
     *  to a placeholder. The endpoint is added in Phase 54F;
     *  ApiStorage.contentLoader.getAsset delegates here. */
    getAsset: async (
      source: string,
      setId: string,
      assetPath: string,
    ): Promise<Blob | null> => {
      const slug = source.replace(/\//g, "--");
      // assetPath contains forward slashes (e.g. "img/x.png")
      // and we want them preserved in the URL — encode each
      // segment individually so a literal "/" stays as "/".
      const encodedAssetPath = assetPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const url = `/api/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}/assets/${encodedAssetPath}`;
      try {
        const response = await fetch(url);
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(
            `Asset fetch failed: ${response.status} ${response.statusText}`,
          );
        }
        return await response.blob();
      } catch (err) {
        // Network failure mirrors the 404 surface — the
        // resolver hook falls back to placeholder /
        // text-only so a flaky connection doesn't break
        // PictureChoice exercises.
        console.warn("getAsset failed", url, err);
        return null;
      }
    },
    /** POST /api/plugins/content-loader/user-sets — Phase 59B /
     *  v1.42.0. Persists a user-generated set into the filesystem
     *  cache (same place as downloaded sets). */
    saveUserSet: (input: import("../storage/types").SaveUserSetInput) =>
      apiCall<import("../storage/types").ContentSetEntry>(
        "/plugins/content-loader/user-sets",
        // apiCall JSON.stringifies the body itself — pass the raw
        // object (double-stringify would 422 the Pydantic body).
        { method: "POST", body: input },
      ),
    /** DELETE /api/plugins/content-loader/sets/{src}/{id} —
     *  Phase 59C / v1.42.0. */
    deleteSet: (source: string, setId: string) => {
      const slug = source.replace(/\//g, "--");
      return apiCall<void>(
        `/plugins/content-loader/sets/${encodeURIComponent(slug)}/${encodeURIComponent(setId)}`,
        { method: "DELETE" },
      );
    },
    /** POST /api/content/validate-lesson — Phase 60 / v1.44.0.
     *  Opt-in AI content review; the backend resolves the AI key
     *  server-side and returns the structured result. */
    aiValidate: (input: import("../storage/types").AiValidateInput) =>
      apiCall<
        import("../lib/content/ai-content-validator").AiValidationResult
      >("/content/validate-lesson", {
        method: "POST",
        body: input,
      }),
  },

  // --- Sync pairing (server-only) -------------------------------------

  sync: {
    /** POST /api/sync/pair/generate — issue a short-lived pairing
     *  token for the QR handshake. Routed through the central client
     *  (Phase 61 C2) so failures surface as ``ApiError``, not a bare
     *  ``Error``. */
    generatePairToken: (userId: string) =>
      apiCall<{ token: string; user_id: string; expires_at: string }>(
        "/sync/pair/generate",
        { method: "POST", body: { user_id: userId } },
      ),
  },

  // --- Pronunciation Practice (v1.18.0 / Phase 31C) -------------------

  pronunciation: {
    eligibility: (projectId: string) =>
      apiCall<{ eligible: boolean }>(
        `/plugins/session/pronunciation/eligibility/${encodeURIComponent(projectId)}`,
      ),
    phrase: (body: {
      project_id: string;
      language: string;
      level?: string;
      focus?: string;
      previous?: string[];
    }) =>
      apiCall<{ phrase: string; language: string }>(
        `/plugins/session/pronunciation/phrase`,
        { method: "POST", body },
      ),
    judge: (body: {
      project_id: string;
      target: string;
      actual: string;
      language: string;
    }) =>
      apiCall<{
        matches: boolean;
        score: number;
        feedback: string;
        missed_sounds: string[];
      }>(`/plugins/session/pronunciation/judge`, {
        method: "POST",
        body,
      }),
  },

  // --- Gamification plugin (v1.16.0 / Phase 29) ------------------------

  gamification: {
    getState: (userId: string) =>
      apiCall<import("../storage/types").XPState>(
        `/plugins/gamification/xp/${encodeURIComponent(userId)}`,
      ),
    awardAssessment: (userId: string) =>
      apiCall<import("../storage/types").XPAwardResult>(
        `/plugins/gamification/xp/${encodeURIComponent(userId)}/award-assessment`,
        { method: "POST", body: {} },
      ),
    awardImport: (userId: string) =>
      apiCall<import("../storage/types").XPAwardResult>(
        `/plugins/gamification/xp/${encodeURIComponent(userId)}/award-import`,
        { method: "POST", body: {} },
      ),
    listBadges: (userId: string) =>
      apiCall<import("../storage/types").BadgeWithProgress[]>(
        `/plugins/gamification/badges/${encodeURIComponent(userId)}`,
      ),
    evaluateBadges: (userId: string) =>
      apiCall<import("../storage/types").BadgeEvaluationResult>(
        `/plugins/gamification/badges/${encodeURIComponent(userId)}/evaluate`,
        { method: "POST", body: {} },
      ),
    getStreak: (userId: string) =>
      apiCall<import("../storage/types").StreakStateOut>(
        `/plugins/gamification/streak/${encodeURIComponent(userId)}`,
      ),
    getStreakHeatmap: (userId: string, days?: number) =>
      apiCall<import("../storage/types").HeatmapEntryOut[]>(
        `/plugins/gamification/streak/${encodeURIComponent(userId)}/heatmap`,
        { query: days !== undefined ? { days: String(days) } : undefined },
      ),
    setWeekendMode: (userId: string, enabled: boolean) =>
      apiCall<import("../storage/types").StreakStateOut>(
        `/plugins/gamification/streak/${encodeURIComponent(userId)}/weekend-mode`,
        { method: "POST", body: { enabled } },
      ),
    resetProgress: (userId: string) =>
      apiCall<{
        xp_deleted: number;
        badges_deleted: number;
        streak_deleted: number;
      }>(`/plugins/gamification/reset/${encodeURIComponent(userId)}`, {
        method: "POST",
        body: {},
      }),
  },

  // --- Anki plugin (v1.17.0 / Phase 30) -------------------------------

  anki: {
    list: (
      userId: string,
      filters?: import("../storage/types").AnkiCardListFilters,
    ) => {
      const query: Record<string, string> = {};
      if (filters?.projectId) query.project_id = filters.projectId;
      if (filters?.acceptedOnly) query.accepted_only = "true";
      if (filters?.includeRejected) query.include_rejected = "true";
      return apiCall<import("../storage/types").AnkiCardSuggestion[]>(
        `/plugins/anki/cards/${encodeURIComponent(userId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    create: (
      userId: string,
      body: import("../storage/types").AnkiCardCreateBody,
    ) =>
      apiCall<import("../storage/types").AnkiCardSuggestion>(
        `/plugins/anki/cards?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body },
      ),
    update: (
      cardId: string,
      body: import("../storage/types").AnkiCardUpdateBody,
    ) =>
      apiCall<import("../storage/types").AnkiCardSuggestion>(
        `/plugins/anki/cards/${encodeURIComponent(cardId)}`,
        { method: "PATCH", body },
      ),
    remove: (cardId: string) =>
      apiCall<{ deleted: string }>(
        `/plugins/anki/cards/${encodeURIComponent(cardId)}`,
        { method: "DELETE" },
      ),
    extractFromSession: (sessionId: string) =>
      apiCall<import("../storage/types").AnkiCardSuggestion[]>(
        `/plugins/anki/cards/extract/session/${encodeURIComponent(sessionId)}`,
        { method: "POST", body: {} },
      ),
    extractFromConversation: (conversationId: string) =>
      apiCall<import("../storage/types").AnkiCardSuggestion[]>(
        `/plugins/anki/cards/extract/conversation/${encodeURIComponent(conversationId)}`,
        { method: "POST", body: {} },
      ),
    markExported: (cardIds: string[]) =>
      apiCall<{ updated: number }>(`/plugins/anki/cards/mark-exported`, {
        method: "POST",
        body: { card_ids: cardIds },
      }),
  },

  // --- Imported conversations (v0.9.0 / Phase 12C) ---------------------

  imports: {
    list: (userId: string) =>
      apiCall<import("../types/domain").ImportedConversation[]>(
        `/users/${encodeURIComponent(userId)}/imports`,
      ),
    create: (
      userId: string,
      body: import("../types/domain").ImportedConversationCreateBody,
    ) =>
      apiCall<import("../types/domain").ImportedConversation>(
        `/users/${encodeURIComponent(userId)}/imports`,
        { method: "POST", body },
      ),
    get: (conversationId: string) =>
      apiCall<import("../types/domain").ImportedConversationDetail>(
        `/imports/${encodeURIComponent(conversationId)}`,
      ),
    update: (
      conversationId: string,
      body: import("../types/domain").ImportedConversationUpdateBody,
    ) =>
      apiCall<import("../types/domain").ImportedConversation>(
        `/imports/${encodeURIComponent(conversationId)}`,
        { method: "PATCH", body },
      ),
    remove: (conversationId: string) =>
      apiCall<void>(`/imports/${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      }),
    saveAnalysis: (
      conversationId: string,
      analysis: import("../types/domain").ImportedConversationAnalysis,
    ) =>
      apiCall<import("../types/domain").ImportedConversationDetail>(
        `/imports/${encodeURIComponent(conversationId)}/analysis`,
        { method: "POST", body: analysis },
      ),
    /**
     * Server-side analyze. The backend decrypts the user's
     * stored API key, fires ``ai_complete`` against the active
     * provider, persists the result. Used by API mode where
     * the cleartext key never leaves the server.
     */
    analyze: (conversationId: string) =>
      apiCall<import("../types/domain").ImportedConversationDetail>(
        `/imports/${encodeURIComponent(conversationId)}/analyze`,
        { method: "POST", body: {} },
      ),
    /**
     * Phase 36 Bug 3 — return the curriculum auto-generated
     * from this conversation, or ``null`` if none exists.
     */
    getCurriculum: (conversationId: string) =>
      apiCall<import("../types/domain").Curriculum | null>(
        `/imports/${encodeURIComponent(conversationId)}/curriculum`,
      ),
    /**
     * Phase 36 Bug 4 — return the most recent active session
     * started from this conversation, or ``null`` if none.
     */
    getActiveSession: (conversationId: string) =>
      apiCall<import("../types/domain").LearningSession | null>(
        `/imports/${encodeURIComponent(conversationId)}/active-session`,
      ),
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
