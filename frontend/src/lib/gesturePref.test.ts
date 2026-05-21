/**
 * gesturePref tests (Phase 23E).
 */

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
    GESTURE_PREF_KEYS,
    markGestureHintShown,
    readGestureHintShown,
    readGesturePref,
    writeGesturePref,
} from "./gesturePref";

describe("gesturePref", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("read returns the persisted value when explicitly set to true", () => {
        writeGesturePref(true);
        expect(readGesturePref()).toBe(true);
    });

    it("read returns the persisted value when explicitly set to false", () => {
        writeGesturePref(false);
        expect(readGesturePref()).toBe(false);
    });

    it("write persists under the canonical key", () => {
        writeGesturePref(true);
        expect(localStorage.getItem(GESTURE_PREF_KEYS.enabled)).toBe("true");
        writeGesturePref(false);
        expect(localStorage.getItem(GESTURE_PREF_KEYS.enabled)).toBe("false");
    });

    it("default falls back to touch detection when nothing persisted", () => {
        // happy-dom: navigator.maxTouchPoints is undefined by default.
        // Without an explicit pref, the helper returns false.
        const original = (navigator as unknown as {maxTouchPoints?: number})
            .maxTouchPoints;
        Object.defineProperty(navigator, "maxTouchPoints", {
            configurable: true,
            value: 0,
        });
        expect(readGesturePref()).toBe(false);
        Object.defineProperty(navigator, "maxTouchPoints", {
            configurable: true,
            value: 5,
        });
        expect(readGesturePref()).toBe(true);
        Object.defineProperty(navigator, "maxTouchPoints", {
            configurable: true,
            value: original ?? 0,
        });
    });

    it("hintShown starts false + flips after markGestureHintShown", () => {
        expect(readGestureHintShown()).toBe(false);
        markGestureHintShown();
        expect(readGestureHintShown()).toBe(true);
        expect(localStorage.getItem(GESTURE_PREF_KEYS.hintShown)).toBe("true");
    });

    it("invalid persisted value falls through to default", () => {
        localStorage.setItem(GESTURE_PREF_KEYS.enabled, "maybe");
        // Same as no value → touch detection.
        Object.defineProperty(navigator, "maxTouchPoints", {
            configurable: true,
            value: 0,
        });
        expect(readGesturePref()).toBe(false);
    });
});
