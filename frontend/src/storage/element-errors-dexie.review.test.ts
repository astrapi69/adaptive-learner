/**
 * #673 — the SRS due count must drop after a review session records its
 * attempts against the CORRECT composite key.
 *
 * These are end-to-end-at-the-data-layer pins for the badge bug: the header
 * "N due" badge reads ``computeReviewQueueDexie(user).filter(overdue)``. The
 * review session records attempts via ``recordElementAttemptsDexie``. The two
 * agree only when the recorded ``lesson_id`` matches the stored row's
 * ``lesson_id`` (part of the composite key
 * ``user#set#lesson#exercise#element#direction``).
 *
 * The fix (carry ``review_lesson_id`` on the synthesised step instead of
 * parsing the hyphen-joined step id) guarantees that match; the
 * "mismatched lesson_id" test pins the pre-fix failure mode so a regression
 * is loud.
 */

import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it} from "vitest";

import {_resetDbForTests, getDb} from "./db/db";
import {
    computeReviewQueueDexie,
    recordElementAttemptsDexie,
} from "./dexie/element-errors-dexie";
import type {ElementAttempt} from "./types";

const USER = "user-1";
const SET = "language-fr-a1";
const LESSON = "01-greetings.json";

/** Seed an element that is OVERDUE: a past error with streak 0 means the
 *  next review is 1 day after ``last_attempt_at``, so a year-old attempt is
 *  comfortably overdue. We record a single wrong attempt then rewind its
 *  timestamps into the past. */
async function seedOverdueElement(elementKey: string): Promise<void> {
    await recordElementAttemptsDexie(USER, [
        {
            set_id: SET,
            lesson_id: LESSON,
            exercise_id: "ex-match-begriffe",
            element_key: elementKey,
            element_type: "vocabulary",
            user_answer: "wrong",
            correct_answer: elementKey,
            correct: false,
        },
    ]);
    const db = getDb();
    const past = "2020-01-01T00:00:00.000Z";
    await db.elementErrors
        .where("[user_id+set_id]")
        .equals([USER, SET])
        .and((r) => r.element_key === elementKey)
        .modify((r) => {
            r.last_attempt_at = past;
            r.last_error_at = past;
            r.updated_at = past;
        });
}

function reviewAttempt(
    elementKey: string,
    correct: boolean,
    overrides: Partial<ElementAttempt> = {},
): ElementAttempt {
    return {
        set_id: SET,
        lesson_id: LESSON,
        exercise_id: "ex-match-begriffe",
        element_key: elementKey,
        element_type: "vocabulary",
        user_answer: correct ? elementKey : "x",
        correct_answer: elementKey,
        correct,
        ...overrides,
    };
}

async function overdueCount(): Promise<number> {
    const queue = await computeReviewQueueDexie(USER);
    return queue.filter((q) => q.overdue).length;
}

const KEYS = Array.from({length: 10}, (_, i) => `word-${i}`);

beforeEach(async () => {
    const db = getDb();
    try {
        await db.elementErrors.clear();
    } catch {
        /* fresh DB */
    }
    await _resetDbForTests();
});

describe("#673 review completion lowers the due count", () => {
    it("10 due, all correct → due drops to 0; next review is in the future", async () => {
        for (const k of KEYS) await seedOverdueElement(k);
        expect(await overdueCount()).toBe(10);

        await recordElementAttemptsDexie(
            USER,
            KEYS.map((k) => reviewAttempt(k, true)),
        );

        expect(await overdueCount()).toBe(0);
        const queue = await computeReviewQueueDexie(USER);
        const nowIso = new Date().toISOString();
        for (const item of queue) {
            expect(item.suggested_review_at > nowIso).toBe(true);
        }
    });

    it("10 due, all wrong → due drops to 0 (rescheduled, NOT mastered)", async () => {
        // A wrong answer resets the streak to 0 but still stamps
        // last_attempt_at = now, so the next review is ~1 day out — out of
        // the OVERDUE set, but the element returns soon (and is never
        // mastered). This is the designed SRS behaviour; the regression the
        // user saw was the count NOT moving at all.
        for (const k of KEYS) await seedOverdueElement(k);
        expect(await overdueCount()).toBe(10);

        await recordElementAttemptsDexie(
            USER,
            KEYS.map((k) => reviewAttempt(k, false)),
        );

        expect(await overdueCount()).toBe(0);
        const all = await computeReviewQueueDexie(USER);
        // Still tracked (returns for review), none mastered out of the queue.
        expect(all).toHaveLength(10);
    });

    it("10 due, 5 correct + 5 wrong → due drops to 0 (all rescheduled)", async () => {
        for (const k of KEYS) await seedOverdueElement(k);
        expect(await overdueCount()).toBe(10);

        await recordElementAttemptsDexie(
            USER,
            KEYS.map((k, i) => reviewAttempt(k, i < 5)),
        );

        expect(await overdueCount()).toBe(0);
    });

    it("a reviewed element does NOT reappear as overdue right after", async () => {
        await seedOverdueElement("merci");
        expect(await overdueCount()).toBe(1);

        await recordElementAttemptsDexie(USER, [reviewAttempt("merci", true)]);

        const queue = await computeReviewQueueDexie(USER);
        const merci = queue.find((q) => q.element_key === "merci");
        expect(merci).toBeDefined();
        expect(merci!.overdue).toBe(false);
    });

    it("regression: a MISMATCHED lesson_id leaves the original overdue (the bug)", async () => {
        // This is exactly what the old _extractLessonId mangling did: it
        // recorded against a lesson_id like "01-greetings.json-ex-match" that
        // does not equal the stored "01-greetings.json", so a PHANTOM row was
        // created and the original overdue row stayed put → badge frozen.
        await seedOverdueElement("merci");
        expect(await overdueCount()).toBe(1);

        await recordElementAttemptsDexie(USER, [
            reviewAttempt("merci", true, {
                lesson_id: "01-greetings.json-ex-match", // mangled
            }),
        ]);

        // Original row still overdue (the symptom); the phantom row inflated
        // the non-overdue tail. Net: the user-visible due count did NOT drop.
        expect(await overdueCount()).toBe(1);
        const all = await computeReviewQueueDexie(USER);
        expect(all.length).toBe(2); // original (overdue) + phantom (fresh)
    });

    it("control: the CORRECT lesson_id updates the stored row in place", async () => {
        await seedOverdueElement("merci");
        await recordElementAttemptsDexie(USER, [reviewAttempt("merci", true)]);
        const all = await computeReviewQueueDexie(USER);
        // Exactly one row — updated in place, no phantom.
        expect(all.length).toBe(1);
        expect(all[0].overdue).toBe(false);
        expect(all[0].correct_streak).toBe(1);
    });
});
