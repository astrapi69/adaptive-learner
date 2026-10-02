import {describe, expect, it} from "vitest";

import {diagnoseParsonsLines, isParsonsCorrect} from "./parsons-correctness";

const LINES = [
    {code: "def greet(name):", indent: 0},
    {code: "if name:", indent: 1},
    {code: "print(name)", indent: 2},
];

describe("isParsonsCorrect (#3110)", () => {
    it("accepts the canonical order at the canonical indents", () => {
        expect(isParsonsCorrect([0, 1, 2], [0, 1, 2], LINES)).toBe(true);
    });

    it("rejects the right order at the wrong indent", () => {
        expect(isParsonsCorrect([0, 1, 2], [0, 1, 1], LINES)).toBe(false);
    });

    it("rejects the wrong order even at correct per-tile indents", () => {
        // Tile 2 (indent 2) and tile 1 (indent 1) swapped — order wrong.
        expect(isParsonsCorrect([0, 2, 1], [0, 2, 1], LINES)).toBe(false);
    });

    it("rejects an incomplete sequence", () => {
        expect(isParsonsCorrect([0, 1], [0, 1], LINES)).toBe(false);
    });

    it("rejects mismatched placed/indents lengths", () => {
        expect(isParsonsCorrect([0, 1, 2], [0, 1], LINES)).toBe(false);
    });
});

describe("diagnoseParsonsLines (#3218)", () => {
    it.each([
        ["all correct", [0, 1, 2], [0, 1, 2], ["correct", "correct", "correct"]],
        ["right order, flat indents", [0, 1, 2], [0, 0, 0], ["correct", "wrong_indent", "wrong_indent"]],
        ["two lines swapped", [0, 2, 1], [0, 2, 1], ["correct", "wrong_position", "wrong_position"]],
        ["position wins over indent", [1, 0, 2], [0, 0, 2], ["wrong_position", "wrong_position", "correct"]],
    ])("%s", (_name, placed, indents, expected) => {
        const diagnosis = diagnoseParsonsLines(placed, indents, LINES);
        expect(diagnosis.map((line) => line.status)).toEqual(expected);
    });

    it("carries the code, the chosen and the expected indent per slot", () => {
        expect(diagnoseParsonsLines([0, 1, 2], [0, 0, 2], LINES)[1]).toEqual({
            code: "if name:",
            indent: 0,
            expectedIndent: 1,
            status: "wrong_indent",
        });
    });
});
