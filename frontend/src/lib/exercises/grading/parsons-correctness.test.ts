import {describe, expect, it} from "vitest";

import {isParsonsCorrect} from "./parsons-correctness";

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
