/**
 * Tests for the mascot state hook (#2849): celebration-bus events
 * drive the pose, poses decay back to idle, the speech bubble
 * appears only for lesson_complete, and disabling unsubscribes.
 */

import {act, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {emitCelebration} from "../../../lib/praise/celebration-bus";
import {useMascotState} from "./useMascotState";

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useMascotState", () => {
    it("starts idle without a bubble", () => {
        const {result} = renderHook(() => useMascotState("de", true));
        expect(result.current.pose).toBe("idle");
        expect(result.current.bubble).toBeNull();
    });

    it("cheers on a correct answer, then returns to idle", () => {
        const {result} = renderHook(() => useMascotState("de", true));
        act(() => emitCelebration({type: "answer_correct"}));
        expect(result.current.pose).toBe("cheer");
        act(() => vi.advanceTimersByTime(2600));
        expect(result.current.pose).toBe("idle");
    });

    it("encourages on a wrong answer (no bubble)", () => {
        const {result} = renderHook(() => useMascotState("de", true));
        act(() => emitCelebration({type: "answer_wrong"}));
        expect(result.current.pose).toBe("encourage");
        expect(result.current.bubble).toBeNull();
    });

    it.each([
        ["level_up"],
        ["streak_milestone"],
        ["badge_earned"],
        ["mission_complete"],
    ] as const)("celebrates on %s", (type) => {
        const {result} = renderHook(() => useMascotState("de", true));
        act(() => emitCelebration({type}));
        expect(result.current.pose).toBe("celebrate");
    });

    it("lesson_complete celebrates AND fills the bubble with a praise phrase", () => {
        const {result} = renderHook(() => useMascotState("de", true));
        act(() => emitCelebration({type: "lesson_complete", payload: {stars: 3}}));
        expect(result.current.pose).toBe("celebrate");
        expect(result.current.bubble).toBeTruthy();
        act(() => vi.advanceTimersByTime(6000));
        expect(result.current.pose).toBe("idle");
        expect(result.current.bubble).toBeNull();
    });

    it("each reaction advances reactionKey so animations restart", () => {
        const {result} = renderHook(() => useMascotState("de", true));
        const first = result.current.reactionKey;
        act(() => emitCelebration({type: "answer_correct"}));
        const second = result.current.reactionKey;
        act(() => emitCelebration({type: "answer_correct"}));
        expect(second).not.toBe(first);
        expect(result.current.reactionKey).not.toBe(second);
    });

    it("ignores events while disabled", () => {
        const {result} = renderHook(() => useMascotState("de", false));
        act(() => emitCelebration({type: "answer_correct"}));
        expect(result.current.pose).toBe("idle");
    });
});
