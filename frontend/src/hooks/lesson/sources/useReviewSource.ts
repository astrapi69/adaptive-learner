/**
 * useReviewSource (EXP-052 slice 1, refs #3169).
 *
 * The source adapter of the review session: calls ``useReviewLesson``
 * exactly as the page did and normalises its result to the shell's
 * ``RunnerSource``. The review-specific wording lives here, not in the
 * shell: the live title (#2703), the subtitle that counts the ELEMENTS
 * the presented questions cover (#664 / #3170, capped form when the pool
 * was trimmed), the ``lesson_id`` the dispatcher stamps (#673, with the
 * legacy step-id parser), and ``recordStepAttempts`` carrying the current
 * step along so every element it covers counts as played (#3170).
 *
 * The two things the review summary needs beyond ``RunnerSource`` sit on
 * the SAME returned object (``reload`` for "another round", ``neutral``
 * for the reinforced wording): the page passes the whole object as the
 * shell's ``source`` (extra fields are ignored there) and reads the two
 * extras in its summary render prop. One object, no second return value
 * to destructure and keep in sync.
 *
 * @example
 * const source = useReviewSource({ setId, limit: quick ? 5 : readReviewLimit() });
 * <LessonRunner source={source} policy={REVIEW_POLICY}
 *   summary={(tallies) => <ReviewSummaryPanel {...tallies} neutral={source.neutral} onAnotherRound={source.reload} />} />
 */

import {useCallback, useState} from "react";

import type {RunnerSource, RunnerSourceStatus} from "../../../components/lesson/runner/types";
import {countCoveredElements} from "../../../lib/review/review-lesson";
import type {ContentLessonStep, ElementAttempt} from "../../../storage/types";
import {useI18n} from "../../ui/useI18n";
import {useReviewLesson} from "../modes/useReviewLesson";

export interface UseReviewSourceOptions {
    setId: string;
    /** #718 / #628: the session length (the learner's setting, or 5 for a quick review). */
    limit: number;
}

export interface ReviewSource extends RunnerSource {
    /** #718: fetch the rest of the due queue and start a new round in place. */
    reload: () => void;
    /** #3170: the round holds never-wrong elements, so the summary says
     *  "reinforced" instead of "corrected". */
    neutral: boolean;
}

/**
 * LEGACY fallback (#673): recover the lesson_id from a synthesised step id
 * ``"review-{lesson_id}-{exercise_id}-{element_key}"`` by stripping the
 * last two hyphen tokens. LOSSY (real exercise ids and element keys
 * contain hyphens); only for steps that predate ``review_lesson_id``.
 */
export function extractReviewLessonId(stepId: string): string {
    if (!stepId.startsWith("review-")) return "";
    const remainder = stepId.slice("review-".length);
    const lastDash = remainder.lastIndexOf("-");
    if (lastDash <= 0) return remainder;
    const secondLastDash = remainder.lastIndexOf("-", lastDash - 1);
    if (secondLastDash <= 0) return remainder;
    return remainder.slice(0, secondLastDash);
}

/** The lesson id the attempt deriver stamps for a synthesised step. */
function lessonIdOf(step: ContentLessonStep | null): string {
    if (!step) return "";
    return step.review_lesson_id ?? extractReviewLessonId(step.id);
}

/** The review session as a ``RunnerSource`` plus ``reload`` and ``neutral``. */
export function useReviewSource({setId, limit}: UseReviewSourceOptions): ReviewSource {
    const {t} = useI18n();
    const review = useReviewLesson({
        setId,
        title: t("review.session_title", "Review session"),
        limit,
    });
    // "Another round" is a new run for the shell (hints cleared, run-local
    // results dropped); the counter makes the run key move with it.
    const [round, setRound] = useState(0);
    const {reload: reloadRound, recordStepAttempts: recordAttempts} = review;
    const reload = useCallback(() => {
        setRound((r) => r + 1);
        reloadRound();
    }, [reloadRound]);

    const steps = review.lesson?.steps ?? [];
    const total = steps.length;
    const index = review.currentStepIndex;
    const status: RunnerSourceStatus =
        review.status === "ready" && review.lesson === null ? "error" : review.status;
    const isSummary = status === "ready" && index >= total;
    const step = status === "ready" && !isSummary ? (steps[index] ?? null) : null;

    const recordStepAttempts = useCallback(
        (attempts: readonly ElementAttempt[]) => recordAttempts(attempts, step ?? undefined),
        [recordAttempts, step],
    );

    const coveredCount = countCoveredElements(steps);
    const dueCount = review.dueCount ?? 0;
    const subtitle =
        coveredCount < dueCount
            ? t("review.subtitle_capped", "Reviewing {shown} of {due} elements due for SRS")
                  .replace("{shown}", String(coveredCount))
                  .replace("{due}", String(dueCount))
            : t("review.subtitle", "Reviewing {n} element(s) due for SRS").replace(
                  "{n}",
                  String(coveredCount),
              );

    return {
        status,
        error: review.error,
        title: t("review.session_title", "Review session"),
        subtitle,
        step,
        cards: review.lesson?.cards ?? [],
        setId,
        lessonId: lessonIdOf(step),
        runKey: `${setId}#${round}`,
        position: {index, total},
        isSummary,
        tallies: {
            correct: review.sessionScoreCorrect ?? 0,
            total: review.sessionScoreTotal ?? 0,
            remaining: review.remaining ?? 0,
        },
        goNext: review.goNext,
        goPrev: review.goPrev,
        recordStepAttempts,
        reload,
        neutral: (review.queue ?? []).some((item) => item.error_count === 0),
    };
}
