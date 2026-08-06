/**
 * #2130 — Dexie-mode exercise-id remap (the stable_id key switch). Mirrors
 * the backend router tests (test_element_errors_router.py, remap_exercise_ids
 * section) so both modes are pinned (#2053): every row of the exercise moves
 * (all element_keys + both directions), idempotent, no double-map, scoped to
 * (set, lesson).
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
    remapExerciseIdsDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "../types";

const USER = "user-1";
const SET = "ja-a1-from-de";
const LESSON = "01-begruessungen.json";

function record(
    element_key: string,
    exercise_id = "ex-match-begruessung",
    opts: {lesson_id?: string; direction?: "source_to_target" | "target_to_source"} = {},
) {
    const attempt: ElementAttempt = {
        set_id: SET,
        lesson_id: opts.lesson_id ?? LESSON,
        exercise_id,
        element_key,
        direction: opts.direction,
        element_type: "vocabulary",
        user_answer: "x",
        correct_answer: element_key,
        correct: false,
    };
    return recordElementAttemptsDexie(USER, [attempt]);
}

async function exerciseIds(): Promise<string[]> {
    const rows = await listElementErrorsDexie(USER);
    return rows.map((r) => r.exercise_id).sort();
}

const REMAP = {
    set_id: SET,
    lesson_id: LESSON,
    old: "ex-match-begruessung",
    new: "greetings-match-x7",
};

beforeEach(async () => {
    getDb().elementErrors.clear();
    _resetDbForTests();
});

describe("remapExerciseIdsDexie (#2130)", () => {
    it("moves every row of the exercise (all element_keys + both directions)", async () => {
        await record("こんにちは");
        await record("さようなら");
        await record("こんにちは", "ex-match-begruessung", {direction: "source_to_target"});
        const res = await remapExerciseIdsDexie(USER, [REMAP]);
        expect(res).toEqual({applied: 3, skipped: 0});
        expect(await exerciseIds()).toEqual([
            "greetings-match-x7", "greetings-match-x7", "greetings-match-x7",
        ]);
        // element_keys survive untouched.
        const rows = await listElementErrorsDexie(USER);
        expect(rows.map((r) => r.element_key).sort()).toEqual([
            "こんにちは", "こんにちは", "さようなら",
        ]);
    });

    it("is idempotent (a second run is a no-op, same state)", async () => {
        await record("こんにちは");
        const first = await remapExerciseIdsDexie(USER, [REMAP]);
        const second = await remapExerciseIdsDexie(USER, [REMAP]);
        expect(first).toEqual({applied: 1, skipped: 0});
        expect(second).toEqual({applied: 0, skipped: 0});
        expect(await exerciseIds()).toEqual(["greetings-match-x7"]);
    });

    it("skips when a target row already exists (no double-map)", async () => {
        await record("こんにちは");
        await record("こんにちは", "greetings-match-x7");
        const res = await remapExerciseIdsDexie(USER, [REMAP]);
        expect(res).toEqual({applied: 0, skipped: 1});
        expect(await exerciseIds()).toEqual([
            "ex-match-begruessung", "greetings-match-x7",
        ]);
    });

    it("scopes to (set, lesson): the same exercise id in another lesson stays", async () => {
        await record("こんにちは");
        await record("いち", "ex-match-begruessung", {lesson_id: "02-zahlen.json"});
        const res = await remapExerciseIdsDexie(USER, [REMAP]);
        expect(res).toEqual({applied: 1, skipped: 0});
        expect(await exerciseIds()).toEqual([
            "ex-match-begruessung", "greetings-match-x7",
        ]);
    });
});
