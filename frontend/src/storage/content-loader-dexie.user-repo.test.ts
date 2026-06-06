/**
 * EXP-023 Phase A — user content repository wiring in the Dexie loader.
 *
 * Pins two things: the connected user repo joins the active source list,
 * and a same-id collision is won by the user repo over the official one
 * (regardless of version).
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  activeSourcesDexie,
  dedupeContentEntries,
} from "./content-loader-dexie";
import { _resetDbForTests, getDb } from "./db";
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

  it("appends a connected user repo (additive, official first)", async () => {
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
});
