/**
 * Tests for the game-mode bonus-lessons preference (#2890): default
 * ON, the round-trip, the combined game-mode gate, and the change
 * event.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    PLAYFUL_BONUS_CHANGE_EVENT,
    playfulBonusActive,
    readPlayfulBonus,
    setPlayfulBonus,
} from "./playfulBonusPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulBonusPref", () => {
    it("defaults ON", () => {
        expect(readPlayfulBonus()).toBe(true);
    });

    it("round-trips the switch and fires the change event", () => {
        const listener = vi.fn();
        window.addEventListener(PLAYFUL_BONUS_CHANGE_EVENT, listener);
        setPlayfulBonus(false);
        expect(readPlayfulBonus()).toBe(false);
        setPlayfulBonus(true);
        expect(readPlayfulBonus()).toBe(true);
        window.removeEventListener(PLAYFUL_BONUS_CHANGE_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("the gate needs the game mode AND the switch", () => {
        expect(playfulBonusActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulBonusActive()).toBe(true);
        setPlayfulBonus(false);
        expect(playfulBonusActive()).toBe(false);
    });
});
