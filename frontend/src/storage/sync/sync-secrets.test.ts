/**
 * LAN sync carries no API key (#3854).
 *
 * Browser mode keeps the AI provider keys in the clear
 * (``user_settings.api_key_<provider>``, ``api_key_backups.key``). The
 * sync wire is plain ``http`` on the local network, so neither may cross
 * it, and a row the desktop sends back must not erase or overwrite the
 * keys this browser holds. The desktop side is covered by
 * ``backend/tests/test_sync_no_api_keys.py``.
 */

import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_PROVIDERS } from "../../lib/constants";
import { _resetDbForTests, getDb } from "../dexie/db";
import type { UserSettingsRow } from "../dexie/db-rows";
import {
  SYNC_TABLES,
  SyncEngine,
  writeSyncConfig,
  type ConflictBundle,
  type ConflictResolution,
} from "./sync-engine";
import { keepLocalSecrets, stripSyncSecrets } from "./sync-secrets";

const KEY_FIELDS = AI_PROVIDERS.map((provider) => `api_key_${provider}`);

function settingsRow(
  overrides: Partial<UserSettingsRow> = {},
): UserSettingsRow {
  return {
    id: "s-1",
    user_id: "u-aster",
    language: "de",
    active_provider: "anthropic",
    api_key_anthropic: "sk-ant-local",
    api_key_openai: "sk-openai-local",
    api_key_gemini: "gemini-local",
    api_key_perplexity: "pplx-local",
    model_override_anthropic: null,
    model_override_openai: null,
    model_override_gemini: null,
    model_override_perplexity: null,
    avatar: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-10-28T10:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

interface WireLog {
  pushed: Record<string, Record<string, unknown>[]>;
  pullTables: string[] | null;
}

function recordingFetch(
  pullRecords: Record<string, Record<string, unknown>[]>,
  pushConflicts: (table: string) => ConflictBundle[] = () => [],
): { fetch: typeof globalThis.fetch; wire: WireLog } {
  const wire: WireLog = { pushed: {}, pullTables: null };
  const fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(init.body as string) : null;
    if (path === "/api/sync/push") {
      wire.pushed[body.table] = body.records;
      return jsonResponse({
        accepted: [],
        conflicts: pushConflicts(body.table),
        skipped: [],
      });
    }
    if (path === "/api/sync/pull") {
      wire.pullTables = body.tables;
      return jsonResponse({ records: pullRecords });
    }
    if (path === "/api/sync/resolve") {
      return jsonResponse({ applied: [], skipped: [] });
    }
    return new Response(JSON.stringify({ detail: path }), { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, wire };
}

beforeEach(async () => {
  await _resetDbForTests();
  localStorage.clear();
  const db = getDb();
  await Promise.all([
    db.userSettings.clear(),
    db.apiKeyBackups.clear(),
    db.users.clear(),
  ]);
  writeSyncConfig({
    host: "192.168.1.20",
    port: 18001,
    user_id: "u-aster",
    user_name: "Aster",
    paired_at: "2026-01-01T00:00:00Z",
  });
});

describe("stripSyncSecrets", () => {
  it("removes every api_key_<provider> field from a user_settings record", () => {
    const stripped = stripSyncSecrets("user_settings", { ...settingsRow() });
    for (const field of KEY_FIELDS) {
      expect(stripped).not.toHaveProperty(field);
    }
    expect(stripped).toMatchObject({
      id: "s-1",
      active_provider: "anthropic",
      avatar: null,
    });
  });

  it("leaves a record of another table unchanged", () => {
    const user = {
      id: "u-aster",
      name: "Aster",
      api_key_anthropic: "not a settings row",
    };
    expect(stripSyncSecrets("users", user)).toEqual(user);
  });
});

describe("keepLocalSecrets", () => {
  it.each([
    ["without key fields", {}],
    [
      "with a desktop's ciphertext",
      { api_key_anthropic: "gAAAAB-ciphertext", api_key_openai: null },
    ],
  ])(
    "keeps this browser's keys when the pulled row arrives %s",
    (_label, incomingKeys) => {
      const pulled = {
        ...stripSyncSecrets("user_settings", { ...settingsRow() }),
        avatar: "data:x",
        ...incomingKeys,
      };
      const merged = keepLocalSecrets("user_settings", pulled, {
        ...settingsRow(),
      });
      expect(merged.avatar).toBe("data:x");
      expect(merged.api_key_anthropic).toBe("sk-ant-local");
      expect(merged.api_key_openai).toBe("sk-openai-local");
      expect(merged.api_key_gemini).toBe("gemini-local");
      expect(merged.api_key_perplexity).toBe("pplx-local");
    },
  );

  it("writes no key field when this browser has no settings row yet", () => {
    const merged = keepLocalSecrets(
      "user_settings",
      { id: "s-1", api_key_anthropic: "gAAAAB-ciphertext" },
      undefined,
    );
    for (const field of KEY_FIELDS) {
      expect(merged).not.toHaveProperty(field);
    }
  });
});

describe("SyncEngine.sync and API keys (#3854)", () => {
  it("pushes user_settings without any API key", async () => {
    await getDb().userSettings.put(settingsRow());
    const { fetch, wire } = recordingFetch({});
    await new SyncEngine({ fetch }).sync();
    const pushed = wire.pushed.user_settings;
    expect(pushed).toHaveLength(1);
    for (const field of KEY_FIELDS) {
      expect(pushed[0]).not.toHaveProperty(field);
    }
    expect(pushed[0]).toMatchObject({
      id: "s-1",
      active_provider: "anthropic",
    });
  });

  it("neither pushes nor requests the api_key_backups rollback cache", async () => {
    await getDb().apiKeyBackups.put({
      id: "u-aster#anthropic",
      user_id: "u-aster",
      provider: "anthropic",
      key: "sk-ant-backup",
      tested_at: "2026-10-28T10:00:00.000Z",
      works: true,
    });
    const { fetch, wire } = recordingFetch({});
    await new SyncEngine({ fetch }).sync();
    expect(wire.pushed).not.toHaveProperty("api_key_backups");
    expect(wire.pullTables).not.toContain("api_key_backups");
    expect(SYNC_TABLES.map((t) => t.name)).not.toContain("api_key_backups");
  });

  it("keeps this browser's keys when the desktop sends its settings row back", async () => {
    await getDb().userSettings.put(
      settingsRow({ updated_at: "2026-10-01T00:00:00.000Z" }),
    );
    const desktopRow = {
      ...settingsRow(),
      avatar: "data:image/png;base64,AAAA",
      api_key_anthropic: "gAAAAB-desktop-ciphertext",
      api_key_openai: null,
      api_key_gemini: null,
      api_key_perplexity: null,
      updated_at: "2026-10-28T11:00:00.000Z",
    };
    const { fetch } = recordingFetch({ user_settings: [desktopRow] });
    await new SyncEngine({ fetch }).sync();
    const stored = await getDb().userSettings.get("s-1");
    expect(stored?.avatar).toBe("data:image/png;base64,AAAA");
    expect(stored?.api_key_anthropic).toBe("sk-ant-local");
    expect(stored?.api_key_openai).toBe("sk-openai-local");
    expect(stored?.api_key_gemini).toBe("gemini-local");
    expect(stored?.api_key_perplexity).toBe("pplx-local");
  });

  it("hands the conflict resolver, and so the AI merge, no API key", async () => {
    await getDb().userSettings.put(settingsRow());
    const conflict: ConflictBundle = {
      table: "user_settings",
      id: "s-1",
      local: {
        ...settingsRow(),
        api_key_anthropic: "gAAAAB-desktop-ciphertext",
      },
      remote: { ...settingsRow() },
    };
    const { fetch } = recordingFetch({}, (table) =>
      table === "user_settings" ? [conflict] : [],
    );
    const resolver = vi.fn(
      async (bundles: ConflictBundle[]): Promise<ConflictResolution[]> => {
        return bundles.map((b) => ({
          table: b.table,
          id: b.id,
          chosen: "local" as const,
        }));
      },
    );
    await new SyncEngine({ fetch }).sync(resolver);
    const seen = resolver.mock.calls[0][0];
    expect(seen).toHaveLength(1);
    for (const field of KEY_FIELDS) {
      expect(seen[0].local).not.toHaveProperty(field);
      expect(seen[0].remote).not.toHaveProperty(field);
    }
    expect(seen[0].local).toMatchObject({
      id: "s-1",
      active_provider: "anthropic",
    });
  });
});
