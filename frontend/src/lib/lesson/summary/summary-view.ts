/**
 * Pure view helpers of the lesson summary (moved out of ``LessonSummary``,
 * #3736, so the component stays under the file-size gate): the display
 * stats of a run, which configurable sections are on screen, the compact
 * view's "Fix mistakes" row and the detailed view's correction marks.
 */

import type { CorrectionSummary } from "../correction/correction-summary";
import type { LessonAttempt, LessonProgress } from "../../../storage/types";

/** Derive the display stats from the (possibly absent) progress row:
 *  the score, the rounded minutes (floored at 1), the completed flag and
 *  the score percentage. Missing values default to 0 so the summary
 *  still renders for an in-progress / unscored run. */
export function deriveSummaryStats(progress: LessonProgress | null): {
  correct: number;
  total: number;
  minutes: number;
  isCompleted: boolean;
  scorePct: number;
  attempts: number;
  attemptHistory: LessonAttempt[];
  bestCorrect: number;
  bestTotal: number;
} {
  const correct = progress?.score_correct ?? 0;
  const total = progress?.score_total ?? 0;
  // #3747 - the run just finished, not the lifetime total across restarts.
  const seconds = progress?.run_time_seconds ?? 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const isCompleted = progress?.status === "completed";
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    correct,
    total,
    minutes,
    isCompleted,
    scorePct,
    attempts: progress?.attempts ?? 0,
    attemptHistory: progress?.attempt_history ?? [],
    bestCorrect: progress?.best_score_correct ?? 0,
    bestTotal: progress?.best_score_total ?? 0,
  };
}

/** #3031 / #3575 - whether a configurable section is on screen: switched on,
 *  the detailed view, or the correction round opened by "Fix mistakes". */
export function isSectionShown(
  id: string,
  enabled: boolean,
  detailed: boolean,
  fixOpen: boolean,
): boolean {
  return enabled || detailed || (id === "correction" && fixOpen);
}

/** #3575 - the compact view's "Fix mistakes" row: only for a persisted run
 *  and only while the correction section itself is not on screen. */
export function offersFixMistakes(args: {
  hasRun: boolean;
  correctionEnabled: boolean;
  detailed: boolean;
  fixOpen: boolean;
}): boolean {
  return args.hasRun && !(args.correctionEnabled || args.detailed || args.fixOpen);
}

/**
 * The correction data the detailed view marks its answers overview and
 * "Why you missed these" with (#3575): the verdict per failed step and the
 * summary itself. The compact view marks nothing, so it gets neither.
 */
export function detailedCorrectionMarks(
  detailed: boolean,
  summary: CorrectionSummary,
): { byStep?: ReadonlyMap<string, boolean>; summary?: CorrectionSummary } {
  if (!detailed || summary.total === 0) return {};
  return {
    byStep: new Map(summary.entries.map((entry) => [entry.stepId, entry.corrected])),
    summary,
  };
}
