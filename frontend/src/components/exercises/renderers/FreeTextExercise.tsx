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

import {Check, X} from "lucide-react";
import type {KeyboardEvent, Ref} from "react";
import {forwardRef, useEffect, useRef, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/useLessonMode";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ExercisePromptRow from "../shell/ExercisePromptRow";
import ExerciseHint from "../feedback/ExerciseHint";
import ExerciseAnswerToggle, {type AnswerView} from "../feedback/ExerciseAnswerToggle";
import {deriveFreeTextAttempt} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {tokenDiff} from "../../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import DiffHighlight from "../feedback/DiffHighlight";
import DirectionInstruction from "../feedback/DirectionInstruction";
import ExerciseFooter from "../shell/ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

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

/** True iff a WRONG answer is a *near miss* — a small typo within 2 edits
 *  of the closest accepted answer (but not already accepted, which the ≤1
 *  matcher handles). Drives the encouraging "Almost! Watch out for:"
 *  feedback instead of a flat "Not quite." (#627). Empty input is never a
 *  near miss. */
export function isFreeTextNearMiss(
    input: string,
    accept: readonly string[],
    codeMode = false,
): boolean {
    if (isFreeTextCorrect(input, accept, codeMode)) return false;
    const norm = codeMode ? _normalizeCode : _normalize;
    const normInput = norm(input);
    if (normInput === "") return false;
    return accept.some((cand) => {
        const distance = _levenshtein(normInput, norm(cand));
        return distance > 0 && distance <= 2;
    });
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

type Translate = (key: string, fallback?: string) => string;

/** The reviewed-revisit score for a persisted free-text answer, or null
 *  when there is no reviewed answer. */
function freeTextReviewedResult(
    reviewedInput: string | null | undefined,
    accept: readonly string[],
    codeMode: boolean,
): {correct: number; total: number} | null {
    if (reviewedInput == null) return null;
    return {
        correct: isFreeTextCorrect(reviewedInput, accept, codeMode) ? 1 : 0,
        total: 1,
    };
}

/** The answer field — a monospace textarea in code mode (Enter inserts a
 *  newline), a plain single-line input otherwise. */
function FreeTextInput({
    codeMode,
    codeLanguage,
    input,
    onInput,
    onKeyDown,
    submitted,
    inputBase,
}: {
    codeMode: boolean;
    codeLanguage: string | null;
    input: string;
    onInput: (value: string) => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    submitted: boolean;
    inputBase: string;
}) {
    const {t} = useI18n();
    // #692 — auto-focus the answer field on mount so the learner can type
    // immediately without a click. The dispatcher keys each step by id, so
    // the renderer remounts per step and this fires on every step change
    // (regular lesson, review, error-replay). Skipped for a reviewed
    // (read-only, submitted) revisit; focusing a disabled field is a no-op
    // anyway. On mobile this opens the keyboard, which is the desired
    // behaviour (the learner wants to type).
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (submitted) return;
        (inputRef.current ?? textareaRef.current)?.focus();
        // Mount-only: the component remounts per step (keyed by step id).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (codeMode) {
        return (
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
                    ref={textareaRef}
                    className={cn(
                        inputBase,
                        "free-text-input-code resize-y overflow-x-auto whitespace-pre font-mono [overflow-wrap:normal] [tab-size:2]",
                    )}
                    value={input}
                    onChange={(e) => onInput(e.target.value)}
                    onKeyDown={onKeyDown}
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
        );
    }
    return (
        <input
            ref={inputRef}
            type="text"
            className={inputBase}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={submitted}
            placeholder={t(
                "lesson.exercise.free_text.placeholder",
                "Type your answer…",
            )}
            aria-label={t("lesson.exercise.free_text.input_label", "Your answer")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            data-testid="free-text-input"
        />
    );
}

/** The "Need a hint?" disclosure; null until shown or once submitted. */
function FreeTextHint({
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
                    data-testid="free-text-hint-show"
                >
                    {t("lesson.exercise.free_text.hint_show", "Need a hint?")}
                </Button>
            ) : (
                <p
                    className="m-0 rounded-sm border px-3 py-2 text-sm text-[var(--fg)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] border-[color-mix(in_srgb,var(--accent)_25%,var(--border))]"
                    data-testid="free-text-hint"
                >
                    {hint}
                </p>
            )}
        </div>
    );
}

/** Correct/wrong feedback (with a token diff on a miss) + the shared
 *  exercise footer. */
function FreeTextResult({
    submitted,
    isCorrect,
    input,
    accept,
    canonical,
    codeMode,
    controlled,
    canCheck,
    onCheck,
    onRetry,
    t,
}: {
    submitted: boolean;
    isCorrect: boolean;
    input: string;
    accept: readonly string[];
    canonical: string;
    codeMode: boolean;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
    t: Translate;
}) {
    // #627 — a wrong-but-close answer (within 2 edits) gets encouraging
    // feedback. Computed here so the component stays under the complexity
    // gate; the ternary below only consults it on the wrong branch.
    const nearMiss = isFreeTextNearMiss(input, accept, codeMode);
    // #1005/#1011 — after a wrong answer, toggle between "My answer" (the
    // learner's text + token diff) and "Solution" (the accepted answers).
    // Gated on the mode's ``showAnswerToggle`` (hidden in exam mode).
    const {showAnswerToggle} = useLessonMode();
    const [view, setView] = useState<AnswerView>("my-answer");
    const showReveal = submitted && !isCorrect && showAnswerToggle;
    return (
        <div className="flex flex-wrap items-center gap-3">
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
                                {nearMiss
                                    ? t(
                                          "lesson.exercise.free_text.result_almost",
                                          "Almost! Watch out for:",
                                      )
                                    : t(
                                          "lesson.exercise.free_text.result_wrong",
                                          "Not quite.",
                                      )}
                            </>
                        )}
                    </p>
                    {showReveal && (
                        <div className="flex w-full flex-col gap-2">
                            <ExerciseAnswerToggle
                                view={view}
                                onShowMyAnswer={() => setView("my-answer")}
                                onShowSolution={() => setView("solution")}
                                testIdPrefix="free-text"
                            />
                            {view === "my-answer" ? (
                                <div
                                    className="free-text-diff-row"
                                    data-testid="free-text-diff-row"
                                >
                                    <DiffHighlight
                                        tokens={tokenDiff(input, canonical)}
                                        className="free-text-diff"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="rounded-sm border border-[var(--exercise-correct)] bg-[color-mix(in_srgb,var(--exercise-correct)_12%,var(--surface))] px-3 py-2"
                                    data-testid="free-text-solution-view"
                                >
                                    <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                                        {t(
                                            "lesson.exercise.free_text.accepted",
                                            "Accepted answers",
                                        )}
                                    </span>
                                    <span className="text-[var(--fg)]">
                                        {accept.join(" · ")}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    <AnswerCelebration isCorrect={isCorrect} />
                </>
            )}
            <ExerciseFooter
                testidPrefix="free-text"
                controlled={controlled}
                submitted={submitted}
                canCheck={canCheck}
                onCheck={onCheck}
                onRetry={onRetry}
                checkLabel={t("lesson.exercise.free_text.submit", "Check answer")}
                retryLabel={t("lesson.exercise.free_text.retry", "Try again")}
            />
        </div>
    );
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

    const reviewedResult = freeTextReviewedResult(
        reviewedFreeText?.input,
        accept,
        codeMode,
    );

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
            <ExercisePromptRow
                prompt={exercise.prompt ?? ""}
                ttsLang={ttsLang}
                codeMode={codeMode}
                testId="free-text-prompt"
            />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="free-text-hint-button"
            />

            <DirectionInstruction exercise={exercise} />

            <FreeTextInput
                codeMode={codeMode}
                codeLanguage={codeLanguage}
                input={input}
                onInput={setInput}
                onKeyDown={handleKeyDown}
                submitted={submitted}
                inputBase={inputBase}
            />

            <FreeTextHint
                hint={exercise.hint}
                submitted={submitted}
                showHint={showHint}
                onShowHint={() => setShowHint(true)}
            />

            <FreeTextResult
                submitted={submitted}
                isCorrect={isCorrect}
                input={input}
                accept={accept}
                canonical={canonical}
                codeMode={codeMode}
                controlled={controlled}
                canCheck={!isInputEmpty}
                onCheck={submit}
                onRetry={reset}
                t={t}
            />
        </section>
    );
}

export default forwardRef(FreeTextExercise);
