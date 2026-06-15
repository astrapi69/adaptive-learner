/**
 * srs/status — pure spaced-repetition status helpers for the SRS
 * visualization (#588).
 *
 * Derives a lesson-level SRS status + per-element review detail from the
 * raw {@link ElementError} rows the app already stores, mirroring the
 * scheduler in ``storage/element-errors-dexie`` (interval bands 1/3/7
 * days by correct-streak; mastered at a 3-streak). Everything here is
 * synchronous + side-effect-free so it unit-tests without a DOM, and a
 * parity test pins ``intervalForStreak`` against the storage scheduler.
 */

import type {ElementError} from "../../storage/types";

/** Consecutive-correct count at which an element is mastered. */
export const SRS_MASTERY_THRESHOLD = 3;

/** Review interval (days) by correct-streak band. Mirrors
 *  ``intervalDaysForStreak`` in the storage scheduler. */
export function intervalForStreak(correctStreak: number): number {
    if (correctStreak <= 0) return 1;
    if (correctStreak === 1) return 3;
    return 7;
}

/** The interval schedule, for the read-only transparency display. */
export interface SrsScheduleStep {
    /** Lower bound of the correct-streak band. */
    streak: number;
    /** Whether the band is open-ended (``2+``). */
    openEnded: boolean;
    /** Review interval in days. */
    days: number;
}

export const SRS_SCHEDULE: readonly SrsScheduleStep[] = [
    {streak: 0, openEnded: false, days: 1},
    {streak: 1, openEnded: false, days: 3},
    {streak: 2, openEnded: true, days: 7},
];

function addDaysUtc(iso: string, days: number): string {
    const d = new Date(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
}

/** Coarse SRS status for a whole lesson. */
export type SrsLessonStatus = "new" | "learning" | "due" | "mastered";

/** Lesson-level SRS roll-up. */
export interface SrsLessonSummary {
    status: SrsLessonStatus;
    /** Tracked element rows for the lesson. */
    total: number;
    /** Rows that are mastered. */
    mastered: number;
    /** Non-mastered rows whose next review is at/before ``now``. */
    due: number;
    /** Soonest next-review ISO timestamp among non-mastered rows. */
    nextReviewAt: string | null;
}

function suggestedReviewAt(row: ElementError): string {
    return addDaysUtc(
        row.last_attempt_at,
        intervalForStreak(row.correct_streak),
    );
}

/**
 * Roll the lesson's element rows up into a single SRS status:
 *   - ``new``       no tracked elements yet
 *   - ``mastered``  every element mastered
 *   - ``due``       at least one non-mastered element is due now
 *   - ``learning``  in progress, nothing due yet
 */
export function srsLessonSummary(
    rows: readonly ElementError[],
    now: Date = new Date(),
): SrsLessonSummary {
    const total = rows.length;
    if (total === 0) {
        return {status: "new", total: 0, mastered: 0, due: 0, nextReviewAt: null};
    }
    const nowIso = now.toISOString();
    let mastered = 0;
    let due = 0;
    let nextReviewAt: string | null = null;
    for (const row of rows) {
        if (row.mastered) {
            mastered += 1;
            continue;
        }
        const suggested = suggestedReviewAt(row);
        if (suggested <= nowIso) due += 1;
        if (nextReviewAt === null || suggested < nextReviewAt) {
            nextReviewAt = suggested;
        }
    }
    let status: SrsLessonStatus;
    if (mastered === total) status = "mastered";
    else if (due > 0) status = "due";
    else status = "learning";
    return {status, total, mastered, due, nextReviewAt};
}

/** Per-element detail for the element-detail surface. */
export interface SrsElementDetail {
    elementKey: string;
    direction: string;
    mastered: boolean;
    correctStreak: number;
    errorCount: number;
    /** Current review interval in days (for the active band). */
    intervalDays: number;
    /** Next review ISO timestamp; null when mastered. */
    nextReviewAt: string | null;
    overdue: boolean;
    lastAnswer: string;
    correctAnswer: string;
    lastAttemptAt: string;
}

/**
 * Per-element review detail, weakest-first: non-mastered before
 * mastered, then due/overdue first, then by error count (descending).
 */
export function elementSrsDetails(
    rows: readonly ElementError[],
    now: Date = new Date(),
): SrsElementDetail[] {
    const nowIso = now.toISOString();
    return rows
        .map((row): SrsElementDetail => {
            const intervalDays = intervalForStreak(row.correct_streak);
            const suggested = row.mastered ? null : suggestedReviewAt(row);
            return {
                elementKey: row.element_key,
                direction: row.direction ?? "target_to_source",
                mastered: row.mastered,
                correctStreak: row.correct_streak,
                errorCount: row.error_count,
                intervalDays,
                nextReviewAt: suggested,
                overdue: suggested !== null && suggested <= nowIso,
                lastAnswer: row.user_answer ?? "",
                correctAnswer: row.correct_answer ?? "",
                lastAttemptAt: row.last_attempt_at,
            };
        })
        .sort((a, b) => {
            if (a.mastered !== b.mastered) return a.mastered ? 1 : -1;
            if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
            return b.errorCount - a.errorCount;
        });
}
