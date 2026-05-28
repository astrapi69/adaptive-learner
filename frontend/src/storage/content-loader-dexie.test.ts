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
import {beforeEach, describe, expect, it, vi, type Mock} from "vitest";

import {
    downloadSetDexie,
    getLessonDexie,
    listLessonsDexie,
    listSetsDexie,
} from "./content-loader-dexie";
import {_resetDbForTests, getDb} from "./db";

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
    cards: [{id: "bonjour", front: "Bonjour", back: "Hello"}],
    steps: [
        {
            id: "intro",
            type: "theory",
            body: "# Greetings\n\nA few common phrases.",
        },
    ],
});

function installFetchMock(
    routes: Record<string, string | null>,
): Mock {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        for (const [path, body] of Object.entries(routes)) {
            if (url.endsWith(path)) {
                if (body === null) {
                    return new Response("not found", {status: 404});
                }
                return new Response(body, {status: 200});
            }
        }
        return new Response(`unmocked: ${url}`, {status: 404});
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
        const result = await listSetsDexie([{source: SOURCE, branch: BRANCH}]);
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
            {source: "bundled:fr-a1", branch: ""},
        ]);
        expect(result.sets).toHaveLength(1);
        expect(result.sets[0].id).toBe(SET_ID);
        // Confirm the fetch went to the bundled path, not the
        // GitHub raw URL.
        const calls = mock.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("/content/fr-a1/manifest.yaml")))
            .toBe(true);
        expect(calls.some((u) => u.includes("raw.githubusercontent.com")))
            .toBe(false);
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
        const result = await listSetsDexie([{source: SOURCE, branch: BRANCH}]);
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
        const result = await listSetsDexie([{source: SOURCE, branch: BRANCH}]);
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
            {source: SOURCE, branch: BRANCH},
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

    it("is idempotent when the cache matches the upstream version", async () => {
        const fetchMock = installFetchMock({
            [`/${SOURCE}/${BRANCH}/manifest.yaml`]: REPO_MANIFEST,
            [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/manifest.yaml`]: SET_MANIFEST,
            [`/${SOURCE}/${BRANCH}/sets/${SET_ID}/lessons/01-greetings.json`]:
                LESSON_JSON,
        });
        await downloadSetDexie(SOURCE, SET_ID, [
            {source: SOURCE, branch: BRANCH},
        ]);
        const callsBefore = fetchMock.mock.calls.length;
        const entry = await downloadSetDexie(SOURCE, SET_ID, [
            {source: SOURCE, branch: BRANCH},
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
                {source: SOURCE, branch: BRANCH},
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
            {source: SOURCE, branch: BRANCH},
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
            {source: SOURCE, branch: BRANCH},
        ]);
        const lesson = await getLessonDexie(
            SOURCE,
            SET_ID,
            "01-greetings.json",
        );
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
            {source: SOURCE, branch: BRANCH},
        ]);
        await expect(
            getLessonDexie(SOURCE, SET_ID, "no-such.json"),
        ).rejects.toThrow(/not found/);
    });
});
