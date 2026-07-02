/**
 * Auto-advance preference (#1330). Default OFF (opt-in), localStorage-backed
 * so it survives a reload and works in both storage modes.
 */

import {afterEach, describe, expect, it} from "vitest";

import {
    DEFAULT_LESSON_AUTO_ADVANCE_ENABLED,
    readLessonAutoAdvanceEnabled,
    setLessonAutoAdvanceEnabled,
} from "./useLessonAutoAdvance";

describe("lesson auto-advance preference (#1330)", () => {
    afterEach(() => localStorage.clear());

    it("defaults to OFF (opt-in)", () => {
        expect(DEFAULT_LESSON_AUTO_ADVANCE_ENABLED).toBe(false);
        expect(readLessonAutoAdvanceEnabled()).toBe(false);
    });

    it("persists an enabled choice (survives a reload)", () => {
        setLessonAutoAdvanceEnabled(true);
        // A fresh read (as after a page reload) returns the stored value.
        expect(readLessonAutoAdvanceEnabled()).toBe(true);
        setLessonAutoAdvanceEnabled(false);
        expect(readLessonAutoAdvanceEnabled()).toBe(false);
    });

    it("falls back to the default on an unreadable value", () => {
        localStorage.setItem(
            "adaptive-learner.lesson.auto_advance_enabled",
            "garbage",
        );
        expect(readLessonAutoAdvanceEnabled()).toBe(
            DEFAULT_LESSON_AUTO_ADVANCE_ENABLED,
        );
    });
});
