/**
 * Tests for stampExamAttempts (#1040 Exam-Mode SRS boost).
 */

import {describe, expect, it} from "vitest";

import {stampExamAttempts} from "./exam-attempt";
import type {ElementAttempt} from "../../storage/types";

function attempt(overrides: Partial<ElementAttempt> = {}): ElementAttempt {
    return {
        set_id: "language-fr-a1",
        lesson_id: "01-greetings.json",
        exercise_id: "ex-thanks",
        element_key: "merci",
        correct: true,
        ...overrides,
    };
}

describe("stampExamAttempts", () => {
    it("stamps exam:true on every attempt in exam mode", () => {
        const out = stampExamAttempts([attempt(), attempt({correct: false})], true);
        expect(out.every((a) => a.exam === true)).toBe(true);
    });

    it("leaves attempts unstamped when not in exam mode", () => {
        const out = stampExamAttempts([attempt(), attempt()], false);
        expect(out.every((a) => a.exam === undefined)).toBe(true);
    });

    it("is pure — never mutates the input", () => {
        const input = [attempt()];
        const out = stampExamAttempts(input, true);
        expect(input[0].exam).toBeUndefined();
        expect(out[0]).not.toBe(input[0]);
    });

    it("returns an empty array for empty input", () => {
        expect(stampExamAttempts([], true)).toEqual([]);
        expect(stampExamAttempts([], false)).toEqual([]);
    });
});
