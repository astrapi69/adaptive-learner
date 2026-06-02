/**
 * useReadAloud helpers (TTS feature C1).
 *
 * The hook itself is exercised end-to-end through the Lesson page
 * tests (auto-read + highlight); here we pin the pure speed
 * persistence helpers + the offered speed set, which the inline
 * speed control (C4) depends on.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    READ_ALOUD_SPEEDS,
    readLessonSpeed,
    writeLessonSpeed,
} from "./useReadAloud";

beforeEach(() => {
    localStorage.clear();
});

describe("lesson read-aloud speed persistence", () => {
    it("offers exactly the 0.5 / 0.75 / 1 / 1.25 set", () => {
        expect([...READ_ALOUD_SPEEDS]).toEqual([0.5, 0.75, 1, 1.25]);
    });

    it("defaults to 1x when nothing is stored", () => {
        expect(readLessonSpeed()).toBe(1);
    });

    it("round-trips a valid speed", () => {
        writeLessonSpeed(0.75);
        expect(readLessonSpeed()).toBe(0.75);
        writeLessonSpeed(1.25);
        expect(readLessonSpeed()).toBe(1.25);
    });

    it("falls back to 1x for an out-of-set / garbage stored value", () => {
        localStorage.setItem("adaptive-learner.voice.lesson_speed", "3");
        expect(readLessonSpeed()).toBe(1);
        localStorage.setItem("adaptive-learner.voice.lesson_speed", "nope");
        expect(readLessonSpeed()).toBe(1);
    });
});
