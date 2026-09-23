/**
 * Tests for the cloze select-mode grader (#3167).
 *
 * A picked option is a member of a fixed list, never a typed answer, so
 * there is no typo to forgive: the verdict is exact membership after the
 * same NFC + trim normalisation ``ClozeMultiSelect`` applies.
 */

import {describe, expect, it} from "vitest";

import {isClozeSelectCorrect, normalizeClozeChoice} from "./cloze-select-grading";

describe("isClozeSelectCorrect", () => {
    const accept = ["<p>Hallo {name}</p>"] as const;

    it("accepts the exact authored answer", () => {
        expect(isClozeSelectCorrect("<p>Hallo {name}</p>", accept)).toBe(true);
    });

    it("accepts any entry of a multi-entry accept list", () => {
        expect(isClozeSelectCorrect("Un", ["un", "Un"])).toBe(true);
    });

    it.each([
        ["one edit away", "<p>Hallo {name}</p>x"],
        ["two edits away (issue repro)", "<p>Hallo $name</p>"],
        ["three edits away", "<p>Hallo %name%</p>"],
    ])("rejects a distractor %s", (_label, distractor) => {
        expect(isClozeSelectCorrect(distractor, accept)).toBe(false);
    });

    it("is case-sensitive", () => {
        expect(isClozeSelectCorrect("usestate", ["useState"])).toBe(false);
    });

    it("treats NFC and NFD spellings of the same option as equal", () => {
        expect(isClozeSelectCorrect("café", ["café"])).toBe(true);
    });

    it("ignores surrounding whitespace only", () => {
        expect(isClozeSelectCorrect("  useState ", ["useState"])).toBe(true);
        expect(isClozeSelectCorrect("use State", ["useState"])).toBe(false);
    });

    it("never accepts an empty pick", () => {
        expect(isClozeSelectCorrect("", ["useState"])).toBe(false);
        expect(isClozeSelectCorrect("   ", ["   "])).toBe(false);
    });
});

describe("normalizeClozeChoice", () => {
    it("NFC-normalises and trims, nothing else", () => {
        expect(normalizeClozeChoice("  café ")).toBe("café");
        expect(normalizeClozeChoice("UseState")).toBe("UseState");
    });
});
