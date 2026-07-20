/**
 * ErrorCorrectionExercise (#1579, second adoption) - renderer for the
 * adopted extension type ``ext:al-error-correction`` (schema 1.7 extension
 * tier): "one token in this sentence is wrong - mark it and correct it".
 *
 * Interaction: tap the wrong token, type the correction, check. The typed
 * correction is graded through the SHARED free-text matcher
 * (``isFreeTextCorrect``) against the payload's ``accept`` array, so it
 * inherits the #1580 normalization (curly quotes, whitespace, terminal
 * punctuation) and typo tolerance instead of duplicating grading logic.
 *
 * After a wrong attempt the canonical solution (``accept[0]``) is surfaced
 * in a solution line - the same first-entry-is-canonical display contract
 * as core ``free_text`` and the categorization verdict chips, and the
 * reviewed (locked) reconstruction shows EXACTLY the same state as a fresh
 * submit (display parity across extension types).
 *
 * Result contract matches the sibling exercises:
 * ``onComplete({correct, total: 1, attempts, raw_answer})`` with
 * ``raw_answer.kind === "al_error_correction"``.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveErrorCorrectionAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {
    asErrorCorrectionPayload,
    canonicalErrorCorrection,
} from "../../../lib/exercises/payload/error-correction";
import {isFreeTextCorrect} from "./FreeTextExercise";
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

export interface ErrorCorrectionExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (1/1 or 0/1) + the single SRS
     *  attempt for the grammar decision. */
    onComplete: (result: ExerciseScored) => void;
}

/** Post-check classification of one token. */
type TokenVerdict = "correct" | "wrong" | "missed" | undefined;

function _tokenVerdict(
    tokenIndex: number,
    pickedIndex: number | null,
    errorIndex: number,
    submitted: boolean,
): TokenVerdict {
    if (!submitted) return undefined;
    if (tokenIndex === pickedIndex) {
        return tokenIndex === errorIndex ? "correct" : "wrong";
    }
    return tokenIndex === errorIndex ? "missed" : undefined;
}

function ErrorCorrectionExercise(
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
    }: ErrorCorrectionExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(
        () => asErrorCorrectionPayload(exercise),
        [exercise],
    );
    const reviewedAnswer =
        reviewed?.kind === "al_error_correction" ? reviewed : null;

    const [pickedIndex, setPickedIndex] = useState<number | null>(
        () => reviewedAnswer?.picked_index ?? null,
    );
    const [typedCorrection, setTypedCorrection] = useState<string>(
        () => reviewedAnswer?.typed ?? "",
    );

    const gradeAttempt = (
        attemptIndex: number | null,
        attemptText: string,
    ): boolean =>
        payload !== null &&
        attemptIndex === payload.error_index &&
        isFreeTextCorrect(attemptText, payload.accept);

    const canCheck = pickedIndex !== null && typedCorrection.trim() !== "";

    const reviewedResult =
        reviewedAnswer && payload
            ? {
                  correct: gradeAttempt(
                      reviewedAnswer.picked_index,
                      reviewedAnswer.typed,
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
            const isCorrect = gradeAttempt(pickedIndex, typedCorrection);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveErrorCorrectionAttempt(
                        exercise,
                        {setId, lessonId},
                        {
                            pickedIndex: pickedIndex ?? -1,
                            typedCorrection,
                        },
                        isCorrect,
                    ),
                ],
                raw_answer: {
                    kind: "al_error_correction",
                    picked_index: pickedIndex ?? -1,
                    typed: typedCorrection,
                },
            };
        },
        resetAnswer: () => {
            setPickedIndex(null);
            setTypedCorrection("");
        },
    });

    if (!payload) {
        return (
            <div data-testid="error-correction-empty">
                {t(
                    "lesson.exercise.al_error_correction.empty",
                    "This error-correction exercise has no sentence.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;
    const markedToken = payload.tokens[payload.error_index] ?? "";
    const canonicalSolution = canonicalErrorCorrection(exercise) ?? "";

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="error-correction-exercise"
        >
            {exercise.prompt && (
                <p
                    className="m-0 font-medium"
                    data-testid="error-correction-prompt"
                >
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <p
                className="m-0 text-sm italic text-[var(--fg-muted)]"
                data-testid="error-correction-instruction"
            >
                {t(
                    "lesson.exercise.al_error_correction.instructions",
                    "Tap the wrong word, then type the correction.",
                )}
            </p>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="error-correction-hint-button"
            />

            <div
                className="flex flex-wrap gap-2"
                data-testid="error-correction-tokens"
            >
                {payload.tokens.map((token, tokenIndex) => {
                    const verdict = _tokenVerdict(
                        tokenIndex,
                        pickedIndex,
                        payload.error_index,
                        submitted,
                    );
                    return (
                        <button
                            key={`${tokenIndex}-${token}`}
                            type="button"
                            aria-pressed={pickedIndex === tokenIndex}
                            disabled={submitted}
                            onClick={() =>
                                setPickedIndex((previous) =>
                                    previous === tokenIndex ? null : tokenIndex,
                                )
                            }
                            data-testid={`error-correction-token-${tokenIndex}`}
                            data-verdict={verdict}
                            className={cn(
                                "min-h-11 rounded-sm border px-3 py-2 text-base",
                                "border-[var(--border-strong)] bg-[var(--surface)]",
                                submitted && "cursor-default",
                                pickedIndex === tokenIndex &&
                                    !submitted &&
                                    "border-[var(--accent)] outline outline-2 outline-[var(--accent)]",
                                verdict === "correct" &&
                                    "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))]",
                                verdict === "wrong" &&
                                    "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]",
                                verdict === "missed" &&
                                    "border-[var(--success)] border-dashed",
                            )}
                        >
                            {token}
                        </button>
                    );
                })}
            </div>

            <input
                type="text"
                value={typedCorrection}
                disabled={submitted}
                onChange={(changeEvent) =>
                    setTypedCorrection(changeEvent.target.value)
                }
                onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" && canCheck) submit();
                }}
                aria-label={t(
                    "lesson.exercise.al_error_correction.input_label",
                    "Correction",
                )}
                placeholder={t(
                    "lesson.exercise.al_error_correction.input_label",
                    "Correction",
                )}
                className="min-h-11 w-full rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base"
                data-testid="error-correction-input"
            />

            {submitted && !isCorrect && (
                <p
                    className="m-0 text-sm"
                    data-testid="error-correction-solution"
                >
                    {t(
                        "lesson.exercise.al_error_correction.solution_label",
                        "Solution",
                    )}
                    {": "}
                    <span className="line-through">{markedToken}</span>
                    {" → "}
                    <strong>{canonicalSolution}</strong>
                </p>
            )}

            <ErrorCorrectionResult
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
 *  MultipleChoiceExercise / CategorizationExercise). */
function ErrorCorrectionResult({
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
                        data-testid="error-correction-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <>
                                <Check size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.al_error_correction.result_correct",
                                    "Correct!",
                                )}
                            </>
                        ) : (
                            <>
                                <X size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.al_error_correction.result_wrong",
                                    "Not quite. Check the solution below.",
                                )}
                            </>
                        )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="error-correction"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="error-correction"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t(
                    "lesson.exercise.al_error_correction.submit",
                    "Check answer",
                )}
                retryLabel={t(
                    "lesson.exercise.al_error_correction.retry",
                    "Try again",
                )}
            />
        </div>
    );
}

export default forwardRef(ErrorCorrectionExercise);
