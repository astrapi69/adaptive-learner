/**
 * reviewPref tests (#599).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    readExplanationsEnabled,
    setExplanationsEnabled,
} from "./reviewPref";

beforeEach(() => localStorage.clear());

describe("reviewPref", () => {
    it("defaults explanations on", () => {
        expect(readExplanationsEnabled()).toBe(true);
    });

    it("round-trips the toggle", () => {
        setExplanationsEnabled(false);
        expect(readExplanationsEnabled()).toBe(false);
        setExplanationsEnabled(true);
        expect(readExplanationsEnabled()).toBe(true);
    });
});
