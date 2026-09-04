/**
 * Tests for useLessonCombo (#2874): the hook follows the
 * celebration bus while enabled, ignores it while disabled, and
 * resets with the reset callback.
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {useLessonCombo} from "./useLessonCombo";
import {emitCelebration} from "../../lib/praise/celebration-bus";

describe("useLessonCombo", () => {
    it("grows on correct answers and breaks on a wrong one", () => {
        const {result} = renderHook(() => useLessonCombo(true));
        act(() => {
            emitCelebration({type: "answer_correct"});
            emitCelebration({type: "answer_correct"});
        });
        expect(result.current.combo).toEqual({current: 2, best: 2, bonusEligible: 0});
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.combo).toEqual({current: 0, best: 2, bonusEligible: 0});
    });

    it("ignores the bus while disabled", () => {
        const {result} = renderHook(() => useLessonCombo(false));
        act(() => emitCelebration({type: "answer_correct"}));
        expect(result.current.combo).toEqual({current: 0, best: 0, bonusEligible: 0});
    });

    it("ignores non-answer celebrations", () => {
        const {result} = renderHook(() => useLessonCombo(true));
        act(() => emitCelebration({type: "level_up"}));
        expect(result.current.combo).toEqual({current: 0, best: 0, bonusEligible: 0});
    });

    it("resets on demand (new lesson)", () => {
        const {result} = renderHook(() => useLessonCombo(true));
        act(() => {
            emitCelebration({type: "answer_correct"});
            emitCelebration({type: "answer_correct"});
        });
        act(() => result.current.resetCombo());
        expect(result.current.combo).toEqual({current: 0, best: 0, bonusEligible: 0});
    });
});
