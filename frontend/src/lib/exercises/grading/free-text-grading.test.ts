/**
 * Tests for the free-text grader (#1877).
 *
 * Extracted verbatim — together with the grader itself — from
 * ``FreeTextExercise.test.tsx`` into ``lib/exercises/grading/`` so the
 * behaviour pins live next to the pure functions. The ``describe`` blocks are
 * byte-identical to their pre-extraction form; only the import path moved.
 */

import {describe, expect, it} from "vitest";

import {isFreeTextCorrect, isFreeTextNearMiss} from "./free-text-grading";

describe("isFreeTextCorrect (matcher)", () => {
    const accept = ["Merci"] as const;

    it("matches exact authored entry", () => {
        expect(isFreeTextCorrect("Merci", accept)).toBe(true);
    });

    it("matches case-insensitively", () => {
        expect(isFreeTextCorrect("MERCI", accept)).toBe(true);
        expect(isFreeTextCorrect("merci", accept)).toBe(true);
        expect(isFreeTextCorrect("MeRcI", accept)).toBe(true);
    });

    it("trims surrounding whitespace before comparing", () => {
        expect(isFreeTextCorrect("  merci  ", accept)).toBe(true);
        expect(isFreeTextCorrect("\tmerci\n", accept)).toBe(true);
    });

    it("normalises NFC variants", () => {
        // 'é' as combining sequence (U+0065 U+0301) vs precomposed U+00E9
        expect(
            isFreeTextCorrect("café", ["café"]),
        ).toBe(true);
    });

    it("accepts single-edit typos (Levenshtein <= 1)", () => {
        expect(isFreeTextCorrect("Mercii", accept)).toBe(true); // insertion
        expect(isFreeTextCorrect("Merc", accept)).toBe(true); // deletion
        expect(isFreeTextCorrect("Mercy", accept)).toBe(true); // substitution
    });

    it("rejects answers more than one edit away", () => {
        expect(isFreeTextCorrect("Mer", accept)).toBe(false); // 2 deletes
        expect(isFreeTextCorrect("Marcy", accept)).toBe(false); // 2 substitutions
        // "Mercii!" moved to the sentence-answer suite (#1580): the trailing
        // "!" is normalized away, leaving a single accepted typo.
        expect(isFreeTextCorrect("Mercii!", accept)).toBe(true);
    });

    it("rejects empty / whitespace-only input even with a permissive accept list", () => {
        expect(isFreeTextCorrect("", accept)).toBe(false);
        expect(isFreeTextCorrect("   ", accept)).toBe(false);
        expect(isFreeTextCorrect("\n\t", accept)).toBe(false);
    });

    it("matches against any entry in a multi-entry accept list", () => {
        const multi = ["Bonjour", "Salut"];
        expect(isFreeTextCorrect("bonjour", multi)).toBe(true);
        expect(isFreeTextCorrect("salut", multi)).toBe(true);
        expect(isFreeTextCorrect("salu", multi)).toBe(true); // 1 edit from "salut"
        expect(isFreeTextCorrect("hola", multi)).toBe(false);
    });

    it("returns false when accept list is empty", () => {
        expect(isFreeTextCorrect("anything", [])).toBe(false);
    });
});

describe("isFreeTextCorrect (sentence answers, #1580)", () => {
    // Repro (#1580): sentence-length answers were graded with the same rigid
    // 1-edit budget as single words, and the normalizer knew nothing about
    // punctuation, curly apostrophes, or inner whitespace - so a correct
    // sentence typed on a mobile keyboard could fail on two harmless slips.
    const accept = ["J'ai faim."] as const;

    it("repro #1580: curly apostrophe + missing final period is correct", () => {
        // iOS/Android keyboards emit U+2019; the period is content-free.
        expect(isFreeTextCorrect("J\u2019ai faim", accept)).toBe(true);
    });

    it("happy path: exact sentence and single-typo sentence stay correct", () => {
        expect(isFreeTextCorrect("J'ai faim.", accept)).toBe(true);
        expect(
            isFreeTextCorrect("Ich gehe nach Huase", ["Ich gehe nach Hause."]),
        ).toBe(true); // transposed u/a = 2 substitutions, within the sentence budget
    });

    it("edge: doubled inner whitespace and missing period is correct", () => {
        expect(
            isFreeTextCorrect("Ich gehe  nach Hause", ["Ich gehe nach Hause."]),
        ).toBe(true);
    });

    it("edge: terminal punctuation is equivalent in both directions", () => {
        expect(isFreeTextCorrect("Wie geht's?", ["Wie geht's"])).toBe(true);
        expect(isFreeTextCorrect("Wie geht's", ["Wie geht's?"])).toBe(true);
    });

    it("boundary: short answers keep the strict single-edit budget", () => {
        // The sentence budget must not leak into single words (D1 intact).
        expect(isFreeTextCorrect("Marcy", ["Merci"])).toBe(false);
        expect(isFreeTextCorrect("Mer", ["Merci"])).toBe(false);
    });

    it("boundary: a genuinely different sentence stays wrong", () => {
        expect(
            isFreeTextCorrect("Ich fahre nach Berlin", ["Ich gehe nach Hause."]),
        ).toBe(false);
    });

    it("boundary: code mode keeps the 1-edit budget regardless of length", () => {
        // println vs print is 2 edits - must stay wrong even though the
        // candidate is sentence-length.
        expect(
            isFreeTextCorrect(
                "println('Hallo Welt')",
                ["print('Hallo Welt')"],
                true,
            ),
        ).toBe(false);
    });
});

describe("isFreeTextCorrect (code mode, schema v1.3)", () => {
    const accept = ["print('Hallo Welt')"] as const;

    it("tolerates whitespace differences", () => {
        expect(isFreeTextCorrect("print( 'Hallo Welt' )", accept, true)).toBe(
            true,
        );
        expect(isFreeTextCorrect("print('Hallo Welt')", accept, true)).toBe(
            true,
        );
    });

    it("treats single and double quotes as equivalent", () => {
        expect(isFreeTextCorrect('print("Hallo Welt")', accept, true)).toBe(
            true,
        );
    });

    it("is case-sensitive (code is)", () => {
        // Plain mode would accept this; code mode must not.
        expect(isFreeTextCorrect("PRINT('Hallo Welt')", accept, true)).toBe(
            false,
        );
        expect(isFreeTextCorrect("PRINT('Hallo Welt')", accept, false)).toBe(
            true,
        );
    });

    it("rejects genuinely different code", () => {
        expect(isFreeTextCorrect("println('Hallo Welt')", accept, true)).toBe(
            false,
        );
    });
});

describe("isFreeTextNearMiss (#627)", () => {
    const accept = ["Merci"] as const;

    it("is true for a wrong answer within 2 edits", () => {
        expect(isFreeTextNearMiss("Mercxy", accept)).toBe(true);
    });

    it("is false for an accepted answer (already correct)", () => {
        expect(isFreeTextNearMiss("Merci", accept)).toBe(false);
        // ≤1-edit typo is accepted, so not a "near miss".
        expect(isFreeTextNearMiss("Merc", accept)).toBe(false);
    });

    it("is false for a far miss", () => {
        expect(isFreeTextNearMiss("banana", accept)).toBe(false);
    });

    it("is false for empty input", () => {
        expect(isFreeTextNearMiss("", accept)).toBe(false);
    });
});

