/**
 * useReadAloud helpers (TTS feature C1).
 *
 * The hook itself is exercised end-to-end through the Lesson page
 * tests (auto-read + highlight); here we pin the pure speed
 * persistence helpers + the offered speed set, which the inline
 * speed control (C4) depends on.
 */

import {beforeEach, describe, expect, it} from "vitest";

import {VOICE_PREF_BLOCK_KEY} from "../../../lib/voice/voicePref";
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

    it("falls back to 1x for an out-of-set block value", () => {
        localStorage.setItem(
            VOICE_PREF_BLOCK_KEY,
            JSON.stringify({lessonSpeed: 3}),
        );
        expect(readLessonSpeed()).toBe(1);
    });

    it("migrates a legacy lesson_speed key, clamping out-of-set values", () => {
        localStorage.setItem("adaptive-learner.voice.lesson_speed", "0.75");
        expect(readLessonSpeed()).toBe(0.75);
        expect(
            localStorage.getItem("adaptive-learner.voice.lesson_speed"),
        ).toBeNull();
    });
});
