/**
 * RED-first: the ja/ko/zh recovery core (#2161). Pure detection + plan over a
 * learner's SRS rows and the one-off incident mapping table. Decides which
 * orphaned rows can be re-keyed to the current content (old element_key ->
 * new element_key) so review scheduling resolves again. No double-mapping,
 * no guessing: a row matches only by exact (set_id, lesson_id, exercise_id,
 * old element_key).
 */

import {describe, expect, it} from "vitest";

import {detectRecoverable, type IncidentMapping, type SrsKeyRow} from "./jkz-recovery";

const MAP: IncidentMapping[] = [
    {set_id: "ja-a1-from-de", lesson_id: "01.json", exercise_id: "ex-a", old: "こんにちは", new: "こんにちは (konnichiwa)"},
    {set_id: "ja-a1-from-de", lesson_id: "01.json", exercise_id: "ex-a", old: "さようなら", new: "さようなら (sayounara)"},
    {set_id: "ko-a1-from-de", lesson_id: "02.json", exercise_id: "ex-b", old: "안녕", new: "안녕 (annyeong)"},
];

const row = (over: Partial<SrsKeyRow>): SrsKeyRow => ({
    set_id: "ja-a1-from-de",
    lesson_id: "01.json",
    exercise_id: "ex-a",
    element_key: "こんにちは",
    ...over,
});

describe("detectRecoverable (#2161)", () => {
    it("finds rows whose (set,lesson,exercise,element_key) matches an incident 'old' key", () => {
        const res = detectRecoverable([row({}), row({element_key: "さようなら"})], MAP);
        expect(res.count).toBe(2);
        expect(res.affectedSets).toEqual(["ja-a1-from-de"]);
        expect(res.remaps).toContainEqual({
            set_id: "ja-a1-from-de", lesson_id: "01.json", exercise_id: "ex-a",
            oldKey: "こんにちは", newKey: "こんにちは (konnichiwa)",
        });
    });

    it("ignores rows already on the NEW key (nothing to do) and unrelated rows", () => {
        const res = detectRecoverable(
            [
                row({element_key: "こんにちは (konnichiwa)"}), // already migrated
                row({exercise_id: "ex-other"}), // no mapping
                row({set_id: "en-a1", element_key: "hello"}), // unaffected set
            ],
            MAP,
        );
        expect(res.count).toBe(0);
        expect(res.remaps).toEqual([]);
        expect(res.affectedSets).toEqual([]);
    });

    it("matches strictly on the full tuple (a right key in the wrong lesson does not match)", () => {
        const res = detectRecoverable([row({lesson_id: "99.json"})], MAP);
        expect(res.count).toBe(0);
    });

    it("aggregates affected sets across ja/ko/zh", () => {
        const res = detectRecoverable(
            [row({}), row({set_id: "ko-a1-from-de", lesson_id: "02.json", exercise_id: "ex-b", element_key: "안녕"})],
            MAP,
        );
        expect(res.count).toBe(2);
        expect(res.affectedSets).toEqual(["ja-a1-from-de", "ko-a1-from-de"]);
    });
});
