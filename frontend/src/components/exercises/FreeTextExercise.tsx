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
import type {KeyboardEvent} from "react";
import {useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveFreeTextAttempt} from "../../lib/element-attempt";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {
    ContentLessonExercise,
    ElementAttempt,
} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DiffHighlight from "./DiffHighlight";

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

/** True iff ``input`` matches any entry of ``accept``:
 *  normalized exact match first, Levenshtein <= 1 fallback.
 *  Empty input never matches. */
export function isFreeTextCorrect(
    input: string,
    accept: readonly string[],
): boolean {
    const normInput = _normalize(input);
    if (normInput === "") return false;
    const normCandidates = accept.map(_normalize);
    if (normCandidates.includes(normInput)) return true;
    for (const cand of normCandidates) {
        if (_levenshtein(normInput, cand) <= 1) return true;
    }
    return false;
}

export interface FreeTextExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => void;
}

export default function FreeTextExercise({
    exercise,
    setId = "",
    lessonId = "",
    onComplete,
}: FreeTextExerciseProps) {
    const {t} = useI18n();
    const accept = exercise.accept ?? [];
    const canonical = accept[0] ?? "";

    const [input, setInput] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{
        correct: number;
        total: number;
    } | null>(null);
    const [showHint, setShowHint] = useState(false);

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

    const trimmed = input.trim();
    const isInputEmpty = trimmed === "";

    const handleSubmit = () => {
        if (submitted || isInputEmpty) return;
        const isCorrect = isFreeTextCorrect(input, accept);
        const correct = isCorrect ? 1 : 0;
        const attempt = deriveFreeTextAttempt(
            exercise,
            {setId, lessonId},
            input,
            isCorrect,
        );
        const scored = {correct, total: 1, attempts: [attempt]};
        setResult({correct, total: 1});
        setSubmitted(true);
        onComplete(scored);
    };

    const handleReset = () => {
        setInput("");
        setSubmitted(false);
        setResult(null);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !submitted && !isInputEmpty) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isCorrect = result !== null && result.correct > 0;

    return (
        <section
            className="free-text-exercise"
            data-testid="free-text-exercise"
        >
            <p
                className="free-text-prompt"
                data-testid="free-text-prompt"
            >
                {exercise.prompt}
            </p>

            <input
                type="text"
                className="free-text-input"
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

            {exercise.hint && !submitted && (
                <div className="free-text-hint-row">
                    {!showHint ? (
                        <button
                            type="button"
                            className="free-text-hint-toggle"
                            onClick={() => setShowHint(true)}
                            data-testid="free-text-hint-show"
                        >
                            {t(
                                "lesson.exercise.free_text.hint_show",
                                "Need a hint?",
                            )}
                        </button>
                    ) : (
                        <p
                            className="free-text-hint"
                            data-testid="free-text-hint"
                        >
                            {exercise.hint}
                        </p>
                    )}
                </div>
            )}

            <div className="free-text-actions">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isInputEmpty}
                        onClick={handleSubmit}
                        data-testid="free-text-submit"
                    >
                        {t(
                            "lesson.exercise.free_text.submit",
                            "Check answer",
                        )}
                    </button>
                ) : (
                    <>
                        <p
                            className={`free-text-result answer-feedback${
                                isCorrect ? " is-correct" : " is-wrong"
                            }`}
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
                        <button
                            type="button"
                            className="btn"
                            onClick={handleReset}
                            data-testid="free-text-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.exercise.free_text.retry",
                                "Try again",
                            )}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}
