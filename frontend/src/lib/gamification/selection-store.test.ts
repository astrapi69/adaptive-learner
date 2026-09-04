/**
 * Tests for the generic unlockable-selection store factory (#2861):
 * per-user round-trips, tolerant reads, the explicit-storage
 * contract (no Dexie mirror with an override), and the change
 * event consumers subscribe to for live updates.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

const mirrorUserData = vi.fn(
    async (_key: string, _value: string | null) => undefined,
);
vi.mock("../../storage/dexie/dexie-user-data", () => ({
    mirrorUserData: (key: string, value: string | null) =>
        mirrorUserData(key, value),
}));

import {createSelectionStore} from "./selection-store";

const KEY = "adaptive-learner.test.selection";

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

describe("createSelectionStore", () => {
    const store = createSelectionStore(KEY, "plain");

    it("defaults to the given default id with no purchases", () => {
        expect(store.read("u1", fakeStorage())).toEqual({
            selected: "plain",
            purchased: [],
        });
    });

    it("round-trips selection and purchases per user", () => {
        const storage = fakeStorage();
        store.setSelected("u1", "fancy", storage);
        store.addPurchased("u1", "fancy", storage);
        store.addPurchased("u1", "fancy", storage);
        expect(store.read("u1", storage)).toEqual({
            selected: "fancy",
            purchased: ["fancy"],
        });
        expect(store.read("u2", storage).selected).toBe("plain");
    });

    it("tolerates corrupt stored JSON", () => {
        const storage = fakeStorage();
        storage.setItem(KEY, "{not json");
        expect(store.read("u1", storage)).toEqual({
            selected: "plain",
            purchased: [],
        });
    });

    it("does not mirror to Dexie with an explicit storage override", () => {
        store.setSelected("u1", "fancy", fakeStorage());
        expect(mirrorUserData).not.toHaveBeenCalled();
    });

    it("mirrors to Dexie when writing the real localStorage", () => {
        store.setSelected("u1", "fancy");
        expect(mirrorUserData).toHaveBeenCalledWith(
            KEY,
            expect.stringContaining("fancy"),
        );
    });

    it("dispatches its change event on writes", () => {
        const seen = vi.fn();
        window.addEventListener(store.changeEvent, seen);
        try {
            store.setSelected("u1", "fancy", fakeStorage());
            store.addPurchased("u1", "fancy", fakeStorage());
        } finally {
            window.removeEventListener(store.changeEvent, seen);
        }
        expect(seen).toHaveBeenCalledTimes(2);
    });
});
