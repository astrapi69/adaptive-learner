/**
 * Tests for the avatar-frame store (#2850): default state, select and
 * purchase round-trips, per-user isolation, tolerant reads, and the
 * explicit-storage contract (no Dexie mirror with an override).
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
    addPurchasedAvatarFrame,
    readAvatarFrameState,
    setSelectedAvatarFrame,
} from "./avatar-frame-store";

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

describe("avatar-frame-store", () => {
    it("defaults to the none frame with no purchases", () => {
        const state = readAvatarFrameState("u1", fakeStorage());
        expect(state).toEqual({selected: "none", purchased: []});
    });

    it("round-trips a selection per user", () => {
        const storage = fakeStorage();
        setSelectedAvatarFrame("u1", "gold", storage);
        expect(readAvatarFrameState("u1", storage).selected).toBe("gold");
        expect(readAvatarFrameState("u2", storage).selected).toBe("none");
    });

    it("accumulates purchases without duplicates", () => {
        const storage = fakeStorage();
        addPurchasedAvatarFrame("u1", "star", storage);
        addPurchasedAvatarFrame("u1", "accent", storage);
        addPurchasedAvatarFrame("u1", "star", storage);
        expect(readAvatarFrameState("u1", storage).purchased).toEqual([
            "star",
            "accent",
        ]);
    });

    it("tolerates corrupt stored JSON", () => {
        const storage = fakeStorage();
        storage.setItem("adaptive-learner.avatar.frames", "{not json");
        expect(readAvatarFrameState("u1", storage)).toEqual({
            selected: "none",
            purchased: [],
        });
    });

    it("drops malformed entries but keeps valid ones", () => {
        const storage = fakeStorage();
        storage.setItem(
            "adaptive-learner.avatar.frames",
            JSON.stringify({
                u1: {selected: "gold", purchased: ["star"]},
                u2: {selected: 5, purchased: "nope"},
            }),
        );
        expect(readAvatarFrameState("u1", storage).selected).toBe("gold");
        expect(readAvatarFrameState("u2", storage)).toEqual({
            selected: "none",
            purchased: [],
        });
    });

    it("does not mirror to Dexie with an explicit storage override", () => {
        setSelectedAvatarFrame("u1", "gold", fakeStorage());
        expect(mirrorUserData).not.toHaveBeenCalled();
    });

    it("mirrors to Dexie when writing the real localStorage", () => {
        setSelectedAvatarFrame("u1", "gold");
        expect(mirrorUserData).toHaveBeenCalledWith(
            "adaptive-learner.avatar.frames",
            expect.stringContaining("gold"),
        );
    });
});
