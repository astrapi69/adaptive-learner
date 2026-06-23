/**
 * Tests for the lesson-mode preferences (#1007): default mode + exam pass
 * threshold persistence and the pure ``examPassed`` predicate.
 */

import {afterEach, describe, expect, it} from "vitest";

import {
    DEFAULT_EXAM_PASS_THRESHOLD,
    DEFAULT_LESSON_MODE,
    examPassed,
    readDefaultLessonMode,
    readExamPassThreshold,
    writeDefaultLessonMode,
    writeExamPassThreshold,
} from "./lessonModePref";

afterEach(() => {
    localStorage.clear();
});

describe("default lesson mode", () => {
    it("defaults to practice", () => {
        expect(readDefaultLessonMode()).toBe("practice");
        expect(DEFAULT_LESSON_MODE).toBe("practice");
    });

    it("round-trips a written mode", () => {
        writeDefaultLessonMode("exam");
        expect(readDefaultLessonMode()).toBe("exam");
    });

    it("falls back to practice for an unknown stored value", () => {
        localStorage.setItem("adaptive-learner.lesson.default_mode", "bogus");
        expect(readDefaultLessonMode()).toBe("practice");
    });
});

describe("exam pass threshold", () => {
    it("defaults to 60", () => {
        expect(readExamPassThreshold()).toBe(60);
        expect(DEFAULT_EXAM_PASS_THRESHOLD).toBe(60);
    });

    it("round-trips a valid threshold", () => {
        writeExamPassThreshold(80);
        expect(readExamPassThreshold()).toBe(80);
    });

    it("falls back to 60 for an invalid stored value", () => {
        localStorage.setItem(
            "adaptive-learner.lesson.exam_pass_threshold",
            "55",
        );
        expect(readExamPassThreshold()).toBe(60);
    });
});

describe("examPassed", () => {
    it("passes at or above the threshold", () => {
        expect(examPassed(8, 10, 60)).toBe(true); // 80%
        expect(examPassed(6, 10, 60)).toBe(true); // exactly 60%
    });

    it("fails below the threshold", () => {
        expect(examPassed(5, 10, 60)).toBe(false); // 50%
        expect(examPassed(7, 10, 80)).toBe(false); // 70% < 80
    });

    it("never passes an empty lesson", () => {
        expect(examPassed(0, 0, 60)).toBe(false);
    });
});
