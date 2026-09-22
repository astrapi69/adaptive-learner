/**
 * "Alles wiederholen" reset service (#3171), proven in BOTH storage modes
 * (#2053): the Dexie half against real fake-indexeddb rows, the API half
 * against the recorded fetch calls (the endpoints the backend owns).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {apiStorage} from "../../storage/api-storage";
import {_resetDbForTests, getDb} from "../../storage/dexie/db";
import {dexieStorage} from "../../storage/dexie-storage";
import {getSetStatus, storeSetStatus} from "../content/browse/lifecycle/set-status-store";
import {resetSetResults, summarizeSetResults} from "./reset-set-results";

const USER = "learner-1";
const SCOPE = {source: "official", setId: "psych"};

describe("reset-set-results (Dexie mode)", () => {
    beforeEach(async () => {
        // Clear the three tables the reset touches (the pattern of the
        // sibling lesson-progress-dexie test): a closed-and-reopened Dexie
        // instance keeps fake-indexeddb's rows, so a fresh factory alone
        // does not isolate the cases.
        const db = getDb();
        await db.lessonProgress.clear();
        await db.elementErrors.clear();
        await db.setRuns.clear();
        localStorage.clear();
    });

    afterEach(async () => {
        await _resetDbForTests();
    });

    async function seedTwoLessonsAndOneError() {
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SCOPE.source,
            set_id: SCOPE.setId,
            lesson_filename: "01.json",
            step_result: {step_id: "s1", correct: 3, total: 4},
            time_spent_seconds_delta: 30,
        });
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SCOPE.source,
            set_id: SCOPE.setId,
            lesson_filename: "02.json",
            step_result: {step_id: "s1", correct: 1, total: 4},
        });
        // A sibling set's progress must survive the reset untouched.
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SCOPE.source,
            set_id: "other",
            lesson_filename: "01.json",
            step_result: {step_id: "s1", correct: 4, total: 4},
        });
        await dexieStorage.elementErrors.recordBulk(USER, [
            {
                set_id: SCOPE.setId,
                lesson_id: "01.json",
                exercise_id: "ex-1",
                element_key: "hola",
                correct: false,
            },
        ]);
    }

    it("summarises the set's progress: lesson count, ids and the average", async () => {
        await seedTwoLessonsAndOneError();
        const summary = await summarizeSetResults(dexieStorage, USER, SCOPE);
        expect(summary.lessonCount).toBe(2);
        expect(summary.progressIds).toHaveLength(2);
        // (3 + 1) / (4 + 4) = 50 %
        expect(summary.averagePercent).toBe(50);
    });

    it("reports no average and no ids for an untouched set", async () => {
        const summary = await summarizeSetResults(dexieStorage, USER, SCOPE);
        expect(summary).toEqual({
            progressIds: [],
            lessonCount: 0,
            averagePercent: null,
        });
    });

    it.each([
        ["one of three is 33", 1, 3, 33],
        ["two of three is 67", 2, 3, 67],
        ["all correct is 100", 4, 4, 100],
        ["none correct is 0", 0, 4, 0],
    ])("rounds the average: %s", async (_name, correct, total, expected) => {
        await dexieStorage.lessonProgress.upsert(USER, {
            source: SCOPE.source,
            set_id: SCOPE.setId,
            lesson_filename: "01.json",
            step_result: {step_id: "s1", correct, total},
        });
        const summary = await summarizeSetResults(dexieStorage, USER, SCOPE);
        expect(summary.averagePercent).toBe(expected);
    });

    it("deletes the set's progress rows, keeps the sibling set, and opens run 2 with run 1 kept as history", async () => {
        await seedTwoLessonsAndOneError();

        const outcome = await resetSetResults(dexieStorage, USER, SCOPE);

        expect(outcome.lessonsDeleted).toBe(2);
        expect(outcome.runId).toBe(2);

        const remaining = await dexieStorage.lessonProgress.list(USER);
        expect(remaining.map((row) => `${row.set_id}/${row.lesson_filename}`)).toEqual([
            "other/01.json",
        ]);

        const runs = await dexieStorage.elementErrors.listRuns(USER, SCOPE.setId);
        expect(runs.map((r) => [r.run_id, r.closed_at === null])).toEqual([
            [1, false],
            [2, true],
        ]);

        // The active run (run 2) starts clean; run 1's row stays for the history.
        const active = await dexieStorage.elementErrors.list(USER, {setId: SCOPE.setId});
        expect(active).toHaveLength(0);
        const history = await dexieStorage.elementErrors.list(USER, {
            setId: SCOPE.setId,
            runId: 1,
        });
        expect(history).toHaveLength(1);
    });

    it("still opens a new run for a set without any progress rows", async () => {
        const outcome = await resetSetResults(dexieStorage, USER, SCOPE);
        expect(outcome.lessonsDeleted).toBe(0);
        expect(outcome.runId).toBe(2);
    });

    // The lifecycle status is a mode-agnostic localStorage store; a set the
    // learner had marked completed/deferred in "Meine Inhalte" must come
    // back as active, exactly as "Set erneut durcharbeiten" does.
    it.each(["completed", "deferred"] as const)(
        "reactivates a set stored as %s, like the restart-set flow",
        async (stored) => {
            storeSetStatus(SCOPE.source, SCOPE.setId, stored);
            await seedTwoLessonsAndOneError();

            await resetSetResults(dexieStorage, USER, SCOPE);

            expect(getSetStatus(SCOPE.source, SCOPE.setId)).toBe("active");
        },
    );
});

describe("reset-set-results (API mode)", () => {
    interface RecordedCall {
        url: string;
        method: string;
        body: unknown;
    }
    let calls: RecordedCall[];

    const progressRows = [
        {
            id: "row-psych-01",
            user_id: USER,
            source: SCOPE.source,
            set_id: SCOPE.setId,
            lesson_filename: "01.json",
            status: "completed",
            step_results: {},
            score_correct: 3,
            score_total: 4,
            time_spent_seconds: 30,
            started_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-01T00:00:00Z",
        },
        {
            id: "row-psych-02",
            user_id: USER,
            source: SCOPE.source,
            set_id: SCOPE.setId,
            lesson_filename: "02.json",
            status: "in_progress",
            step_results: {},
            score_correct: 1,
            score_total: 4,
            time_spent_seconds: 0,
            started_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-02T00:00:00Z",
        },
        {
            id: "row-other-01",
            user_id: USER,
            source: SCOPE.source,
            set_id: "other",
            lesson_filename: "01.json",
            status: "completed",
            step_results: {},
            score_correct: 4,
            score_total: 4,
            time_spent_seconds: 0,
            started_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-01T00:00:00Z",
        },
    ];

    beforeEach(() => {
        calls = [];
        localStorage.clear();
        global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : (input as URL).toString();
            const method = (init?.method ?? "GET").toUpperCase();
            let body: unknown = undefined;
            if (typeof init?.body === "string") body = JSON.parse(init.body);
            calls.push({url, method, body});
            if (url.endsWith("/lesson-progress") && method === "GET") {
                return new Response(JSON.stringify(progressRows), {status: 200});
            }
            if (url.endsWith("/learning-data/delete")) {
                return new Response(
                    JSON.stringify({lessons_deleted: 2, cards_deleted: 0}),
                    {status: 200},
                );
            }
            if (url.endsWith("/set-runs")) {
                return new Response(
                    JSON.stringify({
                        id: "run-2",
                        user_id: USER,
                        set_id: SCOPE.setId,
                        run_id: 2,
                        content_version_at_start: null,
                        started_at: "2026-09-22T00:00:00Z",
                        closed_at: null,
                    }),
                    {status: 200},
                );
            }
            return new Response("{}", {status: 200});
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("summarises from the backend progress list, scoped to the set", async () => {
        const summary = await summarizeSetResults(apiStorage, USER, SCOPE);
        expect(summary.progressIds).toEqual(["row-psych-01", "row-psych-02"]);
        expect(summary.lessonCount).toBe(2);
        expect(summary.averagePercent).toBe(50);
    });

    it("deletes exactly the set's rows via learning-data/delete and starts a run via set-runs, nothing else", async () => {
        const outcome = await resetSetResults(apiStorage, USER, SCOPE);

        expect(outcome).toEqual({lessonsDeleted: 2, runId: 2});
        expect(calls.map((c) => [c.method, c.url.split("/users/")[1]])).toEqual([
            ["GET", `${USER}/lesson-progress`],
            ["POST", `${USER}/learning-data/delete`],
            ["POST", `${USER}/set-runs`],
        ]);
        expect(calls[1].body).toEqual({
            lesson_progress_ids: ["row-psych-01", "row-psych-02"],
            set_ids: [],
            lesson_cards: undefined,
        });
        expect(calls[2].body).toMatchObject({set_id: SCOPE.setId});
    });

    it("skips the delete call when the set has no progress rows", async () => {
        const outcome = await resetSetResults(apiStorage, USER, {
            source: SCOPE.source,
            setId: "never-played",
        });
        expect(outcome.lessonsDeleted).toBe(0);
        expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
        expect(calls[1].url.endsWith("/set-runs")).toBe(true);
    });

    it.each(["completed", "deferred"] as const)(
        "reactivates a set stored as %s, like the restart-set flow",
        async (stored) => {
            storeSetStatus(SCOPE.source, SCOPE.setId, stored);

            await resetSetResults(apiStorage, USER, SCOPE);

            expect(getSetStatus(SCOPE.source, SCOPE.setId)).toBe("active");
        },
    );

    it("leaves the stored status alone when opening the new run fails", async () => {
        storeSetStatus(SCOPE.source, SCOPE.setId, "completed");
        const passThrough = global.fetch;
        global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : (input as URL).toString();
            if (url.endsWith("/set-runs")) {
                return new Response(JSON.stringify({detail: "boom"}), {status: 500});
            }
            return passThrough(input, init);
        }) as unknown as typeof fetch;

        await expect(resetSetResults(apiStorage, USER, SCOPE)).rejects.toThrow();

        expect(getSetStatus(SCOPE.source, SCOPE.setId)).toBe("completed");
    });
});
