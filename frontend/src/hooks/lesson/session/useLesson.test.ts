/**
 * Tests for the useLesson hook
 * (Phase 44 / EXP-002 / P-107 + P-109).
 *
 * Mocks the storage namespace + learnerState so the hook
 * runs in isolation. Pins:
 *
 * - status="loading" → "ready" after fetch.
 * - status="not-cached" when the lesson isn't downloaded.
 * - Resumes on the next-uncompleted step from existing progress.
 * - goNext / goPrev / goToStep clamp at bounds.
 * - goToStepById resolves by id; ignores unknown ids.
 * - recordStepResult calls storage.upsert with the right shape
 *   and updates local progress state.
 * - markCompleted flips status + stamps completed_at.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const getLessonMock = vi.fn();
const getProgressMock = vi.fn();
const upsertProgressMock = vi.fn();

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            getLesson: getLessonMock,
            listSets: vi.fn(),
            downloadSet: vi.fn(),
            listLessons: vi.fn(),
        },
        lessonProgress: {
            get: getProgressMock,
            list: vi.fn(),
            upsert: upsertProgressMock,
        },
    }),
}));

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({
        userId: "user-1",
        projectId: "project-1",
        language: "en",
    }),
}));

import {useLesson} from "./useLesson";

const SOURCE = "astrapi69/adaptive-learner-content";
const SET_ID = "language-fr-a1";
const LESSON = "01-greetings.json";

const LESSON_PAYLOAD = {
    id: "01-greetings",
    title: "Greetings",
    estimated_minutes: 10,
    cards: [],
    steps: [
        {id: "intro", type: "theory" as const, body: "# Intro"},
        {id: "step-formality", type: "theory" as const, body: "## F"},
        {id: "ex-1", type: "exercise" as const},
    ],
};

const FRESH_PROGRESS = {
    id: "user-1#astrapi69--adaptive-learner-content#language-fr-a1#01-greetings.json",
    user_id: "user-1",
    source: SOURCE,
    set_id: SET_ID,
    lesson_filename: LESSON,
    status: "in_progress" as const,
    step_results: {},
    score_correct: 0,
    score_total: 0,
    time_spent_seconds: 0,
    started_at: "2026-05-26T00:00:00Z",
    updated_at: "2026-05-26T00:00:00Z",
    completed_at: null,
};

beforeEach(() => {
    getLessonMock.mockReset();
    getProgressMock.mockReset();
    upsertProgressMock.mockReset();
});

describe("useLesson: load + status transitions", () => {
    it("transitions loading -> ready when fetch succeeds", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue(null);
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        expect(result.current.status).toBe("loading");
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        expect(result.current.lesson?.id).toBe("01-greetings");
        expect(result.current.currentStepIndex).toBe(0);
    });

    it("surfaces status=not-cached when the lesson isn't downloaded", async () => {
        getLessonMock.mockRejectedValue(
            new Error("Set astrapi69/adaptive-learner-content/language-fr-a1 is not cached"),
        );
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("not-cached");
        });
        expect(result.current.lesson).toBeNull();
    });

    it("resumes on the next-uncompleted step from saved progress", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            step_results: {
                intro: {
                    correct: 0,
                    total: 0,
                    attempts: 1,
                    completed_at: "2026-05-26T00:01:00Z",
                },
            },
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        // Completed: intro. Resume on index 1 (step-formality).
        expect(result.current.currentStepIndex).toBe(1);
    });

    it("BUG #41 — resumes at the saved current_step even when no step_results exist", async () => {
        // The user read theory (steps never write a step_result) and
        // paused on step 2 (an unanswered exercise). Before the fix
        // the resume index was reconstructed from step_results only
        // and snapped back to 0; current_step is the real position.
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            status: "paused" as const,
            paused_at: "2026-06-05T00:05:00Z",
            step_results: {},
            current_step: 2,
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        expect(result.current.currentStepIndex).toBe(2);
    });

    it("BUG #41 — resume takes the furthest of current_step and step_results", async () => {
        // step_results says step 0 is done (→ index 1) but the user
        // navigated forward to step 2; the further position wins.
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            status: "paused" as const,
            step_results: {
                intro: {
                    correct: 0,
                    total: 0,
                    attempts: 1,
                    completed_at: "2026-06-05T00:01:00Z",
                },
            },
            current_step: 2,
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        expect(result.current.currentStepIndex).toBe(2);
    });

    it("lands on the summary view when status=completed", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            status: "completed" as const,
            completed_at: "2026-05-26T00:10:00Z",
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        // 3 steps → summary index is 3.
        expect(result.current.currentStepIndex).toBe(3);
    });
});

describe("useLesson: navigation", () => {
    async function _setup() {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue(null);
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        return result;
    }

    it("goNext advances by one and stops at the summary", async () => {
        const result = await _setup();
        act(() => result.current.goNext());
        expect(result.current.currentStepIndex).toBe(1);
        act(() => result.current.goNext());
        act(() => result.current.goNext());
        // Length = 3, summary is index 3. Next no-op past.
        expect(result.current.currentStepIndex).toBe(3);
        act(() => result.current.goNext());
        expect(result.current.currentStepIndex).toBe(3);
    });

    it("goPrev moves back and clamps at 0", async () => {
        const result = await _setup();
        act(() => result.current.goToStep(2));
        expect(result.current.currentStepIndex).toBe(2);
        act(() => result.current.goPrev());
        expect(result.current.currentStepIndex).toBe(1);
        act(() => result.current.goPrev());
        act(() => result.current.goPrev());
        expect(result.current.currentStepIndex).toBe(0);
    });

    it("goToStepById resolves known ids", async () => {
        const result = await _setup();
        act(() => result.current.goToStepById("ex-1"));
        expect(result.current.currentStepIndex).toBe(2);
    });

    it("goToStepById ignores unknown ids", async () => {
        const result = await _setup();
        act(() => result.current.goToStepById("no-such-step"));
        expect(result.current.currentStepIndex).toBe(0);
    });
});

describe("useLesson: persistence", () => {
    it("recordStepResult calls storage.upsert with the right shape", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue(null);
        upsertProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            score_correct: 4,
            score_total: 4,
            step_results: {
                "ex-1": {
                    correct: 4,
                    total: 4,
                    attempts: 1,
                    completed_at: "2026-05-26T00:01:00Z",
                },
            },
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });

        await act(async () => {
            await result.current.recordStepResult({
                step_id: "ex-1",
                correct: 4,
                total: 4,
            });
        });

        expect(upsertProgressMock).toHaveBeenCalledOnce();
        const args = upsertProgressMock.mock.calls[0];
        expect(args[0]).toBe("user-1");
        const body = args[1];
        expect(body.source).toBe(SOURCE);
        expect(body.set_id).toBe(SET_ID);
        expect(body.lesson_filename).toBe(LESSON);
        expect(body.step_result?.step_id).toBe("ex-1");
        expect(body.step_result?.correct).toBe(4);
        expect(result.current.progress?.score_correct).toBe(4);
    });

    it("markCompleted upserts with mark_completed=true", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue(null);
        upsertProgressMock.mockResolvedValue({
            ...FRESH_PROGRESS,
            status: "completed" as const,
            completed_at: "2026-05-26T00:10:00Z",
        });
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        await act(async () => {
            await result.current.markCompleted();
        });
        const body = upsertProgressMock.mock.calls[0][1];
        expect(body.mark_completed).toBe(true);
        expect(result.current.progress?.status).toBe("completed");
    });

    it("markCompleted rethrows when the upsert fails (#1787)", async () => {
        getLessonMock.mockResolvedValue(LESSON_PAYLOAD);
        getProgressMock.mockResolvedValue(null);
        upsertProgressMock.mockRejectedValue(
            new Error("IndexedDB write failed"),
        );
        const {result} = renderHook(() =>
            useLesson({
                source: SOURCE,
                setId: SET_ID,
                lessonFilename: LESSON,
            }),
        );
        await waitFor(() => {
            expect(result.current.status).toBe("ready");
        });
        // Pre-#1787 the failure was swallowed into the hook's error state,
        // which the summary never renders — the click died silently. The
        // caller (the summary click handler) must be able to catch + toast.
        await act(async () => {
            await expect(result.current.markCompleted()).rejects.toThrow(
                "IndexedDB write failed",
            );
        });
        expect(result.current.error).toBe("IndexedDB write failed");
    });
});
