/**
 * #2161 — Dexie-mode element_key recovery remap. Mirrors the backend router
 * tests (test_element_errors_router.py) so both modes are pinned (#2053):
 * applied, idempotent, no double-map, and all-or-nothing on a mid-batch
 * failure (Dexie transaction rollback).
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {_resetDbForTests, getDb} from "../dexie/db";
import {
    listElementErrorsDexie,
    recordElementAttemptsDexie,
    remapElementKeysDexie,
} from "./element-errors-dexie";
import type {ElementAttempt} from "../types";

const USER = "user-1";
const BASE = {
    set_id: "ja-a1-from-de",
    lesson_id: "01-begruessungen.json",
    exercise_id: "ex-match-begruessung",
};

function record(element_key: string) {
    const attempt: ElementAttempt = {
        ...BASE,
        element_key,
        element_type: "vocabulary",
        user_answer: "x",
        correct_answer: element_key,
        correct: false,
    };
    return recordElementAttemptsDexie(USER, [attempt]);
}

async function keys(): Promise<string[]> {
    const rows = await listElementErrorsDexie(USER);
    return rows.map((r) => r.element_key).sort();
}

const REMAP = {...BASE, old: "こんにちは", new: "こんにちは (konnichiwa)"};

beforeEach(async () => {
    getDb().elementErrors.clear();
    _resetDbForTests();
});

describe("remapElementKeysDexie (#2161)", () => {
    it("rewrites an orphaned key old -> new", async () => {
        await record("こんにちは");
        const res = await remapElementKeysDexie(USER, [REMAP]);
        expect(res).toEqual({applied: 1, skipped: 0});
        expect(await keys()).toEqual(["こんにちは (konnichiwa)"]);
    });

    it("is idempotent (a second run is a no-op, same state)", async () => {
        await record("こんにちは");
        const first = await remapElementKeysDexie(USER, [REMAP]);
        const second = await remapElementKeysDexie(USER, [REMAP]);
        expect(first).toEqual({applied: 1, skipped: 0});
        expect(second).toEqual({applied: 0, skipped: 0});
        expect(await keys()).toEqual(["こんにちは (konnichiwa)"]);
    });

    it("skips when the target already exists (no double-map)", async () => {
        await record("こんにちは");
        await record("こんにちは (konnichiwa)");
        const res = await remapElementKeysDexie(USER, [REMAP]);
        expect(res).toEqual({applied: 0, skipped: 1});
        expect(await keys()).toEqual(["こんにちは", "こんにちは (konnichiwa)"]);
    });

    it("is all-or-nothing: a mid-batch failure rolls the whole call back", async () => {
        await record("こんにちは");
        await record("さようなら");
        const db = getDb();
        const realPut = db.elementErrors.put.bind(db.elementErrors);
        let n = 0;
        const spy = vi
            .spyOn(db.elementErrors, "put")
            .mockImplementation((row) => {
                n += 1;
                if (n >= 2) throw new Error("forced mid-batch failure");
                return realPut(row);
            });
        await expect(
            remapElementKeysDexie(USER, [
                REMAP,
                {...BASE, old: "さようなら", new: "さようなら (sayounara)"},
            ]),
        ).rejects.toThrow(/forced mid-batch failure/);
        spy.mockRestore();
        // Transaction rolled back -> both rows keep their ORIGINAL keys.
        expect(await keys()).toEqual(["こんにちは", "さようなら"]);
    });
});
