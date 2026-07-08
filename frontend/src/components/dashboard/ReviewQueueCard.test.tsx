/**
 * Tests for the Dashboard ReviewQueueCard widget
 * (Phase 46C / C13 / P-129).
 *
 * Pins:
 * - empty queue → returns null (no card rendered)
 * - non-empty queue → card renders with total count
 * - overdue count appears when > 0, hides when 0
 * - "Open review session" CTA links to the first set
 * - errors hide the widget (catch branch sets items=[])
 * - missing userId hides the widget
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();
const listSetsMock = vi.fn();

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {
            list: vi.fn(),
            recordBulk: vi.fn(),
            reviewQueue: reviewQueueMock,
        },
        contentLoader: {
            listSets: listSetsMock,
        },
    }),
}));

import ReviewQueueCard from "./ReviewQueueCard";
import {notifyReviewsChanged} from "../../lib/review/reviewsChanged";
import type {ReviewQueueItem} from "../../storage/types";

function item(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
    return {
        id: "row-1",
        user_id: "user-1",
        set_id: "language-fr-a1",
        lesson_id: "01-greetings.json",
        exercise_id: "ex-thanks",
        element_key: "merci",
        element_type: "vocabulary",
        user_answer: "",
        correct_answer: "Merci",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-05-27T00:00:00Z",
        last_attempt_at: "2026-05-27T00:00:00Z",
        suggested_review_at: "2026-05-28T00:00:00Z",
        overdue: false,
        ...overrides,
    };
}

function LocationProbe() {
    const {pathname, search} = useLocation();
    return <span data-testid="location-probe">{pathname + search}</span>;
}

function renderCard(userId: string) {
    return render(
        <MemoryRouter>
            <ReviewQueueCard userId={userId} />
            <LocationProbe />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    reviewQueueMock.mockReset();
    listSetsMock.mockReset();
    // By default every referenced set is loadable, so availability filtering
    // (#1445) is a no-op unless a test overrides the set list.
    listSetsMock.mockResolvedValue({
        sets: [
            {source: "astrapi69/adaptive-learner-content", id: "language-fr-a1"},
            {source: "astrapi69/adaptive-learner-content", id: "other-set"},
        ],
    });
});

describe("ReviewQueueCard: empty + loading", () => {
    it("renders nothing when the queue is empty", async () => {
        reviewQueueMock.mockResolvedValue([]);
        const {container} = renderCard("user-1");
        await waitFor(() => {
            expect(reviewQueueMock).toHaveBeenCalled();
        });
        expect(container.textContent ?? "").not.toContain(
            "Open review session",
        );
        expect(
            screen.queryByTestId("review-queue-card"),
        ).not.toBeInTheDocument();
    });

    it("renders nothing when userId is empty", async () => {
        renderCard("");
        // reviewQueue is never called for empty userId.
        await new Promise((r) => setTimeout(r, 10));
        expect(reviewQueueMock).not.toHaveBeenCalled();
    });

    it("hides the widget when the fetch throws", async () => {
        reviewQueueMock.mockRejectedValue(new Error("boom"));
        renderCard("user-1");
        await waitFor(() => {
            expect(reviewQueueMock).toHaveBeenCalled();
        });
        expect(
            screen.queryByTestId("review-queue-card"),
        ).not.toBeInTheDocument();
    });
});

describe("ReviewQueueCard: populated queue", () => {
    it("renders the card with the total count", async () => {
        reviewQueueMock.mockResolvedValue([item(), item({id: "row-2"})]);
        renderCard("user-1");
        await waitFor(() => {
            expect(
                screen.getByTestId("review-queue-card"),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByTestId("review-queue-total"),
        ).toHaveTextContent("2");
    });

    it("renders the overdue counter when > 0", async () => {
        reviewQueueMock.mockResolvedValue([
            item({id: "a", overdue: true}),
            item({id: "b", overdue: true}),
            item({id: "c", overdue: false}),
        ]);
        renderCard("user-1");
        const overdue = await screen.findByTestId("review-queue-overdue");
        expect(overdue).toHaveTextContent("2");
    });

    it("hides the overdue counter when none overdue", async () => {
        reviewQueueMock.mockResolvedValue([item({overdue: false})]);
        renderCard("user-1");
        await screen.findByTestId("review-queue-card");
        expect(
            screen.queryByTestId("review-queue-overdue"),
        ).not.toBeInTheDocument();
    });

    it("CTA navigates to /review/{first-set-id}", async () => {
        reviewQueueMock.mockResolvedValue([
            item({set_id: "language-fr-a1"}),
            item({id: "row-2", set_id: "other-set"}),
        ]);
        renderCard("user-1");
        const cta = await screen.findByTestId("review-queue-start");
        fireEvent.click(cta);
        expect(screen.getByTestId("location-probe")).toHaveTextContent(
            "/review/language-fr-a1",
        );
    });

    it("Quick review navigates to /review/{set}?quick=1 (#628)", async () => {
        reviewQueueMock.mockResolvedValue([
            item({set_id: "language-fr-a1"}),
        ]);
        renderCard("user-1");
        const quick = await screen.findByTestId("review-queue-secondary");
        fireEvent.click(quick);
        expect(screen.getByTestId("location-probe")).toHaveTextContent(
            "/review/language-fr-a1?quick=1",
        );
    });

    it("hides review items whose set is no longer loadable (#1445)", async () => {
        // The repo providing "orphan-set" was removed → listSets omits it.
        reviewQueueMock.mockResolvedValue([
            item({id: "keep", set_id: "language-fr-a1", overdue: true}),
            item({id: "drop", set_id: "orphan-set", overdue: true}),
        ]);
        listSetsMock.mockResolvedValue({
            sets: [
                {
                    source: "astrapi69/adaptive-learner-content",
                    id: "language-fr-a1",
                },
            ],
        });
        renderCard("user-1");
        // Only the loadable item is counted; the CTA points at it, never the
        // orphaned set.
        const cta = await screen.findByTestId("review-queue-start");
        fireEvent.click(cta);
        expect(screen.getByTestId("location-probe")).toHaveTextContent(
            "/review/language-fr-a1",
        );
    });

    it("renders nothing when every review item is orphaned (#1445)", async () => {
        reviewQueueMock.mockResolvedValue([
            item({id: "a", set_id: "orphan-set", overdue: true}),
        ]);
        listSetsMock.mockResolvedValue({sets: []});
        renderCard("user-1");
        await waitFor(() =>
            expect(reviewQueueMock).toHaveBeenCalled(),
        );
        expect(
            screen.queryByTestId("review-queue-card"),
        ).not.toBeInTheDocument();
    });
});

describe("ReviewQueueCard: reviews-changed live recompute (#761)", () => {
    it("re-reads the queue and decrements when reviews change", async () => {
        reviewQueueMock.mockResolvedValue([
            item({id: "a", overdue: true}),
            item({id: "b", overdue: true}),
        ]);
        renderCard("user-1");
        await waitFor(() =>
            expect(
                screen.getByTestId("review-queue-total"),
            ).toHaveTextContent("2"),
        );

        // A review answer mastered one element — the queue shrinks. The
        // card must recompute live without a remount / route change.
        reviewQueueMock.mockResolvedValue([item({id: "a", overdue: true})]);
        notifyReviewsChanged();
        await waitFor(() =>
            expect(
                screen.getByTestId("review-queue-total"),
            ).toHaveTextContent("1"),
        );
    });

    it("hides the card once the queue empties after a review", async () => {
        reviewQueueMock.mockResolvedValue([item({id: "a", overdue: true})]);
        renderCard("user-1");
        await screen.findByTestId("review-queue-card");

        reviewQueueMock.mockResolvedValue([]);
        notifyReviewsChanged();
        await waitFor(() =>
            expect(
                screen.queryByTestId("review-queue-card"),
            ).not.toBeInTheDocument(),
        );
    });
});
