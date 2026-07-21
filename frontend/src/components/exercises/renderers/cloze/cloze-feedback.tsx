/**
 * Cloze post-answer surfaces (#1782 — extracted from
 * ClozeExercise.tsx).
 *
 * Holds the exercise-level hint disclosure, the per-blank diff row,
 * the solution view, the My-answer/Solution reveal, and the result
 * block with the shared exercise footer. Pure presentation — all
 * state arrives via props.
 */

import {Check, X} from "lucide-react";
import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../../hooks/lesson/modes/useLessonMode";
import ExerciseAnswerToggle, {
    type AnswerView,
} from "../../feedback/ExerciseAnswerToggle";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {tokenDiff} from "../../../../lib/exercises/grading/token-diff";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import DiffHighlight from "../../feedback/DiffHighlight";
import ExerciseFooter from "../../shell/ExerciseFooter";
import type {ClozeBlank} from "./cloze-types";

/** Exercise-level "Need a hint?" toggle (distinct from the per-blank
 *  inline hints). Renders nothing once submitted or when the exercise
 *  carries no hint. */
export function ClozeHint({
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
                    className="text-[var(--accent-text)] hover:underline"
                    onClick={onShowHint}
                    data-testid="cloze-hint-show"
                >
                    {t("lesson.exercise.cloze.hint_show", "Need a hint?")}
                </Button>
            ) : (
                <p
                    className="m-0 rounded-sm bg-[var(--surface-2)] p-2 text-sm text-[var(--fg-muted)]"
                    data-testid="cloze-hint"
                >
                    {hint}
                </p>
            )}
        </div>
    );
}

/** The "My answer" view: one token diff per WRONG blank (the learner's
 *  input struck through against the canonical answer). */
function ClozeDiffRow({
    blanks,
    perBlankCorrect,
    inputs,
}: {
    blanks: readonly ClozeBlank[];
    perBlankCorrect: boolean[];
    inputs: string[];
}) {
    return (
        <div
            className="flex basis-full flex-col gap-1"
            data-testid="cloze-diff-row"
        >
            {blanks.map((blank, idx) =>
                perBlankCorrect[idx] ? null : (
                    <DiffHighlight
                        key={idx}
                        tokens={tokenDiff(inputs[idx], blank.accept[0] ?? "")}
                        className="cloze-blank-diff"
                    />
                ),
            )}
        </div>
    );
}

/** The "Solution" view: every blank's accepted answer(s), labelled by the
 *  blank's hint (or "Blank n"). Mirrors the free-text solution panel. */
function ClozeSolutionView({blanks}: {blanks: readonly ClozeBlank[]}) {
    const {t} = useI18n();
    return (
        <div
            className="basis-full rounded-sm border border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-3 py-2"
            data-testid="cloze-solution-view"
        >
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                {t("lesson.exercise.free_text.accepted", "Accepted answers")}
            </span>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {blanks.map((blank, idx) => (
                    <li key={idx} className="text-[var(--fg)]">
                        <span className="text-[var(--fg-muted)]">
                            {blank.hint ??
                                t(
                                    "lesson.exercise.cloze.blank_label",
                                    "Blank {n}",
                                ).replace("{n}", String(idx + 1))}
                            {": "}
                        </span>
                        {blank.accept.join(" · ")}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** The post-check reveal: in a toggle-enabled mode (#1005/#1011, hidden in
 *  exam) the learner switches between their graded answer (the per-blank
 *  diff) and the revealed solution; otherwise the diff shows directly. */
function ClozeReveal({
    showAnswerToggle,
    blanks,
    perBlankCorrect,
    inputs,
}: {
    showAnswerToggle: boolean;
    blanks: readonly ClozeBlank[];
    perBlankCorrect: boolean[];
    inputs: string[];
}) {
    const [view, setView] = useState<AnswerView>("my-answer");
    if (!showAnswerToggle) {
        return (
            <ClozeDiffRow
                blanks={blanks}
                perBlankCorrect={perBlankCorrect}
                inputs={inputs}
            />
        );
    }
    return (
        <div className="flex basis-full flex-col gap-2">
            <ExerciseAnswerToggle
                view={view}
                onShowMyAnswer={() => setView("my-answer")}
                onShowSolution={() => setView("solution")}
                testIdPrefix="cloze"
            />
            {view === "my-answer" ? (
                <ClozeDiffRow
                    blanks={blanks}
                    perBlankCorrect={perBlankCorrect}
                    inputs={inputs}
                />
            ) : (
                <ClozeSolutionView blanks={blanks} />
            )}
        </div>
    );
}

/** Post-check feedback (all-correct vs N-of-M), the My-answer/Solution
 *  reveal on a miss, the celebration, and the shared exercise footer. */
export function ClozeResult({
    submitted,
    isAllCorrect,
    correctCount,
    total,
    blanks,
    perBlankCorrect,
    inputs,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    onAdvance,
    advanceLabel,
}: {
    submitted: boolean;
    isAllCorrect: boolean;
    correctCount: number;
    total: number;
    blanks: readonly ClozeBlank[];
    perBlankCorrect: boolean[];
    inputs: string[];
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    onAdvance?: () => void;
    advanceLabel?: string;
}) {
    const {t} = useI18n();
    // #1005/#1011 — after a miss, toggle between "My answer" (the per-blank
    // diff) and "Solution" (the accepted answers). Gated on the mode's
    // ``showAnswerToggle`` (hidden in exam mode), matching free-text +
    // word-tiles so cloze isn't the odd one out (#1216).
    const {showAnswerToggle} = useLessonMode();
    // #1218 — an all-correct answer makes the My-answer / Solution toggle
    // redundant; merge it into a success badge + "Continue" (lesson flow
    // only, when onAdvance is set).
    const showSuccessAdvance =
        isAllCorrect && showAnswerToggle && !!onAdvance;
    return (
        <div className="flex flex-wrap items-center gap-2">
            {submitted && (
                <>
                    <p
                        className={cn(
                            "answer-feedback m-0 inline-flex items-center gap-1 font-medium",
                            isAllCorrect
                                ? "is-correct text-[var(--success)]"
                                : "is-wrong text-[var(--danger)]",
                        )}
                        data-testid="cloze-result"
                        data-result={isAllCorrect ? "correct" : "wrong"}
                    >
                        {isAllCorrect ? (
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
                                    "lesson.exercise.cloze.result_partial",
                                    "{correct} of {total} correct.",
                                )
                                    .replace("{correct}", String(correctCount))
                                    .replace("{total}", String(total))}
                            </>
                        )}
                    </p>
                    {showSuccessAdvance && onAdvance && (
                        <ExerciseSuccessAdvance
                            onAdvance={onAdvance}
                            label={advanceLabel}
                            testIdPrefix="cloze"
                        />
                    )}
                    {!isAllCorrect && (
                        <ClozeReveal
                            showAnswerToggle={showAnswerToggle}
                            blanks={blanks}
                            perBlankCorrect={perBlankCorrect}
                            inputs={inputs}
                        />
                    )}
                    <AnswerCelebration isCorrect={isAllCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="cloze"
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
