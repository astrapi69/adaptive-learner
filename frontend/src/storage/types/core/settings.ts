/**
 * Settings namespace + API-key test/backup shapes.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

import type {
  ApiKeySetBody,
  SettingsPatchBody,
} from "../../../api/request-types";
import type { AIProvider } from "../../../lib/constants";
import type { UserSettings } from "../../../types/domain";

export interface AvailableModel {
  id: string;
  name: string;
  context_window: number | null;
  description: string | null;
}

/** Outcome of a live API-key test (Phase 65). ``kind`` is a stable
 *  machine code the UI maps to a localized message. */
export type ApiKeyTestKind = "ok" | "invalid" | "rate_limit" | "network" | "error" | "no_key";

export interface ApiKeyTestResult {
  success: boolean;
  kind: ApiKeyTestKind;
}

/** Metadata about a stored last-known-good key backup (Phase 65).
 *  Never carries the key itself. */
export interface ApiKeyBackupInfo {
  has: boolean;
  tested_at: string | null;
}

export interface ISettingsNamespace {
  get(userId: string): Promise<UserSettings>;
  update(userId: string, body: SettingsPatchBody): Promise<UserSettings>;
  setApiKey(userId: string, body: ApiKeySetBody): Promise<UserSettings>;
  deleteApiKey(userId: string, provider: AIProvider): Promise<UserSettings>;
  getApp(): Promise<Record<string, unknown>>;
  /**
   * Phase 65 — live API-key test. Fires a minimal provider call and
   * classifies the result. When ``key`` is given, tests THAT key
   * (pre-save); otherwise tests the currently-stored key. Never
   * saves. Both modes: ApiStorage hits the backend endpoint,
   * DexieStorage calls the provider browser-direct.
   */
  testApiKey(
    userId: string,
    body: { provider: AIProvider; key?: string },
  ): Promise<ApiKeyTestResult>;
  /**
   * Phase 65 — rollback cache. ``backupApiKey`` caches a tested-good
   * key as the last-known-good backup (called by the save flow after
   * a successful test); ``getApiKeyBackup`` returns its metadata (no
   * key); ``restoreApiKeyBackup`` restores it as the active key.
   * Both modes: ApiStorage hits the backend (Fernet-encrypted DB row),
   * DexieStorage uses an IndexedDB table.
   */
  backupApiKey(userId: string, body: { provider: AIProvider; key: string }): Promise<UserSettings>;
  getApiKeyBackup(userId: string, provider: AIProvider): Promise<ApiKeyBackupInfo>;
  restoreApiKeyBackup(userId: string, provider: AIProvider): Promise<UserSettings>;
  /**
   * v1.11.0 / Phase 24 — provider model discovery. Returns
   * the chat-capable models the user has access to from the
   * provider's official models endpoint. Returns ``[]`` when
   * no API key for the provider is configured. Throws
   * ``ApiError`` on auth / network failure.
   */
  getAvailableModels(userId: string, provider: AIProvider): Promise<AvailableModel[]>;
}

/** Whether a GitHub token is configured and where it lives. ``source``
 *  is ``environment`` / ``secrets.yaml`` (API mode) / ``browser``
 *  (Dexie mode) / ``none``. The token itself is never exposed. */
