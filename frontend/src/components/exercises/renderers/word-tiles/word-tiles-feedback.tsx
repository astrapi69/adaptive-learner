/**
 * Word-Tiles post-answer surfaces (#1776 — extracted from
 * WordTilesExercise.tsx, sibling of word-tiles-parts.tsx).
 *
 * Holds the hint disclosure, the correct/wrong result line with the
 * shared exercise footer, and the post-check My-answer / Solution
 * reveal. Pure presentation — all state arrives via props.
 */

import {Check, X} from "lucide-react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseAnswerToggle, {type AnswerView} from "../../feedback/ExerciseAnswerToggle";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import ExerciseFooter from "../../shell/ExerciseFooter";
import {WordTilesAnswerView} from "./word-tiles-parts";

export type Translate = (key: string, fallback?: string) => string;

/** The "Need a hint?" disclosure; null until shown or once submitted. */
export function WordTilesHint({
    hint,
    submitted,
    showHint,
    onShowHint,
}: {
    hint: string | null | undefined;
    submitted: boolean;
    showHint: boolean;
    onShowHint: () => void;
}) {
    const {t} = useI18n();
    if (!hint || submitted) return null;
    return (
        <div className="flex items-center gap-2">
            {!showHint ? (
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="text-[var(--accent-text)] underline underline-offset-2 hover:no-underline"
                    onClick={onShowHint}
                    data-testid="word-tiles-hint-show"
                >
                    {t("lesson.exercise.word_tiles.hint_show", "Need a hint?")}
                </Button>
            ) : (
                <p
                    className="m-0 rounded-sm border px-3 py-2 text-sm text-[var(--fg)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] border-[color-mix(in_srgb,var(--accent)_25%,var(--border))]"
                    data-testid="word-tiles-hint"
                >
                    {hint}
                </p>
            )}
        </div>
    );
}

/** Correct/wrong feedback + celebration + the shared exercise footer.
 *  The readable correction (My answer / Solution tiles) lives in the
 *  toggle views above, not in a token-diff line (#1005). */
export function WordTilesResult({
    submitted,
    isCorrect,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    t,
}: {
    submitted: boolean;
    isCorrect: boolean;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    t: Translate;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1.5 font-semibold",
                            isCorrect
                                ? "is-correct text-[var(--exercise-correct)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="word-tiles-result"
                        data-result={isCorrect ? "correct" : "wrong"}
                    >
                        {isCorrect ? (
                            <>
                                <Check size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.word_tiles.result_correct",
                                    "Correct!",
                                )}
                            </>
                        ) : (
                            <>
                                <X size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.word_tiles.result_wrong",
                                    "Not quite.",
                                )}
                            </>
                        )}
                    </p>
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="word-tiles"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.word_tiles.submit", "Check answer")}
                retryLabel={t("lesson.exercise.word_tiles.retry", "Try again")}
            />
        </div>
    );
}

/** Post-check reveal: on a fully-correct answer the success-merge (badge
 *  + "Continue", #1218); otherwise the My-answer / Solution toggle and the
 *  chosen view. Extracted so the main renderer stays under the complexity
 *  gate. Renders nothing pre-check or when the toggle is mode-hidden. */
export function WordTilesReveal({
    submitted,
    showAnswerToggle,
    isCorrect,
    onAdvance,
    advanceLabel,
    view,
    onShowMyAnswer,
    onShowSolution,
    myAnswerLabels,
    myAnswerCorrectness,
    tiles,
    t,
}: {
    submitted: boolean;
    showAnswerToggle: boolean;
    isCorrect: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    view: AnswerView;
    onShowMyAnswer: () => void;
    onShowSolution: () => void;
    myAnswerLabels: string[];
    myAnswerCorrectness: boolean[];
    tiles: string[];
    t: Translate;
}) {
    if (!submitted || !showAnswerToggle) return null;
    if (isCorrect && onAdvance) {
        // The interactive editor unmounts on submit, so unlike cloze/free-text
        // (whose inputs stay mounted) the built sentence would vanish here.
        // Keep it on screen, all green, above the success badge (#2494).
        return (
            <>
                <WordTilesAnswerView
                    labels={myAnswerLabels}
                    correctness={null}
                    testId="word-tiles-correct-sentence"
                    ariaLabel={t(
                        "lesson.exercise.word_tiles.answer_label",
                        "Your answer",
                    )}
                />
                <ExerciseSuccessAdvance
                    onAdvance={onAdvance}
                    label={advanceLabel}
                    testIdPrefix="word-tiles"
                />
            </>
        );
    }
    return (
        <>
            <ExerciseAnswerToggle
                view={view}
                onShowMyAnswer={onShowMyAnswer}
                onShowSolution={onShowSolution}
                testIdPrefix="word-tiles"
            />
            {view === "my-answer" ? (
                <WordTilesAnswerView
                    labels={myAnswerLabels}
                    correctness={myAnswerCorrectness}
                    testId="word-tiles-my-answer-view"
                    ariaLabel={t("lesson.exercise.toggle.my_answer", "My answer")}
                />
            ) : (
                <WordTilesAnswerView
                    labels={tiles}
                    correctness={null}
                    testId="word-tiles-solution-view"
                    ariaLabel={t("lesson.exercise.toggle.solution", "Solution")}
                />
            )}
        </>
    );
}
