/**
 * Tests for DailyMissionsCard (EXP-010 / Phase 56F).
 */

import "@testing-library/jest-dom/vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

import DailyMissionsCard from "./DailyMissionsCard";
import type {DailyMission} from "../../lib/missions/types";

const getDaily = vi.fn();
vi.mock("../../storage", () => ({
    getStorage: () => ({missions: {getDaily}}),
}));

function mission(
    id: string,
    progress: number,
    target: number,
    completed: boolean,
): DailyMission {
    return {
        id: `row-${id}`,
        template_id: id,
        assigned_date: "2026-05-29",
        progress,
        target,
        completed,
        xp_awarded: false,
        template: {
            id,
            title_key: `missions.templates.${id}.title`,
            description_key: `missions.templates.${id}.description`,
            category: "learning",
            target_value: target,
            difficulty: "easy",
            xp_reward: 20,
            icon: "book-open",
            check_function: "lessons_completed_today",
        },
    };
}

beforeEach(() => {
    localStorage.clear();
    getDaily.mockReset();
});

describe("DailyMissionsCard", () => {
    it("renders today's missions with progress + XP", async () => {
        getDaily.mockResolvedValue({
            missions: [
                mission("complete-1-lesson", 0, 1, false),
                mission("review-5-elements", 2, 5, false),
            ],
            newlyCompleted: [],
        });
        render(<DailyMissionsCard userId="u1" />);
        await screen.findByTestId("mission-complete-1-lesson");
        expect(
            screen.getByTestId("mission-progress-review-5-elements"),
        ).toHaveTextContent("2 / 5");
        // Both seeded missions carry a 20 XP reward.
        expect(screen.getAllByText(/\+20 XP/)).toHaveLength(2);
    });

    it("shows the all-done state when every mission is complete", async () => {
        getDaily.mockResolvedValue({
            missions: [mission("complete-1-lesson", 1, 1, true)],
            newlyCompleted: [],
        });
        render(<DailyMissionsCard userId="u1" />);
        await screen.findByTestId("daily-missions-alldone");
        const row = screen.getByTestId("mission-complete-1-lesson");
        expect(row).toHaveAttribute("data-completed", "true");
    });

    it("renders nothing when missions are disabled in prefs", () => {
        localStorage.setItem("adaptive-learner.missions.enabled", "false");
        const {container} = render(<DailyMissionsCard userId="u1" />);
        expect(container).toBeEmptyDOMElement();
        expect(getDaily).not.toHaveBeenCalled();
    });

    it("passes the count + difficulty prefs to getDaily", async () => {
        localStorage.setItem("adaptive-learner.missions.count", "2");
        localStorage.setItem(
            "adaptive-learner.missions.difficulty_mix",
            "easy",
        );
        getDaily.mockResolvedValue({missions: [], newlyCompleted: []});
        render(<DailyMissionsCard userId="u1" />);
        await waitFor(() => expect(getDaily).toHaveBeenCalled());
        const opts = getDaily.mock.calls[0][1];
        expect(opts.count).toBe(2);
        expect(opts.difficultyMix).toBe("easy");
    });
});
