import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory plugin-settings backing the storage mock.
const settingsBag: Record<string, Record<string, unknown>> = {};

vi.mock("../../../storage", () => ({
  getStorage: () => ({
    pluginSettings: {
      get: async (plugin: string) => ({ settings: settingsBag[plugin] ?? {} }),
      update: async (plugin: string, body: { settings: Record<string, unknown> }) => {
        settingsBag[plugin] = body.settings;
      },
    },
  }),
}));

import { utf8ToBase64 } from "../../github/github-api";
import {
  fetchInviteCode,
  readRedemptions,
  recordRedemption,
} from "./invite-store";

/** A fetch stub returning a contents-API response for one path. */
function githubContentsResponse(file: unknown): Response {
  return {
    status: 200,
    ok: true,
    json: async () => ({ content: utf8ToBase64(JSON.stringify(file)) }),
  } as unknown as Response;
}

function notFound(): Response {
  return { status: 404, ok: false, json: async () => ({}) } as unknown as Response;
}

beforeEach(() => {
  for (const key of Object.keys(settingsBag)) delete settingsBag[key];
});

describe("fetchInviteCode", () => {
  it("reads + normalises a code file from the contents API", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        githubContentsResponse({
          code: "deutsch-8x4k",
          repo: "coach/deutsch-b1",
          max_uses: 25,
          expires: "2026-12-31",
          note: "Klasse 8a",
          created: "2026-06-24T10:00:00.000Z",
        }),
    );
    const file = await fetchInviteCode(
      "coach/deutsch-b1",
      "main",
      "DEUTSCH-8X4K",
      "",
      fetchImpl as unknown as typeof fetch,
    );
    expect(file).not.toBeNull();
    expect(file?.code).toBe("DEUTSCH-8X4K");
    expect(file?.repo).toBe("coach/deutsch-b1");
    expect(file?.branch).toBe("main"); // defaulted
    // Unauthenticated: no Authorization header.
    const init = fetchImpl.mock.calls[0][1];
    expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("sends a bearer token when one is supplied", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        githubContentsResponse({ code: "AB12", repo: "a/b", max_uses: 0, expires: null, note: "", created: "" }),
    );
    await fetchInviteCode("a/b", "main", "AB12", "ghp_secret", fetchImpl as unknown as typeof fetch);
    const init = fetchImpl.mock.calls[0][1];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ghp_secret",
    });
  });

  it("returns null for an unknown code (404)", async () => {
    const fetchImpl = vi.fn(async () => notFound());
    expect(
      await fetchInviteCode("a/b", "main", "NOPE-1234", "", fetchImpl as unknown as typeof fetch),
    ).toBeNull();
  });

  it("throws on an unexpected non-404 error", async () => {
    const fetchImpl = vi.fn(
      async () => ({ status: 500, ok: false, json: async () => ({}) }) as unknown as Response,
    );
    await expect(
      fetchInviteCode("a/b", "main", "AB12", "", fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/500/);
  });

  it("uses the global fetch (bound) when no fetchImpl is injected", async () => {
    // Regression: the default ``fetchImpl = fetch`` invoked as ``fetchImpl(...)``
    // threw "Illegal invocation" because the receiver was not the global object.
    // A browser-style native fetch enforces the receiver, so the pre-fix default
    // would throw here; the bound default (the fix) passes globalThis.
    const calls: string[] = [];
    const nativeFetch = function (this: unknown, url: string) {
      if (this !== globalThis) {
        throw new TypeError(
          "Failed to execute 'fetch' on 'Window': Illegal invocation",
        );
      }
      calls.push(url);
      return Promise.resolve(
        githubContentsResponse({
          code: "AB12",
          repo: "a/b",
          max_uses: 0,
          expires: null,
          note: "",
          created: "",
        }),
      );
    } as unknown as typeof fetch;
    vi.stubGlobal("fetch", nativeFetch);
    try {
      const file = await fetchInviteCode("a/b", "main", "AB12");
      expect(file?.code).toBe("AB12");
      expect(calls).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("redemption records", () => {
  it("starts empty", async () => {
    expect(await readRedemptions()).toEqual([]);
  });

  it("records and reads back a redemption", async () => {
    await recordRedemption({
      code: "deutsch-8x4k",
      repo: "coach/deutsch-b1",
      redeemed_at: "2026-06-24T12:00:00.000Z",
    });
    const list = await readRedemptions();
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe("DEUTSCH-8X4K"); // normalised
  });

  it("de-duplicates by code on re-redeem", async () => {
    const base = { repo: "coach/deutsch-b1", redeemed_at: "2026-06-24T12:00:00.000Z" };
    await recordRedemption({ code: "AB12", ...base });
    await recordRedemption({ code: "ab12", ...base, redeemed_at: "2026-06-25T12:00:00.000Z" });
    const list = await readRedemptions();
    expect(list).toHaveLength(1);
    expect(list[0].redeemed_at).toBe("2026-06-25T12:00:00.000Z");
  });

  it("preserves other content-loader settings (e.g. user_repos)", async () => {
    settingsBag["content-loader"] = { user_repos: [{ owner: "x", repo: "y" }] };
    await recordRedemption({ code: "AB12", repo: "x/y", redeemed_at: "2026-06-24T12:00:00.000Z" });
    expect(settingsBag["content-loader"].user_repos).toEqual([{ owner: "x", repo: "y" }]);
    expect(settingsBag["content-loader"].invite_redemptions).toHaveLength(1);
  });
});
