/**
 * #2188 — Dexie-mode retired_ids archival. Mirrors the backend router tests
 * (test_element_errors_router.py, archive_retired section) so both modes are
 * pinned (#2053): every row of a retired identity is archived (history kept),
 * archived rows leave the default list + the review queue, idempotent,
 * scoped to the set.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {
    archiveRetiredDexie,
    computeReviewQueueDexie,
    listElementErrorsDexie,
    recordElementAttemptsDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "../types";

const USER = "user-1";
const SET = "ja-a1-from-de";

function record(
    element_key: string,
    exercise_id = "greetings-match-x7",
    set_id = SET,
) {
    const attempt: ElementAttempt = {
        set_id,
        lesson_id: "01-begruessungen.json",
        exercise_id,
        element_key,
        element_type: "vocabulary",
        user_answer: "x",
        correct_answer: element_key,
        correct: false,
    };
    return recordElementAttemptsDexie(USER, [attempt]);
}

beforeEach(async () => {
    getDb().elementErrors.clear();
    _resetDbForTests();
});

describe("archiveRetiredDexie (#2188)", () => {
    it("archives every row of the retired identity and leaves the rest", async () => {
        await record("こんにちは");
        await record("さようなら");
        await record("いち", "numbers-pic-b2");
        const res = await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        expect(res).toEqual({archived: 2});
        // Default list = active rows only (scheduling + due counts).
        const active = await listElementErrorsDexie(USER);
        expect(active.map((r) => r.exercise_id)).toEqual(["numbers-pic-b2"]);
        // Archive view keeps the history.
        const all = await listElementErrorsDexie(USER, {includeRetired: true});
        expect(all).toHaveLength(3);
        const archived = all.filter((r) => r.exercise_id === "greetings-match-x7");
        expect(archived.every((r) => Boolean(r.retired_at))).toBe(true);
    });

    it("is idempotent (a second run archives nothing new)", async () => {
        await record("こんにちは");
        const first = await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        const second = await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        expect(first).toEqual({archived: 1});
        expect(second).toEqual({archived: 0});
    });

    it("scopes to the set: the same identity in another set stays active", async () => {
        await record("こんにちは");
        await record("hallo", "greetings-match-x7", "OTHER-set");
        const res = await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        expect(res).toEqual({archived: 1});
        const active = await listElementErrorsDexie(USER);
        expect(active.map((r) => r.set_id)).toEqual(["OTHER-set"]);
    });

    it("archived rows leave the review queue", async () => {
        await record("こんにちは");
        await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        expect(await computeReviewQueueDexie(USER)).toEqual([]);
    });
});
