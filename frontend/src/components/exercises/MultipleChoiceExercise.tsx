/**
 * MultipleChoiceExercise (#890 / schema v1.5).
 *
 * "Pick the right answer" exercise. The lesson schema's
 * ``Exercise.options`` is a list of answer strings; ``correct_options``
 * holds the 0-based indices of the correct one(s).
 *
 * Select mode is DERIVED from ``correct_options.length``:
 *   - exactly one correct index  → single-select (radio-like): picking
 *     an option replaces the prior choice.
 *   - two or more correct indices → multi-select (checkbox-like):
 *     picking toggles each option independently.
 *
 * Scoring is a single attempt: ``correct: 1`` only when the learner's
 * selected set equals the correct set exactly (no missing + no extra),
 * else ``0``; ``total`` is always 1. After checking, every correct
 * option is highlighted green; a selected-but-wrong option is red; the
 * resolution makes the right answer(s) explicit (not colour alone).
 *
 * Reuses the shared two-phase lifecycle (``useControlledExercise`` +
 * ``ExerciseFooter``) so the Lesson page drives one "Prüfen" button
 * while the Review / AdaptiveLesson pages keep the self-contained
 * behaviour — identical to the other four renderers. No backend call:
 * rendering + grading are fully client-side, so the exercise works the
 * same in API and Dexie mode.
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import {useI18n} from "../../hooks/ui/useI18n";
import {
    useKeyboardShortcuts,
    type ShortcutDefinition,
} from "../../shared/hooks/useKeyboardShortcuts";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../shared/data-display/InlineMarkdown";
import ExerciseHint from "./ExerciseHint";
import {deriveMultipleChoiceAttempt} from "../../lib/srs/element-attempt";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import ExerciseFooter from "./ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";

export interface MultipleChoiceExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (0 or 1 correct of 1 total)
     *  plus the single-attempt SRS payload. */
    onComplete: (result: ExerciseScored) => void;
}

interface Option {
    index: number;
    label: string;
    isCorrect: boolean;
}

function _parseOptions(exercise: ContentLessonExercise): Option[] {
    const options = exercise.options ?? [];
    const correct = new Set(exercise.correct_options ?? []);
    return options.map((label, index) => ({
        index,
        label,
        isCorrect: correct.has(index),
    }));
}

/** True when two index sets are equal (same members, any order). */
function _sameSet(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((x) => setB.has(x));
}

/** The reviewed-revisit score for a persisted multiple-choice answer,
 *  or null when there is no reviewed answer. */
function multipleChoiceReviewedResult(
    reviewedSelected: number[] | null | undefined,
    correctIndices: number[],
): {correct: number; total: number} | null {
    if (reviewedSelected == null) return null;
    return {
        correct: _sameSet(reviewedSelected, correctIndices) ? 1 : 0,
        total: 1,
    };
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
        ttsLang = null,
        codeMode = false,
    }: MultipleChoiceExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const options = useMemo(() => _parseOptions(exercise), [exercise]);
    const correctIndices = useMemo(
        () => options.filter((o) => o.isCorrect).map((o) => o.index),
        [options],
    );
    // Derived select mode: 2+ correct answers => checkbox (multi-select).
    const multiSelect = correctIndices.length > 1;

    const reviewedMc = reviewed?.kind === "multiple_choice" ? reviewed : null;

    const [selected, setSelected] = useState<number[]>(
        reviewedMc?.selected ?? [],
    );

    const reviewedResult = multipleChoiceReviewedResult(
        reviewedMc?.selected,
        correctIndices,
    );

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: selected.length > 0,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = _sameSet(selected, correctIndices);
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
                raw_answer: {kind: "multiple_choice", selected: [...selected]},
            };
        },
        resetAnswer: () => setSelected([]),
    });

    const handleToggle = (index: number) => {
        if (submitted) return;
        setSelected((prev) => {
            if (multiSelect) {
                return prev.includes(index)
                    ? prev.filter((i) => i !== index)
                    : [...prev, index];
            }
            // Single-select: a new pick replaces the prior one.
            return [index];
        });
    };

    // Lesson shortcut: number keys 1..9 toggle the Nth option.
    const numberShortcuts = useMemo<ShortcutDefinition[]>(
        () =>
            options.slice(0, 9).map((option, position) => ({
                id: `multiple-choice-${option.index}`,
                key: String(position + 1),
                context: "lesson",
                description: "Select an answer option",
                action: () => handleToggle(option.index),
            })),
        // handleToggle closes over `submitted` (early-returns after
        // submit) and the hook is also disabled below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [options, multiSelect],
    );
    useKeyboardShortcuts(numberShortcuts, {enabled: !submitted});

    if (options.length === 0) {
        return (
            <div data-testid="multiple-choice-empty">
                {t(
                    "lesson.exercise.multiple_choice.empty",
                    "This multiple-choice exercise has no options.",
                )}
            </div>
        );
    }

    const isCorrect = !!result && result.correct > 0;
    const instruction = multiSelect
        ? t(
              "lesson.exercise.multiple_choice.instructions_multi",
              "Select all correct answers.",
          )
        : t(
              "lesson.exercise.multiple_choice.instructions_single",
              "Select the correct answer.",
          );

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="multiple-choice-exercise"
            data-multiselect={multiSelect ? "true" : "false"}
        >
            <div className="exercise-prompt-row">
                <p
                    className="m-0 font-medium"
                    data-testid="multiple-choice-prompt"
                >
                    <InlineMarkdown>{exercise.prompt ?? ""}</InlineMarkdown>
                </p>
                {ttsLang && !codeMode && (
                    <ReadAloudButton
                        text={exercise.prompt ?? ""}
                        lang={ttsLang}
                        testId="multiple-choice-prompt"
                    />
                )}
            </div>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="multiple-choice-hint-button"
            />

            <p
                className="m-0 text-sm text-[var(--fg-muted)]"
                data-testid="multiple-choice-instructions"
            >
                {instruction}
            </p>

            <ul
                className="m-0 flex list-none flex-col gap-2 p-0"
                data-testid="multiple-choice-options"
                aria-label={t(
                    "lesson.exercise.multiple_choice.options_label",
                    "Answer options",
                )}
            >
                {options.map((option) => {
                    const isSelected = selected.includes(option.index);
                    const showAsCorrect = submitted && option.isCorrect;
                    const showAsWrong =
                        submitted && isSelected && !option.isCorrect;
                    return (
                        <li key={option.index}>
                            <button
                                type="button"
                                role={multiSelect ? "checkbox" : "radio"}
                                aria-checked={isSelected}
                                disabled={submitted}
                                onClick={() => handleToggle(option.index)}
                                className={cn(
                                    "relative flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-left text-sm text-[var(--fg)] enabled:hover:bg-[var(--surface-2)]",
                                    isSelected &&
                                        "is-selected border-[var(--exercise-selected)] bg-[color-mix(in_srgb,var(--exercise-selected)_12%,var(--surface))]",
                                    showAsCorrect &&
                                        "is-correct border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_18%,var(--surface))]",
                                    showAsWrong &&
                                        "is-wrong border-[var(--exercise-wrong)] bg-[color-mix(in_srgb,var(--exercise-wrong)_12%,var(--surface))]",
                                )}
                                data-testid={`multiple-choice-option-${option.index}`}
                                data-correct={
                                    option.isCorrect ? "true" : "false"
                                }
                                data-selected={isSelected ? "true" : "false"}
                            >
                                <span className="flex-1">
                                    <InlineMarkdown>
                                        {option.label}
                                    </InlineMarkdown>
                                </span>
                                {showAsCorrect && (
                                    <span
                                        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-[var(--surface)] text-[var(--exercise-correct)]"
                                        aria-label={t(
                                            "lesson.exercise.multiple_choice.correct_label",
                                            "Correct",
                                        )}
                                    >
                                        <Check size={14} aria-hidden="true" />
                                    </span>
                                )}
                                {showAsWrong && (
                                    <span
                                        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-[var(--surface)] text-[var(--exercise-wrong)]"
                                        aria-label={t(
                                            "lesson.exercise.multiple_choice.wrong_label",
                                            "Wrong",
                                        )}
                                    >
                                        <X size={14} aria-hidden="true" />
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
                {submitted && (
                    <>
                        <p
                            className={cn(
                                "answer-feedback m-0 font-semibold",
                                isCorrect
                                    ? "is-correct text-[var(--exercise-correct)]"
                                    : "is-wrong text-[var(--exercise-wrong)]",
                            )}
                            data-testid="multiple-choice-result"
                            data-result={isCorrect ? "correct" : "wrong"}
                        >
                            {isCorrect
                                ? t(
                                      "lesson.exercise.multiple_choice.result_correct",
                                      "Correct!",
                                  )
                                : t(
                                      "lesson.exercise.multiple_choice.result_wrong",
                                      "Not quite — the highlighted option(s) are the right answer.",
                                  )}
                        </p>
                        <AnswerCelebration isCorrect={isCorrect} />
                    </>
                )}
                <ExerciseFooter
                    testidPrefix="multiple-choice"
                    controlled={controlled}
                    submitted={submitted}
                    canCheck={selected.length > 0}
                    onCheck={submit}
                    onRetry={reset}
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
        </section>
    );
}

export default forwardRef(MultipleChoiceExercise);
