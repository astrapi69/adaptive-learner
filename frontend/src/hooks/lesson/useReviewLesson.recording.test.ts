/**
 * #629 BUG 3a/3c — recording a review step must persist the SRS update
 * (``elementErrors.recordBulk``) AND fire the reviews-changed signal so
 * the header badge recomputes. Review sessions are ephemeral, but the
 * ElementError rows are the whole point — if recordBulk isn't called the
 * due count never drops and the badge stays stuck.
 */

import {act, renderHook} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const recordBulkMock = vi.fn().mockResolvedValue([]);
const reviewQueueMock = vi.fn().mockResolvedValue([]);

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            recordBulk: recordBulkMock,
            reviewQueue: reviewQueueMock,
        },
        contentLoader: {listSets: vi.fn(), getLesson: vi.fn()},
    }),
}));

import {useReviewLesson} from "./useReviewLesson";
import {REVIEWS_CHANGED_EVENT} from "../../lib/review/reviewsChanged";
import type {ElementAttempt} from "../../storage/types";

beforeEach(() => {
    recordBulkMock.mockClear();
    reviewQueueMock.mockClear();
});

const ATTEMPTS: ElementAttempt[] = [
    {
        set_id: "fr-a1",
        lesson_id: "01.json",
        exercise_id: "ex-a",
        element_key: "merci",
        correct: true,
    },
];

describe("useReviewLesson.recordStepAttempts (#629)", () => {
    it("persists via recordBulk and notifies reviews-changed", async () => {
        const {result} = renderHook(() =>
            useReviewLesson({setId: "fr-a1", title: "Review", limit: 20}),
        );
        const reviewsChanged = vi.fn();
        window.addEventListener(REVIEWS_CHANGED_EVENT, reviewsChanged);

        await act(async () => {
            await result.current.recordStepAttempts(ATTEMPTS);
        });

        expect(recordBulkMock).toHaveBeenCalledTimes(1);
        expect(recordBulkMock.mock.calls[0][0]).toBe("user-1");
        expect(reviewsChanged).toHaveBeenCalledTimes(1);
        // Session tally surfaces for the summary screen.
        expect(result.current.sessionScoreCorrect).toBe(1);
        expect(result.current.sessionScoreTotal).toBe(1);

        window.removeEventListener(REVIEWS_CHANGED_EVENT, reviewsChanged);
    });
});
