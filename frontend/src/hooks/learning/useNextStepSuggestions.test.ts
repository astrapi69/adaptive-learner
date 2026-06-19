/**
 * Tests for useNextStepSuggestions (Phase 64 / smart-next-steps).
 *
 * Pins the suggestion-derivation logic:
 *   - next lesson present / absent (last lesson)
 *   - paused successor → isPaused + step counter
 *   - adaptive card gated on errors > 0 (hidden on perfect)
 *   - review card gated on a non-empty queue
 *   - set-complete on the last lesson + suggested-set selection
 *     (never a 100%-completed set)
 *   - primaryAction by star rating
 *   - graceful degradation: a thrown storage read hides only its
 *     own suggestion, never the whole hook
 */

import {renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const listLessonsMock = vi.fn();
const getLessonMock = vi.fn();
const listSetsMock = vi.fn();
const reviewQueueMock = vi.fn();
const progressListMock = vi.fn();
const progressGetMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        contentLoader: {
            listLessons: listLessonsMock,
            getLesson: getLessonMock,
            listSets: listSetsMock,
        },
        elementErrors: {
            reviewQueue: reviewQueueMock,
        },
        lessonProgress: {
            list: progressListMock,
            get: progressGetMock,
        },
    }),
}));

import {
    computePrimaryAction,
    useNextStepSuggestions,
    type UseNextStepArgs,
} from "./useNextStepSuggestions";
import type {
    ContentLesson,
    ContentSetEntry,
    ElementError,
    LessonProgress,
    ReviewQueueItem,
} from "../../storage/types";

const NOW = "2026-06-01T12:00:00Z";

function makeError(overrides: Partial<ElementError> = {}): ElementError {
    return {
        id: overrides.id ?? "err-1",
        user_id: "user-1",
        set_id: overrides.set_id ?? "fr-a1",
        lesson_id: overrides.lesson_id ?? "03.json",
        exercise_id: overrides.exercise_id ?? "ex-1",
        element_key: overrides.element_key ?? "le",
        element_type: overrides.element_type ?? "vocabulary",
        user_answer: overrides.user_answer ?? "la",
        correct_answer: overrides.correct_answer ?? "le",
        error_count: overrides.error_count ?? 2,
        correct_streak: overrides.correct_streak ?? 0,
        last_error_at: overrides.last_error_at ?? NOW,
        last_attempt_at: overrides.last_attempt_at ?? NOW,
        mastered: overrides.mastered ?? false,
        mastered_at: overrides.mastered_at ?? null,
        created_at: NOW,
        updated_at: NOW,
    };
}

function makeReviewItem(
    overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
    return {
        id: overrides.id ?? "rq-1",
        user_id: "user-1",
        set_id: overrides.set_id ?? "fr-a1",
        lesson_id: "03.json",
        exercise_id: "ex-1",
        element_key: overrides.element_key ?? "merci",
        element_type: "vocabulary",
        user_answer: "mercy",
        correct_answer: "merci",
        error_count: 1,
        correct_streak: 0,
        last_error_at: NOW,
        last_attempt_at: NOW,
        suggested_review_at: NOW,
        overdue: overrides.overdue ?? false,
    };
}

function makeSet(overrides: Partial<ContentSetEntry> = {}): ContentSetEntry {
    return {
        source: "bundled:adaptive-learner-content",
        branch: "main",
        id: overrides.id ?? "fr-a1",
        title: overrides.title ?? "French A1",
        title_native: null,
        language: overrides.target_language ?? "fr",
        target_language: overrides.target_language ?? "fr",
        source_language: overrides.source_language ?? "en",
        level: overrides.level ?? "a1",
        domain: "language",
        version: "1.0.0",
        lesson_count: overrides.lesson_count ?? 5,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
    };
}

function makeLesson(title: string, stepCount: number): ContentLesson {
    return {
        id: "next",
        title,
        target_language: "fr",
        source_language: "en",
        level: "a1",
        steps: Array.from({length: stepCount}, (_unused, i) => ({
            id: `step-${i}`,
            type: "theory" as const,
            body: "x",
        })),
    } as unknown as ContentLesson;
}

function makeProgress(
    overrides: Partial<LessonProgress> = {},
): LessonProgress {
    return {
        id: overrides.id ?? "lp-1",
        user_id: "user-1",
        source: "bundled:adaptive-learner-content",
        set_id: overrides.set_id ?? "fr-a1",
        lesson_filename: overrides.lesson_filename ?? "04.json",
        status: overrides.status ?? "completed",
        step_results: overrides.step_results ?? {},
        score_correct: 0,
        score_total: 0,
        time_spent_seconds: 0,
        started_at: NOW,
        updated_at: NOW,
        completed_at: null,
        paused_at: overrides.paused_at ?? null,
        abandoned_at: null,
    };
}

const BASE_ARGS: UseNextStepArgs = {
    source: "bundled:adaptive-learner-content",
    setId: "fr-a1",
    lessonFilename: "03.json",
    userId: "user-1",
    stars: 2,
    sessionErrors: [],
};

function setDefaults() {
    listLessonsMock.mockResolvedValue({
        set_id: "fr-a1",
        source: "bundled:adaptive-learner-content",
        version: "1.0.0",
        lessons: ["01.json", "02.json", "03.json", "04.json"],
    });
    getLessonMock.mockResolvedValue(makeLesson("Être et Avoir", 8));
    listSetsMock.mockResolvedValue({sets: [makeSet()], sources: []});
    reviewQueueMock.mockResolvedValue([]);
    progressListMock.mockResolvedValue([]);
    progressGetMock.mockResolvedValue(null);
}

beforeEach(() => {
    listLessonsMock.mockReset();
    getLessonMock.mockReset();
    listSetsMock.mockReset();
    reviewQueueMock.mockReset();
    progressListMock.mockReset();
    progressGetMock.mockReset();
    setDefaults();
});

async function renderResolved(args: UseNextStepArgs) {
    const view = renderHook(() => useNextStepSuggestions(args));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    return view;
}

describe("computePrimaryAction", () => {
    it("3 stars with a next lesson → next", () => {
        expect(computePrimaryAction(3, true, true, true)).toBe("next");
    });
    it("2 stars with a next lesson → next", () => {
        expect(computePrimaryAction(2, true, true, false)).toBe("next");
    });
    it("0-1 stars with errors → adaptive", () => {
        expect(computePrimaryAction(1, true, true, false)).toBe("adaptive");
        expect(computePrimaryAction(0, true, true, false)).toBe("adaptive");
    });
    it("0-1 stars but no errors → next", () => {
        expect(computePrimaryAction(1, true, false, false)).toBe("next");
    });
    it("last lesson + errors → adaptive", () => {
        expect(computePrimaryAction(2, false, true, true)).toBe("adaptive");
    });
    it("last lesson + perfect + due review → review", () => {
        expect(computePrimaryAction(3, false, false, true)).toBe("review");
    });
    it("last lesson + perfect + nothing → next (harmless default)", () => {
        expect(computePrimaryAction(3, false, false, false)).toBe("next");
    });

    // Error replay (the exact failed exercises) outranks everything
    // after a weak run.
    it("0-1 stars with a replay → error_replay (over adaptive + next)", () => {
        expect(computePrimaryAction(0, true, true, true, true)).toBe(
            "error_replay",
        );
        expect(computePrimaryAction(1, true, true, false, true)).toBe(
            "error_replay",
        );
    });
    it("2-3 stars → next even when a replay is available", () => {
        expect(computePrimaryAction(2, true, true, false, true)).toBe("next");
        expect(computePrimaryAction(3, true, false, false, true)).toBe("next");
    });
    it("0-1 stars without a replay falls back to adaptive", () => {
        expect(computePrimaryAction(1, true, true, false, false)).toBe(
            "adaptive",
        );
    });
});

describe("useNextStepSuggestions", () => {
    it("returns the next lesson when not last in the set", async () => {
        const view = await renderResolved(BASE_ARGS);
        expect(view.result.current.nextLesson.available).toBe(true);
        expect(view.result.current.nextLesson.lessonFilename).toBe("04.json");
        expect(view.result.current.nextLesson.title).toBe("Être et Avoir");
        expect(view.result.current.nextLesson.totalSteps).toBe(8);
        expect(view.result.current.setComplete).toBe(false);
    });

    it("flags the next lesson as paused with a step counter", async () => {
        progressGetMock.mockResolvedValue(
            makeProgress({
                lesson_filename: "04.json",
                status: "paused",
                paused_at: NOW,
                step_results: {
                    "step-0": {correct: 1, total: 1},
                    "step-1": {correct: 1, total: 1},
                    "step-2": {correct: 0, total: 1},
                } as unknown as LessonProgress["step_results"],
            }),
        );
        const view = await renderResolved(BASE_ARGS);
        expect(view.result.current.nextLesson.isPaused).toBe(true);
        expect(view.result.current.nextLesson.pausedStep).toBe(3);
    });

    it("offers an adaptive lesson when there were errors", async () => {
        const view = await renderResolved({
            ...BASE_ARGS,
            stars: 1,
            sessionErrors: [makeError({error_count: 5})],
        });
        expect(view.result.current.adaptiveLesson.available).toBe(true);
        expect(view.result.current.adaptiveLesson.errorCount).toBe(5);
        // "le" vs "la" are both French articles → article_gender tag.
        expect(view.result.current.adaptiveLesson.focusTag).toBe(
            "article_gender",
        );
        // With failed exercises, error-replay is the primary action at
        // 0-1 stars — above the adaptive card.
        expect(view.result.current.primaryAction).toBe("adaptive");
    });

    it("exposes error replay when failed exercises were passed in", async () => {
        const view = await renderResolved({
            ...BASE_ARGS,
            stars: 1,
            failedExerciseCount: 3,
        });
        expect(view.result.current.errorReplay.available).toBe(true);
        expect(view.result.current.errorReplay.errorCount).toBe(3);
        // 0-1 stars + a replay → error_replay is the primary action.
        expect(view.result.current.primaryAction).toBe("error_replay");
    });

    it("hides error replay when there were no failed exercises", async () => {
        const view = await renderResolved({
            ...BASE_ARGS,
            stars: 3,
            failedExerciseCount: 0,
        });
        expect(view.result.current.errorReplay.available).toBe(false);
    });

    it("hides the adaptive lesson on a perfect score (no errors)", async () => {
        const view = await renderResolved({
            ...BASE_ARGS,
            stars: 3,
            sessionErrors: [],
        });
        expect(view.result.current.adaptiveLesson.available).toBe(false);
        expect(view.result.current.adaptiveLesson.errorCount).toBe(0);
        expect(view.result.current.primaryAction).toBe("next");
    });

    it("offers a review session when items are due", async () => {
        reviewQueueMock.mockResolvedValue([
            makeReviewItem(),
            makeReviewItem({id: "rq-2", overdue: true}),
        ]);
        const view = await renderResolved(BASE_ARGS);
        expect(view.result.current.reviewSession.available).toBe(true);
        expect(view.result.current.reviewSession.dueCount).toBe(2);
    });

    it("hides the review session when the queue is empty", async () => {
        reviewQueueMock.mockResolvedValue([]);
        const view = await renderResolved(BASE_ARGS);
        expect(view.result.current.reviewSession.available).toBe(false);
        expect(view.result.current.reviewSession.dueCount).toBe(0);
    });

    it("flags set-complete on the last lesson", async () => {
        const view = await renderResolved({
            ...BASE_ARGS,
            lessonFilename: "04.json",
        });
        expect(view.result.current.setComplete).toBe(true);
        expect(view.result.current.nextLesson.available).toBe(false);
        expect(view.result.current.setTitle).toBe("French A1");
        expect(view.result.current.lessonCount).toBe(5);
    });

    it("suggests another not-yet-finished set with the same source language", async () => {
        listSetsMock.mockResolvedValue({
            sets: [
                makeSet({id: "fr-a1", source_language: "en"}),
                makeSet({
                    id: "es-a1",
                    title: "Spanish A1",
                    source_language: "en",
                    target_language: "es",
                    lesson_count: 5,
                }),
                makeSet({
                    id: "de-a1",
                    title: "German for German speakers",
                    source_language: "de",
                    target_language: "de",
                    lesson_count: 5,
                }),
            ],
            sources: [],
        });
        const view = await renderResolved({
            ...BASE_ARGS,
            lessonFilename: "04.json",
        });
        expect(view.result.current.suggestedSet?.setId).toBe("es-a1");
        expect(view.result.current.suggestedSet?.title).toBe("Spanish A1");
    });

    it("never suggests a set the learner already completed 100%", async () => {
        listSetsMock.mockResolvedValue({
            sets: [
                makeSet({id: "fr-a1", source_language: "en"}),
                makeSet({
                    id: "es-a1",
                    title: "Spanish A1",
                    source_language: "en",
                    lesson_count: 2,
                }),
            ],
            sources: [],
        });
        progressListMock.mockResolvedValue([
            makeProgress({set_id: "es-a1", lesson_filename: "01.json"}),
            makeProgress({set_id: "es-a1", lesson_filename: "02.json"}),
        ]);
        const view = await renderResolved({
            ...BASE_ARGS,
            lessonFilename: "04.json",
        });
        // es-a1 has 2 lessons, both completed → excluded.
        expect(view.result.current.suggestedSet).toBeUndefined();
    });

    it("primaryAction is next on 3 stars with a next lesson", async () => {
        const view = await renderResolved({...BASE_ARGS, stars: 3});
        expect(view.result.current.primaryAction).toBe("next");
    });

    it("degrades gracefully when a storage read throws", async () => {
        listLessonsMock.mockRejectedValue(new Error("offline"));
        reviewQueueMock.mockRejectedValue(new Error("offline"));
        const view = await renderResolved({
            ...BASE_ARGS,
            sessionErrors: [makeError()],
        });
        // The hook never throws; the failed sources are unavailable
        // but the analyzer-derived adaptive card still works.
        expect(view.result.current.loading).toBe(false);
        expect(view.result.current.nextLesson.available).toBe(false);
        expect(view.result.current.reviewSession.available).toBe(false);
        expect(view.result.current.adaptiveLesson.available).toBe(true);
    });
});
