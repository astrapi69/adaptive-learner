/**
 * Q-120: mission reset / timezone / streak-joker tests.
 */

import {describe, expect, it} from "vitest";

import {
    languageToTimezone,
    localTodayIso,
    missionStreakWithJoker,
} from "./schedule";

describe("languageToTimezone", () => {
    it("maps known languages, falls back to UTC", () => {
        expect(languageToTimezone("de")).toBe("Europe/Berlin");
        expect(languageToTimezone("ja")).toBe("Asia/Tokyo");
        expect(languageToTimezone("de-DE")).toBe("Europe/Berlin");
        expect(languageToTimezone("zz")).toBe("UTC");
    });
});

describe("localTodayIso", () => {
    it("returns the local date for the timezone", () => {
        // 2026-05-29 23:30 UTC is already 2026-05-30 in Tokyo.
        const instant = new Date("2026-05-29T23:30:00Z");
        expect(localTodayIso("ja", instant)).toBe("2026-05-30");
        expect(localTodayIso("en", instant)).toBe("2026-05-29");
    });
});

describe("missionStreakWithJoker", () => {
    const days = (...d: string[]) => new Set(d);

    it("counts consecutive completion days", () => {
        const set = days("2026-05-27", "2026-05-28", "2026-05-29");
        const {streak, jokerUsed} = missionStreakWithJoker(set, "2026-05-29");
        expect(streak).toBe(3);
        expect(jokerUsed).toBe(false);
    });

    it("counts back from yesterday when today not yet done", () => {
        const set = days("2026-05-27", "2026-05-28");
        expect(missionStreakWithJoker(set, "2026-05-29").streak).toBe(2);
    });

    it("breaks on a gap without a freeze", () => {
        const set = days("2026-05-26", "2026-05-29"); // gap on 27/28
        expect(missionStreakWithJoker(set, "2026-05-29").streak).toBe(1);
    });

    it("bridges ONE gap with a freeze (joker)", () => {
        const set = days("2026-05-27", "2026-05-29"); // gap on 28
        const r = missionStreakWithJoker(set, "2026-05-29", {
            freezeAvailable: true,
        });
        expect(r.streak).toBe(2);
        expect(r.jokerUsed).toBe(true);
    });

    it("a second gap still ends the streak even with a freeze", () => {
        const set = days("2026-05-25", "2026-05-27", "2026-05-29"); // gaps 26 + 28
        const r = missionStreakWithJoker(set, "2026-05-29", {
            freezeAvailable: true,
        });
        // 29 (1), bridge 28 (joker), 27 (2), gap 26 ends it.
        expect(r.streak).toBe(2);
        expect(r.jokerUsed).toBe(true);
    });
});
