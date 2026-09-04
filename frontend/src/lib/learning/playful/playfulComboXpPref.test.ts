/**
 * Tests for the combo-bonus-XP preference (#2893): DEFAULT ON (the
 * decided feature), disable round-trip, clamped cap, and the combined
 * gate with the game mode.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    DEFAULT_COMBO_XP_CAP,
    comboBonusForRun,
    PLAYFUL_COMBO_XP_CHANGE_EVENT,
    clampComboXpCap,
    playfulComboXpActive,
    readComboXpCap,
    readPlayfulComboXp,
    setComboXpCap,
    setPlayfulComboXp,
} from "./playfulComboXpPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulComboXpPref", () => {
    it("defaults ON with cap 10", () => {
        expect(readPlayfulComboXp()).toBe(true);
        expect(readComboXpCap()).toBe(DEFAULT_COMBO_XP_CAP);
        expect(DEFAULT_COMBO_XP_CAP).toBe(10);
    });

    it("disable round-trips and dispatches the change event", () => {
        const seen = vi.fn();
        window.addEventListener(PLAYFUL_COMBO_XP_CHANGE_EVENT, seen);
        try {
            setPlayfulComboXp(false);
        } finally {
            window.removeEventListener(PLAYFUL_COMBO_XP_CHANGE_EVENT, seen);
        }
        expect(readPlayfulComboXp()).toBe(false);
        expect(seen).toHaveBeenCalledTimes(1);
        setPlayfulComboXp(true);
        expect(readPlayfulComboXp()).toBe(true);
    });

    it.each([
        ["below floor", 1, 5],
        ["above ceiling", 99, 20],
        ["NaN falls back to default", Number.NaN, 10],
    ])("clamps the cap: %s", (_label, raw, expected) => {
        expect(clampComboXpCap(raw)).toBe(expected);
    });

    it("persists a clamped cap", () => {
        setComboXpCap(99);
        expect(readComboXpCap()).toBe(20);
    });

    it("the gate needs game mode AND the switch not disabled", () => {
        expect(playfulComboXpActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulComboXpActive()).toBe(true);
        setPlayfulComboXp(false);
        expect(playfulComboXpActive()).toBe(false);
    });
});

describe("comboBonusForRun", () => {
    it("caps at the configured limit and gates on game mode", () => {
        expect(comboBonusForRun(7)).toBe(0);
        setPlayfulMode(true);
        expect(comboBonusForRun(7)).toBe(7);
        expect(comboBonusForRun(15)).toBe(10);
        setComboXpCap(5);
        expect(comboBonusForRun(15)).toBe(5);
        setPlayfulComboXp(false);
        expect(comboBonusForRun(15)).toBe(0);
    });
});
