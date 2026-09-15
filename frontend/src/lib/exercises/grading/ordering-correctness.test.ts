import {describe, expect, it} from "vitest";

import {isOrderingCorrect} from "./ordering-correctness";

describe("isOrderingCorrect (#3110)", () => {
    it("accepts the canonical order", () => {
        expect(isOrderingCorrect([0, 1, 2], 3)).toBe(true);
    });

    it("rejects one swap", () => {
        expect(isOrderingCorrect([1, 0, 2], 3)).toBe(false);
    });

    it("rejects an incomplete sequence", () => {
        expect(isOrderingCorrect([0, 1], 3)).toBe(false);
    });

    it("rejects an empty sequence when items exist", () => {
        expect(isOrderingCorrect([], 3)).toBe(false);
    });

    it("accepts a single-pair canonical order", () => {
        expect(isOrderingCorrect([0, 1], 2)).toBe(true);
    });
});
