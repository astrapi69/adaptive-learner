/**
 * Tests for milestone detection (EXP-008 / Phase 55D).
 */

import {describe, expect, it} from "vitest";

import {
    badgeMilestone,
    detectLevelUp,
    detectMasteryMilestone,
    detectMilestones,
    detectStreakMilestone,
} from "./milestones";

describe("detectStreakMilestone", () => {
    it("fires when a threshold is newly crossed", () => {
        expect(detectStreakMilestone(6, 7)?.value).toBe(7);
        expect(detectStreakMilestone(29, 30)?.value).toBe(30);
        expect(detectStreakMilestone(99, 100)?.value).toBe(100);
    });

    it("does not fire below a threshold or when already past it", () => {
        expect(detectStreakMilestone(5, 6)).toBeNull();
        expect(detectStreakMilestone(7, 8)).toBeNull();
        expect(detectStreakMilestone(30, 31)).toBeNull();
    });

    it("returns the highest threshold crossed in one jump", () => {
        expect(detectStreakMilestone(0, 100)?.value).toBe(100);
    });
});

describe("detectMasteryMilestone", () => {
    it("fires at 50 / 100 / 500", () => {
        expect(detectMasteryMilestone(49, 50)?.value).toBe(50);
        expect(detectMasteryMilestone(99, 100)?.value).toBe(100);
        expect(detectMasteryMilestone(499, 500)?.value).toBe(500);
    });

    it("does not fire between thresholds", () => {
        expect(detectMasteryMilestone(100, 200)).toBeNull();
    });
});

describe("detectLevelUp", () => {
    it("fires on any level increase, reporting the new level", () => {
        expect(detectLevelUp(4, 5)?.value).toBe(5);
        expect(detectLevelUp(4, 7)?.value).toBe(7);
    });

    it("does not fire when the level is unchanged or lower", () => {
        expect(detectLevelUp(5, 5)).toBeNull();
        expect(detectLevelUp(6, 5)).toBeNull();
    });
});

describe("detectMilestones", () => {
    it("collects every milestone crossed, streak -> level -> mastery", () => {
        const result = detectMilestones(
            {streakDays: 6, masteredCount: 49, level: 4},
            {streakDays: 7, masteredCount: 50, level: 5},
        );
        expect(result.map((m) => m.type)).toEqual([
            "streak",
            "level_up",
            "mastery",
        ]);
    });

    it("returns an empty list when nothing crossed", () => {
        expect(
            detectMilestones(
                {streakDays: 2, masteredCount: 10, level: 1},
                {streakDays: 3, masteredCount: 11, level: 1},
            ),
        ).toEqual([]);
    });
});

describe("badgeMilestone", () => {
    it("builds a badge milestone with id + metadata", () => {
        const m = badgeMilestone("streak_3_days", "Consistent", "3 days running");
        expect(m).toMatchObject({
            id: "badge-streak_3_days",
            type: "badge",
            badgeName: "Consistent",
            badgeDescription: "3 days running",
        });
    });
});
