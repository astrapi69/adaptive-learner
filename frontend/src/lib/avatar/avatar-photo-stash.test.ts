/**
 * Tests for the avatar photo stash (#2862): one slot per user
 * holding the photo displaced by a preset figure, tolerant reads,
 * the explicit-storage contract, and the Dexie mirror on the real
 * localStorage.
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
    clearStashedAvatarPhoto,
    readStashedAvatarPhoto,
    stashAvatarPhoto,
} from "./avatar-photo-stash";

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

describe("avatar-photo-stash", () => {
    it("defaults to no stashed photo", () => {
        expect(readStashedAvatarPhoto("u1", fakeStorage())).toBeNull();
    });

    it("round-trips one slot per user and clears it", () => {
        const storage = fakeStorage();
        stashAvatarPhoto("u1", "data:image/jpeg;base64,AAA", storage);
        stashAvatarPhoto("u2", "data:image/jpeg;base64,BBB", storage);
        expect(readStashedAvatarPhoto("u1", storage)).toBe(
            "data:image/jpeg;base64,AAA",
        );
        expect(readStashedAvatarPhoto("u2", storage)).toBe(
            "data:image/jpeg;base64,BBB",
        );
        clearStashedAvatarPhoto("u1", storage);
        expect(readStashedAvatarPhoto("u1", storage)).toBeNull();
        expect(readStashedAvatarPhoto("u2", storage)).toBe(
            "data:image/jpeg;base64,BBB",
        );
    });

    it("a new stash replaces the previous slot", () => {
        const storage = fakeStorage();
        stashAvatarPhoto("u1", "data:image/jpeg;base64,OLD", storage);
        stashAvatarPhoto("u1", "data:image/jpeg;base64,NEW", storage);
        expect(readStashedAvatarPhoto("u1", storage)).toBe(
            "data:image/jpeg;base64,NEW",
        );
    });

    it("tolerates corrupt stored JSON", () => {
        const storage = fakeStorage();
        storage.setItem("adaptive-learner.avatar.photo-stash", "{not json");
        expect(readStashedAvatarPhoto("u1", storage)).toBeNull();
    });

    it("does not mirror to Dexie with an explicit storage override", () => {
        stashAvatarPhoto("u1", "data:image/jpeg;base64,AAA", fakeStorage());
        expect(mirrorUserData).not.toHaveBeenCalled();
    });

    it("mirrors the registered key when writing the real localStorage", () => {
        stashAvatarPhoto("u1", "data:image/jpeg;base64,AAA");
        expect(mirrorUserData).toHaveBeenCalledWith(
            "adaptive-learner.avatar.photo-stash",
            expect.stringContaining("AAA"),
        );
    });
});
