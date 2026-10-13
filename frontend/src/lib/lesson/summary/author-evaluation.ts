/**
 * A set's author evaluation applied to one lesson run (#3736).
 *
 * A content set may declare an ``evaluation`` block in its manifest
 * (schema 1.15, learn-content-engine#171): a scheme (``percent`` |
 * ``pass_fail`` | ``grades``), a pass mark, a grade table, the report depth
 * and a title. The engine maps a run's percent to the verdict
 * (``gradeFor``, learn-content-engine#227), so every consumer applies the
 * same boundary rules; this module only computes that percent and carries
 * the block's display fields.
 *
 * The percent counts answered elements (the block's ``basis``), which is
 * what ``score_correct`` / ``score_total`` already count, and is passed
 * UNROUNDED: rounding first moves every grade boundary by up to half a
 * point.
 */

import { gradeFor, type EvaluationOutcome } from "learn-content-engine/rules";

import type { ContentSetEntry } from "../../../storage/types";
import {
    examPassed,
    type ExamPassThreshold,
    type LessonMode,
} from "../../learning/lessonModePref";

/** A set's evaluation block as the content listing carries it. */
export type SetEvaluation = NonNullable<ContentSetEntry["evaluation"]>;

/** The author's verdict on one run, plus what the summary shows with it. */
export interface AuthorEvaluationResult {
    /** The engine's verdict: the scheme applied, ``passed`` when the block
     *  has a pass mark, ``grade`` under ``grades``. */
    outcome: EvaluationOutcome;
    /** The run's unrounded percent the verdict was computed from. */
    percent: number;
    /** The block's pass mark, ``null`` when it names none. */
    passPercent: number | null;
    /** The evaluation's name for the learner, ``null`` for the generic wording. */
    title: string | null;
    /** How much the summary shows by default. */
    report: "compact" | "detailed";
}

/**
 * Apply a set's evaluation block to a run of ``correct`` of ``total``
 * elements.
 *
 * Returns ``null`` when there is no block (the caller keeps its own
 * default), for an empty run, and for a score no run can have: a summary
 * falls back to its default instead of crashing on a scoring glitch.
 *
 * @example
 * resolveAuthorEvaluation({scheme: "pass_fail", pass_percent: 60}, 7, 10)
 *     ?.outcome; // {scheme: "pass_fail", passed: true}
 */
export function resolveAuthorEvaluation(
    evaluation: SetEvaluation | null | undefined,
    correct: number,
    total: number,
): AuthorEvaluationResult | null {
    if (!evaluation || total <= 0) return null;
    const percent = (correct / total) * 100;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
    return {
        outcome: gradeFor(evaluation, percent),
        percent,
        passPercent: evaluation.pass_percent ?? null,
        title: evaluation.title ?? null,
        report: evaluation.report ?? "compact",
    };
}

/** The exam verdict of one run, and whether the author's block decided it. */
export interface ExamVerdict {
    /** The author's evaluation when it applies (exam mode with a block). */
    authorEvaluation: AuthorEvaluationResult | null;
    /** Whether the run passed: the author's mark when the block decided,
     *  else the learner's threshold; always ``false`` outside exam mode. */
    examPass: boolean;
}

/**
 * The exam verdict of a run (#3736): in exam mode a set's evaluation block
 * replaces the learner's own threshold, on the same first-pass score.
 * Other modes have no verdict and ignore the block.
 *
 * @example
 * resolveExamVerdict({lessonMode: "exam", evaluation: {scheme: "pass_fail",
 *     pass_percent: 60}, correct: 7, total: 10, learnerThreshold: 80});
 * // {authorEvaluation: {...}, examPass: true}
 */
export function resolveExamVerdict({
    lessonMode,
    evaluation,
    correct,
    total,
    learnerThreshold,
}: {
    lessonMode: LessonMode;
    evaluation: SetEvaluation | null | undefined;
    correct: number;
    total: number;
    learnerThreshold: ExamPassThreshold;
}): ExamVerdict {
    if (lessonMode !== "exam") return { authorEvaluation: null, examPass: false };
    const authorEvaluation = resolveAuthorEvaluation(evaluation, correct, total);
    if (authorEvaluation) {
        return { authorEvaluation, examPass: authorEvaluation.outcome.passed === true };
    }
    return { authorEvaluation: null, examPass: examPassed(correct, total, learnerThreshold) };
}

/**
 * Whether the summary shows the detailed evaluation: the learner's toggle
 * once used, else open when the author's block asks for a detailed report.
 *
 * @example
 * resolveDetailedView(null, authorEvaluation); // true for report "detailed"
 */
export function resolveDetailedView(
    learnerChoice: boolean | null,
    authorEvaluation: AuthorEvaluationResult | null,
): boolean {
    if (learnerChoice !== null) return learnerChoice;
    return authorEvaluation?.report === "detailed";
}
