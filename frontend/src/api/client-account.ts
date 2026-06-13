/**
 * Adaptive Learner API client — identity, users, projects, settings, github namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { ApiError, apiCall } from "./client-core";
import type { IdentityPayload, IdentityStatusPayload, AvailableModelResponse } from "./client-core";
import type { AIProvider } from "../lib/constants";
import type {
  LearningProject,
  User,
  UserSettings
} from "../types/domain";
import type {
  UserCreateBody,
  UserUpdateBody,
  LearningProjectCreateBody,
  LearningProjectUpdateBody,
  SettingsPatchBody,
  ApiKeySetBody
} from "./request-types";

export const accountApi = {
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
    create: (body: UserCreateBody) => apiCall<User>("/users", { method: "POST", body }),
    get: (userId: string) => apiCall<User>(`/users/${encodeURIComponent(userId)}`),
    update: (userId: string, body: UserUpdateBody) =>
      apiCall<User>(`/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body,
      }),

    // User-scoped projects -- nested under the user prefix.
    projects: {
      list: (userId: string) =>
        apiCall<LearningProject[]>(`/users/${encodeURIComponent(userId)}/projects`),
      create: (userId: string, body: LearningProjectCreateBody) =>
        apiCall<LearningProject>(`/users/${encodeURIComponent(userId)}/projects`, {
          method: "POST",
          body,
        }),
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
    get: (userId: string) => apiCall<UserSettings>(`/settings/${encodeURIComponent(userId)}`),
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
    testApiKey: (userId: string, body: { provider: AIProvider; key?: string }) =>
      apiCall<{ success: boolean; kind: string }>(
        `/settings/${encodeURIComponent(userId)}/test-api-key`,
        { method: "POST", body },
      ),

    /** Phase 65 — rollback cache: store a tested-good key as the
     *  last-known-good backup. */
    backupApiKey: (userId: string, body: { provider: AIProvider; key: string }) =>
      apiCall<UserSettings>(`/settings/${encodeURIComponent(userId)}/api-key-backup`, {
        method: "POST",
        body,
      }),
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
    getStatus: () => apiCall<{ configured: boolean; source: string }>(`/github/token`),
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
      apiCall<{ valid: boolean; username: string | null; kind: string }>(`/github/verify-token`, {
        method: "POST",
        body: { token: token ?? null },
      }),
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
      apiCall<{ url: string; number: number; manifest_updated: boolean }>(`/github/create-pr`, {
        method: "POST",
        body,
      }),
  },
};
