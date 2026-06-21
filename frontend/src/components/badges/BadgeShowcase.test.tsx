/**
 * BadgeShowcase render tests (Phase 29B).
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import BadgeShowcase from "./BadgeShowcase";

const SAMPLE = [
    {
        key: "first_session",
        name_key: "gamification.badges.first_session.name",
        description_key: "gamification.badges.first_session.description",
        icon: "rocket",
        category: "getting_started",
        base_tier: "bronze",
        tier: "bronze",
        tier_thresholds: null,
        earned: true,
        earned_at: "2026-05-21T12:00:00Z",
        progress: null,
    },
    {
        key: "streak_3_days",
        name_key: "gamification.badges.streak_3_days.name",
        description_key: "gamification.badges.streak_3_days.description",
        icon: "flame",
        category: "consistency",
        base_tier: "bronze",
        tier: "bronze",
        tier_thresholds: null,
        earned: false,
        earned_at: null,
        progress: null,
    },
];

describe("BadgeShowcase", () => {
    it("renders the loading placeholder on null badges", () => {
        render(<BadgeShowcase badges={null} />);
        expect(screen.getByTestId("badge-showcase-loading")).toBeTruthy();
    });

    it("renders the empty placeholder on []", () => {
        render(<BadgeShowcase badges={[]} />);
        expect(screen.getByTestId("badge-showcase-empty")).toBeTruthy();
    });

    it("groups badges by category", () => {
        render(<BadgeShowcase badges={SAMPLE} />);
        expect(
            screen.getByTestId("badge-category-getting_started"),
        ).toBeTruthy();
        expect(
            screen.getByTestId("badge-category-consistency"),
        ).toBeTruthy();
    });

    it("marks earned tiles with the earned attr + date", () => {
        render(<BadgeShowcase badges={SAMPLE} />);
        const earned = screen.getByTestId("badge-first_session");
        expect(earned.getAttribute("data-earned")).toBe("true");
        expect(
            screen.getByTestId("badge-first_session-earned-at"),
        ).toBeTruthy();
        const locked = screen.getByTestId("badge-streak_3_days");
        expect(locked.getAttribute("data-earned")).toBe("false");
    });

    it("shows the X / Y summary count", () => {
        render(<BadgeShowcase badges={SAMPLE} />);
        const count = screen.getByTestId("badge-showcase-count");
        expect(count.textContent).toContain("1");
        expect(count.textContent).toContain("2");
    });
});
