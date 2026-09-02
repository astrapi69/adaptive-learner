/**
 * Tests for the pure ticket-award rules (#2889): the full-score and
 * full-hearts run conditions, and the streak-milestone derivation
 * with its already-awarded dedupe.
 */

import {describe, expect, it} from "vitest";

import {
    TICKET_STREAK_MILESTONES,
    newStreakMilestones,
    ticketsForRun,
} from "./ticket-rules";

describe("ticketsForRun", () => {
    it.each([
        ["full score alone earns one ticket", 10, 10, false, 1],
        ["a missed answer earns nothing", 9, 10, false, 0],
        ["an unscored run (total 0) earns nothing", 0, 0, false, 0],
        ["full hearts alone earns one ticket", 7, 10, true, 1],
        ["full score AND full hearts stack to two", 10, 10, true, 2],
    ])("%s", (_name, correct, total, fullHearts, expected) => {
        expect(
            ticketsForRun({
                scoreCorrect: correct,
                scoreTotal: total,
                fullHeartsRun: fullHearts,
            }),
        ).toBe(expected);
    });
});

describe("newStreakMilestones", () => {
    it("exposes the fixed milestone ladder", () => {
        expect(TICKET_STREAK_MILESTONES).toEqual([3, 7, 14, 30]);
    });

    it.each([
        ["no streak reaches nothing", 0, [], []],
        ["day 2 reaches nothing", 2, [], []],
        ["day 3 reaches the first milestone", 3, [], [3]],
        ["day 8 reaches two at once", 8, [], [3, 7]],
        ["already-awarded milestones are skipped", 8, [3], [7]],
        ["day 30 with all but the last awarded", 30, [3, 7, 14], [30]],
        ["everything awarded yields nothing", 31, [3, 7, 14, 30], []],
    ])("%s", (_name, streakDays, awarded, expected) => {
        expect(newStreakMilestones(streakDays, awarded)).toEqual(expected);
    });
});
