/**
 * #664 — the nav "N due" badge must count UNIQUE due elements (deduped by
 * element_key), consistent with the review session. Before the fix it
 * counted raw overdue rows, so the per-direction EXP-018 rows (receptive +
 * productive of one card = 2 rows, same element_key) double-counted and the
 * badge ran far past what any session can present (e.g. "98 due" vs a 20-cap
 * session). Pinned across repro / happy-path / edge / boundary.
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";

const reviewQueueMock = vi.fn();

vi.mock("../../hooks/ui/useI18n", () => ({
    useI18n: () => ({
        t: (_k: string, fallback?: string) => fallback ?? _k,
        lang: "en",
    }),
}));

vi.mock("../../lib/learnerState", () => ({
    readLearnerState: () => ({userId: "user-1"}),
}));

vi.mock("../../storage", () => ({
    getStorage: () => ({
        elementErrors: {reviewQueue: reviewQueueMock},
    }),
}));

import NavReviewsBadge from "./NavReviewsBadge";

interface QRow {
    set_id: string;
    element_key: string;
    direction?: string;
    overdue: boolean;
}

function row(over: Partial<QRow>): QRow {
    return {
        set_id: "es-a1",
        element_key: "libro",
        direction: "target_to_source",
        overdue: true,
        ...over,
    };
}

beforeEach(() => {
    reviewQueueMock.mockReset();
});

function renderBadge() {
    return render(
        <MemoryRouter>
            <NavReviewsBadge />
        </MemoryRouter>,
    );
}

describe("#664 NavReviewsBadge: dedup by element_key", () => {
    it("repro: per-direction rows of one card count ONCE, not twice", async () => {
        // 3 cards, each with both EXP-018 directions overdue = 6 raw rows but
        // only 3 unique elements. The badge must show 3, not 6.
        reviewQueueMock.mockResolvedValue([
            row({element_key: "libro", direction: "target_to_source"}),
            row({element_key: "libro", direction: "source_to_target"}),
            row({element_key: "casa", direction: "target_to_source"}),
            row({element_key: "casa", direction: "source_to_target"}),
            row({element_key: "perro", direction: "target_to_source"}),
            row({element_key: "perro", direction: "source_to_target"}),
        ]);
        renderBadge();
        await waitFor(() =>
            expect(screen.getByTestId("nav-reviews-badge")).toHaveTextContent(
                "3",
            ),
        );
        expect(
            screen.getByTestId("nav-reviews-badge"),
        ).not.toHaveTextContent("6");
    });

    it("happy path: distinct elements all count (no over-dedup)", async () => {
        reviewQueueMock.mockResolvedValue([
            row({element_key: "a"}),
            row({element_key: "b"}),
            row({element_key: "c"}),
        ]);
        renderBadge();
        await waitFor(() =>
            expect(screen.getByTestId("nav-reviews-badge")).toHaveTextContent(
                "3",
            ),
        );
    });

    it("edge: only non-overdue rows → badge hidden", async () => {
        reviewQueueMock.mockResolvedValue([
            row({element_key: "a", overdue: false}),
            row({element_key: "b", overdue: false}),
        ]);
        renderBadge();
        await waitFor(() => expect(reviewQueueMock).toHaveBeenCalled());
        expect(
            screen.queryByTestId("nav-reviews-badge"),
        ).not.toBeInTheDocument();
    });

    it("boundary: 98 raw rows over 49 cards (x2 directions) → badge shows 49", async () => {
        const rows: QRow[] = [];
        for (let i = 0; i < 49; i += 1) {
            rows.push(row({element_key: `e${i}`, direction: "target_to_source"}));
            rows.push(row({element_key: `e${i}`, direction: "source_to_target"}));
        }
        reviewQueueMock.mockResolvedValue(rows);
        renderBadge();
        await waitFor(() =>
            expect(screen.getByTestId("nav-reviews-badge")).toHaveTextContent(
                "49",
            ),
        );
    });

    it("links to the first DUE element's set", async () => {
        reviewQueueMock.mockResolvedValue([
            row({element_key: "a", set_id: "fr-a1"}),
            row({element_key: "a", set_id: "fr-a1", direction: "source_to_target"}),
        ]);
        renderBadge();
        await waitFor(() =>
            expect(screen.getByTestId("nav-reviews-badge")).toBeInTheDocument(),
        );
        expect(screen.getByTestId("nav-reviews-badge")).toHaveAttribute(
            "href",
            "/review/fr-a1",
        );
    });
});
