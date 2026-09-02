/**
 * Tests for the arcade catalog + unlock store (#2887): catalog shape
 * (memory free, snake XP-priced), unlock evaluation through the
 * shared vocabulary, and the purchased round-trip via the store.
 */

import {describe, expect, it} from "vitest";

import {ARCADE_GAMES, ARCADE_SNAKE_COST} from "./arcade-games";
import {
    addPurchasedArcadeGame,
    readArcadeUnlockState,
} from "./arcade-unlock-store";
import {isUnlocked} from "../gamification/unlockables";

function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (k) => map.get(k) ?? null,
        key: (i) => [...map.keys()][i] ?? null,
        removeItem: (k) => void map.delete(k),
        setItem: (k, v) => void map.set(k, v),
    };
}

describe("ARCADE_GAMES", () => {
    it("memory is free, snake costs XP, ids unique", () => {
        expect(new Set(ARCADE_GAMES.map((g) => g.id)).size).toBe(
            ARCADE_GAMES.length,
        );
        const memory = ARCADE_GAMES.find((g) => g.id === "memory");
        const snake = ARCADE_GAMES.find((g) => g.id === "snake");
        expect(memory?.unlock).toEqual({kind: "default"});
        expect(snake?.unlock).toEqual({kind: "xp", cost: ARCADE_SNAKE_COST});
        expect(ARCADE_SNAKE_COST).toBeGreaterThan(0);
    });

    it("snake unlocks through a recorded purchase", () => {
        const storage = memoryStorage();
        const ctx = (purchased: string[]) => ({
            level: 1,
            earnedBadgeKeys: new Set<string>(),
            purchased: new Set(purchased),
        });
        const snake = ARCADE_GAMES.find((g) => g.id === "snake");
        if (!snake) throw new Error("snake missing");
        expect(
            isUnlocked(
                snake.id,
                snake.unlock,
                ctx(readArcadeUnlockState("u1", storage).purchased),
            ),
        ).toBe(false);
        addPurchasedArcadeGame("u1", "snake", storage);
        expect(
            isUnlocked(
                snake.id,
                snake.unlock,
                ctx(readArcadeUnlockState("u1", storage).purchased),
            ),
        ).toBe(true);
    });
});
