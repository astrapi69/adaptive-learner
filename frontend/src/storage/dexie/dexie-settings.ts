/**
 * Dexie implementation of the settings namespace (API keys, models, provider state) (#354).
 *
 * Extracted verbatim from ``dexie-storage.ts``; shared row
 * mappers/helpers come from ``./dexie-rows``.
 */

import { getDb, nowIso } from "./db";
import { ensureSettings, requireRow, rowToSettings } from "./dexie-rows";
import { fetchAvailableModels } from "../ai/model-discovery";
import { ApiError } from "../../api/client";
import type { UserSettingsRow } from "./db";
import type { AIProvider } from "../../lib/constants";
import type { ApiKeySetBody, SettingsPatchBody } from "../../api/client";
import type { UserSettings } from "../../types/domain";
import type { ApiKeyBackupInfo, ApiKeyTestResult, AvailableModel, IStorageService } from "../types";

export const dexieSettings: IStorageService["settings"] = {
    async get(userId: string): Promise<UserSettings> {
      const db = getDb();
      const user = await requireRow(db.users, userId, "User");
      const row = await ensureSettings(db, userId, user.language);
      return rowToSettings(row);
    },
    async update(
      userId: string,
      body: SettingsPatchBody,
    ): Promise<UserSettings> {
      const db = getDb();
      // #390 Phase 3: the user read, the settings ensure, and the put run
      // in one rw transaction so a concurrent setApiKey / settings edit on
      // the same userSettings row isn't lost. ensureSettings opens a
      // userSettings-scoped sub-transaction, which Dexie reuses here.
      let updated: UserSettingsRow | null = null;
      await db.transaction("rw", [db.users, db.userSettings], async () => {
        const user = await requireRow(db.users, userId, "User");
        const row = await ensureSettings(db, userId, user.language);
        updated = {
          ...row,
          ...(body.active_provider !== undefined
            ? { active_provider: body.active_provider }
            : {}),
          ...(body.language !== undefined ? { language: body.language } : {}),
          ...(body.model_override_anthropic !== undefined
            ? {
                model_override_anthropic:
                  body.model_override_anthropic === ""
                    ? null
                    : body.model_override_anthropic,
              }
            : {}),
          ...(body.model_override_openai !== undefined
            ? {
                model_override_openai:
                  body.model_override_openai === ""
                    ? null
                    : body.model_override_openai,
              }
            : {}),
          ...(body.model_override_gemini !== undefined
            ? {
                model_override_gemini:
                  body.model_override_gemini === ""
                    ? null
                    : body.model_override_gemini,
              }
            : {}),
          ...(body.avatar !== undefined
            ? { avatar: body.avatar === "" ? null : body.avatar }
            : {}),
          updated_at: nowIso(),
        };
        await db.userSettings.put(updated);
      });
      return rowToSettings(updated as unknown as UserSettingsRow);
    },
    async setApiKey(
      userId: string,
      body: ApiKeySetBody,
    ): Promise<UserSettings> {
      const db = getDb();
      // #390 Phase 3: atomic ensure + put so a concurrent settings edit on
      // the same userSettings row isn't lost.
      const field = `api_key_${body.provider}` as const;
      let updated: UserSettingsRow | null = null;
      await db.transaction("rw", [db.users, db.userSettings], async () => {
        const user = await requireRow(db.users, userId, "User");
        const row = await ensureSettings(db, userId, user.language);
        updated = {
          ...row,
          [field]: body.key,
          updated_at: nowIso(),
        };
        await db.userSettings.put(updated);
      });
      return rowToSettings(updated as unknown as UserSettingsRow);
    },
    async deleteApiKey(
      userId: string,
      provider: AIProvider,
    ): Promise<UserSettings> {
      const db = getDb();
      // #390 Phase 3: atomic ensure + put so a concurrent settings edit on
      // the same userSettings row isn't lost.
      const field = `api_key_${provider}` as const;
      let updated: UserSettingsRow | null = null;
      await db.transaction("rw", [db.users, db.userSettings], async () => {
        const user = await requireRow(db.users, userId, "User");
        const row = await ensureSettings(db, userId, user.language);
        updated = {
          ...row,
          [field]: null,
          updated_at: nowIso(),
        };
        await db.userSettings.put(updated);
      });
      return rowToSettings(updated as unknown as UserSettingsRow);
    },
    async exportApiKeys(
      userId: string,
    ): Promise<Partial<Record<AIProvider, string>>> {
      const db = getDb();
      const user = await requireRow(db.users, userId, "User");
      const row = await ensureSettings(db, userId, user.language);
      const raw = row as unknown as Record<string, unknown>;
      const out: Partial<Record<AIProvider, string>> = {};
      for (const provider of ["anthropic", "openai", "gemini"] as const) {
        const value = raw[`api_key_${provider}`];
        if (typeof value === "string" && value.trim().length > 0) {
          out[provider] = value;
        }
      }
      return out;
    },
    getApp: async () => ({}),
    async getAvailableModels(
      userId: string,
      provider: AIProvider,
    ): Promise<AvailableModel[]> {
      const db = getDb();
      const user = await requireRow(db.users, userId, "User");
      const row = await ensureSettings(db, userId, user.language);
      const field = `api_key_${provider}` as const;
      const apiKey = (row as unknown as Record<string, unknown>)[field];
      if (typeof apiKey !== "string" || apiKey.length === 0) {
        return [];
      }
      const models = await fetchAvailableModels(provider, apiKey);
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        context_window: m.context_window,
        description: m.description,
      }));
    },
    async testApiKey(
      userId: string,
      body: { provider: AIProvider; key?: string },
    ): Promise<ApiKeyTestResult> {
      const { provider } = body;
      let key = body.key;
      if (!key) {
        const db = getDb();
        const user = await requireRow(db.users, userId, "User");
        const row = await ensureSettings(db, userId, user.language);
        const field = `api_key_${provider}` as const;
        const stored = (row as unknown as Record<string, unknown>)[field];
        key = typeof stored === "string" ? stored : undefined;
      }
      if (!key || key.trim().length === 0) {
        return { success: false, kind: "no_key" };
      }
      try {
        // #799 — validate the key against the provider's lightweight
        // models-list GET (OpenAI /v1/models, Gemini /v1beta/models?key=,
        // Anthropic /v1/models), NOT a generation call. A generateContent /
        // chat completion with a 1-token cap returns empty content on
        // Gemini (a false failure) and depends on per-model access / quota
        // on OpenAI — neither reflects whether the key is VALID. A 200 here
        // means the provider accepts the key; the GET is browser-direct +
        // CORS-friendly (no preflight on Gemini's query-param key).
        await fetchAvailableModels(provider, key.trim());
        return { success: true, kind: "ok" };
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401 || err.status === 403) {
            return { success: false, kind: "invalid" };
          }
          if (err.status === 429) {
            return { success: false, kind: "rate_limit" };
          }
          return { success: false, kind: "error" };
        }
        // A thrown fetch (no ApiError) means the request never
        // reached the provider — treat as a connectivity failure.
        return { success: false, kind: "network" };
      }
    },
    async backupApiKey(
      userId: string,
      body: { provider: AIProvider; key: string },
    ): Promise<UserSettings> {
      const db = getDb();
      const user = await requireRow(db.users, userId, "User");
      const row = await ensureSettings(db, userId, user.language);
      await db.apiKeyBackups.put({
        id: `${userId}#${body.provider}`,
        user_id: userId,
        provider: body.provider,
        key: body.key,
        tested_at: nowIso(),
        works: true,
      });
      return rowToSettings(row);
    },
    async getApiKeyBackup(
      userId: string,
      provider: AIProvider,
    ): Promise<ApiKeyBackupInfo> {
      const db = getDb();
      const backup = await db.apiKeyBackups.get(`${userId}#${provider}`);
      if (!backup) return { has: false, tested_at: null };
      return { has: true, tested_at: backup.tested_at };
    },
    async restoreApiKeyBackup(
      userId: string,
      provider: AIProvider,
    ): Promise<UserSettings> {
      const db = getDb();
      // #390 Phase 3: backup read + ensure + put in one rw transaction so
      // a concurrent settings edit isn't lost.
      const field = `api_key_${provider}` as const;
      let updated: UserSettingsRow | null = null;
      await db.transaction(
        "rw",
        [db.users, db.userSettings, db.apiKeyBackups],
        async () => {
          const backup = await db.apiKeyBackups.get(`${userId}#${provider}`);
          if (!backup) {
            throw new ApiError(404, "No API-key backup for this provider");
          }
          const user = await requireRow(db.users, userId, "User");
          const row = await ensureSettings(db, userId, user.language);
          updated = {
            ...row,
            [field]: backup.key,
            updated_at: nowIso(),
          };
          await db.userSettings.put(updated);
        },
      );
      return rowToSettings(updated as unknown as UserSettingsRow);
    },

};
