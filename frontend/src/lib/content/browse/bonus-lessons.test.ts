/**
 * Tests for the bonus-lesson rules (#2890): the ``bonus-`` filename
 * convention, the derived unlock (every regular lesson at one star or
 * better), and the bonus-last listing order. Progress fixtures use
 * the real ``LessonProgress`` row shape.
 */

import {describe, expect, it} from "vitest";

import {
    baseLessons,
    isBonusLesson,
    isBonusUnlocked,
    orderWithBonusLast,
} from "./bonus-lessons";
import type {LessonProgress} from "../../../storage/types";

const SET = "psy-basics";

function completedRow(
    filename: string,
    correct: number,
    total: number,
): LessonProgress {
    return {
        id: filename,
        user_id: "u1",
        source: "owner/repo",
        set_id: SET,
        lesson_filename: filename,
        status: "completed",
        step_results: {},
        score_correct: correct,
        score_total: total,
    } as LessonProgress;
}

describe("isBonusLesson", () => {
    it.each([
        ["bonus- prefix marks a bonus", "bonus-vertiefung.json", true],
        ["case-insensitive prefix", "Bonus-Extra.json", true],
        ["a regular NN-slug file is not", "01-begruessung.json", false],
        ["'bonus' inside the slug is not", "10-bonus-malus-system.json", false],
        ["'bonus' without the dash is not", "bonusrunde.json", false],
    ])("%s", (_name, filename, expected) => {
        expect(isBonusLesson(filename)).toBe(expected);
    });
});

describe("baseLessons / orderWithBonusLast", () => {
    const LESSONS = ["bonus-extra.json", "01-a.json", "02-b.json"];

    it("baseLessons drops the bonus files", () => {
        expect(baseLessons(LESSONS)).toEqual(["01-a.json", "02-b.json"]);
    });

    it("orderWithBonusLast moves bonus files to the end, order preserved", () => {
        expect(orderWithBonusLast(LESSONS)).toEqual([
            "01-a.json",
            "02-b.json",
            "bonus-extra.json",
        ]);
    });
});

describe("isBonusUnlocked", () => {
    const LESSONS = ["01-a.json", "02-b.json", "bonus-extra.json"];

    it("unlocks once every REGULAR lesson has at least one star", () => {
        const progress = [
            completedRow("01-a.json", 6, 10),
            completedRow("02-b.json", 10, 10),
        ];
        expect(isBonusUnlocked(LESSONS, progress, SET)).toBe(true);
    });

    it("the bonus lesson itself never blocks the unlock", () => {
        const progress = [
            completedRow("01-a.json", 6, 10),
            completedRow("02-b.json", 10, 10),
        ];
        // No progress row for bonus-extra.json - still unlocked.
        expect(isBonusUnlocked(LESSONS, progress, SET)).toBe(true);
    });

    it("an unfinished regular lesson keeps it locked", () => {
        const progress = [completedRow("01-a.json", 6, 10)];
        expect(isBonusUnlocked(LESSONS, progress, SET)).toBe(false);
    });

    it("a zero-star completion keeps it locked", () => {
        const progress = [
            completedRow("01-a.json", 0, 10),
            completedRow("02-b.json", 10, 10),
        ];
        expect(isBonusUnlocked(LESSONS, progress, SET)).toBe(false);
    });

    it("a bonus-only set never unlocks", () => {
        expect(isBonusUnlocked(["bonus-extra.json"], [], SET)).toBe(false);
    });
});
