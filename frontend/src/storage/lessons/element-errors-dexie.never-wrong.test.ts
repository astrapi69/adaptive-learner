/**
 * #3170 (Dexie mode) - error training is error training.
 *
 * ``recordBulk`` seeds a row for EVERY played element, a correct first
 * attempt included (``error_count 0`` / ``correct_streak 1``). The queue
 * used to schedule those rows three days later, so a flawless lesson still
 * produced "Fehler trainieren (N)" and a review session that called
 * never-wrong elements "korrigiert". By default the queue now holds only
 * rows with at least one recorded error; the Settings > Learning toggle
 * ("Auch fehlerfreie Elemente wiederholen") opts back into scheduling the
 * never-wrong rows. The API-mode twin of this file is
 * ``backend/tests/test_element_srs_service.py`` (#2053: one test per mode).
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {
    computeReviewQueueDexie,
    recordElementAttemptsDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "../types";

const USER = "user-1";
const SET = "language-fr-a1";

function attempt(
    elementKey: string,
    correct: boolean,
    overrides: Partial<ElementAttempt> = {},
): ElementAttempt {
    return {
        set_id: SET,
        lesson_id: "01-greetings.json",
        exercise_id: "ex-thanks",
        element_key: elementKey,
        element_type: "vocabulary",
        user_answer: correct ? elementKey : "x",
        correct_answer: elementKey,
        correct,
        ...overrides,
    };
}

beforeEach(async () => {
    const db = getDb();
    try {
        await db.elementErrors.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("#3170 computeReviewQueueDexie: never-wrong rows", () => {
    it("repro: a flawless first attempt does NOT enter the default queue", async () => {
        await recordElementAttemptsDexie(USER, [attempt("merci", true)]);
        expect(await computeReviewQueueDexie(USER)).toEqual([]);
    });

    it("happy path: the toggle opts never-wrong rows back in", async () => {
        await recordElementAttemptsDexie(USER, [attempt("merci", true)]);
        const queue = await computeReviewQueueDexie(USER, {
            includeNeverWrong: true,
        });
        expect(queue).toHaveLength(1);
        expect(queue[0].error_count).toBe(0);
        expect(queue[0].correct_streak).toBe(1);
    });

    it.each([
        {id: "wrong-once", outcomes: [false]},
        {id: "wrong-then-corrected", outcomes: [false, true]},
        {id: "right-then-wrong", outcomes: [true, false]},
        {id: "corrected-twice-not-yet-mastered", outcomes: [false, true, true]},
    ])("boundary: a row with an error stays in the default queue ($id)", async ({outcomes}) => {
        for (const correct of outcomes) {
            await recordElementAttemptsDexie(USER, [attempt("merci", correct)]);
        }
        const queue = await computeReviewQueueDexie(USER);
        expect(queue).toHaveLength(1);
        expect(queue[0].error_count).toBe(1);
    });

    it("edge: mixed rows -> only the error rows, priority order kept", async () => {
        await recordElementAttemptsDexie(USER, [
            attempt("clean-a", true),
            attempt("clean-b", true),
            attempt("corrected", false),
        ]);
        await recordElementAttemptsDexie(USER, [attempt("corrected", true)]);
        await recordElementAttemptsDexie(USER, [attempt("wrong", false)]);
        const queue = await computeReviewQueueDexie(USER);
        expect(queue.map((q) => q.element_key)).toEqual(["wrong", "corrected"]);
        const everything = await computeReviewQueueDexie(USER, {
            includeNeverWrong: true,
        });
        expect(everything).toHaveLength(4);
    });
});
