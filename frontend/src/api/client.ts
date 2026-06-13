/**
 * Typed Adaptive Learner API client (Phase 4A).
 *
 * Every fetch on the frontend MUST go through one of the ``api.*``
 * namespaces — components never call ``fetch`` directly. The single
 * ``apiCall`` helper (in ``client-core``) builds the URL from the
 * resolved ``API_BASE``, JSON-serialises the body, records the call,
 * and throws :class:`ApiError` on any non-2xx response.
 *
 * This module is the BARREL: the HTTP core lives in ``client-core``,
 * the namespace groups live in the per-domain ``client-*`` modules, and
 * here they are composed into the single ``api`` object (via spread) and
 * the payload types are re-exported so existing ``from "../api/client"``
 * imports keep working unchanged.
 */

import { apiCall } from "./client-core";
import { accountApi } from "./client-account";
import { sessionApi } from "./client-session";
import { curriculumApi } from "./client-curriculum";
import { platformApi } from "./client-platform";
import { contentApi } from "./client-content";
import { engagementApi } from "./client-engagement";

// --- Re-exports: error class + response payload shapes -----------------

export { ApiError } from "./client-core";
export type {
  IdentityPayload,
  IdentityStatusPayload,
  AvailableModelResponse,
  PluginInspection,
} from "./client-core";

// #252 — request-body DTOs live in ./request-types (a pure module that
// imports only lib/constants) so the IStorageService contract in
// storage/types.ts can name them WITHOUT importing this client module.
// Re-exported so existing `from "../api/client"` imports keep working.
export type {
  UserCreateBody,
  UserUpdateBody,
  LearningProjectCreateBody,
  LearningProjectUpdateBody,
  SettingsPatchBody,
  ApiKeySetBody,
  SessionStartBody,
  SessionMessageBody,
  SessionRatingBody,
  CurriculumCreateBody,
  CurriculumUpdateBody,
  TopicCreateBody,
  TopicUpdateBody,
  LessonCreateBody,
  LessonUpdateBody,
  SubjectCreateBody,
  SubjectUpdateBody,
  TagCreateBody,
  TagUpdateBody,
} from "./request-types";

// --- Public namespaces --------------------------------------------------

export const api = {
  health: () => apiCall<{ status: string; version: string; debug: boolean }>("/health"),

  i18n: {
    get: (lang: string) => apiCall<Record<string, unknown>>(`/i18n/${encodeURIComponent(lang)}`),
  },

  ...accountApi,
  ...sessionApi,
  ...curriculumApi,
  ...platformApi,
  ...contentApi,
  ...engagementApi,
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
