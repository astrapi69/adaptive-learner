/**
 * Tests for word-tiles correctness — Mechanism A (explicit
 * ``accept_orderings``) and Mechanism B (conservative connector-move
 * equivalence).
 *
 * The central guard under test: Mechanism B must accept the documented
 * grammatically-equivalent reordering WITHOUT turning "any permutation is
 * fine" on. The negative cases prove that a meaning-changing or
 * non-connector reorder stays wrong.
 */

import {describe, expect, it} from "vitest";

import {
    equivalentByConnectorMove,
    isWordTilesCorrect,
} from "./word-tiles-equivalence";

// The documented case: "..., aber erinnert sich an den Inhalt" (canonical)
// vs "..., erinnert sich aber an den Inhalt" (the learner's natural German).
const SATZ = ["Quelle,", "aber", "erinnert", "sich", "an", "den", "Inhalt"];
const CANON = [0, 1, 2, 3, 4, 5, 6];
// "aber" (index 1) moves to the other side of the verb cluster "erinnert sich".
const ABER_MOVED = [0, 2, 3, 1, 4, 5, 6];

describe("Mechanism B — reproduction of the documented bug (#word-tiles)", () => {
    it("accepts 'erinnert sich aber' as equivalent to 'aber erinnert sich'", () => {
        expect(isWordTilesCorrect(ABER_MOVED, SATZ, null)).toBe(true);
        expect(equivalentByConnectorMove(ABER_MOVED, CANON, SATZ)).toBe(true);
    });

    it("accepts the connector move on a short clause too ('er kommt aber')", () => {
        const tiles = ["aber", "er", "kommt"]; // "aber er kommt"
        // "er kommt aber" — connector jumps the pronoun+verb cluster.
        expect(isWordTilesCorrect([1, 2, 0], tiles, null)).toBe(true);
    });
});

describe("Happy path — exact orders still score as before", () => {
    it("accepts the exact canonical order", () => {
        expect(isWordTilesCorrect(CANON, SATZ, null)).toBe(true);
    });

    it("rejects a full reversal (meaning destroyed)", () => {
        expect(isWordTilesCorrect([6, 5, 4, 3, 2, 1, 0], SATZ, null)).toBe(
            false,
        );
    });
});

describe("Mechanism A — explicit accept_orderings", () => {
    const tiles = ["I", "really", "love", "you"];
    const accept = [[0, 2, 1, 3]]; // "I love really you"

    it("accepts a listed alternative order", () => {
        expect(isWordTilesCorrect([0, 2, 1, 3], tiles, accept)).toBe(true);
    });

    it("still accepts the canonical order when the field is present", () => {
        expect(isWordTilesCorrect([0, 1, 2, 3], tiles, accept)).toBe(true);
    });

    it("is backward-compatible: WITHOUT the field, a non-canonical order with no connector stays wrong", () => {
        // No accept_orderings, no movable connector among the tiles → only the
        // canonical order is correct (unchanged legacy behaviour).
        expect(isWordTilesCorrect([0, 2, 1, 3], tiles, null)).toBe(false);
        expect(isWordTilesCorrect([0, 2, 1, 3], tiles, undefined)).toBe(false);
    });
});

describe("Mechanism B — strict boundary (NOT every permutation is green)", () => {
    it("rejects a meaning-changing content-word swap even when a connector exists", () => {
        // Swap "den"/"Inhalt" (indices 5/6) — two content words reordered,
        // the connector did not move. Must stay wrong.
        expect(isWordTilesCorrect([0, 1, 2, 3, 4, 6, 5], SATZ, null)).toBe(
            false,
        );
    });

    it("rejects a connector jumping a NOUN (capitalization guard: 'Hund aber kommt')", () => {
        const tiles = ["aber", "Hund", "kommt"]; // "aber Hund kommt"
        expect(isWordTilesCorrect([1, 0, 2], tiles, null)).toBe(false);
    });

    it("rejects a connector jumping a non-verb adverb ('sehr aber schnell')", () => {
        const tiles = ["aber", "sehr", "schnell"]; // "aber sehr schnell"
        expect(isWordTilesCorrect([1, 0, 2], tiles, null)).toBe(false);
    });

    it("rejects a long-range connector jump (span > 2)", () => {
        // Move "aber" (idx 1) far to the right, past 4 tokens.
        const placed = [0, 2, 3, 4, 5, 1, 6];
        expect(isWordTilesCorrect(placed, SATZ, null)).toBe(false);
    });

    it("rejects when more than the connector moved", () => {
        // "aber" moved AND "den"/"Inhalt" swapped — two independent changes.
        const placed = [0, 2, 3, 1, 4, 6, 5];
        expect(isWordTilesCorrect(placed, SATZ, null)).toBe(false);
    });
});

describe("Edge cases — tile-set integrity", () => {
    it("rejects an incomplete placement (missing tile)", () => {
        expect(isWordTilesCorrect([0, 1, 2, 3, 4, 5], SATZ, null)).toBe(false);
    });

    it("rejects a placement longer than the tile set (extra tile)", () => {
        expect(
            isWordTilesCorrect([0, 1, 2, 3, 4, 5, 6, 6], SATZ, null),
        ).toBe(false);
    });

    it("equivalentByConnectorMove returns false when lengths differ", () => {
        expect(equivalentByConnectorMove([0, 1], [0, 1, 2], SATZ)).toBe(false);
    });

    it("equivalentByConnectorMove returns false for an identical order (exact, not B)", () => {
        expect(equivalentByConnectorMove(CANON, CANON, SATZ)).toBe(false);
    });
});
