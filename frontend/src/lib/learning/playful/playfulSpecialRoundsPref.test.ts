/**
 * Tests for the special-rounds preference (#2888): switch DEFAULT ON,
 * the combined gate with the game mode, and the clamped flash-round
 * card count (5-20, default 10).
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    DEFAULT_FLASH_ROUND_CARDS,
    PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
    clampFlashRoundCards,
    playfulSpecialRoundsActive,
    readFlashRoundCards,
    readPlayfulSpecialRounds,
    setFlashRoundCards,
    setPlayfulSpecialRounds,
} from "./playfulSpecialRoundsPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulSpecialRoundsPref", () => {
    it("defaults ON with 10 flash-round cards", () => {
        expect(readPlayfulSpecialRounds()).toBe(true);
        expect(readFlashRoundCards()).toBe(DEFAULT_FLASH_ROUND_CARDS);
        expect(DEFAULT_FLASH_ROUND_CARDS).toBe(10);
    });

    it("disable round-trips and dispatches the change event", () => {
        const seen = vi.fn();
        window.addEventListener(PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT, seen);
        try {
            setPlayfulSpecialRounds(false);
        } finally {
            window.removeEventListener(
                PLAYFUL_SPECIAL_ROUNDS_CHANGE_EVENT,
                seen,
            );
        }
        expect(readPlayfulSpecialRounds()).toBe(false);
        expect(seen).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["below floor", 1, 5],
        ["above ceiling", 99, 20],
        ["NaN falls back", Number.NaN, 10],
    ] as const)("clamps the card count: %s", (_label, raw, expected) => {
        expect(clampFlashRoundCards(raw)).toBe(expected);
    });

    it("persists a clamped card count", () => {
        setFlashRoundCards(99);
        expect(readFlashRoundCards()).toBe(20);
    });

    it("the gate needs game mode AND the switch not disabled", () => {
        expect(playfulSpecialRoundsActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulSpecialRoundsActive()).toBe(true);
        setPlayfulSpecialRounds(false);
        expect(playfulSpecialRoundsActive()).toBe(false);
    });
});
