/**
 * useLessonStepState (#1790).
 *
 * Pins the two-phase check-state cluster at hook level: the
 * render-phase reset on a step change, the reviewed-lock
 * reconstruction from a stored step result (incl. the -1 sentinel
 * so a resume/deep-link entry computes it on the FIRST render),
 * and the setter round-trip for answerable/checked.
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import {useLessonStepState} from "./useLessonStepState";
import type {ContentLesson, LessonProgress, RawAnswer} from "../../../storage/types";

const LESSON = {
    id: "l1",
    title: "Test",
    steps: [
        {id: "s0", type: "exercise"},
        {id: "s1", type: "exercise"},
    ],
} as unknown as ContentLesson;

const STORED_RAW: RawAnswer = {kind: "cloze", inputs: ["bonjour"]};

const PROGRESS = {
    step_results: {
        s1: {correct: 1, total: 1, raw_answer: STORED_RAW},
    },
} as unknown as LessonProgress;

function mount(initialStep: number, progress: LessonProgress | null) {
    return renderHook(
        ({stepIndex}) =>
            useLessonStepState({
                lesson: LESSON,
                currentStepIndex: stepIndex,
                progress,
            }),
        {initialProps: {stepIndex: initialStep}},
    );
}

describe("useLessonStepState", () => {
    it("starts a fresh step unanswered and unchecked", () => {
        const {result} = mount(0, null);
        expect(result.current.answerable).toBe(false);
        expect(result.current.checked).toBe(false);
        expect(result.current.enteredReviewed).toBe(false);
        expect(result.current.reviewedRaw).toBeNull();
    });

    it("resets answerable + checked when the step changes", () => {
        const {result, rerender} = mount(0, null);
        act(() => {
            result.current.setAnswerable(true);
            result.current.setChecked(true);
        });
        expect(result.current.answerable).toBe(true);
        expect(result.current.checked).toBe(true);

        rerender({stepIndex: 1});
        expect(result.current.answerable).toBe(false);
        expect(result.current.checked).toBe(false);
    });

    it("locks a step entered with a stored result and carries the raw answer", () => {
        const {result, rerender} = mount(0, PROGRESS);
        expect(result.current.enteredReviewed).toBe(false);

        rerender({stepIndex: 1});
        expect(result.current.enteredReviewed).toBe(true);
        expect(result.current.reviewedRaw).toEqual(STORED_RAW);
    });

    it("computes the reviewed lock on the FIRST render (resume / deep-link)", () => {
        const {result} = mount(1, PROGRESS);
        expect(result.current.enteredReviewed).toBe(true);
        expect(result.current.reviewedRaw).toEqual(STORED_RAW);
    });

    it("does not flip into the locked view when progress updates mid-step", () => {
        const {result, rerender} = renderHook(
            ({progress}) =>
                useLessonStepState({
                    lesson: LESSON,
                    currentStepIndex: 1,
                    progress,
                }),
            {initialProps: {progress: null as LessonProgress | null}},
        );
        act(() => {
            result.current.setChecked(true);
        });
        rerender({progress: PROGRESS});
        expect(result.current.checked).toBe(true);
        expect(result.current.enteredReviewed).toBe(false);
    });
});
