/**
 * CategorizationExercise (#1579) - renderer for the adopted extension
 * exercise type ``ext:al-categorization`` (schema 1.7 extension tier):
 * "sort these items into their buckets".
 *
 * Interaction is tap-tap (mobile-first, no drag & drop): tap an item in
 * the pool to arm it, tap a bucket to drop it there, tap an assigned chip
 * to return it to the pool. Checkable once every item is assigned; scored
 * per item (``correct/total`` over the pool) with one SRS attempt per item
 * (``deriveCategorizationAttempts``), mirroring the matching fan-out.
 *
 * The payload contract and its validation live in
 * ``lib/exercises/categorization.ts`` (the engine half); a malformed
 * payload renders the empty state - load-time validation refuses it
 * before it can reach a session.
 *
 * Result contract matches the sibling exercises:
 * ``onComplete({correct, total, attempts, raw_answer})`` with
 * ``raw_answer.kind === "al_categorization"`` for locked-revisit
 * reconstruction.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveCategorizationAttempts} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/seeded-shuffle";
import {
    allCategorizationItems,
    asCategorizationPayload,
    authoredBucketFor,
    countCorrectAssignments,
    type CategorizationPayload,
} from "../../../lib/exercises/categorization";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../shell/ExerciseFooter";
import ExerciseHint from "../feedback/ExerciseHint";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

export interface CategorizationExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Called on submit with the per-item score + one SRS attempt per
     *  authored item. */
    onComplete: (result: ExerciseScored) => void;
}

function CategorizationExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: CategorizationExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(
        () => asCategorizationPayload(exercise),
        [exercise],
    );
    const reviewedAnswer =
        reviewed?.kind === "al_categorization" ? reviewed : null;

    const [assignments, setAssignments] = useState<Map<string, string>>(
        () => new Map(reviewedAnswer?.assignments ?? []),
    );
    const [activeItem, setActiveItem] = useState<string | null>(null);

    /** Shuffled item pool, stable per mount via the exercise-id seed. */
    const itemPool = useMemo(
        () =>
            payload
                ? seededShuffle(allCategorizationItems(payload), exercise.id)
                : [],
        [payload, exercise.id],
    );

    const unassignedItems = itemPool.filter((item) => !assignments.has(item));
    const canCheck = itemPool.length > 0 && unassignedItems.length === 0;

    const reviewedResult =
        reviewedAnswer && payload
            ? {
                  correct: countCorrectAssignments(
                      payload,
                      new Map(reviewedAnswer.assignments),
                  ),
                  total: itemPool.length,
              }
            : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: canCheck,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => ({
            correct: payload
                ? countCorrectAssignments(payload, assignments)
                : 0,
            total: itemPool.length,
            attempts: deriveCategorizationAttempts(
                exercise,
                {setId, lessonId},
                assignments,
            ),
            raw_answer: {
                kind: "al_categorization",
                assignments: [...assignments.entries()],
            },
        }),
        resetAnswer: () => {
            setAssignments(new Map());
            setActiveItem(null);
        },
    });

    if (!payload || itemPool.length === 0) {
        return (
            <div data-testid="categorization-empty">
                {t(
                    "lesson.exercise.al_categorization.empty",
                    "This categorization exercise has no categories.",
                )}
            </div>
        );
    }

    const handlePoolTap = (item: string) => {
        if (submitted) return;
        setActiveItem((previous) => (previous === item ? null : item));
    };

    const handleBucketTap = (bucketName: string) => {
        if (submitted || activeItem === null) return;
        const armedItem = activeItem;
        setAssignments((previous) => new Map(previous).set(armedItem, bucketName));
        setActiveItem(null);
    };

    const handleChipTap = (item: string) => {
        if (submitted) return;
        setAssignments((previous) => {
            const remaining = new Map(previous);
            remaining.delete(item);
            return remaining;
        });
    };

    const isCorrect = result !== null && result.correct === result.total;

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="categorization-exercise"
        >
            {exercise.prompt && (
                <p className="m-0 font-medium" data-testid="categorization-prompt">
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <p
                className="m-0 text-sm italic text-[var(--fg-muted)]"
                data-testid="categorization-instruction"
            >
                {t(
                    "lesson.exercise.al_categorization.instructions",
                    "Tap an item, then tap its category.",
                )}
            </p>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="categorization-hint-button"
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {payload.categories.map((bucket) => (
                    <CategorizationBucket
                        key={bucket.name}
                        bucketName={bucket.name}
                        payload={payload}
                        itemPool={itemPool}
                        assignments={assignments}
                        submitted={submitted}
                        armed={activeItem !== null}
                        onAssign={handleBucketTap}
                        onUnassign={handleChipTap}
                    />
                ))}
            </div>

            {unassignedItems.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="m-0 text-sm text-[var(--fg-muted)]">
                        {t("lesson.exercise.al_categorization.pool_label", "Items")}
                    </p>
                    <div
                        className="flex flex-wrap gap-2"
                        data-testid="categorization-pool"
                    >
                        {unassignedItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                aria-pressed={activeItem === item}
                                data-active={activeItem === item || undefined}
                                onClick={() => handlePoolTap(item)}
                                className={cn(
                                    "min-h-11 rounded-sm border px-3 py-2 text-base",
                                    "border-[var(--border-strong)] bg-[var(--surface)]",
                                    activeItem === item &&
                                        "border-[var(--accent)] outline outline-2 outline-[var(--accent)]",
                                )}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <CategorizationResult
                submitted={submitted}
                isCorrect={isCorrect}
                result={result}
                showAnswerToggle={showAnswerToggle}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                controlled={controlled}
                canCheck={canCheck}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

/** One bucket: the tap-to-assign header plus the chips assigned to it,
 *  with per-chip verdicts (and the authored bucket) after check. */
function CategorizationBucket({
    bucketName,
    payload,
    itemPool,
    assignments,
    submitted,
    armed,
    onAssign,
    onUnassign,
}: {
    bucketName: string;
    payload: CategorizationPayload;
    itemPool: readonly string[];
    assignments: ReadonlyMap<string, string>;
    submitted: boolean;
    armed: boolean;
    onAssign: (bucketName: string) => void;
    onUnassign: (item: string) => void;
}) {
    const assignedItems = itemPool.filter(
        (item) => assignments.get(item) === bucketName,
    );
    return (
        <section
            className="min-w-40 flex-1 rounded-sm border border-[var(--border-strong)] p-2"
            data-testid={`categorization-bucket-${bucketName}`}
        >
            <button
                type="button"
                onClick={() => onAssign(bucketName)}
                data-testid={`categorization-bucket-assign-${bucketName}`}
                className={cn(
                    "min-h-11 w-full rounded-sm border border-dashed px-3 py-2 text-base font-medium",
                    "border-[var(--border-strong)] bg-[var(--surface)]",
                    armed &&
                        !submitted &&
                        "border-[var(--accent)] text-[var(--accent)]",
                )}
            >
                {bucketName}
            </button>
            <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
                {assignedItems.map((item) => {
                    const authoredBucket = authoredBucketFor(payload, item);
                    const verdict = submitted
                        ? authoredBucket === bucketName
                            ? "correct"
                            : "wrong"
                        : undefined;
                    return (
                        <button
                            key={item}
                            type="button"
                            onClick={() => onUnassign(item)}
                            data-testid={`categorization-chip-${item}`}
                            data-verdict={verdict}
                            className={cn(
                                "inline-flex min-h-11 items-center gap-1 rounded-sm border px-3 py-2 text-base",
                                "border-[var(--border-strong)] bg-[var(--surface)]",
                                submitted && "cursor-default",
                                verdict === "correct" &&
                                    "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))]",
                                verdict === "wrong" &&
                                    "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]",
                            )}
                        >
                            {item}
                            {verdict === "correct" && (
                                <Check
                                    size={12}
                                    aria-hidden="true"
                                    className="text-[var(--success)]"
                                />
                            )}
                            {verdict === "wrong" && authoredBucket && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--danger)]">
                                    <X size={12} aria-hidden="true" />
                                    {authoredBucket}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

/** Post-check feedback + the shared check/retry footer. Extracted so the
 *  main renderer stays under the complexity gate (same split as
 *  MultipleChoiceExercise). */
function CategorizationResult({
    submitted,
    isCorrect,
    result,
    showAnswerToggle,
    onAdvance,
    advanceLabel,
    controlled,
    canCheck,
    onCheck,
    onRetry,
}: {
    submitted: boolean;
    isCorrect: boolean;
    result: {correct: number; total: number} | null;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    return (
        <div className="flex flex-wrap items-center gap-2">
            {submitted && result && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                            isCorrect
                                ? "is-correct text-[var(--success)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="categorization-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <Check size={14} aria-hidden="true" />
                        ) : (
                            <X size={14} aria-hidden="true" />
                        )}
                        {`${result.correct}/${result.total} `}
                        {isCorrect
                            ? t(
                                  "lesson.exercise.al_categorization.result_correct",
                                  "Correct!",
                              )
                            : t(
                                  "lesson.exercise.al_categorization.result_wrong",
                                  "Not quite. Review the highlighted items.",
                              )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="categorization"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="categorization"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t(
                    "lesson.exercise.al_categorization.submit",
                    "Check answer",
                )}
                retryLabel={t(
                    "lesson.exercise.al_categorization.retry",
                    "Try again",
                )}
            />
        </div>
    );
}

export default forwardRef(CategorizationExercise);
