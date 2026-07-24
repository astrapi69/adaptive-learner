/**
 * #629 BUG 3c — the "N due" header badge must recompute live after a
 * review session changes SRS state, not stay stale until the next route
 * change / tab focus. The badge subscribes to the ``reviews-changed``
 * window event (``notifyReviewsChanged``); dispatching it re-reads the
 * queue and updates the count.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_k: string, fallback?: string) => fallback ?? _k,
        lang: "en",
    }),
}));

vi.mock("../../lib/learning/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

const listSetsMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {reviewQueue: reviewQueueMock},
        contentLoader: {listSets: listSetsMock},
    }),
}));

import NavReviewsBadge from "./NavReviewsBadge";
import {notifyReviewsChanged} from "../../lib/review/reviewsChanged";

function overdue(n: number) {
    return Array.from({length: n}, (_, i) => ({
        set_id: "fr-a1",
        element_key: `e${i}`,
        overdue: true,
    }));
}

beforeEach(() => {
    reviewQueueMock.mockReset();
    // fr-a1 is loadable by default → #1445 availability filter is a no-op.
    listSetsMock
        .mockReset()
        .mockResolvedValue({sets: [{source: "owner/repo", id: "fr-a1"}]});
});

describe("NavReviewsBadge: reviews-changed live recompute (#629)", () => {
    it("re-reads the queue and drops the count when reviews change", async () => {
        reviewQueueMock.mockResolvedValueOnce(overdue(98));
        render(
            <MemoryRouter>
                <NavReviewsBadge />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(screen.getByTestId("nav-reviews-badge")).toHaveTextContent(
                "98",
            ),
        );

        // Simulate the session having mastered the due elements.
        reviewQueueMock.mockResolvedValueOnce(overdue(0));
        notifyReviewsChanged();

        await waitFor(() =>
            expect(
                screen.queryByTestId("nav-reviews-badge"),
            ).not.toBeInTheDocument(),
        );
        expect(reviewQueueMock).toHaveBeenCalledTimes(2);
    });
});
