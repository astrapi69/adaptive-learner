/**
 * Tests for the game-mode sound preference (#2875): default off,
 * round-trip + change event, the one-time offer flag, and the
 * combined gate with the game mode itself.
 */

import {beforeEach, describe, expect, it, vi} from "vitest";

import {setPlayfulMode} from "./playfulModePref";
import {
    PLAYFUL_SOUNDS_CHANGE_EVENT,
    markPlayfulSoundsPrompted,
    playfulSoundsActive,
    readPlayfulSounds,
    readPlayfulSoundsPrompted,
    setPlayfulSounds,
} from "./playfulSoundsPref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulSoundsPref", () => {
    it("defaults to off and unprompted", () => {
        expect(readPlayfulSounds()).toBe(false);
        expect(readPlayfulSoundsPrompted()).toBe(false);
    });

    it("round-trips and dispatches the change event", () => {
        const seen = vi.fn();
        window.addEventListener(PLAYFUL_SOUNDS_CHANGE_EVENT, seen);
        try {
            setPlayfulSounds(true);
        } finally {
            window.removeEventListener(PLAYFUL_SOUNDS_CHANGE_EVENT, seen);
        }
        expect(readPlayfulSounds()).toBe(true);
        expect(seen).toHaveBeenCalledTimes(1);
    });

    it("any explicit choice answers the one-time offer", () => {
        setPlayfulSounds(false);
        expect(readPlayfulSoundsPrompted()).toBe(true);
    });

    it("'later' dismisses the offer without enabling sounds", () => {
        markPlayfulSoundsPrompted();
        expect(readPlayfulSoundsPrompted()).toBe(true);
        expect(readPlayfulSounds()).toBe(false);
    });

    it("the gate needs BOTH game mode and its sound flag", () => {
        setPlayfulSounds(true);
        expect(playfulSoundsActive()).toBe(false);
        setPlayfulMode(true);
        expect(playfulSoundsActive()).toBe(true);
        setPlayfulSounds(false);
        expect(playfulSoundsActive()).toBe(false);
    });
});
