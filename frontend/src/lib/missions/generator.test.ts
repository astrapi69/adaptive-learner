/**
 * Q-121: mission generator tests - determinism, variety, no
 * back-to-back repeats, adaptive difficulty/category.
 */

import {describe, expect, it} from "vitest";

import {isSupportedCheck} from "./checks";
import {assignDailyMissions, eligibleCategories} from "./generator";
import type {MissionProfile} from "./types";

const VETERAN: MissionProfile = {
    lessonsCompleted: 60,
    hasErrors: true,
    level: 8,
    isWeekend: false,
};
const NEW_USER: MissionProfile = {
    lessonsCompleted: 0,
    hasErrors: false,
    level: 1,
    isWeekend: false,
};

describe("eligibleCategories", () => {
    it("new user gets only learning + exploration", () => {
        expect([...eligibleCategories(NEW_USER)].sort()).toEqual([
            "exploration",
            "learning",
        ]);
    });

    it("active user with errors unlocks review + mastery", () => {
        const cats = eligibleCategories({
            lessonsCompleted: 5,
            hasErrors: true,
            level: 3,
            isWeekend: false,
        });
        expect(cats.has("review")).toBe(true);
        expect(cats.has("mastery")).toBe(true);
    });

    it("active user without errors does NOT get review/mastery", () => {
        const cats = eligibleCategories({
            lessonsCompleted: 5,
            hasErrors: false,
            level: 3,
            isWeekend: false,
        });
        expect(cats.has("review")).toBe(false);
        expect(cats.has("mastery")).toBe(false);
    });
});

describe("assignDailyMissions", () => {
    it("is deterministic for the same user + day", () => {
        const a = assignDailyMissions("u1", "2026-05-29", VETERAN);
        const b = assignDailyMissions("u1", "2026-05-29", VETERAN);
        expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    });

    it("differs by user (different seed)", () => {
        const a = assignDailyMissions("u1", "2026-05-29", VETERAN);
        const b = assignDailyMissions("u2", "2026-05-29", VETERAN);
        // Not guaranteed different, but the id sets should usually
        // diverge for distinct seeds; assert at least one differs.
        expect(a.map((m) => m.id).join()).not.toBe(b.map((m) => m.id).join());
    });

    it("returns the requested count with unique ids", () => {
        for (const count of [1, 2, 3]) {
            const picks = assignDailyMissions("u1", "2026-05-29", VETERAN, {
                count,
            });
            expect(picks).toHaveLength(count);
            expect(new Set(picks.map((m) => m.id)).size).toBe(count);
        }
    });

    it("balanced mix yields one easy + one medium + one hard", () => {
        const picks = assignDailyMissions("u1", "2026-05-29", VETERAN, {
            difficultyMix: "balanced",
        });
        expect(picks.map((m) => m.difficulty).sort()).toEqual([
            "easy",
            "hard",
            "medium",
        ]);
    });

    it("never repeats yesterday's missions", () => {
        const yesterday = assignDailyMissions("u1", "2026-05-28", VETERAN);
        const today = assignDailyMissions("u1", "2026-05-29", VETERAN, {
            excludeIds: yesterday.map((m) => m.id),
        });
        const overlap = today.filter((m) =>
            yesterday.some((y) => y.id === m.id),
        );
        expect(overlap).toHaveLength(0);
    });

    it("new user only gets learning/exploration missions", () => {
        const picks = assignDailyMissions("new", "2026-05-29", NEW_USER);
        for (const m of picks) {
            expect(["learning", "exploration"]).toContain(m.category);
        }
    });

    it("only assigns missions whose progress can be tracked", () => {
        for (const u of ["u1", "u2", "u3", "u4", "u5"]) {
            for (const m of assignDailyMissions(u, "2026-05-29", VETERAN)) {
                expect(isSupportedCheck(m.check_function)).toBe(true);
            }
        }
    });

    it("weekend-learner only appears on weekends", () => {
        const weekday = assignDailyMissions("u1", "2026-05-29", {
            ...VETERAN,
            isWeekend: false,
        });
        expect(weekday.some((m) => m.id === "weekend-learner")).toBe(false);
        // On a weekend it becomes eligible (may or may not be picked,
        // but it must be possible across the seed space).
        const sawWeekend = ["a", "b", "c", "d", "e", "f"].some((u) =>
            assignDailyMissions(u, "2026-05-30", {
                ...VETERAN,
                isWeekend: true,
            }).some((m) => m.id === "weekend-learner"),
        );
        expect(sawWeekend).toBe(true);
    });
});
