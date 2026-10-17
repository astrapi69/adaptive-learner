/**
 * Accounting of one completed lesson attempt (#983), shared by the Dexie
 * progress writer and the v35 completion repair (#3792).
 *
 * Pure: it only shapes a row, so the upgrade path can use it without
 * importing the storage modules that open the database.
 */

import type {LessonProgressRow} from "../dexie/db-rows";

/** How many completed attempts ``attempt_history`` keeps. */
const ATTEMPT_HISTORY_CAP = 50;

/** #983 — account one completed attempt onto the row (mirrors the
 *  backend ``_record_completed_attempt``): bump ``attempts``, append to
 *  ``attempt_history``, and lift ``best_score_*`` only when this attempt
 *  beat the previous best by percentage (ties keep the earlier best). */
export function recordCompletedAttempt(
    row: Pick<
        LessonProgressRow,
        | "attempts"
        | "attempt_history"
        | "score_correct"
        | "score_total"
        | "best_score_correct"
        | "best_score_total"
    >,
    atIso: string,
): void {
    row.attempts = (row.attempts ?? 0) + 1;
    const history = [...(row.attempt_history ?? [])];
    history.push({
        at: atIso,
        correct: row.score_correct,
        total: row.score_total,
    });
    row.attempt_history = history.slice(-ATTEMPT_HISTORY_CAP);

    const currentPct = row.score_total
        ? row.score_correct / row.score_total
        : 0;
    const bestTotal = row.best_score_total ?? 0;
    const bestPct = bestTotal ? (row.best_score_correct ?? 0) / bestTotal : -1;
    if (bestTotal === 0 || currentPct > bestPct) {
        row.best_score_correct = row.score_correct;
        row.best_score_total = row.score_total;
    }
}
