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
import {tokenDiff} from "../../../lib/exercises/grading/token-diff";
import type {ExerciseBreakdownEntry} from "../../../lib/lesson/lesson-summary";

export interface LessonAnswersDetailProps {
    /** #1411 — the "Answers overview" section toggle; defaults ON. */
    enabled?: boolean;
    /** One entry per exercise step of the run (from ``buildExerciseBreakdown``). */
    breakdown: ExerciseBreakdownEntry[];
}

type Translate = (key: string, fallback?: string) => string;

/** The status class for one breakdown row. */
function rowStatusOf(entry: ExerciseBreakdownEntry): string {
    if (!entry.attempted) return "unattempted";
    return entry.fullyCorrect ? "correct" : "wrong";
}

/** One exercise's result row: a compact ``title + score`` line that expands
 *  into what was asked, what the learner answered, and the solution.
 *
 *  #2807 - the row used to show ONLY the title and the score, and revealed a
 *  detail solely for a wrong TEXT answer. A partially correct row ("2 / 3")
 *  therefore showed nothing at all, and no row ever showed the QUESTION: the
 *  same "answers without context" gap #2757 fixed on the sibling surface. */
function AnswerRow({
    entry,
    t,
}: {
    entry: ExerciseBreakdownEntry;
    t: Translate;
}) {
    const status = rowStatusOf(entry);
    // There is something to review whenever the step was attempted and not
    // perfect - regardless of whether a text answer happens to exist.
    const reviewable = entry.attempted && !entry.fullyCorrect;
    const showAnswer = reviewable && Boolean(entry.canonicalAnswer);

    const head = (
        <>
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
        </>
    );

    const body = (
        <>
            {entry.question && (
                <span
                    className="block pt-0.5 text-[0.8125rem] text-fg-secondary"
                    data-testid={`lesson-summary-question-${entry.stepId}`}
                >
                    {entry.question}
                </span>
            )}
            {/* The learner's own answer, for the types that record one. The
                diff below already contains it for text answers, so it is only
                spelled out where no diff is rendered. */}
            {entry.userAnswer && !entry.canonicalAnswer && (
                <span
                    className="block pt-0.5 text-[0.8125rem] text-fg-muted"
                    data-testid={`lesson-summary-your-answer-${entry.stepId}`}
                >
                    {t("review.your_answer", "Your answer:")} {entry.userAnswer}
                </span>
            )}
            {showAnswer &&
                (entry.userAnswer ? (
                    <>
                        <span
                            className="block pt-0.5 text-[0.8125rem] text-fg-muted"
                            data-testid={`lesson-summary-your-answer-${entry.stepId}`}
                        >
                            {t("review.your_answer", "Your answer:")}{" "}
                            {entry.userAnswer}
                        </span>
                        <span
                            className="lesson-summary-breakdown-diff block"
                            data-testid={`lesson-summary-breakdown-diff-${entry.stepId}`}
                        >
                            <DiffHighlight
                                tokens={tokenDiff(
                                    entry.userAnswer,
                                    entry.canonicalAnswer,
                                )}
                            />
                        </span>
                    </>
                ) : (
                    <span className="lesson-summary-breakdown-canonical block">
                        {t(
                            "lesson.summary.breakdown_correct_answer",
                            "Correct answer: {answer}",
                        ).replace("{answer}", entry.canonicalAnswer)}
                    </span>
                ))}
        </>
    );

    const hasBody = Boolean(entry.question) || showAnswer || Boolean(entry.userAnswer);
    return (
        <li
            className={`lesson-summary-breakdown-row is-${status}`}
            data-testid={`lesson-summary-breakdown-${entry.stepId}`}
            data-status={status}
        >
            {hasBody ? (
                // Open by default: the learner asked to see all answers, so the
                // context is the point - collapsing is the escape, not the norm.
                <details open data-testid={`lesson-summary-row-details-${entry.stepId}`}>
                    <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-baseline gap-2">
                        {head}
                    </summary>
                    {body}
                </details>
            ) : (
                head
            )}
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
    enabled = true,
    breakdown,
}: LessonAnswersDetailProps) {
    const {t} = useI18n();
    if (!enabled || breakdown.length === 0) return null;
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
