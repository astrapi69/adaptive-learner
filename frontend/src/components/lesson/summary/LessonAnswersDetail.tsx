/**
 * LessonAnswersDetail (#1007 Phase 2 — collected-answers detail).
 *
 * The end-of-lesson "View all answers" detail: every exercise of the run
 * with its score and, for a wrong text answer, the token-level diff against
 * the canonical answer (the bare "Correct answer: X" line is the fallback
 * for matching / picture-choice and pre-v1.35.0 lessons). Collapsed behind a
 * native ``<details>`` disclosure so it declutters the summary — and in exam
 * mode (delayed feedback) it IS the place the learner finally sees every
 * answer at once.
 *
 * Extracted from ``LessonSummary`` so the summary keeps its cohesion (the
 * per-row status + diff branching lived inline); pure presentational, every
 * value is derived by the caller.
 */

import {DiffHighlight} from "../../exercises";
import {useI18n} from "../../../hooks/ui/useI18n";
import {tokenDiff} from "../../../lib/exercises/token-diff";
import type {ExerciseBreakdownEntry} from "../../../lib/lesson/lesson-summary";

export interface LessonAnswersDetailProps {
    /** One entry per exercise step of the run (from ``buildExerciseBreakdown``). */
    breakdown: ExerciseBreakdownEntry[];
}

type Translate = (key: string, fallback?: string) => string;

/** The status class for one breakdown row. */
function rowStatusOf(entry: ExerciseBreakdownEntry): string {
    if (!entry.attempted) return "unattempted";
    return entry.fullyCorrect ? "correct" : "wrong";
}

/** One exercise's result row: title + score + (on a wrong text answer) the
 *  token diff, else the bare canonical answer. */
function AnswerRow({
    entry,
    t,
}: {
    entry: ExerciseBreakdownEntry;
    t: Translate;
}) {
    const status = rowStatusOf(entry);
    const showAnswer =
        entry.attempted && !entry.fullyCorrect && entry.canonicalAnswer;
    return (
        <li
            className={`lesson-summary-breakdown-row is-${status}`}
            data-testid={`lesson-summary-breakdown-${entry.stepId}`}
            data-status={status}
        >
            <span className="lesson-summary-breakdown-title">{entry.title}</span>
            {entry.attempted ? (
                <span className="lesson-summary-breakdown-score">
                    {entry.correct} / {entry.total}
                </span>
            ) : (
                <span className="lesson-summary-breakdown-score lesson-summary-breakdown-unattempted">
                    {t("lesson.summary.breakdown_unattempted", "Not attempted")}
                </span>
            )}
            {showAnswer &&
                (entry.userAnswer ? (
                    <span
                        className="lesson-summary-breakdown-diff"
                        data-testid={`lesson-summary-breakdown-diff-${entry.stepId}`}
                    >
                        <DiffHighlight
                            tokens={tokenDiff(
                                entry.userAnswer,
                                entry.canonicalAnswer,
                            )}
                        />
                    </span>
                ) : (
                    <span className="lesson-summary-breakdown-canonical">
                        {t(
                            "lesson.summary.breakdown_correct_answer",
                            "Correct answer: {answer}",
                        ).replace("{answer}", entry.canonicalAnswer)}
                    </span>
                ))}
        </li>
    );
}

/**
 * Render the collapsible "View all answers" detail, or nothing when the run
 * had no exercise steps.
 *
 * @param props - See {@link LessonAnswersDetailProps}.
 */
export default function LessonAnswersDetail({
    breakdown,
}: LessonAnswersDetailProps) {
    const {t} = useI18n();
    if (breakdown.length === 0) return null;
    return (
        <details
            className="lesson-summary-breakdown"
            data-testid="lesson-summary-breakdown"
        >
            <summary
                className="lesson-summary-breakdown-summary"
                data-testid="lesson-summary-view-all-answers"
            >
                {t(
                    "lesson.summary.view_all_answers",
                    "View all answers ({n})",
                ).replace("{n}", String(breakdown.length))}
            </summary>
            <ul className="lesson-summary-breakdown-list">
                {breakdown.map((entry) => (
                    <AnswerRow key={entry.stepId} entry={entry} t={t} />
                ))}
            </ul>
        </details>
    );
}
