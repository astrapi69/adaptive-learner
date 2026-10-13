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
        // #3365 - leaving by navigation is logged as an exit, not a pause.
        expect(markPaused).toHaveBeenCalledWith("exit");
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

    it("leaving from the summary does not pause: the run is played through", () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const {unmount} = renderFlow({
            progress: progress("in_progress"),
            markPaused,
            atSummary: true,
        });
        unmount();
        expect(markPaused).not.toHaveBeenCalled();
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
        // #3365 - the pause the learner chose carries no exit reason.
        expect(markPaused).toHaveBeenCalledWith();
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

/** Switch the document's visibility and fire the event, as a phone lock or
 *  an app switch does. */
function setVisibility(state: "hidden" | "visible") {
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => state});
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("a hidden tab or app switch only flushes, it never pauses (#3361)", () => {
    it("hiding an in-progress run flushes time and position without a pause", () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        const autosave = vi.fn().mockResolvedValue(undefined);
        renderFlow({progress: progress("in_progress"), markPaused, autosave});
        act(() => setVisibility("hidden"));
        expect(autosave).toHaveBeenCalledTimes(1);
        expect(markPaused).not.toHaveBeenCalled();
        act(() => setVisibility("visible"));
    });

    it("coming back shows no resume dialog and writes no resume", () => {
        const markResumed = vi.fn().mockResolvedValue(undefined);
        const {result} = renderFlow({progress: progress("in_progress"), markResumed});
        act(() => setVisibility("hidden"));
        act(() => setVisibility("visible"));
        expect(result.current.showResumePrompt).toBe(false);
        expect(markResumed).not.toHaveBeenCalled();
    });

    it("pagehide (iOS never fires beforeunload) flushes too", () => {
        const autosave = vi.fn().mockResolvedValue(undefined);
        const markPaused = vi.fn().mockResolvedValue(undefined);
        renderFlow({progress: progress("in_progress"), autosave, markPaused});
        act(() => {
            window.dispatchEvent(new Event("pagehide"));
        });
        expect(autosave).toHaveBeenCalledTimes(1);
        expect(markPaused).not.toHaveBeenCalled();
    });

    it("closing the tab pauses, logged as an exit (#3365)", () => {
        const markPaused = vi.fn().mockResolvedValue(undefined);
        renderFlow({progress: progress("in_progress"), markPaused});
        act(() => {
            window.dispatchEvent(new Event("beforeunload"));
        });
        expect(markPaused).toHaveBeenCalledWith("exit");
    });
});

describe("the resume choice belongs to one lesson (#3361)", () => {
    function pausedLesson(file: string): LessonProgress {
        return {
            status: "paused",
            source: "jane/repo",
            set_id: "es-a1",
            lesson_filename: file,
        } as unknown as LessonProgress;
    }

    it("the next lesson's paused run asks again after the previous one was resumed", async () => {
        let current = pausedLesson("01.json");
        const {result, rerender} = renderHook(() =>
            useLessonFlowControl({
                status: "ready",
                progress: current,
                markPaused: vi.fn().mockResolvedValue(undefined),
                markAbandoned: vi.fn().mockResolvedValue(undefined),
                markResumed: vi.fn().mockResolvedValue(undefined),
                markRestarted: vi.fn().mockResolvedValue(undefined),
                autosave: vi.fn().mockResolvedValue(undefined),
                goToStep: vi.fn(),
            }),
        );
        expect(result.current.showResumePrompt).toBe(true);
        await act(async () => {
            await result.current.handleResume();
        });
        expect(result.current.showResumePrompt).toBe(false);
        current = pausedLesson("02.json");
        rerender();
        expect(result.current.showResumePrompt).toBe(true);
    });
});

describe("a run from another mode does not continue as an exam (#3742)", () => {
    function run(
        status: LessonProgress["status"],
        mode: string,
    ): LessonProgress {
        return {
            status,
            lesson_mode: mode,
            step_results: {"ex-1": {correct: 1, total: 1}},
            source: "s",
            set_id: "set",
            lesson_filename: "01.json",
        } as unknown as LessonProgress;
    }

    it.each([
        ["paused practice run opened in exam", "paused", "practice", "exam"],
        ["in-progress practice run opened in exam", "in_progress", "practice", "exam"],
        ["paused exam run opened in practice", "paused", "exam", "practice"],
    ] as const)("%s: prompt shows the conflict", (_name, status, stored, mode) => {
        const {result} = renderFlow({progress: run(status, stored), lessonMode: mode});
        expect(result.current.showResumePrompt).toBe(true);
        expect(result.current.modeConflict).toBe(true);
    });

    it.each([
        ["exam run opened in exam", "exam", "exam"],
        ["practice run opened in practice", "practice", "practice"],
    ] as const)("%s: resumes as today", (_name, stored, mode) => {
        const {result} = renderFlow({progress: run("paused", stored), lessonMode: mode});
        expect(result.current.showResumePrompt).toBe(true);
        expect(result.current.modeConflict).toBe(false);
    });

    it("an in-progress run in the same mode opens without a prompt, as today", () => {
        const {result} = renderFlow({progress: run("in_progress", "exam"), lessonMode: "exam"});
        expect(result.current.showResumePrompt).toBe(false);
    });

    it("a completed practice run opened in exam starts fresh: no prompt", () => {
        const {result} = renderFlow({progress: run("completed", "practice"), lessonMode: "exam"});
        expect(result.current.showResumePrompt).toBe(false);
        expect(result.current.modeConflict).toBe(false);
    });

    it("the conflict holds while an autosave restamps the row with the current mode", () => {
        let current = run("in_progress", "practice");
        const {result, rerender} = renderHook(
            ({progress}: {progress: LessonProgress}) =>
                useLessonFlowControl({
                    status: "ready",
                    progress,
                    lessonMode: "exam",
                    markPaused: vi.fn().mockResolvedValue(undefined),
                    markAbandoned: vi.fn().mockResolvedValue(undefined),
                    markResumed: vi.fn().mockResolvedValue(undefined),
                    markRestarted: vi.fn().mockResolvedValue(undefined),
                    autosave: vi.fn().mockResolvedValue(undefined),
                    goToStep: vi.fn(),
                }),
            {initialProps: {progress: current}},
        );
        expect(result.current.modeConflict).toBe(true);
        current = run("in_progress", "exam");
        rerender({progress: current});
        expect(result.current.showResumePrompt).toBe(true);
        expect(result.current.modeConflict).toBe(true);
    });

    it("starting over clears the prompt", async () => {
        const markRestarted = vi.fn().mockResolvedValue(undefined);
        const {result} = renderFlow({
            progress: run("paused", "practice"),
            lessonMode: "exam",
            markRestarted,
        });
        await act(async () => {
            await result.current.handleStartOver();
        });
        expect(markRestarted).toHaveBeenCalledTimes(1);
        expect(result.current.showResumePrompt).toBe(false);
    });
});
