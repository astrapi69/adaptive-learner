/**
 * Browser mode classifies a failed tutor turn like API mode (#3376).
 *
 * A provider's ``ApiError`` status used to be flattened into
 * ``"AI provider error: ..."`` with no code, so a rejected key, a quota hit
 * and an outage all showed the same raw English toast. The backend half is
 * pinned in ``backend/tests/test_session_ai_error_codes.py``.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetDbForTests } from "../dexie/db";
import { dexieStorage } from "../dexie-storage";

function failWith(status: number): void {
  global.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: { message: "nope" } }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

async function startSession(): Promise<string> {
  const u = await dexieStorage.users.create({ name: "A", language: "en" });
  const p = await dexieStorage.users.projects.create(u.id, {
    topic: "Topic",
    goal: "Goal",
    timeframe: "1w",
    daily_minutes: 10,
  });
  await dexieStorage.settings.setApiKey(u.id, { provider: "anthropic", key: "sk-fake" });
  return (await dexieStorage.session.start({ project_id: p.id, lang: "en" })).session.id;
}

beforeEach(async () => {
  await _resetDbForTests();
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

afterEach(async () => {
  await _resetDbForTests();
  vi.restoreAllMocks();
});

describe("Dexie session flow ai_error_code (#3376)", () => {
  it.each([
    [401, "provider_auth"],
    [429, "provider_rate_limited"],
    [503, "provider_unavailable"],
    [400, "provider_error"],
  ])("a %i from the provider on /message is %s", async (status, code) => {
    const sessionId = await startSession();
    failWith(status);
    const result = await dexieStorage.session.message(sessionId, { role: "user", content: "hi" });
    expect(result.assistant_message).toBeNull();
    expect(result.ai_error).toMatch(/AI provider error/);
    expect(result.ai_error_code).toBe(code);
  });

  it("a rejected key on the stream path is provider_auth", async () => {
    const sessionId = await startSession();
    failWith(401);
    let done: { ai_error_code?: string | null } | null = null;
    await dexieStorage.session.streamMessage(
      sessionId,
      { role: "user", content: "hi" },
      {
        onStart: () => {},
        onChunk: () => {},
        onDone: (r) => {
          done = r;
        },
      },
    );
    expect(done).not.toBeNull();
    expect(done!.ai_error_code).toBe("provider_auth");
  });
});
