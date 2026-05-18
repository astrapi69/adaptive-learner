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

export interface UserSettings {
    id: string;
    user_id: string;
    language: string;
    active_provider: AIProvider;
    has_anthropic_key: boolean;
    has_openai_key: boolean;
    has_gemini_key: boolean;
    created_at: string;
    updated_at: string;
}

// --- LearningProject ----------------------------------------------------

export interface LearningProject {
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
 * v0.2.0 shape for ``POST /api/plugins/session/{id}/message``.
 *
 * The backend orchestrates AI server-side: route saves the user
 * message, fires the ``ai_complete`` hook against the active
 * provider's API key + default model, persists the assistant
 * reply, returns the composite. ``assistant_message`` is ``null``
 * when AI couldn't reply (no API key, no provider matched,
 * provider raised); ``ai_error`` carries a one-line explanation.
 */
export interface SessionMessageExchangeResult {
    user_message: SessionMessage;
    assistant_message: SessionMessage | null;
    ai_error: string | null;
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
    text: string;
    answers: AssessmentAnswer[];
}

/**
 * Payload of ``POST /api/plugins/assessment/evaluate``. The
 * answers array carries one entry per question; the plugin
 * validates ``min_length=1`` (every question must be answered).
 */
export interface AssessmentEvaluatePayload {
    project_id: string;
    answers: {question_id: string; answer_id: string}[];
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
export interface TrackingSummary {
    total_sessions: number;
    sessions_per_method: Partial<Record<LearningMethod, number>>;
    recent_understanding: number[];
    recent_stress: number[];
    mean_understanding: number;
    mean_stress: number;
}

export interface ProgressSummary {
    tracking?: TrackingSummary;
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
