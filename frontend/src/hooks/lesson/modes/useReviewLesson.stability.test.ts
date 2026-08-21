/**
 * #2703 — the SRS fetch must not restart merely because the DISPLAY title
 * or description changed between renders.
 *
 * ``title`` is ``t("review.session_title", "Review session")``: on first
 * paint (before the async i18n catalog resolves) that's the caller-supplied
 * English fallback; once the catalog lands it flips to the translated
 * string. When the fetch effect depended on that value directly, the
 * catalog landing after the review session was already "ready" tore the
 * session back down to "loading" and re-queried the SRS queue — an
 * #1540-class coin flip hitting AFTER first paint instead of before it,
 * which is how a review-session visual baseline could capture the empty
 * state after the active session had already rendered.
 *
 * These tests pin: a title/description change alone must not touch the
 * queue/listSets/getLesson calls or move the hook out of "ready"; an
 * explicit ``reload()`` still picks up whatever title/description is
 * current at that moment.
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();
const listSetsMock = vi.fn();
const getLessonMock = vi.fn();

vi.mock("../../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            reviewQueue: reviewQueueMock,
            recordBulk: vi.fn().mockResolvedValue([]),
        },
        contentLoader: {listSets: listSetsMock, getLesson: getLessonMock},
    }),
}));

import {useReviewLesson} from "./useReviewLesson";
import type {ContentLesson, ContentLessonExercise, ReviewQueueItem} from "../../../storage/types";

const SET_ID = "es-a1";

function matching(id: string): ContentLessonExercise {
    return {
        id,
        type: "matching",
        prompt: `Match (${id})`,
        card_ids: ["c-libro", "c-casa", "c-perro"],
        pairs: [
            {left: "libro", right: "book"},
            {left: "casa", right: "house"},
            {left: "perro", right: "dog"},
        ],
        distractors: [],
    };
}

function lessonWith(lessonId: string, exercises: ContentLessonExercise[]): ContentLesson {
    return {
        id: lessonId,
        title: lessonId,
        description: null,
        estimated_minutes: 5,
        cards: [],
        steps: exercises.map((ex) => ({
            id: `step-${ex.id}`,
            type: "exercise" as const,
            title: null,
            exercise: ex,
        })),
    };
}

function qItem(over: Partial<ReviewQueueItem>): ReviewQueueItem {
    return {
        id: `row-${over.element_key ?? "x"}`,
        user_id: "user-1",
        set_id: SET_ID,
        lesson_id: "L1",
        exercise_id: "ex-match",
        element_key: "libro",
        direction: "target_to_source",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "book",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T00:00:00Z",
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: true,
        ...over,
    };
}

beforeEach(() => {
    reviewQueueMock.mockReset();
    listSetsMock.mockReset();
    getLessonMock.mockReset();
    listSetsMock.mockResolvedValue({sets: [{id: SET_ID, source: "bundled:es"}]});
    reviewQueueMock.mockResolvedValue([qItem({})]);
    getLessonMock.mockResolvedValue(lessonWith("L1", [matching("ex-match")]));
});

describe("#2703 useReviewLesson: title/description are display-only", () => {
    it("a title change after ready does not refetch or leave the ready state", async () => {
        const {result, rerender} = renderHook(
            ({title}: {title: string}) => useReviewLesson({setId: SET_ID, title, limit: 20}),
            {initialProps: {title: "Review session"}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(reviewQueueMock).toHaveBeenCalledTimes(1);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        expect(getLessonMock).toHaveBeenCalledTimes(1);

        // Simulate the i18n catalog landing: the caller now passes the
        // translated title instead of the English fallback.
        rerender({title: "Wiederholungssitzung"});

        // Give any (incorrect) re-fetch a chance to happen before asserting
        // it didn't.
        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.status).toBe("ready");
        expect(reviewQueueMock).toHaveBeenCalledTimes(1);
        expect(listSetsMock).toHaveBeenCalledTimes(1);
        expect(getLessonMock).toHaveBeenCalledTimes(1);
    });

    it("a description change alone does not refetch either", async () => {
        const {result, rerender} = renderHook(
            ({description}: {description: string | null}) =>
                useReviewLesson({setId: SET_ID, title: "Review", description, limit: 20}),
            {initialProps: {description: null as string | null}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(reviewQueueMock).toHaveBeenCalledTimes(1);

        rerender({description: "A localised subtitle"});
        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.status).toBe("ready");
        expect(reviewQueueMock).toHaveBeenCalledTimes(1);
    });

    it("reload() still refetches and picks up whatever title is current", async () => {
        const {result, rerender} = renderHook(
            ({title}: {title: string}) => useReviewLesson({setId: SET_ID, title, limit: 20}),
            {initialProps: {title: "Review session"}},
        );
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(reviewQueueMock).toHaveBeenCalledTimes(1);

        rerender({title: "Wiederholungssitzung"});
        act(() => {
            result.current.reload();
        });
        await waitFor(() => expect(result.current.status).toBe("ready"));

        // reload() is an explicit user action — it MUST refetch.
        expect(reviewQueueMock).toHaveBeenCalledTimes(2);
        // The refreshed lesson carries the CURRENT title, not the stale one
        // captured at mount.
        expect(result.current.lesson?.title).toBe("Wiederholungssitzung");
    });
});
