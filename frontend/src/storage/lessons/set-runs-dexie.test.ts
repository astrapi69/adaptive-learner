/**
 * Tests for the Dexie-mode Durchgang (run/pass) store — the GitHub-Pages
 * half of EXP-051 / #2125.
 *
 * Mirrors ``backend/tests/test_set_runs.py`` so a divergence in either
 * storage backing surfaces as a test failure (the #2053 both-modes rule).
 * Pins: lazy run-1 materialisation on first write, the atomic
 * close-old-then-open-next start transition, active-run read scoping on
 * the list + review queue, the ``runId`` filter reaching a closed run, and
 * the set-delete sweep across all runs.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {
    computeReviewQueueDexie,
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "./element-errors-dexie";
import {
    ensureActiveRunDexie,
    listRunsDexie,
    startRunDexie,
} from "./set-runs-dexie";
import {deleteLearningDataDexie} from "./orphan-data-dexie";
import type {ElementAttempt} from "../types";

const USER = "user-1";
const SET = "language-fr-a1";

function attempt(overrides: Partial<ElementAttempt> = {}): ElementAttempt {
    return {
        set_id: SET,
        lesson_id: "01-greetings.json",
        exercise_id: "ex-thanks",
        element_key: "merci",
        correct: false,
        correct_answer: "Merci",
        ...overrides,
    };
}

beforeEach(async () => {
    const db = getDb();
    try {
        await db.elementErrors.clear();
        await db.setRuns.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("Dexie setRuns: lazy run 1", () => {
    it("materialises the active run 1 on the first recorded attempt", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const runs = await listRunsDexie(USER, SET);
        expect(runs).toHaveLength(1);
        expect(runs[0].run_id).toBe(1);
        expect(runs[0].closed_at).toBeNull();
        const rows = await listElementErrorsDexie(USER);
        expect(rows[0].run_id).toBe(1);
    });

    it("ensureActiveRun is idempotent for an open run", async () => {
        const first = await ensureActiveRunDexie(USER, SET, new Date().toISOString());
        const second = await ensureActiveRunDexie(USER, SET, new Date().toISOString());
        expect(first).toBe(1);
        expect(second).toBe(1);
        expect(await listRunsDexie(USER, SET)).toHaveLength(1);
    });
});

describe("Dexie setRuns: start a new run", () => {
    it("closes the old run and opens the next", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        const opened = await startRunDexie(USER, SET);
        expect(opened.run_id).toBe(2);
        expect(opened.closed_at).toBeNull();
        const runs = await listRunsDexie(USER, SET);
        expect(runs.map((r) => r.run_id)).toEqual([1, 2]);
        expect(runs[0].closed_at).not.toBeNull();
        expect(runs[1].closed_at).toBeNull();
    });

    it("opens run 2 (run 1 closed) when no run row exists yet", async () => {
        const opened = await startRunDexie(USER, SET);
        expect(opened.run_id).toBe(2);
        const runs = await listRunsDexie(USER, SET);
        expect(runs.map((r) => r.run_id)).toEqual([1, 2]);
        expect(runs[0].closed_at).not.toBeNull();
    });

    it("a second run keeps the first run's rows (distinct ids)", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "merci", correct: false}),
        ]);
        await startRunDexie(USER, SET);
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "merci", correct: true}),
        ]);
        const run1 = await listElementErrorsDexie(USER, {runId: 1});
        const run2 = await listElementErrorsDexie(USER, {runId: 2});
        expect(run1).toHaveLength(1);
        expect(run1[0].error_count).toBe(1);
        expect(run2).toHaveLength(1);
        expect(run2[0].error_count).toBe(0);
        expect(run1[0].id).not.toBe(run2[0].id);
    });

    it("records the content version at start when given", async () => {
        const opened = await startRunDexie(USER, SET, {contentVersion: "abc123"});
        expect(opened.content_version_at_start).toBe("abc123");
    });
});

describe("Dexie setRuns: read scoping", () => {
    it("the default list returns only the active run", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        await startRunDexie(USER, SET);
        await recordElementAttemptsDexie(USER, [attempt({correct: true})]);
        const active = await listElementErrorsDexie(USER);
        expect(active).toHaveLength(1);
        expect(active[0].run_id).toBe(2);
    });

    it("the review queue only sees the active run", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "a", correct: false}),
        ]);
        await startRunDexie(USER, SET);
        await recordElementAttemptsDexie(USER, [
            attempt({element_key: "b", correct: false}),
        ]);
        const queue = await computeReviewQueueDexie(USER, {setId: SET});
        expect(queue.map((q) => q.element_key)).toEqual(["b"]);
    });

    it("legacy rows with no run row read as the active run", async () => {
        // Simulate a pre-EXP-051 row: run_id present (v31 backfill) but no
        // setRuns row yet.
        const db = getDb();
        const nowIso = new Date().toISOString();
        await db.elementErrors.put({
            id: `${USER}#${SET}#01.json#ex#merci#target_to_source#1`,
            user_id: USER,
            run_id: 1,
            set_id: SET,
            lesson_id: "01.json",
            exercise_id: "ex",
            element_key: "merci",
            direction: "target_to_source",
            element_type: "vocabulary",
            user_answer: "",
            correct_answer: "Merci",
            error_count: 1,
            correct_streak: 0,
            last_error_at: nowIso,
            last_attempt_at: nowIso,
            mastered: false,
            mastered_at: null,
            created_at: nowIso,
            updated_at: nowIso,
        });
        expect(await listRunsDexie(USER, SET)).toHaveLength(0);
        expect(await listElementErrorsDexie(USER)).toHaveLength(1);
    });
});

describe("Dexie setRuns: orphan sweep", () => {
    it("deleting a set removes all of its runs and rows", async () => {
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);
        await startRunDexie(USER, SET);
        await recordElementAttemptsDexie(USER, [attempt({correct: false})]);

        await deleteLearningDataDexie(USER, {
            lessonProgressIds: [],
            setIds: [SET],
        });

        expect(await listRunsDexie(USER, SET)).toHaveLength(0);
        expect(await listElementErrorsDexie(USER, {runId: 1})).toHaveLength(0);
        expect(await listElementErrorsDexie(USER, {runId: 2})).toHaveLength(0);
    });
});
