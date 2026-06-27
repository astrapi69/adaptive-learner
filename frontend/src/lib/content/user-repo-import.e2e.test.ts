/**
 * E2E-style integration test: user content-repository import against the
 * real starter/test repo ``astrapi69/adaptive-learner-content-test``
 * (EXP-023, #636).
 *
 * Per the "mock external services — no real network in tests" rule
 * (.claude/rules/coding-standards.md), ``fetch`` is mocked and serves the
 * REAL test-repo content captured as fixtures under ``./__fixtures__``
 * (its root manifest, the ``inception-example`` set manifest, and the
 * ``106-inception-effekt-und-beeinflussung.json`` lesson). The test then
 * drives the real Dexie content-loader + ``content-repos`` helpers
 * end-to-end — the GitHub-Pages / Dexie mode is where user-repo import is
 * the headline feature.
 *
 * Only the two non-content concerns are stubbed: the technical validator
 * (``content-repo-validate``) and the per-repo token store
 * (``repo-token``) — same isolation as ``content-repos.test.ts``.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

// Force Dexie storage mode BEFORE the storage barrel resolves its
// singleton (getStorage reads this on first call).
localStorage.setItem("adaptive-learner.storage_mode", "dexie");

// Stub the two non-content concerns (network-isolated, mirrors
// content-repos.test.ts): the validator passes, no per-repo token.
vi.mock("./repos/content-repo-validate", () => ({
    validateUserRepo: vi.fn(async () => ({
        ok: true,
        setCount: 1,
        lessonCount: 1,
    })),
}));
vi.mock("./repos/repo-token", () => ({resolveRepoToken: () => ""}));

import inceptionLesson from "./__fixtures__/inception-lesson.json";
import REPO_MANIFEST from "./__fixtures__/repo-manifest.yaml?raw";
import SET_MANIFEST from "./__fixtures__/set-manifest.yaml?raw";
import {
    addUserRepo,
    isOfficialSource,
    readUserRepos,
    removeUserRepo,
    syncUserRepo,
    userRepoSource,
    type UserContentRepo,
} from "./repos/content-repos";
import {getStorage} from "../../storage";
import {_resetDbForTests} from "../../storage/dexie/db";
import {SUPPORTED_EXERCISE_TYPES} from "../../components/exercises";

// --- real fixtures captured from the test repo -----------------------------

const LESSON_BODY = JSON.stringify(inceptionLesson);

const TEST_OWNER = "astrapi69";
const TEST_REPO = "adaptive-learner-content-test";
const TEST_SOURCE = userRepoSource(TEST_OWNER, TEST_REPO);
const SET_ID = "inception-example-from-de";
const LESSON_FILE = "106-inception-effekt-und-beeinflussung.json";

// A minimal official manifest so scenario 4 can prove the official
// content is still consulted after the user repo is removed.
const OFFICIAL_MANIFEST = [
    "schema_version: '1.2'",
    "name: Official",
    "sets:",
    "  - id: official-fr-a1",
    "    title: Official FR A1",
    "    target_language: fr",
    "    source_language: en",
    "    level: A1",
    "    domain: language",
    "    path: sets/en/fr-a1",
    "    version: '1.0.0'",
    "    lesson_count: 1",
].join("\n");

/** A by-URL-fragment fetch mock. Unknown URLs resolve to 404 so the
 *  bundled + official defaults fall through gracefully (the loader's
 *  cached fallback), exactly as in a real GH-Pages run with the upstream
 *  not serving those paths. */
function installFetch(routes: Array<[string, string | number]>) {
    const fetchMock = vi.fn(async (url: string | URL) => {
        const u = String(url);
        for (const [fragment, body] of routes) {
            if (!u.includes(fragment)) continue;
            if (typeof body === "number") {
                return {
                    ok: body >= 200 && body < 300,
                    status: body,
                    text: async () => "",
                    arrayBuffer: async () => new ArrayBuffer(0),
                } as unknown as Response;
            }
            return {
                ok: true,
                status: 200,
                text: async () => body,
                arrayBuffer: async () => new ArrayBuffer(0),
            } as unknown as Response;
        }
        return {
            ok: false,
            status: 404,
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

/** The routes that serve the real test-repo content. */
const TEST_REPO_ROUTES: Array<[string, string | number]> = [
    [`${TEST_REPO}/main/manifest.yaml`, REPO_MANIFEST],
    ["sets/de/inception-example/manifest.yaml", SET_MANIFEST],
    [LESSON_FILE, LESSON_BODY],
];

function connectedRepo(): UserContentRepo {
    return {
        url: `https://github.com/${TEST_OWNER}/${TEST_REPO}`,
        owner: TEST_OWNER,
        repo: TEST_REPO,
        branch: "main",
        connected: true,
        last_synced: null,
        set_count: 0,
        lesson_count: 0,
    };
}

beforeAll(() => {
    // Sanity: the captured fixtures describe the expected set.
    expect(REPO_MANIFEST).toContain(SET_ID);
    expect(SET_MANIFEST).toContain(LESSON_FILE);
});

beforeEach(async () => {
    await _resetDbForTests();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("user-repo import E2E (adaptive-learner-content-test, #636)", () => {
    it("1. adds the repo, syncs, and lists its set", async () => {
        installFetch(TEST_REPO_ROUTES);
        await addUserRepo(connectedRepo());

        const repos = await readUserRepos();
        expect(repos.map((r) => userRepoSource(r.owner, r.repo))).toContain(
            TEST_SOURCE,
        );

        const result = await syncUserRepo(TEST_SOURCE);
        expect(result.setCount).toBe(1);
        expect(result.lessonCount).toBe(1);

        const {sets} = await getStorage().contentLoader.listSets();
        const entry = sets.find(
            (s) => s.id === SET_ID && s.source === TEST_SOURCE,
        );
        expect(entry).toBeDefined();
        expect(entry?.title).toContain("Inception");
        expect(entry?.domain).toBe("psychology");
    });

    it("2. downloads the set; the lesson parses with theory + exercises", async () => {
        installFetch(TEST_REPO_ROUTES);
        await addUserRepo(connectedRepo());
        await getStorage().contentLoader.downloadSet(TEST_SOURCE, SET_ID);

        const list = await getStorage().contentLoader.listLessons(
            TEST_SOURCE,
            SET_ID,
        );
        expect(list.lessons).toContain(LESSON_FILE);

        const lesson = await getStorage().contentLoader.getLesson(
            TEST_SOURCE,
            SET_ID,
            LESSON_FILE,
        );
        const theory = lesson.steps.filter((s) => s.type === "theory");
        const exercises = lesson.steps.filter((s) => s.type === "exercise");
        // Real lesson shape: 3 theory steps + 8 exercises, 10 cards.
        expect(theory.length).toBeGreaterThanOrEqual(1);
        expect(exercises.length).toBeGreaterThanOrEqual(1);
        expect(lesson.cards.length).toBeGreaterThan(0);
        // Every theory step has body to render.
        for (const step of theory) {
            expect((step.body ?? "").length).toBeGreaterThan(0);
        }
        // Every exercise renders via a supported renderer.
        for (const step of exercises) {
            expect(SUPPORTED_EXERCISE_TYPES.has(step.exercise!.type)).toBe(true);
        }
        // The parent set's language pair is injected onto the lesson.
        expect(lesson.target_language).toBe("de");
    });

    it("3. surfaces the test-repo source badge — not official", async () => {
        installFetch(TEST_REPO_ROUTES);
        await addUserRepo(connectedRepo());

        const {sets} = await getStorage().contentLoader.listSets();
        const entry = sets.find((s) => s.id === SET_ID);
        expect(entry?.source).toBe(TEST_SOURCE);
        expect(isOfficialSource(entry!.source)).toBe(false);
    });

    it("4. removing the repo drops its set but keeps official content", async () => {
        installFetch([
            ...TEST_REPO_ROUTES,
            ["adaptive-learner-content/main/manifest.yaml", OFFICIAL_MANIFEST],
        ]);
        await addUserRepo(connectedRepo());

        const before = await getStorage().contentLoader.listSets();
        expect(before.sets.some((s) => s.id === SET_ID)).toBe(true);

        await removeUserRepo(TEST_SOURCE);
        expect(await readUserRepos()).toHaveLength(0);

        const after = await getStorage().contentLoader.listSets();
        expect(after.sets.some((s) => s.source === TEST_SOURCE)).toBe(false);
        // Official content is still consulted (untouched by the removal).
        expect(after.sets.some((s) => s.id === "official-fr-a1")).toBe(true);
    });

    it("5. cached content stays available offline after import", async () => {
        installFetch(TEST_REPO_ROUTES);
        await addUserRepo(connectedRepo());
        await getStorage().contentLoader.downloadSet(TEST_SOURCE, SET_ID);

        // Go offline: every fetch now fails.
        vi.unstubAllGlobals();
        installFetch([]); // all unknown → 404

        // The set still lists (cached fallback) and the lesson still loads.
        const {sets} = await getStorage().contentLoader.listSets();
        expect(sets.some((s) => s.id === SET_ID && s.source === TEST_SOURCE)).toBe(
            true,
        );
        const lesson = await getStorage().contentLoader.getLesson(
            TEST_SOURCE,
            SET_ID,
            LESSON_FILE,
        );
        expect(lesson.steps.length).toBeGreaterThan(0);
    });

    it("6. adding the same repo twice does not create a duplicate", async () => {
        installFetch(TEST_REPO_ROUTES);
        await addUserRepo(connectedRepo());
        await addUserRepo({...connectedRepo(), branch: "main"});

        const repos = await readUserRepos();
        const matches = repos.filter(
            (r) => userRepoSource(r.owner, r.repo) === TEST_SOURCE,
        );
        expect(matches).toHaveLength(1);
    });
});
