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
    retireUnservableDexie,
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

// Mirrors the backend router tests (retire-unservable section), so both
// storage modes hold the same contract (#2053).
describe("retirement reason (#3952)", () => {
    const all = () => listElementErrorsDexie(USER, {includeRetired: true});

    it("an author retirement records its reason", async () => {
        await record("こんにちは");
        await archiveRetiredDexie(USER, SET, ["greetings-match-x7"]);
        expect((await all()).map((r) => r.retired_reason)).toEqual(["author"]);
    });

    it("an active row has no reason", async () => {
        await record("いち", "numbers-pic-b2");
        expect((await all()).map((r) => r.retired_reason)).toEqual([null]);
    });

    it("a row retired before the reason existed reads as author-retired", async () => {
        await record("こんにちは");
        const [row] = await getDb().elementErrors.toArray();
        await getDb().elementErrors.put({...row, retired_at: "2026-08-01T00:00:00.000Z"});
        expect((await all()).map((r) => r.retired_reason)).toEqual(["author"]);
    });

    it.each(["exercise_missing", "lesson_missing", "element_missing", "superseded"] as const)(
        "retireUnservable hides the rows and records %s",
        async (reason) => {
            await record("こんにちは", "gone-ex");
            await record("いち", "numbers-pic-b2");
            const gone = (await all()).find((r) => r.exercise_id === "gone-ex")!;

            expect(await retireUnservableDexie(USER, [gone.id], reason)).toEqual({retired: 1});

            const rows = new Map((await all()).map((r) => [r.exercise_id, r]));
            expect(rows.get("gone-ex")?.retired_reason).toBe(reason);
            expect(rows.get("gone-ex")?.retired_at).toBeTruthy();
            expect(rows.get("numbers-pic-b2")?.retired_at ?? null).toBeNull();
            const queue = await computeReviewQueueDexie(USER);
            expect(queue.map((item) => item.exercise_id)).toEqual(["numbers-pic-b2"]);
        },
    );

    it("is idempotent and keeps the first reason", async () => {
        await record("こんにちは", "gone-ex");
        const [row] = await all();
        expect(await retireUnservableDexie(USER, [row.id], "exercise_missing")).toEqual({retired: 1});
        expect(await retireUnservableDexie(USER, [row.id], "lesson_missing")).toEqual({retired: 0});
        expect((await all())[0].retired_reason).toBe("exercise_missing");
    });

    it("ignores unknown ids and another learner's rows", async () => {
        await record("こんにちは", "gone-ex");
        const [row] = await all();
        expect(await retireUnservableDexie(USER, ["no-such-row"], "exercise_missing")).toEqual({retired: 0});
        expect(await retireUnservableDexie("other-user", [row.id], "exercise_missing")).toEqual({retired: 0});
        expect((await all())[0].retired_at ?? null).toBeNull();
    });
});
