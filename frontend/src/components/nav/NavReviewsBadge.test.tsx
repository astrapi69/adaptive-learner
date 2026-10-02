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

describe("NavReviewsBadge: count-only below 2xl (#3123, #3339)", () => {
    it("renders the count in its own span and hides only the word below 2xl", async () => {
        reviewQueueMock.mockResolvedValue(overdue(718));
        render(
            <MemoryRouter>
                <NavReviewsBadge />
            </MemoryRouter>,
        );
        const badge = await screen.findByTestId("nav-reviews-badge");
        // The count is always visible; the surrounding word (" due") sits in
        // a span that the 2xl breakpoint hides, so a 375px phone bar and the
        // single-row 1280px desktop bar both show "718" (#3339: with the
        // word the desktop row ran out of room).
        expect(screen.getByTestId("nav-reviews-badge-count")).toHaveTextContent(
            "718",
        );
        expect(screen.getByTestId("nav-reviews-badge-count").className).not.toContain(
            "max-2xl:hidden",
        );
        // #3339 - a crowded bar must never flex-shrink the badge (the icon
        // became a sliver).
        expect(badge.className).toContain("shrink-0");
        const hidden = [...badge.querySelectorAll("span.max-2xl\\:hidden")];
        expect(hidden.map((el) => el.textContent).join("")).toBe(" due");
        // The full label survives in the accessible name and the tooltip.
        expect(badge.getAttribute("aria-label")).toContain("718 due");
        expect(badge).toHaveTextContent("718 due");
    });
});
