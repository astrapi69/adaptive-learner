/**
 * Tests for the seeded option shuffle (#2317).
 *
 * The shuffle exists so a correct answer authored at a fixed position (the
 * shipped content authors the correct picture_choice tile first ~87% of the
 * time) is not positionally predictable at display time. That only holds if
 * the shuffle distributes WELL for near-identical seeds - authored content ids
 * share long prefixes (``ex-pick-morning`` / ``ex-pick-evening``). These tests
 * pin the distribution property, not a specific order.
 */

import {describe, expect, it} from "vitest";

import {seededShuffle} from "./seeded-shuffle";

describe("seededShuffle: determinism + stability", () => {
    it("returns the same order for the same seed", () => {
        const a = seededShuffle([0, 1, 2, 3], "ex-pick-morning");
        const b = seededShuffle([0, 1, 2, 3], "ex-pick-morning");
        expect(b).toEqual(a);
    });

    it("does not mutate the input array", () => {
        const input = [0, 1, 2, 3];
        seededShuffle(input, "seed");
        expect(input).toEqual([0, 1, 2, 3]);
    });

    it("preserves the multiset of items (a permutation)", () => {
        const out = seededShuffle(["a", "b", "c", "d", "e"], "x");
        expect([...out].sort()).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("handles 0- and 1-element lists", () => {
        expect(seededShuffle([], "s")).toEqual([]);
        expect(seededShuffle([42], "s")).toEqual([42]);
    });
});

describe("seededShuffle: distribution for near-identical seeds (#2317)", () => {
    /** The position a fixed 'correct' element (index 0) lands at, over many
     *  seeds that share a long common prefix - the shape of real content ids. */
    function positionsOfFirstElement(prefix: string, count: number): number[] {
        const positions: number[] = [];
        for (let i = 0; i < count; i++) {
            const order = seededShuffle([0, 1, 2, 3], `${prefix}-${i}`);
            positions.push(order.indexOf(0));
        }
        return positions;
    }

    it("does not pin the first-authored element to one display position", () => {
        const positions = positionsOfFirstElement("ex-pick", 200);
        const distinct = new Set(positions);
        // The reported bug: the correct answer always at the same position.
        // A working shuffle reaches every one of the 4 slots.
        expect(distinct).toEqual(new Set([0, 1, 2, 3]));
    });

    it("spreads a first-authored element roughly evenly across positions", () => {
        const positions = positionsOfFirstElement("ex-pick", 400);
        const counts = [0, 0, 0, 0];
        for (const p of positions) counts[p]++;
        // Each of the 4 slots should hold a healthy share (ideal 25% = 100).
        // A generous floor of 10% guards against the low-bit funnel
        // regression (which pushed ~87% onto a single slot) without being
        // flaky on the deterministic sequence.
        for (const c of counts) {
            expect(c).toBeGreaterThan(400 * 0.1);
        }
    });

    it("also distributes for numeric-prefixed lesson ids", () => {
        // Lesson ids like 01-..., 02-... are another near-identical family.
        const positions: number[] = [];
        for (let i = 1; i <= 200; i++) {
            const id = `${String(i).padStart(2, "0")}-greeting`;
            positions.push(seededShuffle([0, 1, 2, 3], id).indexOf(0));
        }
        expect(new Set(positions)).toEqual(new Set([0, 1, 2, 3]));
    });
});
