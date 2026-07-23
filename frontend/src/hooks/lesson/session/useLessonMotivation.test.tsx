/**
 * useLessonMotivation (#1790).
 *
 * Pins the hook behaviour on top of the pure ``lessonMotivation``
 * rule (covered in lib/lesson/motivation.test.ts): the toast fires
 * once per step, never twice for the same step (StrictMode /
 * re-render guard), and never on the summary index.
 */

import {renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {useLessonMotivation} from "./useLessonMotivation";
import {notify} from "../../../utils/notify";
import type {ContentLesson} from "../../../storage/types";

vi.mock("../../../utils/notify", () => ({
    notify: {info: vi.fn(), error: vi.fn(), success: vi.fn()},
}));

vi.mock("../../ui/useI18n", () => ({
    useI18n: () => ({
        t: (_key: string, fallback: string) => fallback,
        lang: "en",
    }),
}));

function lessonWithSteps(count: number): ContentLesson {
    return {
        id: "l1",
        title: "Test lesson",
        steps: Array.from({length: count}, (_, i) => ({
            id: `s${i}`,
            type: "theory",
            body: `Step ${i}`,
        })),
    } as unknown as ContentLesson;
}

describe("useLessonMotivation", () => {
    beforeEach(() => {
        vi.mocked(notify.info).mockClear();
    });

    it("fires the halftime toast once at the halfway step", () => {
        const lesson = lessonWithSteps(10);
        const {rerender} = renderHook(
            ({stepIndex}) =>
                useLessonMotivation({lesson, currentStepIndex: stepIndex}),
            {initialProps: {stepIndex: 5}},
        );
        expect(notify.info).toHaveBeenCalledTimes(1);
        expect(vi.mocked(notify.info).mock.calls[0][0]).toMatch(/Halfway/);

        rerender({stepIndex: 5});
        expect(notify.info).toHaveBeenCalledTimes(1);
    });

    it("fires the last-step toast on the final step", () => {
        const lesson = lessonWithSteps(10);
        renderHook(() =>
            useLessonMotivation({lesson, currentStepIndex: 9}),
        );
        expect(notify.info).toHaveBeenCalledTimes(1);
        expect(vi.mocked(notify.info).mock.calls[0][0]).toMatch(/Last one/);
    });

    it("stays silent on the summary index and without a lesson", () => {
        const lesson = lessonWithSteps(10);
        renderHook(() =>
            useLessonMotivation({lesson, currentStepIndex: 10}),
        );
        renderHook(() =>
            useLessonMotivation({lesson: null, currentStepIndex: 5}),
        );
        expect(notify.info).not.toHaveBeenCalled();
    });
});
