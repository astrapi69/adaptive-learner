/**
 * Dexie-side wiring for the lesson-XP award (Phase 50D /
 * v1.33.0 / D-DEXIE-GAMIFICATION).
 *
 * Closes the gap left by v1.31.0 for GitHub-Pages visitors:
 * API-mode users have the gamification plugin's
 * ``on_session_complete`` hook fire ``award_xp_for_lesson_session``
 * when a content-lesson completes; Dexie-mode users had no such
 * hook, so completing a lesson left their XP unchanged. This
 * module is the client-side equivalent: when DexieStorage's
 * ``lessonProgress.upsert`` flips status from ``in_progress``
 * to ``completed``, the caller fires ``awardLessonXpDexie`` to
 * resolve the formula inputs (streak + first-attempt + stars),
 * run the calculator (Phase 50B), and persist the new total XP.
 *
 * The pure helpers all live at ``../lib/gamification/`` and are
 * pinned by the cross-language parity fixture at
 * ``tests/fixtures/lesson-xp-parity/``. The persistence path
 * reuses ``persistXP`` + ``userActivityDates`` from
 * ``./gamification.ts`` (the existing session-XP wiring).
 *
 * Activity-date sourcing decision (handover § 2.1): the
 * existing ``userActivityDates`` reads ``learningSessions``
 * filtered to the user's projects + projects ``started_at``
 * down to YYYY-MM-DD. Same source as the Python
 * ``_activity_dates_for_user`` — sessions only, lesson
 * completions don't count toward the streak. Matches the
 * cross-language parity contract.
 */

import {isFirstAttempt} from "../../lib/gamification/first-attempt";
import {
    calculateLessonSessionXp,
    computeStars,
} from "../../lib/gamification/lesson-xp";
import type {XPAward} from "../../lib/gamification/lesson-xp";
import {currentStreakDays} from "../../lib/gamification/streak";
import {nowIso} from "../dexie/db";
import {persistXP, userActivityDates} from "./gamification";
import type {LessonProgress, XPAwardResult} from "../types";

/**
 * Award lesson-XP for a just-completed LessonProgress row.
 *
 * Caller MUST ensure ``progress.status === "completed"`` and
 * MUST detect the just-completed transition itself (this
 * function does not check whether XP was already awarded for
 * this lesson — calling it twice for the same row would double
 * the XP).
 *
 * Errors propagate; the DexieStorage facade wraps in try/catch
 * so a gamification failure can't break a lesson completion.
 */
export async function awardLessonXpDexie(
    userId: string,
    progress: LessonProgress,
): Promise<XPAwardResult> {
    const today = nowIso().slice(0, 10);
    const activity = await userActivityDates(userId);
    const streakDays = currentStreakDays(activity, today);

    // LessonProgress.step_results is already a parsed object;
    // round-trip via JSON.stringify so the parity-tested
    // isFirstAttempt (which expects the raw JSON-on-Text shape
    // Python's _is_first_attempt_from_step_results consumes)
    // sees the same input shape.
    const firstAttempt = isFirstAttempt(JSON.stringify(progress.step_results));
    const stars = computeStars(progress.score_correct, progress.score_total);
    const award: XPAward = calculateLessonSessionXp({
        stars,
        first_attempt: firstAttempt,
        streak_days: streakDays,
    });

    const {row, levelUp} = await persistXP(userId, award.xp_earned);
    // The XPBreakdown type uses optional snake_case fields;
    // XPAwardResult expects a flat Record<string, number>. Filter
    // out the undefined keys so the API-mode payload shape (which
    // the Python ``XPAward.to_dict`` produces) matches.
    const breakdown: Record<string, number> = {};
    for (const [k, v] of Object.entries(award.breakdown)) {
        if (typeof v === "number") {
            breakdown[k] = v;
        }
    }

    return {
        xp_earned: award.xp_earned,
        xp_total: row.total_xp,
        level: row.level,
        level_up: levelUp,
        multiplier: award.multiplier,
        breakdown,
        reason: award.reason,
    };
}
