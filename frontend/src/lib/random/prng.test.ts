/**
 * Golden pins for the one mulberry32 + FNV-1a implementation (#3214).
 *
 * The vectors were captured from the ``missions/generator.ts`` copies BEFORE
 * they moved here. Daily mission assignment, every seeded option shuffle and
 * the visual random pin all draw from these functions, so the move has to be
 * bit-identical: a single changed output re-rolls missions for every user and
 * moves every option-order baseline.
 */

import {describe, expect, it} from "vitest";

import {fnv1a32, mulberry32} from "./prng";

describe("fnv1a32: golden hashes", () => {
    it.each([
        {input: "", expected: 2166136261},
        {input: "user-1:2026-06-10:balanced", expected: 57320477},
        {input: "shuffle-order", expected: 1865665899},
    ])("hashes $input to its pre-move value", ({input, expected}) => {
        expect(fnv1a32(input)).toBe(expected);
    });
});

describe("mulberry32: golden sequences", () => {
    it.each([
        {
            input: "",
            expected: [
                0.6112444521859288, 0.4935242917854339, 0.7740248835179955,
                0.4122861116193235, 0.8122657814528793,
            ],
        },
        {
            input: "user-1:2026-06-10:balanced",
            expected: [
                0.7173360858578235, 0.41563933016732335, 0.4171661864966154,
                0.5938866978976876, 0.4136062003672123,
            ],
        },
        {
            input: "shuffle-order",
            expected: [
                0.8442326427903026, 0.8502601834479719, 0.8307446704711765,
                0.9268239855300635, 0.6144277611747384,
            ],
        },
    ])("seed fnv1a32($input) yields its pre-move first five draws", ({input, expected}) => {
        const next = mulberry32(fnv1a32(input));
        expect([next(), next(), next(), next(), next()]).toEqual(expected);
    });

    it("stays inside [0, 1) and never shares state between generators", () => {
        const first = mulberry32(7);
        const second = mulberry32(7);
        const drawn = Array.from({length: 1000}, () => first());
        expect(drawn.every((value) => value >= 0 && value < 1)).toBe(true);
        expect(second()).toBe(drawn[0]);
    });
});
