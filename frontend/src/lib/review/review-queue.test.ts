/**
 * #3170 - ``loadReviewQueue`` is the ONE place that turns the
 * "Auch fehlerfreie Elemente wiederholen" preference into the storage
 * option, so the review session, the header badge, the dashboard card,
 * the reminder and the next-step suggestions can never disagree about
 * whether never-wrong elements are due.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({elementErrors: {reviewQueue: reviewQueueMock}}),
}));

import {loadReviewQueue} from "./review-queue";
import {writeReviewIncludeNeverWrong} from "../learning/reviewIncludeNeverWrongPref";

beforeEach(() => {
    reviewQueueMock.mockReset();
    reviewQueueMock.mockResolvedValue([]);
});

afterEach(() => localStorage.clear());

describe("loadReviewQueue (#3170)", () => {
    it("asks for errors only while the preference is OFF (default)", async () => {
        await loadReviewQueue("u1", {setId: "es-a1"});
        expect(reviewQueueMock).toHaveBeenCalledWith("u1", {
            setId: "es-a1",
            includeNeverWrong: false,
        });
    });

    it("asks for never-wrong rows too once the preference is ON", async () => {
        writeReviewIncludeNeverWrong(true);
        await loadReviewQueue("u1");
        expect(reviewQueueMock).toHaveBeenCalledWith("u1", {
            includeNeverWrong: true,
        });
    });

    it("an explicit option wins over the preference", async () => {
        writeReviewIncludeNeverWrong(true);
        await loadReviewQueue("u1", {includeNeverWrong: false, limit: 3});
        expect(reviewQueueMock).toHaveBeenCalledWith("u1", {
            includeNeverWrong: false,
            limit: 3,
        });
    });

    it("returns whatever the storage returns", async () => {
        reviewQueueMock.mockResolvedValue([{element_key: "merci"}]);
        await expect(loadReviewQueue("u1")).resolves.toEqual([
            {element_key: "merci"},
        ]);
    });
});
