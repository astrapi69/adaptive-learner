/**
 * EXP-023 Phase A — user content repository wiring in the Dexie loader.
 *
 * Pins two things: the connected user repo joins the active source list,
 * and a same-id collision is won by the user repo over the official one
 * (regardless of version).
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeSourcesDexie,
  dedupeContentEntries,
  listSetsDexie,
} from "./content-loader-dexie";
import { _resetDbForTests, getDb } from "./dexie/db";
import type { ContentSetEntry } from "./types";

beforeEach(async () => {
  await _resetDbForTests();
});

function entry(
  source: string,
  id: string,
  version: string,
): ContentSetEntry {
  return {
    source,
    branch: "main",
    id,
    title: id,
    language: "fr",
    target_language: "fr",
    source_language: "en",
    level: "A1",
    domain: "language",
    version,
    lesson_count: 1,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: null,
    update_available: false,
  } as ContentSetEntry;
}

describe("activeSourcesDexie", () => {
  it("returns only the defaults when no repo is connected", async () => {
    const sources = await activeSourcesDexie();
    expect(sources.some((s) => s.source === "jane/my-content")).toBe(false);
  });

  it("migrates a legacy single user_repo into the active sources", async () => {
    await getDb().pluginSettings.put({
      name: "content-loader",
      settings: {
        user_repo: {
          owner: "jane",
          repo: "my-content",
          branch: "dev",
          connected: true,
        },
      },
      updated_at: new Date().toISOString(),
    });
    const sources = await activeSourcesDexie();
    expect(sources[sources.length - 1]).toEqual({
      source: "jane/my-content",
      branch: "dev",
    });
  });

  it("appends every connected user repo in list order", async () => {
    await getDb().pluginSettings.put({
      name: "content-loader",
      settings: {
        user_repos: [
          { owner: "jane", repo: "a", branch: "main", connected: true },
          { owner: "bob", repo: "b", branch: "dev", connected: true },
          { owner: "kim", repo: "c", branch: "main", connected: false },
        ],
      },
      updated_at: new Date().toISOString(),
    });
    const sources = await activeSourcesDexie();
    const tail = sources.slice(-2);
    expect(tail).toEqual([
      { source: "jane/a", branch: "main" },
      { source: "bob/b", branch: "dev" },
    ]);
    expect(sources.some((s) => s.source === "kim/c")).toBe(false);
  });

  it("ignores a saved-but-not-connected repo", async () => {
    await getDb().pluginSettings.put({
      name: "content-loader",
      settings: {
        user_repo: { owner: "jane", repo: "x", branch: "main", connected: false },
      },
      updated_at: new Date().toISOString(),
    });
    const sources = await activeSourcesDexie();
    expect(sources.some((s) => s.source === "jane/x")).toBe(false);
  });
});

describe("dedupeContentEntries — user repo wins a collision", () => {
  it("prefers the user repo over official for the same id, lower version", () => {
    const result = dedupeContentEntries([
      entry("astrapi69/adaptive-learner-content", "fr-a1", "2.0.0"),
      entry("jane/my-content", "fr-a1", "1.0.0"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("jane/my-content");
  });

  it("keeps the version rule between two official sources", () => {
    const result = dedupeContentEntries([
      entry("bundled:adaptive-learner-content", "fr-a1", "1.0.0"),
      entry("astrapi69/adaptive-learner-content", "fr-a1", "2.0.0"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe("2.0.0");
  });

  it("between two user repos, the later (higher precedence) wins", () => {
    // Entries arrive in source order: jane first, bob later. bob wins
    // regardless of version (precedence = list order, later wins).
    const result = dedupeContentEntries([
      entry("jane/a", "shared", "9.0.0"),
      entry("bob/b", "shared", "1.0.0"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("bob/b");
  });
});

describe("per-repo token auth on fetch (coach/private)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the per-repo Bearer token when fetching a user source", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) =>
        k === "adaptive-learner.content_repo_token::jane/private"
          ? "ghp_coach"
          : null,
      setItem: () => {},
      removeItem: () => {},
    });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => "sets: []",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await listSetsDexie([{ source: "jane/private", branch: "main" }]);

    const call = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("jane/private"),
    );
    expect(call).toBeTruthy();
    expect((call?.[1] as RequestInit | undefined)?.headers).toMatchObject({
      Authorization: "Bearer ghp_coach",
    });
  });
});
