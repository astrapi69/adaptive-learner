/**
 * Tests for the mascot-variant store (#2861): the per-store
 * contract on top of the shared factory - key name, funke default,
 * and the Dexie mirror on the real localStorage.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

const mirrorUserData = vi.fn(
    async (_key: string, _value: string | null) => undefined,
);
vi.mock("../../storage/dexie/dexie-user-data", () => ({
    mirrorUserData: (key: string, value: string | null) =>
        mirrorUserData(key, value),
}));

import {
    MASCOT_VARIANT_CHANGE_EVENT,
    addPurchasedMascotVariant,
    readMascotVariantState,
    setSelectedMascotVariant,
} from "./mascot-variant-store";

function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: () => null,
        length: 0,
    } as Storage;
}

beforeEach(() => {
    localStorage.clear();
    mirrorUserData.mockClear();
});

describe("mascot-variant-store", () => {
    it("defaults to the funke variant with no purchases", () => {
        expect(readMascotVariantState("u1", fakeStorage())).toEqual({
            selected: "funke",
            purchased: [],
        });
    });

    it("round-trips selection and purchases per user", () => {
        const storage = fakeStorage();
        setSelectedMascotVariant("u1", "wald", storage);
        addPurchasedMascotVariant("u1", "gold", storage);
        expect(readMascotVariantState("u1", storage)).toEqual({
            selected: "wald",
            purchased: ["gold"],
        });
        expect(readMascotVariantState("u2", storage).selected).toBe("funke");
    });

    it("mirrors the registered key when writing the real localStorage", () => {
        setSelectedMascotVariant("u1", "ozean");
        expect(mirrorUserData).toHaveBeenCalledWith(
            "adaptive-learner.mascot.variants",
            expect.stringContaining("ozean"),
        );
    });

    it("names a change event for live consumers", () => {
        expect(MASCOT_VARIANT_CHANGE_EVENT).toBe(
            "adaptive-learner.mascot.variants:changed",
        );
    });
});
