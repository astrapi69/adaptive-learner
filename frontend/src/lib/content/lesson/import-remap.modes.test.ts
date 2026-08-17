/**
 * #2592 per-mode proof: the import-overwrite carry-over works in BOTH storage
 * modes (the #2053 rule — a storage change is proven in both modes or it is
 * not proven).
 *
 * ``import-remap.test.ts`` mocks ``getStorage`` to pin the orchestration. This
 * file does the opposite: it drives the REAL implementations through
 * ``getStorage()`` (selected by the persisted mode, exactly as the app does),
 * so the facade methods the carry-over depends on are proven present and
 * behaving on both sides — ``contentLoader.listLessons`` / ``getLesson``,
 * ``elementErrors.list`` / ``remapKeys`` / ``remapExerciseIds``.
 *
 * The Dexie half is end-to-end against fake-indexeddb: a real user set is
 * saved, a real attempt is recorded through the real key deriver, and the row
 * is read back afterwards to prove its ``element_key`` actually moved. That is
 * deliberately stronger than asserting a call was made — the #2657 sibling
 * proved a call-shape assertion can pass while nothing happens.
 */

import "fake-indexeddb/auto";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {applyImportOverwritePlan, planImportOverwrite} from "./import-remap";
import {_resetStorageCacheForTests} from "../../../storage";
import {_resetDbForTests, getDb} from "../../../storage/dexie/db";
import {saveUserSetDexie} from "../../../storage/content/content-loader-user-sets";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "../../../storage/lessons/element-errors-dexie";
import type {ContentLesson} from "../../../storage/types";

const USER = "user-1";
const SET = "imported-spanish-travel";
const LESSON_ID = "l0";
/** The BARE filename listLessons() returns and ElementError.lesson_id holds. */
const FILE = "l0.json";
const EXERCISE = "ex-1";
const STORED_KEY = "the watter";
const CORRECTED_KEY = "the water";

const STORAGE_MODE_KEY = "adaptive-learner.storage_mode";

function lessonWith(answer: string, exerciseId = EXERCISE): ContentLesson {
    return {
        id: LESSON_ID,
        title: "Spanish travel",
        description: null,
        target_language: "es",
        source_language: "de",
        estimated_minutes: 5,
        cards: [],
        steps: [
            {id: "s1", type: "theory", title: "T", body: "Body"},
            {
                id: "s2",
                type: "exercise",
                exercise: {id: exerciseId, type: "free_text", accept: [answer]},
            },
        ],
        contributed_by: null,
        contributed_at: null,
    } as unknown as ContentLesson;
}

function useMode(mode: "api" | "dexie") {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    _resetStorageCacheForTests();
}

afterEach(() => {
    localStorage.clear();
    _resetStorageCacheForTests();
    vi.restoreAllMocks();
});

describe("Dexie mode: import-overwrite carries the row over (#2592/#2053)", () => {
    beforeEach(async () => {
        localStorage.clear();
        // ``_resetDbForTests`` is async (it closes the handle): AWAIT it before
        // touching the fresh one, or the close races the seeding below and every
        // later call dies with DatabaseClosedError.
        await _resetDbForTests();
        const db = getDb();
        await db.elementErrors.clear();
        await db.contentSets.clear();
        await db.contentSetFiles.clear();
        useMode("dexie");
        // The set as it is stored BEFORE the re-import, plus a real learner row
        // recorded against it through the real recorder.
        await saveUserSetDexie(
            {
                set_id: SET,
                title: "Spanish travel",
                language: "es",
                level: "A1",
                origin: "imported",
                description: null,
                lessons: [lessonWith(STORED_KEY)],
            },
            new Date(0).toISOString(),
        );
        await recordElementAttemptsDexie(USER, [
            {
                set_id: SET,
                lesson_id: FILE,
                exercise_id: EXERCISE,
                element_key: STORED_KEY,
                element_type: "free_text",
                user_answer: "wrong",
                correct_answer: STORED_KEY,
                correct: false,
            },
        ]);
    });

    it("moves the stored row onto the corrected answer text in IndexedDB", async () => {
        const before = await listElementErrorsDexie(USER);
        expect(before.map((r) => r.element_key)).toEqual([STORED_KEY]);
        // The row the fixture just recorded carries the bare filename, proving
        // the convention the plan relies on is the one the recorder writes.
        expect(before[0].lesson_id).toBe(FILE);

        const plan = await planImportOverwrite(USER, SET, [lessonWith(CORRECTED_KEY)]);
        expect(plan.element.certain).toEqual([
            {
                set_id: SET,
                lesson_id: FILE,
                exercise_id: EXERCISE,
                old: STORED_KEY,
                new: CORRECTED_KEY,
            },
        ]);

        const result = await applyImportOverwritePlan(USER, plan);
        expect(result).toEqual({applied: 1, uncertain: 0});

        const after = await listElementErrorsDexie(USER);
        expect(after.map((r) => r.element_key)).toEqual([CORRECTED_KEY]);
        // The history moved WITH the key - carrying the row is the point, not
        // creating a fresh one at the new identity.
        expect(after[0].error_count).toBe(before[0].error_count);
    });

    it("moves the row when the exercise itself was renamed (#2569's dimension)", async () => {
        const plan = await planImportOverwrite(USER, SET, [
            lessonWith(STORED_KEY, "ex-free-1"),
        ]);
        expect(plan.exercise.certain).toEqual([
            {set_id: SET, lesson_id: FILE, old: EXERCISE, new: "ex-free-1"},
        ]);

        const result = await applyImportOverwritePlan(USER, plan);
        expect(result.applied).toBe(1);

        const after = await listElementErrorsDexie(USER);
        expect(after.map((r) => r.exercise_id)).toEqual(["ex-free-1"]);
        expect(after.map((r) => r.element_key)).toEqual([STORED_KEY]);
    });
});

describe("API mode: import-overwrite carries the row over (#2592/#2053)", () => {
    /** Every request the carry-over issued, so the per-mode assertion is about
     *  the real HTTP surface rather than a stubbed facade. */
    let requests: {url: string; method: string; body: unknown}[];

    beforeEach(() => {
        localStorage.clear();
        useMode("api");
        requests = [];
        global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            requests.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });

            if (url.includes("/element-errors/remap-exercise-ids")) {
                return new Response(JSON.stringify({applied: 0, skipped: 0}), {status: 200});
            }
            if (url.includes("/element-errors/remap")) {
                return new Response(JSON.stringify({applied: 1, skipped: 0}), {status: 200});
            }
            if (url.includes("/element-errors")) {
                return new Response(
                    JSON.stringify([
                        {
                            id: "r1",
                            user_id: USER,
                            set_id: SET,
                            lesson_id: FILE,
                            exercise_id: EXERCISE,
                            element_key: STORED_KEY,
                            element_type: "free_text",
                            user_answer: "",
                            correct_answer: STORED_KEY,
                            error_count: 2,
                            correct_streak: 0,
                            last_error_at: null,
                            last_attempt_at: "2026-08-13T00:00:00.000Z",
                            mastered: false,
                            mastered_at: null,
                            created_at: "2026-08-13T00:00:00.000Z",
                            updated_at: "2026-08-13T00:00:00.000Z",
                        },
                    ]),
                    {status: 200},
                );
            }
            if (url.includes(`/lessons/${FILE}`)) {
                return new Response(JSON.stringify(lessonWith(STORED_KEY)), {status: 200});
            }
            throw new Error(`unexpected request: ${method} ${url}`);
        }) as unknown as typeof fetch;
    });

    it("reads the stored lesson over HTTP and POSTs the remap", async () => {
        const plan = await planImportOverwrite(USER, SET, [lessonWith(CORRECTED_KEY)]);
        expect(plan.element.certain).toEqual([
            {
                set_id: SET,
                lesson_id: FILE,
                exercise_id: EXERCISE,
                old: STORED_KEY,
                new: CORRECTED_KEY,
            },
        ]);

        const result = await applyImportOverwritePlan(USER, plan);
        expect(result).toEqual({applied: 1, uncertain: 0});

        // The stored version was fetched under the user-generated source, by the
        // bare filename - a "lessons/"-prefixed name would 404 here (#2657).
        expect(
            requests.some(
                (r) =>
                    r.method === "GET" &&
                    r.url.includes("user-generated") &&
                    r.url.includes(`/lessons/${FILE}`),
            ),
        ).toBe(true);
        // And the re-key really went out on the wire, with the mapping.
        const remap = requests.find(
            (r) => r.method === "POST" && r.url.includes("/element-errors/remap"),
        );
        expect(remap?.body).toEqual({
            remaps: [
                {
                    set_id: SET,
                    lesson_id: FILE,
                    exercise_id: EXERCISE,
                    old: STORED_KEY,
                    new: CORRECTED_KEY,
                },
            ],
        });
    });

    it("never asks the backend to EXCLUDE mastered rows", async () => {
        await planImportOverwrite(USER, SET, [lessonWith(CORRECTED_KEY)]);

        // Both modes default to including mastered rows (the backend query
        // default is ``True``; ``listElementErrorsDexie`` filters only on an
        // explicit ``false``), so the API client sends the parameter only to
        // OPT OUT. The behaviour worth pinning is therefore the absence of that
        // opt-out - a mastered element carries the most history, so excluding it
        // would drop exactly the rows most worth carrying.
        const listRequest = requests.find(
            (r) => r.method === "GET" && r.url.includes("/element-errors"),
        );
        expect(listRequest).toBeDefined();
        expect(listRequest?.url).not.toContain("include_mastered=false");
    });
});
