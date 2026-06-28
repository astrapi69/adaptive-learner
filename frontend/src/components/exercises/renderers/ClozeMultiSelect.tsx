/**
 * ClozeMultiSelect (#1195).
 *
 * "Select all that apply" multiple-choice, authored as a CLOZE exercise
 * with ``cloze_mode: "multiselect"``. The ``sentence`` is the question
 * stem; ``accept`` (every entry correct, mode-specific reuse) and
 * ``distractors`` are two disjoint option lists rendered as one shuffled
 * native checkbox group. Graded by EXACT-SET match: correct only when
 * the chosen set equals the ``accept`` set — no missing correct option,
 * no chosen distractor.
 *
 * Distinct render path from the blank-based ClozeExercise (type/select):
 * a multiselect question has no ``___`` markers and no ``blanks``.
 * ClozeExercise delegates here when the mode is multiselect.
 *
 * Mobile-first: 44px min touch targets, native checkboxes with visible
 * labels + focus-visible rings for keyboard navigation. Resolution marks
 * correct/wrong/missed with an icon badge (not colour alone).
 */

import {Check, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import {cn} from "@/lib/utils";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import {deriveClozeMultiSelectAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/seeded-shuffle";
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

export interface ClozeMultiSelectProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Called on submit with the exact-set score (1/1 or 0/1) + the
     *  single SRS attempt for the question. */
    onComplete: (result: ExerciseScored) => void;
}

/** Normalise an option for set comparison (NFC + trim). Options are
 *  picked from a fixed list (no typing) so the chosen strings are
 *  byte-identical to the authored ``accept`` / ``distractors``. */
function _norm(value: string): string {
    return value.normalize("NFC").trim();
}

/** Exact-set verdict: the chosen set equals the correct set. */
function _exactSetCorrect(
    selected: readonly string[],
    accept: readonly string[],
): boolean {
    const want = new Set(accept.map(_norm));
    const got = new Set(selected.map(_norm));
    if (want.size !== got.size) return false;
    for (const value of want) if (!got.has(value)) return false;
    return true;
}

/** Post-check classification of one option. */
type OptionVerdict = "correct" | "wrong" | "missed" | "neutral";

function _verdict(
    option: string,
    chosen: boolean,
    acceptSet: ReadonlySet<string>,
): OptionVerdict {
    const isCorrectOption = acceptSet.has(_norm(option));
    if (chosen) return isCorrectOption ? "correct" : "wrong";
    return isCorrectOption ? "missed" : "neutral";
}

function ClozeMultiSelect(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
        onAdvance,
        advanceLabel,
    }: ClozeMultiSelectProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const question = exercise.sentence ?? "";
    const accept = useMemo(() => exercise.accept ?? [], [exercise.accept]);
    const acceptSet = useMemo(
        () => new Set(accept.map(_norm)),
        [accept],
    );
    const reviewedMulti =
        reviewed?.kind === "cloze_multiselect" ? reviewed : null;

    const [selected, setSelected] = useState<string[]>(
        () => [...(reviewedMulti?.selected ?? [])],
    );

    /** The shuffled checkbox options (accept + distractors), stable per
     *  mount via a seed so positions don't jitter between re-renders. */
    const options = useMemo(
        () =>
            seededShuffle(
                [...accept, ...(exercise.distractors ?? [])],
                exercise.id,
            ),
        [accept, exercise.distractors, exercise.id],
    );

    const canCheck = selected.length > 0;

    const reviewedResult = reviewedMulti
        ? {
              correct: _exactSetCorrect(reviewedMulti.selected, accept) ? 1 : 0,
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
            const isCorrect = _exactSetCorrect(selected, accept);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveClozeMultiSelectAttempt(
                        exercise,
                        {setId, lessonId},
                        selected,
                        isCorrect,
                    ),
                ],
                raw_answer: {
                    kind: "cloze_multiselect",
                    selected: [...selected],
                },
            };
        },
        resetAnswer: () => setSelected([]),
    });

    const handleToggle = (option: string) => {
        if (submitted) return;
        setSelected((prev) =>
            prev.includes(option)
                ? prev.filter((o) => o !== option)
                : [...prev, option],
        );
    };

    if (question === "" || accept.length === 0) {
        return (
            <div data-testid="cloze-multiselect-empty">
                {t(
                    "lesson.exercise.cloze.empty",
                    "This cloze exercise has no blanks.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="cloze-multiselect-exercise"
            data-cloze-mode="multiselect"
        >
            {exercise.prompt && (
                <p
                    className="m-0 font-medium"
                    data-testid="cloze-multiselect-prompt"
                >
                    <InlineMarkdown>{exercise.prompt}</InlineMarkdown>
                </p>
            )}

            <div className="exercise-prompt-row">
                <p
                    className="m-0 rounded-sm bg-[var(--surface-2)] p-3 text-[1.0625rem] font-medium leading-relaxed"
                    data-testid="cloze-multiselect-question"
                >
                    <InlineMarkdown>{question}</InlineMarkdown>
                </p>
                {ttsLang && (
                    <ReadAloudButton
                        text={question}
                        lang={ttsLang}
                        testId="cloze-multiselect-question"
                    />
                )}
            </div>

            <p
                className="m-0 text-sm italic text-[var(--fg-muted)]"
                data-testid="cloze-multiselect-instruction"
            >
                {t(
                    "lesson.exercise.cloze.multi_group_label",
                    "Select all that apply",
                )}
            </p>

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="cloze-multiselect-hint-button"
            />

            <div
                role="group"
                aria-label={t(
                    "lesson.exercise.cloze.multi_group_label",
                    "Select all that apply",
                )}
                className="flex flex-col gap-2"
                data-testid="cloze-multiselect-options"
            >
                {options.map((option, idx) => {
                    const chosen = selected.includes(option);
                    const verdict = submitted
                        ? _verdict(option, chosen, acceptSet)
                        : "neutral";
                    return (
                        <label
                            key={option}
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
                            data-testid={`cloze-multiselect-option-${idx}`}
                            data-verdict={submitted ? verdict : undefined}
                        >
                            <input
                                type="checkbox"
                                className="size-5 accent-[var(--accent)]"
                                checked={chosen}
                                disabled={submitted}
                                onChange={() => handleToggle(option)}
                                aria-label={option}
                                data-testid={`cloze-multiselect-checkbox-${idx}`}
                            />
                            <span className="flex-1">
                                <InlineMarkdown>{option}</InlineMarkdown>
                            </span>
                            {submitted && verdict !== "neutral" && (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1 text-xs font-medium",
                                        verdict === "wrong"
                                            ? "text-[var(--danger)]"
                                            : "text-[var(--success)]",
                                    )}
                                    data-testid={`cloze-multiselect-badge-${idx}`}
                                >
                                    {verdict === "wrong" ? (
                                        <X size={12} aria-hidden="true" />
                                    ) : (
                                        <Check size={12} aria-hidden="true" />
                                    )}
                                    {verdict === "correct" &&
                                        t(
                                            "lesson.exercise.cloze.multi_badge_correct",
                                            "Correct",
                                        )}
                                    {verdict === "wrong" &&
                                        t(
                                            "lesson.exercise.cloze.multi_badge_wrong",
                                            "Wrong",
                                        )}
                                    {verdict === "missed" &&
                                        t(
                                            "lesson.exercise.cloze.multi_badge_missed",
                                            "Missed",
                                        )}
                                </span>
                            )}
                        </label>
                    );
                })}
            </div>

            <ClozeMultiSelectResult
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

/** Post-check feedback (correct/wrong line, #1218 success-merge on a
 *  correct answer, celebration) + the shared check/retry footer. Extracted
 *  so the main renderer stays under the complexity gate. */
function ClozeMultiSelectResult({
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
                        data-testid="cloze-multiselect-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <>
                                <Check size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.cloze.result_correct",
                                    "All correct!",
                                )}
                            </>
                        ) : (
                            <>
                                <X size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.cloze.multi_result_wrong",
                                    "Not quite. Review the highlighted options.",
                                )}
                            </>
                        )}
                    </p>
                    {isCorrect && showAnswerToggle && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="cloze-multiselect"
                        />
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="cloze-multiselect"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.cloze.submit", "Check answers")}
                retryLabel={t("lesson.exercise.cloze.retry", "Try again")}
            />
        </div>
    );
}

export default forwardRef(ClozeMultiSelect);
