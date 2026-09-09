/**
 * Regression tests for {@link useLessonFlowControl}'s ``isInProgress``
 * derivation (#1027).
 *
 * The bug: a fresh lesson has no ``LessonProgress`` row yet (``progress``
 * is null until the first answer upserts one), and the old derivation
 * ``progress === null || progress.status === "in_progress"`` therefore
 * reported the lesson as in-progress from the moment it opened. That
 * locked the Practice/Exam/Timed mode toggle for the whole lesson and
 * auto-paused a lesson the learner never started. ``isInProgress`` must
 * be true ONLY for a started run (status ``in_progress``).
 */

import {act, renderHook} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {useLessonFlowControl} from "./useLessonFlowControl";
import type {LessonProgress} from "../../../storage/types";

vi.mock("react-router", () => ({
    useNavigate: () => vi.fn(),
}));
vi.mock("../../ui/useI18n", () => ({
    useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));
vi.mock("../../../utils/notify", () => ({
    notify: {info: vi.fn(), error: vi.fn(), success: vi.fn()},
}));

function progress(status: LessonProgress["status"]): LessonProgress {
    return {status} as unknown as LessonProgress;
}

function renderFlow(over: Partial<Parameters<typeof useLessonFlowControl>[0]> = {}) {
    return renderHook(() =>
        useLessonFlowControl({
            status: "ready",
            progress: null,
            markPaused: vi.fn().mockResolvedValue(undefined),
            markAbandoned: vi.fn().mockResolvedValue(undefined),
            markResumed: vi.fn().mockResolvedValue(undefined),
            markRestarted: vi.fn().mockResolvedValue(undefined),
            autosave: vi.fn().mockResolvedValue(undefined),
            goToStep: vi.fn(),
            ...over,
        }),
    );
}

describe("useLessonFlowControl isInProgress (#1027)", () => {
    it("is false on a fresh lesson with no progress row", () => {
        const {result} = renderFlow({progress: null});
        expect(result.current.isInProgress).toBe(false);
    });

    it("is true once the run is under way (status in_progress)", () => {
        const {result} = renderFlow({progress: progress("in_progress")});
        expect(result.current.isInProgress).toBe(true);
    });

    it("is false for a paused run", () => {
        const {result} = renderFlow({progress: progress("paused")});
        expect(result.current.isInProgress).toBe(false);
    });

    it("is false for a completed run", () => {
        const {result} = renderFlow({progress: progress("completed")});
        expect(result.current.isInProgress).toBe(false);
    });
});

describe("useLessonFlowControl pauses a started run on unmount (#3075)", () => {
    it("unmount while in_progress calls markPaused exactly once", () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const {unmount} = renderFlow({
            progress: progress("in_progress"),
            markPaused,
        });
        expect(markPaused).not.toHaveBeenCalled();
        unmount();
        expect(markPaused).toHaveBeenCalledTimes(1);
    });

    it("unmount of a lesson with no started run writes nothing", () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const {unmount} = renderFlow({progress: null, markPaused});
        unmount();
        expect(markPaused).not.toHaveBeenCalled();
    });

    it("unmount of an already paused or completed run writes nothing", () => {
        for (const state of ["paused", "completed"] as const) {
            const markPaused = vi.fn().mockResolvedValue(undefined);
            const {unmount} = renderFlow({
                progress: progress(state),
                markPaused,
            });
            unmount();
            expect(markPaused).not.toHaveBeenCalled();
        }
    });

    it("the dialog's own pause is not repeated by the unmount that follows it", async () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const {result, unmount} = renderFlow({
            progress: progress("in_progress"),
            markPaused,
        });
        await act(async () => {
            await result.current.handlePauseFromDialog();
        });
        expect(markPaused).toHaveBeenCalledTimes(1);
        unmount();
        expect(markPaused).toHaveBeenCalledTimes(1);
    });

    it("abandoning through the dialog is not followed by a pause on unmount", async () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const markAbandoned = vi.fn().mockResolvedValue(undefined);
        const {result, unmount} = renderFlow({
            progress: progress("in_progress"),
            markPaused,
            markAbandoned,
        });
        await act(async () => {
            await result.current.handleAbandonFromDialog();
        });
        unmount();
        expect(markAbandoned).toHaveBeenCalledTimes(1);
        expect(markPaused).not.toHaveBeenCalled();
    });
});
