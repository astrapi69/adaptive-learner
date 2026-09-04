/**
 * Tests for useLessonHearts (#2878): lives fall on wrong-answer
 * celebrations while enabled, never below zero, ignore the bus while
 * disabled, reset to the
 * current max on demand.
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {useLessonHearts} from "./useLessonHearts";
import {emitCelebration} from "../../lib/praise/celebration-bus";

describe("useLessonHearts", () => {
    it("starts full and loses one heart per wrong answer", () => {
        const {result} = renderHook(() => useLessonHearts(true, 3));
        expect(result.current.hearts).toBe(3);
        expect(result.current.depleted).toBe(false);
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.hearts).toBe(2);
        act(() => emitCelebration({type: "answer_wrong"}));
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.hearts).toBe(0);
        expect(result.current.depleted).toBe(true);
    });

    it("never goes below zero and ignores other celebrations", () => {
        const {result} = renderHook(() => useLessonHearts(true, 1));
        act(() => emitCelebration({type: "answer_correct"}));
        expect(result.current.hearts).toBe(1);
        act(() => emitCelebration({type: "answer_wrong"}));
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.hearts).toBe(0);
    });

    it("ignores the bus while disabled (summary/correction round)", () => {
        const {result} = renderHook(() => useLessonHearts(false, 3));
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.hearts).toBe(3);
        expect(result.current.depleted).toBe(false);
    });

    it("resetHearts refills to the current max", () => {
        const {result, rerender} = renderHook(
            ({max}: {max: number}) => useLessonHearts(true, max),
            {initialProps: {max: 3}},
        );
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.hearts).toBe(2);
        rerender({max: 5});
        act(() => result.current.resetHearts());
        expect(result.current.hearts).toBe(5);
    });
});
