/**
 * BadgeGallery render + filter/sort/expand tests (Phase 57 / F-129).
 *
 * useI18n is unmocked here — it returns the fallback string when no
 * provider wraps the tree, which is what these assertions check
 * against (English fallbacks).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import BadgeGallery from "./BadgeGallery";
import type {BadgeWithProgress} from "../../storage/types";

function badge(
    over: Partial<BadgeWithProgress> & {key: string},
): BadgeWithProgress {
    return {
        name_key: `gamification.badges.${over.key}.name`,
        description_key: `gamification.badges.${over.key}.description`,
        icon: "star",
        category: "depth",
        base_tier: "bronze",
        tier: "bronze",
        tier_thresholds: null,
        earned: false,
        earned_at: null,
        progress: null,
        ...over,
    };
}

const BADGES: BadgeWithProgress[] = [
    badge({
        key: "first_session",
        category: "getting_started",
        earned: true,
        earned_at: "2026-05-20T10:00:00Z",
    }),
    badge({
        key: "sessions_100",
        base_tier: "gold",
        tier: "gold",
        earned: true,
        earned_at: "2026-05-25T10:00:00Z",
    }),
    badge({
        key: "lessons_10",
        earned: true,
        tier: "silver",
        earned_at: "2026-05-22T10:00:00Z",
        tier_thresholds: {
            bronze: {threshold: 10, xp_bonus: 50},
            silver: {threshold: 50, xp_bonus: 150},
            gold: {threshold: 100, xp_bonus: 300},
        },
    }),
    badge({key: "review_master", earned: false, tier: "bronze"}),
];

describe("BadgeGallery", () => {
    it("renders nothing visible when closed", () => {
        render(
            <BadgeGallery open={false} onClose={vi.fn()} badges={BADGES} />,
        );
        expect(screen.queryByTestId("badge-gallery")).not.toBeInTheDocument();
    });

    it("renders the count and a card per badge when open", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        expect(screen.getByTestId("badge-gallery-count")).toHaveTextContent(
            /3\s*\/\s*4/,
        );
        for (const b of BADGES) {
            expect(
                screen.getByTestId(`badge-card-${b.key}`),
            ).toBeInTheDocument();
        }
    });

    it("locked badge renders with data-earned=false + a locked hint", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        const card = screen.getByTestId("badge-card-review_master");
        expect(card.getAttribute("data-earned")).toBe("false");
        expect(card.getAttribute("data-tier")).toBe("locked");
        expect(
            screen.getByTestId("badge-card-locked-review_master"),
        ).toBeInTheDocument();
    });

    it("shows the earned tier label on an earned badge", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        expect(
            screen.getByTestId("badge-card-tier-sessions_100"),
        ).toHaveTextContent(/gold/i);
    });

    it("category filter narrows the grid", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        fireEvent.click(screen.getByTestId("badge-filter-getting_started"));
        expect(
            screen.getByTestId("badge-card-first_session"),
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId("badge-card-sessions_100"),
        ).not.toBeInTheDocument();
    });

    it("expands a card to show the tier breakdown for a dynamic badge", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        expect(
            screen.queryByTestId("badge-card-detail-lessons_10"),
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("badge-card-toggle-lessons_10"));
        const detail = screen.getByTestId("badge-card-detail-lessons_10");
        expect(detail).toBeInTheDocument();
        // Tier-threshold table lists all three numeric thresholds.
        expect(detail).toHaveTextContent("10");
        expect(detail).toHaveTextContent("50");
        expect(detail).toHaveTextContent("100");
    });

    it("sort control switches ordering without crashing", () => {
        render(<BadgeGallery open onClose={vi.fn()} badges={BADGES} />);
        fireEvent.change(screen.getByTestId("badge-gallery-sort"), {
            target: {value: "category"},
        });
        expect(screen.getByTestId("badge-gallery-grid")).toBeInTheDocument();
    });
});
