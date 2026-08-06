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
import {deriveCorrectionAdjustedScore} from "../../lib/lesson/correction-adjusted-score";
import {configForMode} from "../../lib/learning/lessonModeConfig";
import type {LessonMode} from "../../lib/learning/lessonModePref";
import {nowIso} from "../dexie/db";
import {listElementErrorsDexie} from "../lessons/element-errors-dexie";
import {persistXP, userActivityDates} from "./gamification";
import type {LessonProgress, XPAwardResult} from "../types";

/**
 * #2479 — the stars the XP award is scored on. For practice (and every
 * non-exam mode) this is the CORRECTION-ADJUSTED final: elements fixed in the
 * correction round count, so the credited XP matches the stars + bar the
 * summary shows on the same screen. Exam mode is exempt (an exam result is
 * first-pass by design), so it scores on the frozen ``score_correct``.
 *
 * The correction count is read from the lesson's live ``ElementError`` rows —
 * the same source the summary's ``deriveCorrectionAdjustedScore`` uses — so
 * display and award never diverge. Conservative on a read failure: falls back
 * to the frozen first-pass stars.
 */
async function starsForAward(
    userId: string,
    progress: LessonProgress,
    mode: LessonMode,
): Promise<number> {
    const immediate = computeStars(
        progress.score_correct,
        progress.score_total,
    );
    if (mode === "exam") return immediate;
    try {
        const rows = await listElementErrorsDexie(userId, {
            setId: progress.set_id,
        });
        const sessionErrors = rows.filter(
            (row) => row.lesson_id === progress.lesson_filename,
        );
        const adjusted = deriveCorrectionAdjustedScore(progress, sessionErrors);
        return computeStars(adjusted.finalCorrect, adjusted.total);
    } catch {
        return immediate;
    }
}

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
    // #1007 Phase 2 — apply the lesson mode's reward weight (exam = 1.5×).
    // configForMode falls back to practice (1.0×) for an unknown/missing mode.
    const mode = (progress.lesson_mode ?? "practice") as LessonMode;
    // #2479 — score on the correction-adjusted stars so the credited XP
    // matches what the summary shows after the correction round. The
    // first-attempt bonus below still reads the frozen step_results, so a
    // corrected (not first-try) run never earns the no-mistakes bonus.
    const stars = await starsForAward(userId, progress, mode);
    const xpMultiplier = configForMode(mode).xpMultiplier;
    const award: XPAward = calculateLessonSessionXp({
        stars,
        first_attempt: firstAttempt,
        streak_days: streakDays,
        xp_multiplier: xpMultiplier,
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
