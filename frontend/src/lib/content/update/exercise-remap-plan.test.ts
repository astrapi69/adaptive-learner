/**
 * AUTH-05 — the derivation that lifts #2308/#2161/#2519's element-key remap
 * technique one layer up onto ``exercise_id``. Same shape as
 * ``remap-plan.test.ts``, one level higher: an ordered-list-position
 * comparison, certain only when unambiguous, never guessed.
 */

import {describe, expect, it} from "vitest";
import {planExerciseIdRemaps} from "./exercise-remap-plan";
import type {PeekLesson} from "./update-impact";

const SET = "es-a1";
const L = "01.json";

function lesson(exercises: PeekLesson["exercises"]): PeekLesson[] {
    return [{filename: L, exercises}];
}

const identity = (exercise_id: string) => ({lesson_id: L, exercise_id});

describe("planExerciseIdRemaps: the renumbering-at-a-fixed-position case", () => {
    it("maps a renamed exercise slug onto its replacement (same position, no stable_id)", () => {
        const old = lesson([
            {id: "ex-match-1", type: "matching", pairs: [{left: "a", right: "b"}]},
            {id: "ex-free-2", type: "free_text", accept: ["c"]},
        ]);
        const incoming = lesson([
            {id: "ex-match-1", type: "matching", pairs: [{left: "a", right: "b"}]},
            {id: "ex-free-3", type: "free_text", accept: ["c"]},
        ]);
        const plan = planExerciseIdRemaps([identity("ex-free-2")], old, incoming, SET);
        expect(plan.uncertain).toEqual([]);
        expect(plan.certain).toEqual([
            {set_id: SET, lesson_id: L, old: "ex-free-2", new: "ex-free-3"},
        ]);
    });

    it("proposes nothing for a row whose exercise_id still resolves", () => {
        const both = lesson([{id: "ex-1", type: "free_text", accept: ["a"]}]);
        const plan = planExerciseIdRemaps([identity("ex-1")], both, both, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toEqual([]);
    });

    it("skips an exercise that already carries a stable_id (matchesExerciseIdentity resolves it, nothing to lift)", () => {
        const old = lesson([
            {id: "ex-1", stable_id: "stable-a", type: "free_text", accept: ["a"]},
        ]);
        const incoming = lesson([
            // Authored slug renumbered, but the stable_id is unchanged - the
            // exercise still resolves via matchesExerciseIdentity, so this
            // never reaches the position-based fallback at all.
            {id: "ex-2", stable_id: "stable-a", type: "free_text", accept: ["a"]},
        ]);
        const plan = planExerciseIdRemaps([identity("stable-a")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toEqual([]);
    });
});

describe("planExerciseIdRemaps: what must NOT be guessed", () => {
    it("a reordered exercise list is uncertain, never mapped", () => {
        const old = lesson([
            {id: "ex-a", type: "free_text", accept: ["1"]},
            {id: "ex-b", type: "free_text", accept: ["2"]},
        ]);
        const incoming = lesson([
            {id: "ex-b", type: "free_text", accept: ["2"]},
            {id: "ex-c", type: "free_text", accept: ["1"]},
        ]);
        const plan = planExerciseIdRemaps([identity("ex-a")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain).toHaveLength(1);
        expect(plan.uncertain[0].reason).toBe("reordered");
        expect(plan.uncertain[0].candidate).toBe("ex-b");
    });

    it("an inserted exercise is uncertain (length changed), never mapped", () => {
        const old = lesson([
            {id: "ex-a", type: "free_text", accept: ["1"]},
            {id: "ex-b", type: "free_text", accept: ["2"]},
        ]);
        const incoming = lesson([
            {id: "ex-a", type: "free_text", accept: ["1"]},
            {id: "ex-new", type: "free_text", accept: ["9"]},
            {id: "ex-c", type: "free_text", accept: ["2"]},
        ]);
        const plan = planExerciseIdRemaps([identity("ex-b")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("shifted");
    });

    it("a vanished lesson is uncertain, not mapped onto a neighbour", () => {
        const old = lesson([{id: "ex-a", type: "free_text", accept: ["1"]}]);
        const incoming: PeekLesson[] = [{filename: "02.json", exercises: [{id: "ex-a", type: "free_text", accept: ["1"]}]}];
        const plan = planExerciseIdRemaps([identity("ex-a")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("lesson_gone");
    });

    it("a row not present in the cached version either is uncertain", () => {
        const old = lesson([{id: "ex-a", type: "free_text", accept: ["1"]}]);
        const incoming = lesson([{id: "ex-b", type: "free_text", accept: ["1"]}]);
        const plan = planExerciseIdRemaps([identity("ex-ghost")], old, incoming, SET);
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain[0].reason).toBe("not_in_cached");
    });

    it("two rows proposing the same target are both refused (ambiguous_target)", () => {
        const old = lesson([
            {id: "ex-a", type: "free_text", accept: ["1"]},
            {id: "ex-b", type: "free_text", accept: ["2"]},
        ]);
        // Both old exercises collapse onto the SAME incoming exercise id at
        // their respective positions - contrived, but the collision guard
        // must still refuse rather than double-write the same target row.
        const incoming = lesson([
            {id: "ex-x", type: "free_text", accept: ["1"]},
            {id: "ex-x", type: "free_text", accept: ["2"]},
        ]);
        const plan = planExerciseIdRemaps(
            [identity("ex-a"), identity("ex-b")],
            old,
            incoming,
            SET,
        );
        expect(plan.certain).toEqual([]);
        expect(plan.uncertain.map((u) => u.reason)).toEqual([
            "ambiguous_target",
            "ambiguous_target",
        ]);
    });
});
