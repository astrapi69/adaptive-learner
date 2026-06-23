import {afterEach, describe, expect, it} from "vitest";

import {
    DEFAULT_LESSON_SHORTCUTS_ENABLED,
    decideLessonEnterAction,
    type LessonEnterState,
    readLessonShortcutsEnabled,
    setLessonShortcutsEnabled,
} from "./lessonShortcutsPref";

const base: LessonEnterState = {
    isSummary: false,
    isExerciseStep: true,
    checked: false,
    enteredReviewed: false,
    answerable: false,
};

describe("decideLessonEnterAction", () => {
    it("does nothing on an unanswered exercise", () => {
        expect(decideLessonEnterAction({...base, answerable: false})).toBe(
            "none",
        );
    });

    it("checks an answered, not-yet-checked exercise", () => {
        expect(decideLessonEnterAction({...base, answerable: true})).toBe(
            "check",
        );
    });

    it("advances once the exercise is checked", () => {
        expect(
            decideLessonEnterAction({...base, answerable: true, checked: true}),
        ).toBe("next");
    });

    it("advances on a step entered already-reviewed (locked)", () => {
        expect(
            decideLessonEnterAction({...base, enteredReviewed: true}),
        ).toBe("next");
    });

    it("advances on a non-exercise (theory) step", () => {
        expect(
            decideLessonEnterAction({...base, isExerciseStep: false}),
        ).toBe("next");
    });

    it("submits + advances an answered exercise in the exam flow (#1007)", () => {
        expect(
            decideLessonEnterAction({
                ...base,
                answerable: true,
                delayedFeedback: true,
            }),
        ).toBe("submit-next");
    });

    it("still does nothing on an unanswered exam exercise", () => {
        expect(
            decideLessonEnterAction({
                ...base,
                answerable: false,
                delayedFeedback: true,
            }),
        ).toBe("none");
    });

    it("does nothing on the summary screen", () => {
        expect(decideLessonEnterAction({...base, isSummary: true})).toBe(
            "none",
        );
    });
});

describe("lesson-shortcuts preference", () => {
    afterEach(() => {
        try {
            localStorage.clear();
        } catch {
            /* no-op */
        }
    });

    it("defaults to enabled", () => {
        expect(readLessonShortcutsEnabled()).toBe(
            DEFAULT_LESSON_SHORTCUTS_ENABLED,
        );
        expect(DEFAULT_LESSON_SHORTCUTS_ENABLED).toBe(true);
    });

    it("round-trips an explicit off / on", () => {
        setLessonShortcutsEnabled(false);
        expect(readLessonShortcutsEnabled()).toBe(false);
        setLessonShortcutsEnabled(true);
        expect(readLessonShortcutsEnabled()).toBe(true);
    });
});
