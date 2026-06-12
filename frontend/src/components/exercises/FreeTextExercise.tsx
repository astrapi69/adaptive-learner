/**
 * FreeTextExercise (Phase 45 / EXP-002 / 3E — F-108).
 *
 * Text-input exercise. The user types an answer; Submit
 * checks it against ``exercise.accept`` (case-insensitive,
 * NFC-normalized exact match first; Levenshtein <= 1 fallback
 * for single-edit typos). The first entry in ``accept`` is
 * the canonical answer surfaced after a wrong attempt.
 *
 * Typo tolerance (D1, Phase 45): threshold = 1 catches
 * "Mercii" / "Merc" but rejects near-miss wrong words like
 * "Marci". Authors control synonyms / case / punctuation
 * variants via additional ``accept`` entries — the renderer
 * does not infer beyond a single edit.
 *
 * AI semantic validation (P-114) is OUT of scope per D2.
 * The dual-mode dispatcher belongs in Phase 46 alongside
 * SRS; folding it into this renderer would create an
 * asymmetric foundation.
 *
 * Result contract matches the sibling exercises:
 * ``onComplete({correct, total})`` where ``total`` is
 * always 1. Parent (Lesson viewer) persists via
 * ``recordStepResult``.
 *
 * Mobile-first: input is full-width, Submit stretches at
 * narrow viewports, 44px min touch targets.
 */

import {Check, RotateCcw, X} from "lucide-react";
import type {KeyboardEvent, Ref} from "react";
import {forwardRef, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../lesson/ReadAloudButton";
import {deriveFreeTextAttempt} from "../../lib/element-attempt";
import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DiffHighlight from "./DiffHighlight";
import DirectionInstruction from "./DirectionInstruction";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";

/** Levenshtein edit distance between ``a`` and ``b``.
 *  Two-row DP variant: O(m*n) time, O(n) space. The free-
 *  text exercise compares short authored answers (typically
 *  under 30 chars), so the matrix stays small. */
function _levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let prev = new Array<number>(b.length + 1);
    let curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost,
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

/** NFC unicode normalization + trim + locale-aware lowercase.
 *  Catches surface variants ("MERCI", "Mêrci", "merci ") that
 *  authors should not have to enumerate in ``accept``. */
function _normalize(s: string): string {
    return s.normalize("NFC").trim().toLocaleLowerCase();
}

/** Code-answer normalization (schema v1.3). Code is CASE-sensitive,
 *  so we keep case — but we drop ALL whitespace (so "print( 'x' )" ==
 *  "print('x')") and unify quote styles (', ", ` -> "), the two
 *  variations a learner shouldn't be marked wrong for. Authors can
 *  still add explicit ``accept`` entries for cases where spacing is
 *  semantically meaningful. */
function _normalizeCode(s: string): string {
    return s.replace(/\s+/g, "").replace(/['"`]/g, '"');
}

/** True iff ``input`` matches any entry of ``accept``:
 *  normalized exact match first, Levenshtein <= 1 fallback.
 *  Empty input never matches. In ``codeMode`` the normalizer is
 *  whitespace-stripping + quote-unifying + case-preserving. */
export function isFreeTextCorrect(
    input: string,
    accept: readonly string[],
    codeMode = false,
): boolean {
    const norm = codeMode ? _normalizeCode : _normalize;
    const normInput = norm(input);
    if (normInput === "") return false;
    const normCandidates = accept.map(norm);
    if (normCandidates.includes(normInput)) return true;
    for (const cand of normCandidates) {
        if (_levenshtein(normInput, cand) <= 1) return true;
    }
    return false;
}

export interface FreeTextExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Schema v1.3 — when the referenced card is a code/formula card,
     *  render a monospace, spellcheck-off textarea and match answers
     *  with whitespace-tolerant, case-sensitive code normalization. */
    codeMode?: boolean;
    /** Highlighter language hint, surfaced as a small label. */
    codeLanguage?: string | null;
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: ExerciseScored) => void;
}

function FreeTextExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        codeMode = false,
        codeLanguage = null,
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
    }: FreeTextExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const accept = exercise.accept ?? [];
    const canonical = accept[0] ?? "";
    const reviewedFreeText =
        reviewed?.kind === "free_text" ? reviewed : null;

    const [input, setInput] = useState(reviewedFreeText?.input ?? "");
    const [showHint, setShowHint] = useState(false);

    const trimmed = input.trim();
    const isInputEmpty = trimmed === "";

    const reviewedResult = reviewedFreeText
        ? {
              correct: isFreeTextCorrect(
                  reviewedFreeText.input,
                  accept,
                  codeMode,
              )
                  ? 1
                  : 0,
              total: 1,
          }
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: !isInputEmpty,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = isFreeTextCorrect(input, accept, codeMode);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveFreeTextAttempt(
                        exercise,
                        {setId, lessonId},
                        input,
                        isCorrect,
                    ),
                ],
                raw_answer: {kind: "free_text", input},
            };
        },
        resetAnswer: () => setInput(""),
    });

    const handleKeyDown = (
        e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        // In code mode the input is a multi-line textarea, so Enter must
        // insert a newline, not submit. Plain free-text submits on Enter.
        if (codeMode) return;
        if (e.key === "Enter" && !submitted && !isInputEmpty) {
            e.preventDefault();
            submit();
        }
    };

    if (accept.length === 0) {
        return (
            <div data-testid="free-text-empty">
                {t(
                    "lesson.exercise.free_text.empty",
                    "This free-text exercise has no accepted answers.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;

    // Shared input/textarea styling (was .free-text-input). 44px min
    // height; accent focus ring; muted disabled state.
    const inputBase =
        "w-full min-h-11 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)]";

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="free-text-exercise"
        >
            <div className="exercise-prompt-row">
                <p
                    className="m-0 font-medium"
                    data-testid="free-text-prompt"
                >
                    {exercise.prompt}
                </p>
                {ttsLang && !codeMode && (
                    <ReadAloudButton
                        text={exercise.prompt ?? ""}
                        lang={ttsLang}
                        testId="free-text-prompt"
                    />
                )}
            </div>

            <DirectionInstruction exercise={exercise} />

            {codeMode ? (
                <div className="relative">
                    {codeLanguage && (
                        <span
                            className="pointer-events-none absolute right-2 top-1 text-[0.7rem] uppercase tracking-[0.04em] text-[var(--text-muted)]"
                            data-testid="free-text-code-lang"
                        >
                            {codeLanguage}
                        </span>
                    )}
                    <textarea
                        className={cn(
                            inputBase,
                            "free-text-input-code resize-y overflow-x-auto whitespace-pre font-mono [overflow-wrap:normal] [tab-size:2]",
                        )}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitted}
                        rows={4}
                        placeholder={t(
                            "lesson.exercise.free_text.code_placeholder",
                            "Type the code…",
                        )}
                        aria-label={t(
                            "lesson.exercise.free_text.input_label",
                            "Your answer",
                        )}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        data-testid="free-text-input"
                    />
                </div>
            ) : (
                <input
                    type="text"
                    className={inputBase}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={submitted}
                    placeholder={t(
                        "lesson.exercise.free_text.placeholder",
                        "Type your answer…",
                    )}
                    aria-label={t(
                        "lesson.exercise.free_text.input_label",
                        "Your answer",
                    )}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-testid="free-text-input"
                />
            )}

            {exercise.hint && !submitted && (
                <div className="flex items-center gap-2">
                    {!showHint ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-[var(--accent-text)] underline underline-offset-2 hover:no-underline"
                            onClick={() => setShowHint(true)}
                            data-testid="free-text-hint-show"
                        >
                            {t(
                                "lesson.exercise.free_text.hint_show",
                                "Need a hint?",
                            )}
                        </Button>
                    ) : (
                        <p
                            className="m-0 rounded-sm border px-3 py-2 text-sm text-[var(--fg)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] border-[color-mix(in_srgb,var(--accent)_25%,var(--border))]"
                            data-testid="free-text-hint"
                        >
                            {exercise.hint}
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                {!submitted && !controlled && (
                    <Button
                        type="button"
                        disabled={isInputEmpty}
                        onClick={submit}
                        data-testid="free-text-submit"
                    >
                        {t(
                            "lesson.exercise.free_text.submit",
                            "Check answer",
                        )}
                    </Button>
                )}
                {submitted && (
                    <>
                        <p
                            className={cn(
                                "answer-feedback m-0 inline-flex items-center gap-1.5 font-semibold",
                                isCorrect
                                    ? "is-correct text-[var(--exercise-correct)]"
                                    : "is-wrong text-[var(--exercise-wrong)]",
                            )}
                            data-testid="free-text-result"
                            data-result={isCorrect ? "correct" : "wrong"}
                        >
                            {isCorrect ? (
                                <>
                                    <Check size={14} aria-hidden="true" />
                                    {t(
                                        "lesson.exercise.free_text.result_correct",
                                        "Correct!",
                                    )}
                                </>
                            ) : (
                                <>
                                    <X size={14} aria-hidden="true" />
                                    {t(
                                        "lesson.exercise.free_text.result_wrong",
                                        "Not quite.",
                                    )}
                                </>
                            )}
                        </p>
                        {!isCorrect && (
                            <div
                                className="free-text-diff-row"
                                data-testid="free-text-diff-row"
                            >
                                <DiffHighlight
                                    tokens={tokenDiff(input, canonical)}
                                    className="free-text-diff"
                                />
                            </div>
                        )}
                        <AnswerCelebration isCorrect={isCorrect} />
                        {!controlled && (
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={reset}
                                data-testid="free-text-retry"
                            >
                                <RotateCcw size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.free_text.retry",
                                    "Try again",
                                )}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

export default forwardRef(FreeTextExercise);
