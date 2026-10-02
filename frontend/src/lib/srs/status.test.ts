/**
 * srs/status unit tests (#588).
 *
 * Pins the lesson roll-up, the per-element detail ordering, the
 * interval bands, and parity with the storage scheduler so the two
 * cannot drift.
 */

import {describe, expect, it} from "vitest";

import {
    elementSrsDetails,
    intervalForStreak,
    srsLessonSummary,
} from "./status";
import {intervalDaysForStreak} from "../../storage/lessons/element-errors-dexie";
import type {ElementError} from "../../storage/types";

function ee(over: Partial<ElementError>): ElementError {
    return {
        id: "e",
        user_id: "u",
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex",
        element_key: "el libro",
        element_type: "card",
        user_answer: "la libro",
        correct_answer: "el libro",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-01-01T00:00:00Z",
        last_attempt_at: "2026-01-01T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...over,
    } as ElementError;
}

const NOW = new Date("2026-02-01T00:00:00Z");

describe("intervalForStreak", () => {
    it("uses 1/3/7-day bands", () => {
        expect(intervalForStreak(0)).toBe(1);
        expect(intervalForStreak(1)).toBe(3);
        expect(intervalForStreak(2)).toBe(7);
        expect(intervalForStreak(5)).toBe(7);
    });

    it("matches the storage scheduler (no drift)", () => {
        for (const streak of [0, 1, 2, 3, 5]) {
            expect(intervalForStreak(streak)).toBe(
                intervalDaysForStreak(streak),
            );
        }
    });
});

describe("srsLessonSummary", () => {
    it("is 'new' with no tracked elements", () => {
        expect(srsLessonSummary([], NOW).status).toBe("new");
    });

    it("is 'mastered' when every element is mastered", () => {
        const s = srsLessonSummary(
            [ee({mastered: true}), ee({mastered: true})],
            NOW,
        );
        expect(s.status).toBe("mastered");
        expect(s.mastered).toBe(2);
        expect(s.due).toBe(0);
    });

    it("is 'due' when a non-mastered element's review has passed", () => {
        const s = srsLessonSummary(
            [ee({last_attempt_at: "2026-01-01T00:00:00Z", correct_streak: 0})],
            NOW,
        );
        expect(s.status).toBe("due");
        expect(s.due).toBe(1);
        expect(s.nextReviewAt).toBe("2026-01-02T00:00:00.000Z");
    });

    it("is 'learning' when nothing is due yet", () => {
        const s = srsLessonSummary(
            [ee({last_attempt_at: "2026-01-31T00:00:00Z", correct_streak: 2})],
            NOW,
        );
        expect(s.status).toBe("learning");
        expect(s.due).toBe(0);
    });
});

describe("never-wrong rows (#3170)", () => {
    /** The row ``recordBulk`` writes for a correct first attempt, a month old
     *  (so the 3-day band would long be over). */
    const clean = ee({
        error_count: 0,
        correct_streak: 1,
        last_error_at: null,
        last_attempt_at: "2026-01-01T00:00:00Z",
    });

    it("repro: a never-wrong row is settled by default, not due for ever", () => {
        const s = srsLessonSummary([clean], NOW);
        expect(s.status).toBe("mastered");
        expect(s.mastered).toBe(1);
        expect(s.due).toBe(0);
        expect(s.nextReviewAt).toBeNull();
    });

    it("with the toggle ON the SRS flag rules: the same row is due", () => {
        const s = srsLessonSummary([clean], NOW, {includeNeverWrong: true});
        expect(s.status).toBe("due");
        expect(s.mastered).toBe(0);
        expect(s.due).toBe(1);
    });

    it("an open error next to a never-wrong row keeps the lesson due", () => {
        const s = srsLessonSummary([clean, ee({id: "wrong"})], NOW);
        expect(s.status).toBe("due");
        expect(s.mastered).toBe(1);
        expect(s.due).toBe(1);
    });

    it("elementSrsDetails shows the never-wrong row as mastered by default and sorts it last", () => {
        const details = elementSrsDetails([clean, ee({id: "wrong", element_key: "wrong"})], NOW);
        expect(details.map((d) => d.elementKey)).toEqual(["wrong", "el libro"]);
        const settled = details[1];
        expect(settled.mastered).toBe(true);
        expect(settled.nextReviewAt).toBeNull();
        expect(settled.overdue).toBe(false);
        expect(settled.errorCount).toBe(0);
    });

    it("elementSrsDetails keeps the SRS schedule for the never-wrong row when the toggle is ON", () => {
        const [detail] = elementSrsDetails([clean], NOW, {includeNeverWrong: true});
        expect(detail.mastered).toBe(false);
        expect(detail.nextReviewAt).toBe("2026-01-04T00:00:00.000Z");
        expect(detail.overdue).toBe(true);
    });
});

describe("elementSrsDetails", () => {
    it("orders non-mastered/overdue/most-errors first; mastered last", () => {
        const rows = [
            ee({element_key: "mastered", mastered: true}),
            ee({element_key: "due-2err", last_attempt_at: "2026-01-01T00:00:00Z", error_count: 2}),
            ee({element_key: "due-5err", last_attempt_at: "2026-01-01T00:00:00Z", error_count: 5}),
            ee({element_key: "scheduled", last_attempt_at: "2026-01-31T00:00:00Z", correct_streak: 2}),
        ];
        const details = elementSrsDetails(rows, NOW);
        expect(details.map((d) => d.elementKey)).toEqual([
            "due-5err",
            "due-2err",
            "scheduled",
            "mastered",
        ]);
        expect(details.at(-1)!.nextReviewAt).toBeNull();
        expect(details[0].overdue).toBe(true);
    });
});
