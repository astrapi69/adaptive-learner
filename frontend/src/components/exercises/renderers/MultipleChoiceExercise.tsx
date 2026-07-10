/**
 * MultipleChoiceExercise (#1525, schema v1.6).
 *
 * The native ``multiple_choice`` type from learn-content-engine 0.8.1:
 * ``options`` ({text, correct?}) plus ``multiple``. With ``multiple:
 * false`` (default) it renders a native radio group - exactly one pick;
 * with ``multiple: true`` a checkbox group ("select all that apply"),
 * graded by EXACT-SET match with no partial credit (the contract fixed
 * in the engine schema, mirroring cloze multiselect).
 *
 * Coexists with the cloze select/multiselect vehicle (#890/#1195) -
 * those render paths are untouched.
 *
 * Mobile-first: 44px min touch targets, native inputs with visible
 * labels + focus-visible rings. Resolution marks correct/wrong/missed
 * with an icon badge (not colour alone).
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveMultipleChoiceAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/seeded-shuffle";
import {
    correctOptionTexts,
    isMultipleChoiceCorrect,
} from "../../../lib/exercises/multiple-choice-grading";
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

export interface MultipleChoiceExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (1/1 or 0/1) + the single SRS
     *  attempt for the question. */
    onComplete: (result: ExerciseScored) => void;
}

/** Post-check classification of one option. */
type OptionVerdict = "correct" | "wrong" | "missed" | "neutral";

function _verdict(
    optionText: string,
    chosen: boolean,
    correctSet: ReadonlySet<string>,
): OptionVerdict {
    const isCorrectOption = correctSet.has(optionText);
    if (chosen) return isCorrectOption ? "correct" : "wrong";
    return isCorrectOption ? "missed" : "neutral";
}

function MultipleChoiceExercise(
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
    }: MultipleChoiceExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const multiple = exercise.multiple === true;
    const allOptions = useMemo(
        () => exercise.options ?? [],
        [exercise.options],
    );
    const correctSet = useMemo(
        () => new Set(correctOptionTexts(allOptions)),
        [allOptions],
    );
    const reviewedChoice =
        reviewed?.kind === "multiple_choice" ? reviewed : null;

    const [selected, setSelected] = useState<string[]>(
        () => [...(reviewedChoice?.selected ?? [])],
    );

    /** Shuffled option texts, stable per mount via a seed so positions
     *  don't jitter between re-renders. */
    const optionTexts = useMemo(
        () =>
            seededShuffle(
                allOptions.map((option) => option.text),
                exercise.id,
            ),
        [allOptions, exercise.id],
    );

    const canCheck = selected.length > 0;

    const reviewedResult = reviewedChoice
        ? {
              correct: isMultipleChoiceCorrect(
                  reviewedChoice.selected,
                  allOptions,
                  multiple,
              )
                  ? 1
                  : 0,
              total: 1,
          }
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: canCheck,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = isMultipleChoiceCorrect(
                selected,
                allOptions,
                multiple,
            );
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveMultipleChoiceAttempt(
                        exercise,
                        {setId, lessonId},
                        selected,
                        isCorrect,
                    ),
                ],
                raw_answer: {
                    kind: "multiple_choice",
                    selected: [...selected],
                },
            };
        },
        resetAnswer: () => setSelected([]),
    });

    const handleSelect = (optionText: string) => {
        if (submitted) return;
        if (!multiple) {
            setSelected([optionText]);
            return;
        }
        setSelected((prev) =>
            prev.includes(optionText)
                ? prev.filter((o) => o !== optionText)
                : [...prev, optionText],
        );
    };

    if (optionTexts.length === 0) {
        return (
            <div data-testid="multiple-choice-empty">
                {t(
                    "lesson.exercise.multiple_choice.empty",
                    "This multiple-choice exercise has no options.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;
    const groupLabel = multiple
        ? t(
              "lesson.exercise.multiple_choice.multi_group_label",
              "Select all that apply",
          )
        : t(
              "lesson.exercise.multiple_choice.single_group_label",
              "Select one answer",
          );

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="multiple-choice-exercise"
            data-multiple={multiple ? "true" : "false"}
        >
            {exercise.prompt && (
                <p
                    className="m-0 font-medium"
                    data-testid="multiple-choice-prompt"
                >
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <p
                className="m-0 text-sm italic text-[var(--fg-muted)]"
                data-testid="multiple-choice-instruction"
            >
                {groupLabel}
            </p>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="multiple-choice-hint-button"
            />

            <div
                role={multiple ? "group" : "radiogroup"}
                aria-label={groupLabel}
                className="flex flex-col gap-2"
                data-testid="multiple-choice-options"
            >
                {optionTexts.map((optionText, idx) => {
                    const chosen = selected.includes(optionText);
                    const verdict = submitted
                        ? _verdict(optionText, chosen, correctSet)
                        : "neutral";
                    return (
                        <label
                            key={optionText}
                            className={cn(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-base",
                                "border-[var(--border-strong)] bg-[var(--surface)]",
                                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]",
                                submitted && "cursor-default",
                                verdict === "correct" &&
                                    "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))]",
                                verdict === "wrong" &&
                                    "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]",
                                verdict === "missed" &&
                                    "border-[var(--success)] border-dashed",
                            )}
                            data-testid={`multiple-choice-option-${idx}`}
                            data-verdict={submitted ? verdict : undefined}
                        >
                            <input
                                type={multiple ? "checkbox" : "radio"}
                                name={
                                    multiple
                                        ? undefined
                                        : `multiple-choice-${exercise.id}`
                                }
                                className="size-5 accent-[var(--accent)]"
                                checked={chosen}
                                disabled={submitted}
                                onChange={() => handleSelect(optionText)}
                                aria-label={optionText}
                                data-testid={`multiple-choice-input-${idx}`}
                            />
                            <span className="flex-1">
                                <InlineMarkdown>{optionText}</InlineMarkdown>
                            </span>
                            {submitted && verdict !== "neutral" && (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1 text-xs font-medium",
                                        verdict === "wrong"
                                            ? "text-[var(--danger)]"
                                            : "text-[var(--success)]",
                                    )}
                                    data-testid={`multiple-choice-badge-${idx}`}
                                >
                                    {verdict === "wrong" ? (
                                        <X size={12} aria-hidden="true" />
                                    ) : (
                                        <Check size={12} aria-hidden="true" />
                                    )}
                                    {verdict === "correct" &&
                                        t(
                                            "lesson.exercise.multiple_choice.badge_correct",
                                            "Correct",
                                        )}
                                    {verdict === "wrong" &&
                                        t(
                                            "lesson.exercise.multiple_choice.badge_wrong",
                                            "Wrong",
                                        )}
                                    {verdict === "missed" &&
                                        t(
                                            "lesson.exercise.multiple_choice.badge_missed",
                                            "Missed",
                                        )}
                                </span>
                            )}
                        </label>
                    );
                })}
            </div>

            <MultipleChoiceResult
                submitted={submitted}
                isCorrect={isCorrect}
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

/** Post-check feedback + the shared check/retry footer. Extracted so the
 *  main renderer stays under the complexity gate (same split as
 *  ClozeMultiSelect). */
function MultipleChoiceResult({
    submitted,
    isCorrect,
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
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                            isCorrect
                                ? "is-correct text-[var(--success)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="multiple-choice-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <>
                                <Check size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.multiple_choice.result_correct",
                                    "Correct!",
                                )}
                            </>
                        ) : (
                            <>
                                <X size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.multiple_choice.result_wrong",
                                    "Not quite. Review the highlighted options.",
                                )}
                            </>
                        )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="multiple-choice"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="multiple-choice"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t(
                    "lesson.exercise.multiple_choice.submit",
                    "Check answer",
                )}
                retryLabel={t(
                    "lesson.exercise.multiple_choice.retry",
                    "Try again",
                )}
            />
        </div>
    );
}

export default forwardRef(MultipleChoiceExercise);
