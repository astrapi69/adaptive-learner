/**
 * disclosurePref tests (#2959): the persisted open state of a settings
 * disclosure, keyed by the caller, falling back to the given default when
 * nothing usable is stored or the storage throws.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {readDisclosureOpen, writeDisclosureOpen} from "./disclosurePref";

const KEY = "adaptive-learner.settings.test_details_open";

describe("disclosurePref", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("returns the fallback when nothing is stored", () => {
        expect(readDisclosureOpen(KEY, false)).toBe(false);
        expect(readDisclosureOpen(KEY, true)).toBe(true);
    });

    it.each([
        ["open", true],
        ["closed", false],
    ])("round-trips the %s state through localStorage", (_label, open) => {
        writeDisclosureOpen(KEY, open);
        expect(localStorage.getItem(KEY)).toBe(String(open));
        expect(readDisclosureOpen(KEY, !open)).toBe(open);
    });

    it("ignores an unparseable stored value and returns the fallback", () => {
        localStorage.setItem(KEY, "maybe");
        expect(readDisclosureOpen(KEY, true)).toBe(true);
        expect(readDisclosureOpen(KEY, false)).toBe(false);
    });

    it("keys are independent: writing one leaves another at its fallback", () => {
        writeDisclosureOpen(KEY, true);
        expect(readDisclosureOpen(`${KEY}.other`, false)).toBe(false);
    });

    it("falls back to the default when the storage throws on read", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        });
        expect(readDisclosureOpen(KEY, true)).toBe(true);
        expect(readDisclosureOpen(KEY, false)).toBe(false);
    });

    it("swallows a throwing storage on write", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => null,
            setItem: () => {
                throw new Error("quota");
            },
        });
        expect(() => writeDisclosureOpen(KEY, true)).not.toThrow();
    });
});
