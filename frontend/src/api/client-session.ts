/**
 * Adaptive Learner API client — assessment, session, tracking, tools namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { apiCall } from "./client-core";
import { API_BASE, type LearningMethod } from "../lib/constants";
import type {
  AssessmentEvaluatePayload,
  AssessmentQuestion,
  LearningProfile,
  ProgressCommit,
  ProgressSummary,
  SessionEndResult,
  SessionMessage,
  SessionMessageExchangeResult,
  SessionRating,
  SessionStartResult,
  SwitchRecommendation,
  ToolRecommendation
} from "../types/domain";
import type {
  SessionStartBody,
  SessionMessageBody,
  SessionRatingBody
} from "./request-types";

export const sessionApi = {
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
      apiCall<LearningProfile>(`/plugins/assessment/profile/${encodeURIComponent(projectId)}`),
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
      import("../lib/utils/sse-reader").then(({ streamSse }) =>
        streamSse({
          url: `${API_BASE}/plugins/session/${encodeURIComponent(sessionId)}/message/stream`,
          body,
          signal: handlers.signal,
          onEvent: (event) => {
            if (event.event === "start" && handlers.onStart) {
              handlers.onStart((event.data as { user_message: SessionMessage }).user_message);
            } else if (event.event === "chunk") {
              handlers.onChunk((event.data as { delta: string }).delta);
            } else if (event.event === "done") {
              handlers.onDone(event.data as SessionMessageExchangeResult);
            }
          },
        }),
      ),
    rate: (sessionId: string, body: SessionRatingBody) =>
      apiCall<SessionRating>(`/plugins/session/${encodeURIComponent(sessionId)}/rate`, {
        method: "POST",
        body,
      }),
    end: (sessionId: string) =>
      apiCall<SessionEndResult>(`/plugins/session/${encodeURIComponent(sessionId)}/end`, {
        method: "POST",
      }),
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
    acceptSwitch: (sessionId: string, body: { to_method: LearningMethod; reason: string }) =>
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
      apiCall<SessionMessage[]>(`/plugins/session/${encodeURIComponent(sessionId)}/messages`),
  },

  // --- Tracking plugin -------------------------------------------------

  tracking: {
    progress: (projectId: string) =>
      apiCall<ProgressSummary>(`/plugins/tracking/progress/${encodeURIComponent(projectId)}`),
    commits: (projectId: string) =>
      apiCall<ProgressCommit[]>(`/plugins/tracking/commits/${encodeURIComponent(projectId)}`),
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
};
