/**
 * hintPref unit tests (#590).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    DEFAULT_HINT_XP_COST,
    clampHintXpCost,
    readHintXpCost,
    readHintsEnabled,
    setHintXpCost,
    setHintsEnabled,
} from "./hintPref";

beforeEach(() => localStorage.clear());

describe("hintPref", () => {
    it("defaults to enabled with the default cost", () => {
        expect(readHintsEnabled()).toBe(true);
        expect(readHintXpCost()).toBe(DEFAULT_HINT_XP_COST);
    });

    it("round-trips the enabled flag", () => {
        setHintsEnabled(false);
        expect(readHintsEnabled()).toBe(false);
        setHintsEnabled(true);
        expect(readHintsEnabled()).toBe(true);
    });

    it("clamps the XP cost to 0..50 integers", () => {
        expect(clampHintXpCost(60)).toBe(50);
        expect(clampHintXpCost(-5)).toBe(0);
        expect(clampHintXpCost(3.7)).toBe(4);
        expect(clampHintXpCost(Number.NaN)).toBe(DEFAULT_HINT_XP_COST);
    });

    it("round-trips the XP cost (clamped)", () => {
        setHintXpCost(8);
        expect(readHintXpCost()).toBe(8);
        setHintXpCost(999);
        expect(readHintXpCost()).toBe(50);
    });
});
