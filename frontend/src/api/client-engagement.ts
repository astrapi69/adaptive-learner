/**
 * Adaptive Learner API client — sync, pronunciation, gamification, anki, imports namespaces.
 *
 * Namespace bodies extracted verbatim from client.ts (#394) and
 * composed into ``api`` by the client.ts barrel via spread.
 */

import { apiCall } from "./client-core";

export const engagementApi = {
  // --- Sync pairing (server-only) -------------------------------------

  sync: {
    /** POST /api/sync/pair/generate — issue a short-lived pairing
     *  token for the QR handshake. Routed through the central client
     *  (Phase 61 C2) so failures surface as ``ApiError``, not a bare
     *  ``Error``. */
    generatePairToken: (userId: string) =>
      apiCall<{ token: string; user_id: string; expires_at: string }>("/sync/pair/generate", {
        method: "POST",
        body: { user_id: userId },
      }),
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
      apiCall<{ phrase: string; language: string }>(`/plugins/session/pronunciation/phrase`, {
        method: "POST",
        body,
      }),
    judge: (body: { project_id: string; target: string; actual: string; language: string }) =>
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
    spendXp: (userId: string, amount: number, reason: string) =>
      apiCall<import("../storage/types").XPState>(
        `/plugins/gamification/xp/${encodeURIComponent(userId)}/spend`,
        { method: "POST", body: { amount, reason } },
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
    list: (userId: string, filters?: import("../storage/types").AnkiCardListFilters) => {
      const query: Record<string, string> = {};
      if (filters?.projectId) query.project_id = filters.projectId;
      if (filters?.acceptedOnly) query.accepted_only = "true";
      if (filters?.includeRejected) query.include_rejected = "true";
      return apiCall<import("../storage/types").AnkiCardSuggestion[]>(
        `/plugins/anki/cards/${encodeURIComponent(userId)}`,
        Object.keys(query).length > 0 ? { query } : undefined,
      );
    },
    create: (userId: string, body: import("../storage/types").AnkiCardCreateBody) =>
      apiCall<import("../storage/types").AnkiCardSuggestion>(
        `/plugins/anki/cards?user_id=${encodeURIComponent(userId)}`,
        { method: "POST", body },
      ),
    update: (cardId: string, body: import("../storage/types").AnkiCardUpdateBody) =>
      apiCall<import("../storage/types").AnkiCardSuggestion>(
        `/plugins/anki/cards/${encodeURIComponent(cardId)}`,
        { method: "PATCH", body },
      ),
    remove: (cardId: string) =>
      apiCall<{ deleted: string }>(`/plugins/anki/cards/${encodeURIComponent(cardId)}`, {
        method: "DELETE",
      }),
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
    create: (userId: string, body: import("../types/domain").ImportedConversationCreateBody) =>
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
