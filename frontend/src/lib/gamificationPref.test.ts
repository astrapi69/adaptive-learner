/**
 * Unit tests for the localStorage-backed gamification prefs
 * (Phase 29D).
 */

import {beforeEach, describe, expect, it} from "vitest";

import {
    GAMIFICATION_PREF_KEYS,
    readGamificationPrefs,
    setBadgeNotifications,
    setDailySessionGoal,
    setXpNotifications,
} from "./gamificationPref";

beforeEach(() => {
    localStorage.clear();
});

describe("readGamificationPrefs", () => {
    it("returns sensible defaults when nothing is persisted", () => {
        const prefs = readGamificationPrefs();
        expect(prefs.xpNotifications).toBe(true);
        expect(prefs.badgeNotifications).toBe(true);
        expect(prefs.dailySessionGoal).toBe(1);
    });

    it("reads persisted values", () => {
        localStorage.setItem(GAMIFICATION_PREF_KEYS.xpNotifications, "false");
        localStorage.setItem(GAMIFICATION_PREF_KEYS.badgeNotifications, "false");
        localStorage.setItem(GAMIFICATION_PREF_KEYS.dailySessionGoal, "3");
        const prefs = readGamificationPrefs();
        expect(prefs.xpNotifications).toBe(false);
        expect(prefs.badgeNotifications).toBe(false);
        expect(prefs.dailySessionGoal).toBe(3);
    });
});

describe("setters", () => {
    it("setXpNotifications persists", () => {
        setXpNotifications(false);
        expect(
            localStorage.getItem(GAMIFICATION_PREF_KEYS.xpNotifications),
        ).toBe("false");
    });

    it("setBadgeNotifications persists", () => {
        setBadgeNotifications(false);
        expect(
            localStorage.getItem(GAMIFICATION_PREF_KEYS.badgeNotifications),
        ).toBe("false");
    });

    it("setDailySessionGoal clamps to [1, 10]", () => {
        setDailySessionGoal(0);
        expect(
            localStorage.getItem(GAMIFICATION_PREF_KEYS.dailySessionGoal),
        ).toBe("1");
        setDailySessionGoal(100);
        expect(
            localStorage.getItem(GAMIFICATION_PREF_KEYS.dailySessionGoal),
        ).toBe("10");
        setDailySessionGoal(5);
        expect(
            localStorage.getItem(GAMIFICATION_PREF_KEYS.dailySessionGoal),
        ).toBe("5");
    });
});
