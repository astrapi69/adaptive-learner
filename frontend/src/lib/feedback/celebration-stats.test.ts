/**
 * Tests for celebration stats + completion wiring
 * (EXP-008 / Phase 55H).
 */

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

// Sound is irrelevant here; keep AudioContext out of the test.
vi.mock("../audio/sound-effects", () => ({playSound: vi.fn()}));

const storage = {
    gamification: {
        getState: vi.fn(),
        getStreak: vi.fn(),
        listBadges: vi.fn(),
    },
    elementErrors: {
        list: vi.fn(),
    },
};
vi.mock("../../storage", () => ({getStorage: () => storage}));

import {
    captureCelebrationSnapshot,
    celebrateProgressSince,
} from "./celebration-stats";
import {
    clearMilestoneQueue,
    milestoneQueueLength,
} from "./celebrationQueue";
import {setFeedbackIntensity} from "./feedbackPref";

function badge(key: string, earned: boolean, tier = "bronze") {
    return {
        key,
        name_key: `b.${key}.name`,
        description_key: `b.${key}.desc`,
        icon: "",
        category: "",
        base_tier: tier,
        tier,
        tier_thresholds: null,
        earned,
        earned_at: earned ? "2026-05-29" : null,
        progress: null,
    };
}

beforeEach(() => {
    localStorage.clear();
    clearMilestoneQueue();
    setFeedbackIntensity("normal");
    storage.gamification.getState.mockResolvedValue({level: 1});
    storage.gamification.getStreak.mockResolvedValue({
        current_streak_days: 6,
    });
    storage.elementErrors.list.mockResolvedValue([]);
    storage.gamification.listBadges.mockResolvedValue([]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("captureCelebrationSnapshot", () => {
    it("returns an empty snapshot for an anonymous run", async () => {
        const snap = await captureCelebrationSnapshot("");
        expect(snap).toEqual({
            level: 0,
            streakDays: 0,
            masteredCount: 0,
            earnedBadgeKeys: [],
            badgeTiers: {},
        });
        expect(storage.gamification.getState).not.toHaveBeenCalled();
    });

    it("aggregates level, streak, mastered count + earned badges", async () => {
        storage.gamification.getState.mockResolvedValue({level: 4});
        storage.gamification.getStreak.mockResolvedValue({
            current_streak_days: 12,
        });
        storage.elementErrors.list.mockResolvedValue([
            {mastered: true},
            {mastered: false},
            {mastered: true},
        ]);
        storage.gamification.listBadges.mockResolvedValue([
            badge("a", true),
            badge("b", false),
        ]);
        const snap = await captureCelebrationSnapshot("u1");
        expect(snap).toEqual({
            level: 4,
            streakDays: 12,
            masteredCount: 2,
            earnedBadgeKeys: ["a"],
            badgeTiers: {a: "bronze"},
        });
    });

    it("never throws when a read fails", async () => {
        storage.gamification.getState.mockRejectedValue(new Error("x"));
        const snap = await captureCelebrationSnapshot("u1");
        expect(snap.level).toBe(0);
    });
});

describe("celebrateProgressSince", () => {
    it("queues a streak + level milestone when the threshold is crossed", async () => {
        const before = {
            level: 1,
            streakDays: 6,
            masteredCount: 0,
            earnedBadgeKeys: [],
            badgeTiers: {},
        };
        storage.gamification.getState.mockResolvedValue({level: 2});
        storage.gamification.getStreak.mockResolvedValue({
            current_streak_days: 7,
        });
        await celebrateProgressSince("u1", before, () => ({
            name: "n",
            description: "d",
        }));
        // streak-7 + level-2.
        expect(milestoneQueueLength()).toBe(2);
    });

    it("queues a milestone for a newly earned badge", async () => {
        const before = {
            level: 1,
            streakDays: 6,
            masteredCount: 0,
            earnedBadgeKeys: [],
            badgeTiers: {},
        };
        storage.gamification.listBadges.mockResolvedValue([
            badge("first_lesson", true),
        ]);
        await celebrateProgressSince("u1", before, (b) => ({
            name: b.name_key,
            description: b.description_key,
        }));
        expect(milestoneQueueLength()).toBe(1);
    });

    it("does nothing for an anonymous run", async () => {
        await celebrateProgressSince(
            "",
            {
                level: 1,
                streakDays: 6,
                masteredCount: 0,
                earnedBadgeKeys: [],
                badgeTiers: {},
            },
            () => ({name: "n", description: "d"}),
        );
        expect(milestoneQueueLength()).toBe(0);
    });

    it("celebrates a tier UPGRADE on an already-earned dynamic badge", async () => {
        // Before: lessons_10 earned at bronze. After: same badge at silver.
        const before = {
            level: 1,
            streakDays: 6,
            masteredCount: 0,
            earnedBadgeKeys: ["lessons_10"],
            badgeTiers: {lessons_10: "bronze"},
        };
        storage.gamification.listBadges.mockResolvedValue([
            badge("lessons_10", true, "silver"),
        ]);
        await celebrateProgressSince(
            "u1",
            before,
            (b) => ({name: b.name_key, description: b.description_key}),
            (b, newTier) => ({name: b.name_key, message: newTier}),
        );
        // Tier-upgrade overlay queued (no NEW-earn since it was in before).
        expect(milestoneQueueLength()).toBe(1);
    });

    it("does NOT celebrate when an earned badge's tier is unchanged", async () => {
        const before = {
            level: 1,
            streakDays: 6,
            masteredCount: 0,
            earnedBadgeKeys: ["lessons_10"],
            badgeTiers: {lessons_10: "silver"},
        };
        storage.gamification.listBadges.mockResolvedValue([
            badge("lessons_10", true, "silver"),
        ]);
        await celebrateProgressSince("u1", before, (b) => ({
            name: b.name_key,
            description: b.description_key,
        }));
        expect(milestoneQueueLength()).toBe(0);
    });
});
