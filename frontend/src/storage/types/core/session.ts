/**
 * Assessment / session / tracking namespaces.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  SessionMessageBody,
  SessionRatingBody,
  SessionStartBody,
} from "../../../api/request-types";
import type { LearningMethod } from "../../../lib/constants";
import type {
  AssessmentEvaluatePayload,
  AssessmentQuestion,
  LearningProfile,
  LearningSession,
  ProgressCommit,
  ProgressSummary,
  SessionEndResult,
  SessionMessage,
  SessionMessageExchangeResult,
  SessionRating,
  SessionStartResult,
  SwitchRecommendation,
} from "../../../types/domain";

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
    body: { to_method: LearningMethod; reason: string },
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
