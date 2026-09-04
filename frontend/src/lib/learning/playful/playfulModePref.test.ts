/**
 * Tests for the playful-mode (Spielmodus) preference store (#2844):
 * default-off round-trip, corrupt-value fallback, the same-tab change
 * event, and the lesson-start hint dismissal flag.
 */

import {describe, expect, it, beforeEach, vi} from "vitest";

import {
    DEFAULT_PLAYFUL_MODE,
    dismissPlayfulHint,
    PLAYFUL_MODE_CHANGE_EVENT,
    readPlayfulHintDismissed,
    readPlayfulMode,
    setPlayfulMode,
} from "./playfulModePref";

beforeEach(() => {
    localStorage.clear();
});

describe("playfulModePref — mode flag", () => {
    it("defaults to OFF", () => {
        expect(DEFAULT_PLAYFUL_MODE).toBe(false);
        expect(readPlayfulMode()).toBe(false);
    });

    it("round-trips on and off", () => {
        setPlayfulMode(true);
        expect(readPlayfulMode()).toBe(true);
        setPlayfulMode(false);
        expect(readPlayfulMode()).toBe(false);
    });

    it.each([
        ["corrupt string", "yes"],
        ["empty string", ""],
        ["number-ish", "1"],
    ])("falls back to OFF for a %s stored value", (_name, raw) => {
        localStorage.setItem("adaptive-learner.lesson.playful_mode", raw);
        expect(readPlayfulMode()).toBe(false);
    });

    it("dispatches the change event on write (same-tab live update)", () => {
        const listener = vi.fn();
        window.addEventListener(PLAYFUL_MODE_CHANGE_EVENT, listener);
        setPlayfulMode(true);
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(PLAYFUL_MODE_CHANGE_EVENT, listener);
    });
});

describe("playfulModePref — lesson-start hint", () => {
    it("hint is not dismissed by default", () => {
        expect(readPlayfulHintDismissed()).toBe(false);
    });

    it("dismissal persists", () => {
        dismissPlayfulHint();
        expect(readPlayfulHintDismissed()).toBe(true);
    });
});
