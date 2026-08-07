/**
 * Correction-adjusted lesson score (#2479).
 *
 * The main lesson run freezes ``LessonProgress.score_correct/score_total``
 * at grading time (the sum of each step's ``step_results`` correct/total).
 * The end-of-lesson correction round and error-replay advance SRS
 * ``ElementError`` rows but never lift that number, so the summary showed
 * a first-pass score, first-pass stars and a first-pass message on the same
 * screen that reported "Alle Fehler korrigiert!".
 *
 * These pure helpers derive the FINAL, post-correction view the summary
 * renders WITHOUT mutating the frozen score: an immediate segment (what was
 * correct on the first pass), a corrected segment (previously-wrong elements
 * now resolved), and the final count that drives the stars, the message and
 * the displayed XP. The frozen ``score_correct`` is deliberately left intact
 * — the two-segment bar keeps "where it stalled" visible, the exact reason
 * the merge-into-one-number variant was rejected.
 *
 * The corrected count is read from the LIVE ``ElementError`` rows for the
 * lesson (the same source ``openFailedExercises`` uses), so it reflects the
 * correction round, error-replay AND any later SRS advance, in both storage
 * modes. Conservative: without positive evidence (no resolved erred rows)
 * the corrected count is 0, so the bar stays single-segment.
 */

import type {ElementError, LessonProgress} from "../../storage/types";
import {computeStars, type StarRating} from "./lesson-summary";

export interface CorrectionAdjustedScore {
    /** Elements correct on the first pass (the frozen ``score_correct``). */
    immediateCorrect: number;
    /** Previously-wrong elements now resolved via correction / SRS, bounded
     *  by the run's wrong-element count so the total can never be exceeded. */
    correctedCount: number;
    /** ``immediateCorrect + correctedCount``, capped at ``total``. Drives
     *  the stars, the message and the displayed XP. */
    finalCorrect: number;
    /** The frozen ``score_total`` (number of scored elements). */
    total: number;
    /** ``round(finalCorrect / total * 100)``; 0 when ``total <= 0``. */
    finalPct: number;
    /** ``round(immediateCorrect / total * 100)``; 0 when ``total <= 0``.
     *  Drives the immediate segment's width AND the corrected segment's left
     *  offset (which stacks straight after it). */
    immediatePct: number;
    /** Elements still wrong after correction (``total - finalCorrect``). */
    remaining: number;
    /** True when at least one element was corrected — the two-segment bar +
     *  the legend only appear then (a run with no correction round stays a
     *  single, solid segment). */
    hasCorrections: boolean;
}

/** True iff this element erred at least once but its LATEST state is
 *  resolved — a positive correct-streak or full mastery. A never-erred
 *  (first-try correct) element is excluded (``error_count === 0``); a
 *  still-wrong element is excluded (``correct_streak === 0`` and not
 *  mastered). */
function isCorrectedElement(row: ElementError): boolean {
    if ((row.error_count ?? 0) <= 0) return false;
    return row.mastered === true || (row.correct_streak ?? 0) > 0;
}

/**
 * Count the previously-wrong elements that are now resolved, bounded by the
 * run's wrong-element count.
 *
 * @param sessionErrors - live ``ElementError`` rows for the lesson.
 * @param wrongInRun - ``score_total - score_correct`` for this run; the cap.
 */
export function countCorrectedElements(
    sessionErrors: readonly ElementError[],
    wrongInRun: number,
): number {
    const cap = Math.max(0, wrongInRun);
    if (cap === 0) return 0;
    let resolved = 0;
    for (const row of sessionErrors) {
        if (isCorrectedElement(row)) resolved += 1;
    }
    return Math.min(resolved, cap);
}

/**
 * Derive the correction-adjusted score view for the lesson summary.
 *
 * @param progress - the (possibly null) lesson-progress row.
 * @param sessionErrors - live ``ElementError`` rows for the lesson.
 */
export function deriveCorrectionAdjustedScore(
    progress: LessonProgress | null,
    sessionErrors: readonly ElementError[],
): CorrectionAdjustedScore {
    const immediateCorrect = progress?.score_correct ?? 0;
    const total = progress?.score_total ?? 0;
    const wrongInRun = Math.max(0, total - immediateCorrect);
    const correctedCount = countCorrectedElements(sessionErrors, wrongInRun);
    const finalCorrect = Math.min(total, immediateCorrect + correctedCount);
    const remaining = Math.max(0, total - finalCorrect);
    const pct = (value: number): number =>
        total > 0 ? Math.round((value / total) * 100) : 0;
    return {
        immediateCorrect,
        correctedCount,
        finalCorrect,
        total,
        finalPct: pct(finalCorrect),
        immediatePct: pct(immediateCorrect),
        remaining,
        hasCorrections: correctedCount > 0,
    };
}

/** The score view the summary actually displays: the adjusted breakdown plus
 *  the stars / correct-count / percentage the stars, message and XP follow.
 *  Exam mode is exempt (an exam result is the first pass, by design), so it
 *  reports the frozen first-pass numbers with the corrected part suppressed.
 *
 *  Extracted from ``LessonSummary`` so the mode branching lives in one tested
 *  place instead of inflating the component's cyclomatic complexity (#2479). */
export interface SummaryScoreDisplay {
    /** The full correction-adjusted breakdown (drives the two-segment bar). */
    adjusted: CorrectionAdjustedScore;
    /** Whether the correction folds into the display (false in exam mode). */
    applyCorrection: boolean;
    /** First-pass stars — the mount celebration + confetti + exam verdict. */
    immediateStars: StarRating;
    /** Displayed stars: final in practice, first-pass in exam. */
    stars: StarRating;
    /** Displayed correct count (final in practice, first-pass in exam). */
    displayCorrect: number;
    /** Displayed percentage (final in practice, first-pass in exam). */
    displayPct: number;
    /** The corrected segment count the bar renders (0 in exam mode). */
    correctedCount: number;
}

export function resolveSummaryScoreDisplay(
    progress: LessonProgress | null,
    sessionErrors: readonly ElementError[],
    opts: {isExam: boolean},
): SummaryScoreDisplay {
    const adjusted = deriveCorrectionAdjustedScore(progress, sessionErrors);
    const applyCorrection = !opts.isExam;
    const immediateStars = computeStars(
        adjusted.immediateCorrect,
        adjusted.total,
    );
    return {
        adjusted,
        applyCorrection,
        immediateStars,
        stars: applyCorrection
            ? computeStars(adjusted.finalCorrect, adjusted.total)
            : immediateStars,
        displayCorrect: applyCorrection
            ? adjusted.finalCorrect
            : adjusted.immediateCorrect,
        displayPct: applyCorrection ? adjusted.finalPct : adjusted.immediatePct,
        correctedCount: applyCorrection ? adjusted.correctedCount : 0,
    };
}
