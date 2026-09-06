/**
 * Tests for the game-mode tension preferences (#2878): hearts and the
 * per-exercise countdown, both default OFF, with clamped counts. The
 * game-mode gate lives with the consumers (``usePlayfulTension`` +
 * ``usePlayfulMode``), not here (#2964).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {
    DEFAULT_HEARTS_COUNT,
    DEFAULT_COUNTDOWN_SECONDS,
    PLAYFUL_TENSION_CHANGE_EVENT,
    clampHeartsCount,
    clampCountdownSeconds,
    readPlayfulCountdown,
    readPlayfulCountdownSeconds,
    readPlayfulHearts,
    readPlayfulHeartsCount,
    setPlayfulCountdown,
    setPlayfulCountdownSeconds,
    setPlayfulHearts,
    setPlayfulHeartsCount,
} from "./playfulTensionPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulTensionPref", () => {
    it("defaults: both systems off, count 3, 30 seconds", () => {
        expect(readPlayfulHearts()).toBe(false);
        expect(readPlayfulCountdown()).toBe(false);
        expect(readPlayfulHeartsCount()).toBe(DEFAULT_HEARTS_COUNT);
        expect(readPlayfulCountdownSeconds()).toBe(DEFAULT_COUNTDOWN_SECONDS);
        expect(DEFAULT_HEARTS_COUNT).toBe(3);
        expect(DEFAULT_COUNTDOWN_SECONDS).toBe(30);
    });

    it("round-trips the switches and dispatches the change event", () => {
        const seen = vi.fn();
        window.addEventListener(PLAYFUL_TENSION_CHANGE_EVENT, seen);
        try {
            setPlayfulHearts(true);
            setPlayfulCountdown(true);
        } finally {
            window.removeEventListener(PLAYFUL_TENSION_CHANGE_EVENT, seen);
        }
        expect(readPlayfulHearts()).toBe(true);
        expect(readPlayfulCountdown()).toBe(true);
        expect(seen).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["hearts below floor", 0, 1],
        ["hearts above ceiling", 99, 5],
        ["hearts NaN falls back to default", Number.NaN, 3],
    ])("clamps hearts count: %s", (_label, raw, expected) => {
        expect(clampHeartsCount(raw)).toBe(expected);
    });

    it.each([
        ["seconds below floor", 1, 5],
        ["seconds above ceiling", 999, 120],
        ["seconds NaN falls back to default", Number.NaN, 30],
    ])("clamps countdown seconds: %s", (_label, raw, expected) => {
        expect(clampCountdownSeconds(raw)).toBe(expected);
    });

    it("persists clamped values", () => {
        setPlayfulHeartsCount(99);
        setPlayfulCountdownSeconds(1);
        expect(readPlayfulHeartsCount()).toBe(5);
        expect(readPlayfulCountdownSeconds()).toBe(5);
    });
});
