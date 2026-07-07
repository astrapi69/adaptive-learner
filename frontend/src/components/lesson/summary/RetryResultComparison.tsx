/**
 * RetryResultComparison (#983).
 *
 * Shown on the lesson summary after a RE-attempt (``attempts >= 2``).
 * Turns "you redid the lesson" into a visible improvement signal:
 *
 *   Attempt 2: 85%  (↑ from 60%)
 *   Improvement: +25%
 *   Errors fixed: 3 of 5
 *   Best result: 85% (attempt 2)   [New record!]
 *
 * Pure presentation: derives everything from ``attempt_history`` + the
 * stored best score; no storage reads. All colors route through the
 * design-token ``--exercise-*`` palette. Mistakes are framed as fixable
 * progress, never as failure — a retry that scores lower still shows the
 * (unchanged) best, so the learner can never lose ground by practising.
 */

import {Star, TrendingDown, TrendingUp, Trophy} from "lucide-react";

import {cn} from "@/lib/utils";
import {useI18n} from "../../../hooks/ui/useI18n";
import type {LessonAttempt} from "../../../storage/types";

interface RetryResultComparisonProps {
    /** #1411 — the "Result and statistics" section toggle; defaults ON. */
    enabled?: boolean;
    attempts: number;
    attemptHistory: LessonAttempt[];
    bestCorrect: number;
    bestTotal: number;
}

function pct(correct: number, total: number): number {
    return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/** 1-based index of the first attempt to reach the best percentage. */
function bestAttemptNumber(
    history: LessonAttempt[],
    bestPct: number,
): number {
    const idx = history.findIndex((a) => pct(a.correct, a.total) >= bestPct);
    return idx >= 0 ? idx + 1 : history.length;
}

export default function RetryResultComparison({
    enabled = true,
    attempts,
    attemptHistory,
    bestCorrect,
    bestTotal,
}: RetryResultComparisonProps) {
    const {t} = useI18n();
    if (!enabled || attempts < 2 || attemptHistory.length < 2) return null;

    const current = attemptHistory[attemptHistory.length - 1];
    const previous = attemptHistory[attemptHistory.length - 2];
    const currentPct = pct(current.correct, current.total);
    const previousPct = pct(previous.correct, previous.total);
    const delta = currentPct - previousPct;
    const improved = delta > 0;

    const prevErrors = Math.max(0, previous.total - previous.correct);
    const curErrors = Math.max(0, current.total - current.correct);
    const errorsFixed = Math.max(0, Math.min(prevErrors, prevErrors - curErrors));

    const bestPct = pct(bestCorrect, bestTotal);
    const bestAttempt = bestAttemptNumber(attemptHistory, bestPct);
    // A new record is set when this attempt is (one of) the best AND it
    // improved over the immediately previous run.
    const isNewRecord = improved && currentPct >= bestPct;

    const TrendIcon = improved ? TrendingUp : TrendingDown;
    const deltaSign = delta > 0 ? "+" : delta < 0 ? "−" : "±";

    return (
        <section
            className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-bg-elevated p-3"
            data-testid="retry-comparison"
            aria-label={t("lesson.summary.retry_heading", "Your improvement")}
        >
            <h3 className="m-0 flex items-center gap-2 text-base font-semibold">
                <Star
                    size={16}
                    aria-hidden="true"
                    className="text-[var(--accent-text)]"
                />
                {t("lesson.summary.retry_heading", "Your improvement")}
            </h3>

            <p
                className="m-0 flex flex-wrap items-center gap-2"
                data-testid="retry-attempt-line"
            >
                <span className="font-semibold">
                    {t("lesson.summary.retry_attempt", "Attempt {n}: {pct}%")
                        .replace("{n}", String(attempts))
                        .replace("{pct}", String(currentPct))}
                </span>
                <span
                    className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium",
                        improved
                            ? "text-[var(--exercise-correct)]"
                            : delta < 0
                              ? "text-[var(--exercise-wrong)]"
                              : "text-[var(--fg-muted)]",
                    )}
                >
                    <TrendIcon size={14} aria-hidden="true" />
                    {t("lesson.summary.retry_from", "(from {pct}%)").replace(
                        "{pct}",
                        String(previousPct),
                    )}
                </span>
            </p>

            <p
                className="m-0 text-sm"
                data-testid="retry-improvement-line"
            >
                <strong>
                    {t("lesson.summary.retry_improvement", "Improvement")}:
                </strong>{" "}
                <span
                    className={cn(
                        "font-semibold",
                        improved
                            ? "text-[var(--exercise-correct)]"
                            : delta < 0
                              ? "text-[var(--exercise-wrong)]"
                              : "text-[var(--fg-muted)]",
                    )}
                >
                    {deltaSign}
                    {Math.abs(delta)}%
                </span>
            </p>

            {prevErrors > 0 && (
                <p
                    className="m-0 text-sm"
                    data-testid="retry-errors-fixed-line"
                >
                    <strong>
                        {t("lesson.summary.retry_errors_fixed", "Errors fixed")}:
                    </strong>{" "}
                    {t("lesson.summary.retry_errors_fixed_value", "{fixed} of {total}")
                        .replace("{fixed}", String(errorsFixed))
                        .replace("{total}", String(prevErrors))}
                </p>
            )}

            <p
                className="m-0 flex flex-wrap items-center gap-2 text-sm"
                data-testid="retry-best-line"
            >
                <Trophy
                    size={14}
                    aria-hidden="true"
                    className="text-[var(--accent-text)]"
                />
                <span>
                    <strong>
                        {t("lesson.summary.retry_best", "Best result")}:
                    </strong>{" "}
                    {t("lesson.summary.retry_best_value", "{pct}% (attempt {n})")
                        .replace("{pct}", String(bestPct))
                        .replace("{n}", String(bestAttempt))}
                </span>
                {isNewRecord && (
                    <span
                        className="inline-flex items-center rounded-full bg-[var(--exercise-correct)] px-2 py-0.5 text-xs font-bold text-[var(--bg-surface)]"
                        data-testid="retry-new-record"
                    >
                        {t("lesson.summary.retry_new_record", "New record!")}
                    </span>
                )}
            </p>
        </section>
    );
}
