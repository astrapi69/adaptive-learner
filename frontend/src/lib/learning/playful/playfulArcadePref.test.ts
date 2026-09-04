/**
 * Tests for the arcade preference (#2887): switch DEFAULT ON, the
 * combined gate with the game mode, and the clamped number settings
 * (snake round seconds, memory pair count).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    DEFAULT_MEMORY_PAIRS,
    DEFAULT_SIMON_TARGET,
    DEFAULT_SNAKE_SECONDS,
    PLAYFUL_ARCADE_CHANGE_EVENT,
    clampMemoryPairs,
    clampSimonTarget,
    clampSnakeSeconds,
    playfulArcadeActive,
    readMemoryPairs,
    readPlayfulArcade,
    readSimonTarget,
    readSnakeSeconds,
    setMemoryPairs,
    setPlayfulArcade,
    setSimonTarget,
    setSnakeSeconds,
} from "./playfulArcadePref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulArcadePref", () => {
    it("defaults ON with snake 60s, 8 memory pairs, simon target 8", () => {
        expect(readPlayfulArcade()).toBe(true);
        expect(readSnakeSeconds()).toBe(DEFAULT_SNAKE_SECONDS);
        expect(readMemoryPairs()).toBe(DEFAULT_MEMORY_PAIRS);
        expect(readSimonTarget()).toBe(DEFAULT_SIMON_TARGET);
        expect(DEFAULT_SNAKE_SECONDS).toBe(60);
        expect(DEFAULT_MEMORY_PAIRS).toBe(8);
        expect(DEFAULT_SIMON_TARGET).toBe(8);
    });

    it("disable round-trips and dispatches the change event", () => {
        const seen = vi.fn();
        window.addEventListener(PLAYFUL_ARCADE_CHANGE_EVENT, seen);
        try {
            setPlayfulArcade(false);
        } finally {
            window.removeEventListener(PLAYFUL_ARCADE_CHANGE_EVENT, seen);
        }
        expect(readPlayfulArcade()).toBe(false);
        expect(seen).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["snake below floor", clampSnakeSeconds, 5, 30],
        ["snake above ceiling", clampSnakeSeconds, 999, 120],
        ["snake NaN falls back", clampSnakeSeconds, Number.NaN, 60],
        ["pairs below floor", clampMemoryPairs, 1, 4],
        ["pairs above ceiling", clampMemoryPairs, 50, 12],
        ["pairs NaN falls back", clampMemoryPairs, Number.NaN, 8],
        ["simon below floor", clampSimonTarget, 1, 5],
        ["simon above ceiling", clampSimonTarget, 99, 15],
        ["simon NaN falls back", clampSimonTarget, Number.NaN, 8],
    ] as const)("clamps: %s", (_label, clamp, raw, expected) => {
        expect(clamp(raw)).toBe(expected);
    });

    it("persists clamped values", () => {
        setSnakeSeconds(999);
        setMemoryPairs(1);
        setSimonTarget(99);
        expect(readSnakeSeconds()).toBe(120);
        expect(readMemoryPairs()).toBe(4);
        expect(readSimonTarget()).toBe(15);
    });

    it("the gate needs game mode AND the switch not disabled", () => {
        expect(playfulArcadeActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulArcadeActive()).toBe(true);
        setPlayfulArcade(false);
        expect(playfulArcadeActive()).toBe(false);
    });
});
