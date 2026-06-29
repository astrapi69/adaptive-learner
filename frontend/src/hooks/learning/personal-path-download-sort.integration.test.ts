/**
 * Integration regression guard for the Learning Path "Persönlich" list
 * download-order (bug: a freshly downloaded set is NOT surfaced at the top
 * of the untouched tier; the order looks random in Dexie mode).
 *
 * #1211 wired ``compareByDownloadPriority`` into ``buildPersonalPath`` and
 * the pure unit test pins it. This file exercises the REAL Dexie data path
 * the page uses — downloadSetDexie (writes ``downloaded_at``) → listSetsDexie
 * (must read it back) → buildPersonalPath (sorts) — to catch a drop of
 * ``downloaded_at`` ANYWHERE between the cache write and the comparator.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it, vi, type Mock} from "vitest";

import {
  downloadSetDexie,
  listSetsDexie,
} from "../../storage/content/content-loader-dexie";
import {_resetDbForTests, getDb} from "../../storage/dexie/db";
import {
  buildPersonalPath,
  type PersonalSetInput,
} from "../../lib/learning-path/personal-path";
import type {ContentSetEntry} from "../../storage/types";

const SOURCE = "astrapi69/adaptive-learner-content";
const BRANCH = "main";

const REPO_MANIFEST = `
schema_version: '1.0'
name: Repo
sets:
  - id: alpha-set
    title: Alpha
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
  - id: zulu-set
    title: Zulu
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
`.trim();

const setManifest = (id: string, title: string) =>
  `
schema_version: '1.0'
name: ${title}
sets:
  - id: ${id}
    title: ${title}
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
metadata:
  lessons:
    - 01.json
`.trim();

const lessonJson = (id: string) =>
  JSON.stringify({
    id,
    title: "Lesson 1",
    cards: [],
    steps: [{id: "t", type: "theory", body: "x"}],
  });

function installFetchMock(): Mock {
  const routes: Record<string, string> = {
    [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    [`/${SOURCE}/${BRANCH}/sets/alpha-set/manifest.yaml`]: setManifest(
      "alpha-set",
      "Alpha",
    ),
    [`/${SOURCE}/${BRANCH}/sets/alpha-set/lessons/01.json`]:
      lessonJson("alpha-set"),
    [`/${SOURCE}/${BRANCH}/sets/zulu-set/manifest.yaml`]: setManifest(
      "zulu-set",
      "Zulu",
    ),
    [`/${SOURCE}/${BRANCH}/sets/zulu-set/lessons/01.json`]:
      lessonJson("zulu-set"),
  };
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [path, body] of Object.entries(routes)) {
      if (url.endsWith(path)) return new Response(body, {status: 200});
    }
    return new Response(`unmocked: ${url}`, {status: 404});
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(async () => {
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB */
  }
  await _resetDbForTests();
  vi.useRealTimers();
});

/** Mirror usePersonalPath's mapping of listSets() entries into the
 *  buildPersonalPath input (each downloaded entry + a single lesson). */
function toPersonalInput(entry: ContentSetEntry): PersonalSetInput {
  return {
    entry,
    lessons: [{filename: "01.json", number: 1, title: "Lesson 1"}],
  };
}

describe("Personal path download-order — real Dexie chain (#1211 regression)", () => {
  /** Download both sets (real timers — fake timers hang Dexie's async
   *  internals), then stamp distinct download timestamps directly on the
   *  cache rows (alpha older, zulu newer) so the untouched-tier ordering
   *  is observable. listSetsDexie then reads them back. Returns the
   *  listSets() entries (post-download). */
  async function downloadBothAndList(): Promise<ContentSetEntry[]> {
    installFetchMock();
    await downloadSetDexie(SOURCE, "alpha-set", [
      {source: SOURCE, branch: BRANCH},
    ]);
    await downloadSetDexie(SOURCE, "zulu-set", [
      {source: SOURCE, branch: BRANCH},
    ]);
    const db = getDb();
    await db.contentSets
      .where("set_id")
      .equals("alpha-set")
      .modify({downloaded_at: "2026-06-01T00:00:00.000Z"});
    await db.contentSets
      .where("set_id")
      .equals("zulu-set")
      .modify({downloaded_at: "2026-06-20T00:00:00.000Z"});
    const list = await listSetsDexie([{source: SOURCE, branch: BRANCH}]);
    return list.sets.filter((s) => s.cached_version);
  }

  it("downloadSetDexie writes a real downloaded_at, listSetsDexie reads it back", async () => {
    installFetchMock();
    const entry = await downloadSetDexie(SOURCE, "alpha-set", [
      {source: SOURCE, branch: BRANCH},
    ]);
    // The write path stamps a real ISO timestamp...
    expect(entry.downloaded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // ...and the load path surfaces it (the #1211 wiring through listSets).
    const list = await listSetsDexie([{source: SOURCE, branch: BRANCH}]);
    const alpha = list.sets.find((s) => s.id === "alpha-set");
    expect(alpha?.downloaded_at).toBe(entry.downloaded_at);
  });

  it("listSetsDexie carries downloaded_at for freshly downloaded sets", async () => {
    const cached = await downloadBothAndList();
    const alpha = cached.find((s) => s.id === "alpha-set");
    const zulu = cached.find((s) => s.id === "zulu-set");
    expect(alpha?.downloaded_at).toBe("2026-06-01T00:00:00.000Z");
    expect(zulu?.downloaded_at).toBe("2026-06-20T00:00:00.000Z");
  });

  it("buildPersonalPath surfaces the most-recently downloaded set first", async () => {
    const cached = await downloadBothAndList();
    const result = buildPersonalPath({
      sets: cached.map(toPersonalInput),
      progress: {},
      errors: {},
      notDownloaded: [],
    });
    // Both untouched: zulu downloaded later → must come first, even though
    // its title sorts after Alpha. If downloaded_at were dropped on the
    // load path, this would fall back to title (Alpha first) and fail.
    expect(result.activeSets.map((s) => s.setId)).toEqual([
      "zulu-set",
      "alpha-set",
    ]);
    expect(result.activeSets[0].downloadedAt).toBe("2026-06-20T00:00:00.000Z");
  });
});
