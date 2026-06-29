/**
 * Tests for the Dexie-mode Content-Loader
 * (Phase 43 / EXP-002 / 2C-wire — frontend half).
 *
 * Pins the GH-Pages-shape contract: list / download / cache /
 * read cycle works end-to-end against a stubbed
 * ``fetch`` so zero real network calls fire. The
 * ``contentSets`` + ``contentSetFiles`` tables hold the
 * cached set after a successful download, and a subsequent
 * ``listSets`` correctly reports ``cached_version`` + the
 * ``update_available`` flag.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  downloadSetDexie,
  getAssetDexie,
  getLessonDexie,
  listLessonsDexie,
  listSetsDexie,
  mimeTypeForAssetPath,
} from "./content-loader-dexie";
import { _resetDbForTests, getDb } from "../dexie/db";

const SOURCE = "astrapi69/adaptive-learner-content";
const BRANCH = "main";
const SET_ID = "language-fr-a1";

const REPO_MANIFEST = `
schema_version: '1.0'
name: Adaptive Learner Pilot
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
    tags: [beginner]
`.trim();

const SET_MANIFEST = `
schema_version: '1.0'
name: French A1
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
metadata:
  lessons:
    - 01-greetings.json
`.trim();

const LESSON_JSON = JSON.stringify({
  id: "01-greetings",
  title: "Greetings",
  cards: [{ id: "bonjour", front: "Bonjour", back: "Hello" }],
  steps: [
    {
      id: "intro",
      type: "theory",
      body: "# Greetings\n\nA few common phrases.",
    },
  ],
});

function installFetchMock(routes: Record<string, string | null>): Mock {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [path, body] of Object.entries(routes)) {
      if (url.endsWith(path)) {
        if (body === null) {
          return new Response("not found", { status: 404 });
        }
        return new Response(body, { status: 200 });
      }
    }
    return new Response(`unmocked: ${url}`, { status: 404 });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(async () => {
  // Drop the Dexie database explicitly so every test starts
  // from an empty IndexedDB. ``_resetDbForTests`` only closes
  // the connection — it does not wipe the data, and the
  // fake-indexeddb engine persists across resets.
  const db = getDb();
  try {
    await db.contentSets.clear();
    await db.contentSetFiles.clear();
  } catch {
    /* fresh DB — nothing to clear */
  }
  await _resetDbForTests();
});

describe("Dexie content-loader: listSets", () => {
  it("surfaces upstream sets when manifest fetch succeeds", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    });
    const result = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(result.sets).toHaveLength(1);
    const entry = result.sets[0];
    expect(entry.id).toBe(SET_ID);
    expect(entry.language).toBe("fr");
    expect(entry.cached_version).toBeNull();
    expect(entry.update_available).toBe(false);
  });

  it("resolves bundled: sources to /content/{key}/... (Phase 51D)", async () => {
    // Bundled-source URL contract: source ``bundled:fr-a1``
    // + path ``manifest.yaml`` MUST fetch from
    // ``/content/fr-a1/manifest.yaml`` (the Vite
    // static-asset path produced by copy-bundled-content.mjs
    // at predev/prebuild). Branch is ignored.
    const mock = installFetchMock({
      "/content/fr-a1/manifest.yaml": REPO_MANIFEST,
    });
    const result = await listSetsDexie([
      { source: "bundled:fr-a1", branch: "" },
    ]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].id).toBe(SET_ID);
    // Confirm the fetch went to the bundled path, not the
    // GitHub raw URL.
    const calls = mock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/content/fr-a1/manifest.yaml"))).toBe(
      true,
    );
    expect(calls.some((u) => u.includes("raw.githubusercontent.com"))).toBe(
      false,
    );
  });

  it("dedupes a set advertised by bundled + external, higher version wins", async () => {
    const githubManifest = REPO_MANIFEST.replace(
      "version: '1.0.0'",
      "version: '1.2.0'",
    );
    installFetchMock({
      "/content/fr-a1/manifest.yaml": REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: githubManifest,
    });
    const result = await listSetsDexie([
      { source: "bundled:fr-a1", branch: "" },
      { source: SOURCE, branch: BRANCH },
    ]);
    // One row, not two — the external 1.2.0 beats bundled 1.0.0.
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].id).toBe(SET_ID);
    expect(result.sets[0].version).toBe("1.2.0");
    expect(result.sets[0].source).toBe(SOURCE);
  });

  it("dedupes on a version tie by preferring the external source", async () => {
    installFetchMock({
      "/content/fr-a1/manifest.yaml": REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    });
    const result = await listSetsDexie([
      { source: "bundled:fr-a1", branch: "" },
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].source).toBe(SOURCE);
  });

  it("keeps the bundled set when the external source is unreachable", async () => {
    installFetchMock({
      "/content/fr-a1/manifest.yaml": REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: null,
    });
    const result = await listSetsDexie([
      { source: "bundled:fr-a1", branch: "" },
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].source).toBe("bundled:fr-a1");
  });

  it("resolves the legacy `language` key as the target, defaulting source to en", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    });
    const result = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].target_language).toBe("fr");
    expect(result.sets[0].source_language).toBe("en");
    // Legacy alias still mirrors the target.
    expect(result.sets[0].language).toBe("fr");
  });

  it("reads an explicit target/source language pair", async () => {
    const PAIR_MANIFEST = `
schema_version: '1.2'
name: Französisch A1
sets:
  - id: fr-a1-from-de
    title: Französisch A1
    target_language: fr
    source_language: de
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
`.trim();
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: PAIR_MANIFEST,
    });
    const result = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].target_language).toBe("fr");
    expect(result.sets[0].source_language).toBe("de");
  });

  it("degrades to cached sets when upstream is unreachable", async () => {
    // Seed a cached row, then make the manifest fetch
    // return 404 — the result must surface the cached
    // entry only.
    const db = getDb();
    await db.contentSets.put({
      id: `astrapi69--adaptive-learner-content/${SET_ID}/1.0.0`,
      source: SOURCE,
      branch: BRANCH,
      set_id: SET_ID,
      version: "1.0.0",
      title: "French A1",
      language: "fr",
      target_language: "fr",
      source_language: "en",
      level: "A1",
      domain: "language",
      lesson_count: 1,
      description: null,
      tags: "[]",
      cover_image: null,
      downloaded_at: "2026-05-26T00:00:00Z",
      manifest_yaml: SET_MANIFEST,
    });

    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: null,
    });
    const result = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].cached_version).toBe("1.0.0");
  });

  it("marks update_available when cached < upstream", async () => {
    const db = getDb();
    await db.contentSets.put({
      id: `astrapi69--adaptive-learner-content/${SET_ID}/0.9.0`,
      source: SOURCE,
      branch: BRANCH,
      set_id: SET_ID,
      version: "0.9.0",
      title: "French A1",
      language: "fr",
      target_language: "fr",
      source_language: "en",
      level: "A1",
      domain: "language",
      lesson_count: 1,
      description: null,
      tags: "[]",
      cover_image: null,
      downloaded_at: "2026-05-26T00:00:00Z",
      manifest_yaml: SET_MANIFEST,
    });
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    });
    const result = await listSetsDexie([{ source: SOURCE, branch: BRANCH }]);
    expect(result.sets[0].cached_version).toBe("0.9.0");
    expect(result.sets[0].update_available).toBe(true);
  });
});

describe("Dexie content-loader: downloadSet", () => {
  it("caches the set + lesson files after a full download", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    const entry = await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(entry.cached_version).toBe("1.0.0");
    expect(entry.update_available).toBe(false);

    const db = getDb();
    const rows = await db.contentSets.toArray();
    expect(rows).toHaveLength(1);
    const files = await db.contentSetFiles.toArray();
    const filenames = files.map((f) => f.filename).sort();
    expect(filenames).toContain("lessons/01-greetings.json");
    expect(filenames).toContain("manifest.yaml");
  });

  it("reports per-lesson download progress (DIS-06)", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    const events: Array<{ current: number; total: number }> = [];
    await downloadSetDexie(
      SOURCE,
      SET_ID,
      [{ source: SOURCE, branch: BRANCH }],
      (p) => events.push(p),
    );
    // An initial (0, total) and a (total, total) when done.
    expect(events[0]).toEqual({ current: 0, total: events[0].total });
    const last = events[events.length - 1];
    expect(last.current).toBe(last.total);
    expect(last.total).toBeGreaterThan(0);
  });

  it("prunes the stale version when re-downloading a newer version (#62)", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);

    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST.replace(
        /'1\.0\.0'/g,
        "'2.0.0'",
      ),
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]:
        SET_MANIFEST.replace(/'1\.0\.0'/g, "'2.0.0'"),
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    const entry = await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(entry.cached_version).toBe("2.0.0");

    const db = getDb();
    const rows = await db.contentSets.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe("2.0.0");
    const files = await db.contentSetFiles.toArray();
    expect(files.every((f) => f.set_pk === rows[0].id)).toBe(true);
  });

  it("fetches from the set's `path` (source-language tree)", async () => {
    // Phase 60: a set declaring ``path: sets/de/fr-a1`` is
    // downloaded from that directory, not ``sets/{id}``.
    const PAIR_ID = "fr-a1-from-de";
    const repoManifest = `
schema_version: '1.2'
name: Adaptive Learner Content
sets:
  - id: fr-a1-from-de
    title: Französisch A1
    target_language: fr
    source_language: de
    level: A1
    path: sets/de/fr-a1
    version: '1.0.0'
    lesson_count: 1
    domain: language
`.trim();
    const setManifest = `
schema_version: '1.2'
name: Französisch A1
sets:
  - id: fr-a1-from-de
    title: Französisch A1
    target_language: fr
    source_language: de
    level: A1
    path: sets/de/fr-a1
    version: '1.0.0'
    lesson_count: 1
metadata:
  lessons:
    - 01-begruessung.json
`.trim();
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: repoManifest,
      [`/${SOURCE}/${BRANCH}/sets/de/fr-a1/manifest.yaml`]: setManifest,
      [`/${SOURCE}/${BRANCH}/sets/de/fr-a1/lessons/01-begruessung.json`]:
        LESSON_JSON,
    });
    const entry = await downloadSetDexie(SOURCE, PAIR_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(entry.cached_version).toBe("1.0.0");
    expect(entry.source_language).toBe("de");
    const db = getDb();
    const files = await db.contentSetFiles.toArray();
    expect(files.map((f) => f.filename)).toContain(
      "lessons/01-begruessung.json",
    );
  });

  it("is idempotent when the cache matches the upstream version", async () => {
    const fetchMock = installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const callsBefore = fetchMock.mock.calls.length;
    const entry = await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(entry.cached_version).toBe("1.0.0");
    // The second call fetches ONLY the repo manifest to
    // reconcile versions; it skips the set manifest and
    // lesson files.
    const callsAfter = fetchMock.mock.calls.length;
    expect(callsAfter - callsBefore).toBe(1);
  });

  it("404s when the set id is not in the upstream manifest", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
    });
    await expect(
      downloadSetDexie(SOURCE, "no-such-set", [
        { source: SOURCE, branch: BRANCH },
      ]),
    ).rejects.toThrow(/no-such-set/);
  });
});

describe("Dexie content-loader: listLessons + getLesson", () => {
  it("returns the lesson list after download", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const listing = await listLessonsDexie(SOURCE, SET_ID);
    expect(listing.lessons).toEqual(["01-greetings.json"]);
    expect(listing.version).toBe("1.0.0");
  });

  it("404s on uncached set", async () => {
    await expect(listLessonsDexie(SOURCE, SET_ID)).rejects.toThrow(
      /not cached/,
    );
  });

  it("reads the lesson back from the cache", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const lesson = await getLessonDexie(SOURCE, SET_ID, "01-greetings.json");
    expect(lesson.id).toBe("01-greetings");
    expect(lesson.title).toBe("Greetings");
  });

  it("404s on unknown lesson filename", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    await expect(
      getLessonDexie(SOURCE, SET_ID, "no-such.json"),
    ).rejects.toThrow(/not found/);
  });

  // #1195 regression: a multiselect cloze must survive the real
  // download → cache → read cycle (the GH-Pages / iPhone Dexie path).
  // The renderer dispatches on ``exercise.cloze_mode === "multiselect"``,
  // so if the load path ever dropped that field (the verify-first
  // "field dropped in mapping" concern) the renderer would silently fall
  // back to the blank-based dropdown. This pins the field through.
  it("preserves cloze_mode='multiselect' + accept/distractors on read-back", async () => {
    const MULTISELECT_LESSON = JSON.stringify({
      id: "01-influence",
      title: "Influence",
      cards: [],
      steps: [
        {
          id: "ms",
          type: "exercise",
          exercise: {
            id: "ex-ms",
            type: "cloze",
            cloze_mode: "multiselect",
            prompt: "Select all that apply.",
            card_ids: [],
            sentence: "Which are persuasion principles?",
            accept: ["Reciprocity", "Scarcity"],
            distractors: ["Gravity", "Entropy"],
          },
        },
      ],
    });
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        MULTISELECT_LESSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const lesson = await getLessonDexie(SOURCE, SET_ID, "01-greetings.json");
    const exercise = lesson.steps[0].exercise;
    expect(exercise?.cloze_mode).toBe("multiselect");
    expect(exercise?.accept).toEqual(["Reciprocity", "Scarcity"]);
    expect(exercise?.distractors).toEqual(["Gravity", "Entropy"]);
  });
});

describe("mimeTypeForAssetPath", () => {
  it.each([
    ["img/cover.png", "image/png"],
    ["img/scene.jpg", "image/jpeg"],
    ["img/scene.jpeg", "image/jpeg"],
    ["img/scene.webp", "image/webp"],
    ["img/icon.svg", "image/svg+xml"],
    ["audio/x.mp3", "application/octet-stream"],
  ])("maps %s → %s", (path, expected) => {
    expect(mimeTypeForAssetPath(path)).toBe(expected);
  });
});

describe("Dexie content-loader: assets (Phase 54 / v1.37.0)", () => {
  // Repo manifest with one declared asset on the set.
  const REPO_MANIFEST_WITH_ASSETS = `
schema_version: '1.0'
name: Adaptive Learner Pilot
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 1
    domain: language
    tags: [beginner]
    assets:
      - path: img/cover.png
        size_kb: 1
`.trim();

  const PNG_BODY = "\x89PNG\r\n\x1a\nFAKE_PIXEL_DATA";

  it("fetches + caches declared assets during downloadSet", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST_WITH_ASSETS,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/assets/img/cover.png`]: PNG_BODY,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const db = getDb();
    const files = await db.contentSetFiles.toArray();
    const filenames = files.map((f) => f.filename).sort();
    expect(filenames).toContain("assets/img/cover.png");
  });

  it("getAssetDexie returns a Blob with the right MIME", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST_WITH_ASSETS,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/assets/img/cover.png`]: PNG_BODY,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const blob = await getAssetDexie(SOURCE, SET_ID, "img/cover.png");
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/png");
    expect(blob!.size).toBeGreaterThan(0);
  });

  it("getAssetDexie returns null for an uncached set", async () => {
    const blob = await getAssetDexie(
      SOURCE,
      "nonexistent-set",
      "img/cover.png",
    );
    expect(blob).toBeNull();
  });

  it("getAssetDexie returns null when the asset wasn't bundled", async () => {
    // Download the set with NO assets, then try to read one.
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
    });
    await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    const blob = await getAssetDexie(SOURCE, SET_ID, "img/cover.png");
    expect(blob).toBeNull();
  });

  it("download tolerates a 404 on a declared asset (graceful skip)", async () => {
    installFetchMock({
      [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST_WITH_ASSETS,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
        LESSON_JSON,
      // assets/img/cover.png → 404 (mock returns null)
      [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/assets/img/cover.png`]: null,
    });
    // download succeeds even though one declared asset is
    // missing on the upstream — frontend will text-fallback
    // when it tries to render it.
    const entry = await downloadSetDexie(SOURCE, SET_ID, [
      { source: SOURCE, branch: BRANCH },
    ]);
    expect(entry.cached_version).toBe("1.0.0");
    const blob = await getAssetDexie(SOURCE, SET_ID, "img/cover.png");
    expect(blob).toBeNull();
  });
});
