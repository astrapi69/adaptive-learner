/**
 * Tests for timed-mode config helpers (#1009): per-type/difficulty limits,
 * difficulty persistence, and the end-of-run stats aggregation.
 */

import {afterEach, describe, expect, it} from "vitest";

import {
    DEFAULT_TIMED_DIFFICULTY,
    readTimedDifficulty,
    summarizeTimedRun,
    TIMED_BONUS_SECONDS,
    timeLimitSeconds,
    writeTimedDifficulty,
    type TimedQuestionRecord,
} from "./timedMode";

afterEach(() => {
    localStorage.clear();
});

describe("timeLimitSeconds", () => {
    it("uses the per-type base at normal difficulty", () => {
        expect(timeLimitSeconds("cloze", "normal")).toBe(20);
        expect(timeLimitSeconds("word_tiles", "normal")).toBe(30);
        expect(timeLimitSeconds("free_text", "normal")).toBe(90);
        expect(timeLimitSeconds("picture_choice", "normal")).toBe(15);
    });

    it("scales matching by the pair count (8s per pair)", () => {
        expect(timeLimitSeconds("matching", "normal", 3)).toBe(24);
        expect(timeLimitSeconds("matching", "normal", 1)).toBe(8);
    });

    it("applies the difficulty multiplier", () => {
        expect(timeLimitSeconds("cloze", "relaxed")).toBe(40); // 2×
        expect(timeLimitSeconds("cloze", "fast")).toBe(14); // 0.7× → round(14)
    });

    it("never drops below 1 second", () => {
        expect(timeLimitSeconds("matching", "fast", 1)).toBeGreaterThanOrEqual(1);
    });
});

describe("timed difficulty preference", () => {
    it("defaults to normal", () => {
        expect(readTimedDifficulty()).toBe("normal");
        expect(DEFAULT_TIMED_DIFFICULTY).toBe("normal");
    });

    it("round-trips a written difficulty", () => {
        writeTimedDifficulty("fast");
        expect(readTimedDifficulty()).toBe("fast");
    });

    it("exposes a fixed bonus", () => {
        expect(TIMED_BONUS_SECONDS).toBe(5);
    });
});

describe("summarizeTimedRun", () => {
    it("returns zeros for an empty run", () => {
        const s = summarizeTimedRun([]);
        expect(s.total).toBe(0);
        expect(s.fastest).toBeNull();
        expect(s.slowest).toBeNull();
    });

    it("aggregates answered-in-time, average, fastest, slowest", () => {
        const records: TimedQuestionRecord[] = [
            {type: "matching", seconds: 3, inTime: true},
            {type: "free_text", seconds: 45, inTime: true},
            {type: "cloze", seconds: 20, inTime: false},
        ];
        const s = summarizeTimedRun(records);
        expect(s.total).toBe(3);
        expect(s.answeredInTime).toBe(2);
        expect(s.averageSeconds).toBeCloseTo((3 + 45 + 20) / 3, 1);
        expect(s.fastest).toEqual({seconds: 3, type: "matching"});
        expect(s.slowest).toEqual({seconds: 45, type: "free_text"});
    });
});
