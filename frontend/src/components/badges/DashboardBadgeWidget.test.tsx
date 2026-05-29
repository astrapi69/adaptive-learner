/**
 * DashboardBadgeWidget tests (Phase 57 / 57F).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import DashboardBadgeWidget from "./DashboardBadgeWidget";
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
    badge({key: "first_session", earned: true, earned_at: "2026-05-20"}),
    badge({key: "sessions_50", tier: "silver", earned: true, earned_at: "2026-05-25"}),
    badge({key: "level_5", earned: true, earned_at: "2026-05-22"}),
    badge({key: "lessons_10", earned: true, earned_at: "2026-05-10"}),
    badge({key: "review_master", earned: false, category: "depth"}),
];

describe("DashboardBadgeWidget", () => {
    it("shows a loading state for null badges", () => {
        render(<DashboardBadgeWidget badges={null} />);
        expect(
            screen.getByTestId("dashboard-badge-loading"),
        ).toBeInTheDocument();
    });

    it("renders the earned count and the 3 most recent badges", () => {
        render(<DashboardBadgeWidget badges={BADGES} />);
        expect(screen.getByTestId("badge-widget-count")).toHaveTextContent(
            /4\s*\/\s*5/,
        );
        // 3 most recent by earned_at desc: sessions_50, level_5, first_session.
        expect(
            screen.getByTestId("badge-widget-recent-sessions_50"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("badge-widget-recent-level_5"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("badge-widget-recent-first_session"),
        ).toBeInTheDocument();
        // The 4th-most-recent (lessons_10) is NOT in the recent strip.
        expect(
            screen.queryByTestId("badge-widget-recent-lessons_10"),
        ).not.toBeInTheDocument();
    });

    it("shows the next (first locked) badge", () => {
        render(<DashboardBadgeWidget badges={BADGES} />);
        const next = screen.getByTestId("badge-widget-next");
        expect(next).toHaveTextContent(/review_master|Review/i);
    });

    it("opens the gallery from the count button", () => {
        render(<DashboardBadgeWidget badges={BADGES} />);
        expect(screen.queryByTestId("badge-gallery")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("badge-widget-count"));
        expect(screen.getByTestId("badge-gallery")).toBeInTheDocument();
    });

    it("opens the gallery from View all", () => {
        render(<DashboardBadgeWidget badges={BADGES} />);
        fireEvent.click(screen.getByTestId("badge-widget-view-all"));
        expect(screen.getByTestId("badge-gallery")).toBeInTheDocument();
    });
});
