/**
 * ClozeExercise (Phase 52D / v1.35.0 / P-127 + F-111).
 *
 * Fill-in-the-blank renderer. The exercise's ``sentence`` carries
 * ``___`` markers; ``blanks[i]`` provides the metadata for the
 * i-th marker. The renderer splits on the markers and interleaves
 * one input control per blank:
 *
 *   "type"   → ``<input>`` per blank, validated with the existing
 *              ``isFreeTextCorrect`` matcher (NFC + Levenshtein
 *              <= 1 fallback). Default mode when ``cloze_mode``
 *              is omitted.
 *   "select" → ``<select>`` per blank with options shuffled from
 *              ``distractors`` + the canonical accept. Schema
 *              validation guarantees ``distractors`` is non-empty
 *              when ``cloze_mode === "select"``.
 *
 * Element-attempt fan-out: one ElementAttempt per blank via
 * ``deriveClozeAttempts`` — so per-blank mastery tracking lights
 * up cleanly when one blank is consistently missed and another
 * is consistently fluent.
 *
 * Mobile-first: every input/select gets 44px min touch target.
 * Inputs render inline with the surrounding text via CSS so the
 * sentence reads naturally on a single line at desktop widths
 * and wraps gracefully at narrow viewports.
 */

import {Check, X} from "lucide-react";
import type {KeyboardEvent, Ref} from "react";
import {forwardRef, useEffect, useMemo, useRef, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import ExerciseHint from "../feedback/ExerciseHint";
import ExerciseAnswerToggle, {
    type AnswerView,
} from "../feedback/ExerciseAnswerToggle";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../../lesson/tts/ReadAloudButton";
import InlineMarkdown from "../../../shared/data-display/InlineMarkdown";
import {deriveClozeAttempts} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/seeded-shuffle";
import ChoiceButtonGroup from "../../../shared/forms/ChoiceButtonGroup";
import {tokenDiff} from "../../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../../storage/types";
import AnswerCelebration from "../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../feedback/ExerciseSuccessAdvance";
import ClozeMultiSelect from "./ClozeMultiSelect";
import DiffHighlight from "../feedback/DiffHighlight";
import ExerciseFooter from "../shell/ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";
import {isFreeTextCorrect} from "./FreeTextExercise";

export interface ClozeExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Schema v1.3 — when the referenced card is a code/formula card,
     *  render the cloze sentence + blanks in a monospace, no-spellcheck
     *  style (code cloze). */
    codeMode?: boolean;
    /** Called on submit with the score (sum of correct blanks
     *  of total blanks) + the per-blank SRS attempts. */
    onComplete: (result: ExerciseScored) => void;
}

/** Split the cloze sentence on ``___`` markers. The returned
 *  array always has ``blanks.length + 1`` segments — the i-th
 *  blank sits between segment i and segment i+1. */
function _splitOnMarkers(sentence: string): string[] {
    return sentence.split("___");
}

/** One blank's authored metadata (accept list, hint, placeholder). */
type ClozeBlank = NonNullable<ContentLessonExercise["blanks"]>[number];

/** Score a reviewed (read-only) cloze attempt: how many of the frozen
 *  inputs match their blank's accept list. Returns null when there is
 *  no reviewed answer to score. */
function clozeReviewedResult(
    reviewedInputs: readonly string[] | null,
    blanks: readonly ClozeBlank[],
): {correct: number; total: number} | null {
    if (!reviewedInputs) return null;
    return {
        correct: blanks.filter((blank, i) =>
            isFreeTextCorrect(reviewedInputs[i] ?? "", blank.accept),
        ).length,
        total: blanks.length,
    };
}

/** The prompt line + (non-code lessons only) the read-aloud control. */
function ClozePromptRow({
    prompt,
    ttsLang,
    codeMode,
}: {
    prompt: string | undefined;
    ttsLang: string | null;
    codeMode: boolean;
}) {
    return (
        <div className="exercise-prompt-row">
            <p className="m-0 font-medium" data-testid="cloze-prompt">
                <InlineMarkdown>{prompt ?? ""}</InlineMarkdown>
            </p>
            {ttsLang && !codeMode && (
                <ReadAloudButton
                    text={prompt ?? ""}
                    lang={ttsLang}
                    testId="cloze-prompt"
                />
            )}
        </div>
    );
}

/** A single blank control: an ``<input>`` (type mode) or ``<select>``
 *  (select mode) plus the optional inline per-blank hint, wrapped in a
 *  span that reflects the post-check correct/wrong state. */
function ClozeBlankControl({
    idx,
    blank,
    mode,
    submitted,
    isCorrect,
    value,
    options,
    onChange,
    onKeyDown,
    blankBase,
    blankState,
}: {
    idx: number;
    blank: ClozeBlank;
    mode: "type" | "select";
    submitted: boolean;
    isCorrect: boolean;
    value: string;
    options: string[] | undefined;
    onChange: (idx: number, value: string) => void;
    onKeyDown: (idx: number, event: KeyboardEvent) => void;
    blankBase: string;
    blankState: (idx: number) => string | false;
}) {
    const {t} = useI18n();
    const blankLabel =
        blank.hint ??
        t("lesson.exercise.cloze.blank_label", "Blank {n}").replace(
            "{n}",
            String(idx + 1),
        );
    return (
        <span
            className={cn(
                "mx-1 inline-flex flex-col items-stretch gap-0.5 align-baseline",
                submitted && (isCorrect ? "is-correct" : "is-wrong"),
            )}
            data-testid={`cloze-blank-${idx}`}
            data-result={
                submitted ? (isCorrect ? "correct" : "wrong") : "pending"
            }
        >
            {mode === "type" ? (
                <input
                    type="text"
                    className={cn(blankBase, blankState(idx))}
                    value={value}
                    onChange={(e) => onChange(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    disabled={submitted}
                    placeholder={blank.placeholder ?? "?"}
                    aria-label={blankLabel}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-testid={`cloze-input-${idx}`}
                />
            ) : (
                <select
                    className={cn(blankBase, blankState(idx))}
                    value={value}
                    onChange={(e) => onChange(idx, e.target.value)}
                    onKeyDown={(e) => onKeyDown(idx, e)}
                    disabled={submitted}
                    aria-label={blankLabel}
                    data-testid={`cloze-select-${idx}`}
                >
                    <option value="">
                        {t(
                            "lesson.exercise.cloze.select_placeholder",
                            "Choose…",
                        )}
                    </option>
                    {options?.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            )}
            {blank.hint && !submitted && (
                <span
                    className="text-xs italic text-[var(--fg-muted)]"
                    data-testid={`cloze-blank-hint-${idx}`}
                >
                    {blank.hint}
                </span>
            )}
        </span>
    );
}

/** The cloze sentence: the marker-split segments interleaved with one
 *  blank control per blank. Each blank reflects its post-check
 *  correct/wrong state once ``submitted``. */
function ClozeSentence({
    segments,
    blanks,
    mode,
    submitted,
    perBlankCorrect,
    inputs,
    selectOptions,
    onChange,
    onKeyDown,
    blankBase,
    blankState,
    codeMode,
}: {
    segments: string[];
    blanks: readonly ClozeBlank[];
    mode: "type" | "select";
    submitted: boolean;
    perBlankCorrect: boolean[];
    inputs: string[];
    selectOptions: string[][];
    onChange: (idx: number, value: string) => void;
    onKeyDown: (idx: number, event: KeyboardEvent) => void;
    blankBase: string;
    blankState: (idx: number) => string | false;
    codeMode: boolean;
}) {
    const {t} = useI18n();
    return (
        <p
            className={cn(
                "m-0 rounded-sm bg-[var(--surface-2)] p-3 text-[1.0625rem] leading-[1.8]",
                codeMode && "cloze-sentence-code",
            )}
            data-testid="cloze-sentence"
            aria-label={t(
                "lesson.exercise.cloze.sentence_label",
                "Cloze sentence",
            )}
        >
            {segments.map((segment, segIdx) => (
                <span key={`seg-${segIdx}`} className="inline">
                    <InlineMarkdown>{segment}</InlineMarkdown>
                    {segIdx < blanks.length && (
                        <ClozeBlankControl
                            idx={segIdx}
                            blank={blanks[segIdx]}
                            mode={mode}
                            submitted={submitted}
                            isCorrect={perBlankCorrect[segIdx]}
                            value={inputs[segIdx]}
                            options={selectOptions[segIdx]}
                            onChange={onChange}
                            onKeyDown={onKeyDown}
                            blankBase={blankBase}
                            blankState={blankState}
                        />
                    )}
                </span>
            ))}
        </p>
    );
}

/** Select-mode (multiple-choice) rendering: the answer options as a tappable
 *  button radiogroup per blank (replaces the native `<select>`, which mis-hits
 *  on iOS — #1341). One group per blank; a non-empty surrounding sentence is
 *  shown above with the current pick chipped into the blank. The data model
 *  (accept[0] + distractors, seeded shuffle) is unchanged. */
function ClozeSelectChoices({
    segments,
    blanks,
    submitted,
    inputs,
    selectOptions,
    perBlankCorrect,
    onChange,
}: {
    segments: string[];
    blanks: readonly ClozeBlank[];
    submitted: boolean;
    inputs: string[];
    selectOptions: string[][];
    perBlankCorrect: boolean[];
    onChange: (idx: number, value: string) => void;
}) {
    const {t} = useI18n();
    const hasText = segments.some((s) => s.trim() !== "");
    return (
        <div className="flex flex-col gap-3" data-testid="cloze-choices">
            {hasText && (
                <p
                    className="m-0 rounded-sm bg-[var(--surface-2)] p-3 text-[1.0625rem] leading-[1.8]"
                    data-testid="cloze-sentence"
                >
                    {segments.map((segment, segIdx) => (
                        <span key={`seg-${segIdx}`} className="inline">
                            <InlineMarkdown>{segment}</InlineMarkdown>
                            {segIdx < blanks.length && (
                                <span
                                    className="mx-1 rounded-sm bg-[var(--surface)] px-2 py-0.5 font-semibold"
                                    data-testid={`cloze-selected-${segIdx}`}
                                >
                                    {inputs[segIdx] || "___"}
                                </span>
                            )}
                        </span>
                    ))}
                </p>
            )}
            {blanks.map((blank, idx) => {
                const correct = blank.accept[0] ?? "";
                const picked = inputs[idx] ?? "";
                return (
                    <ChoiceButtonGroup
                        key={`choices-${idx}`}
                        options={selectOptions[idx] ?? []}
                        value={picked || null}
                        onChange={(value) => onChange(idx, value)}
                        ariaLabel={
                            blank.hint ??
                            t(
                                "lesson.exercise.cloze.blank_label",
                                "Blank {n}",
                            ).replace("{n}", String(idx + 1))
                        }
                        locked={submitted}
                        stateFor={
                            submitted
                                ? (opt) =>
                                      opt === correct
                                          ? "correct"
                                          : opt === picked && !perBlankCorrect[idx]
                                            ? "wrong"
                                            : undefined
                                : undefined
                        }
                        testIdPrefix={`cloze-option-${idx}`}
                        groupTestId={`cloze-choices-${idx}`}
                    />
                );
            })}
        </div>
    );
}

/** Exercise-level "Need a hint?" toggle (distinct from the per-blank
 *  inline hints). Renders nothing once submitted or when the exercise
 *  carries no hint. */
function ClozeHint({
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
function ClozeResult({
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

function ClozeExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        codeMode = false,
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
        onAdvance,
        advanceLabel,
    }: ClozeExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const sentence = exercise.sentence ?? "";
    const blanks = useMemo(() => exercise.blanks ?? [], [exercise.blanks]);
    // ``multiselect`` is handled by the dispatch wrapper before reaching
    // this blank-based renderer, so only type/select arrive here.
    const mode: "type" | "select" =
        exercise.cloze_mode === "select" ? "select" : "type";
    const reviewedCloze = reviewed?.kind === "cloze" ? reviewed : null;

    const [inputs, setInputs] = useState<string[]>(() =>
        reviewedCloze
            ? blanks.map((_, i) => reviewedCloze.inputs[i] ?? "")
            : blanks.map(() => ""),
    );
    const [showHint, setShowHint] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);

    /** For ``select`` mode, build the per-blank option list once
     *  per mount: canonical accept + all distractors, shuffled
     *  by a stable seed so the order doesn't jitter between
     *  re-renders. */
    const selectOptions = useMemo(() => {
        if (mode !== "select") return [];
        return blanks.map((blank, idx) => {
            const seed = `${exercise.id}#${idx}`;
            const pool = [
                blank.accept[0] ?? "",
                ...(exercise.distractors ?? []),
            ];
            return seededShuffle(pool, seed);
        });
    }, [exercise.id, exercise.distractors, blanks, mode]);

    const segments = _splitOnMarkers(sentence);
    const allFilled =
        inputs.length > 0 && inputs.every((s) => s.trim() !== "");

    const reviewedResult = clozeReviewedResult(
        reviewedCloze ? reviewedCloze.inputs : null,
        blanks,
    );

    const {submitted, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allFilled,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const perCorrect = blanks.map((blank, i) =>
                isFreeTextCorrect(inputs[i], blank.accept),
            );
            return {
                correct: perCorrect.filter(Boolean).length,
                total: blanks.length,
                attempts: deriveClozeAttempts(
                    exercise,
                    {setId, lessonId},
                    inputs,
                    perCorrect,
                ),
                raw_answer: {kind: "cloze", inputs: [...inputs]},
            };
        },
        resetAnswer: () => setInputs(blanks.map(() => "")),
    });

    // Per-blank correctness for the post-check display. Derived (not
    // stored): inputs are frozen once submitted, so this stays stable.
    const perBlankCorrect = submitted
        ? blanks.map((blank, i) => isFreeTextCorrect(inputs[i], blank.accept))
        : blanks.map(() => false);

    const handleChange = (idx: number, value: string) => {
        if (submitted) return;
        const next = [...inputs];
        next[idx] = value;
        setInputs(next);
    };

    // #623 — Tab advances directly to the next blank's control. The
    // blanks render in DOM order, but the section's leading affordances
    // (read-aloud, the hint button) sit before them; making Tab explicit
    // keeps focus moving blank -> blank and is regression-pinnable. The
    // last blank falls through to native flow (Tab reaches the footer);
    // shift-Tab and modified Tab are never intercepted.
    const handleBlankKeyDown = (idx: number, event: KeyboardEvent) => {
        if (event.key !== "Tab" || event.shiftKey) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (idx >= blanks.length - 1) return;
        const next = sectionRef.current?.querySelector<HTMLElement>(
            `[data-testid="cloze-input-${idx + 1}"], [data-testid="cloze-select-${idx + 1}"]`,
        );
        if (!next) return;
        event.preventDefault();
        next.focus();
    };

    // #692 — auto-focus the FIRST blank on mount (type mode only) so the
    // learner can type immediately without a click. The dispatcher keys
    // each step by id, so the renderer remounts per step and this fires on
    // every step change (regular lesson, review, error-replay). Skipped
    // for a reviewed (read-only) revisit and for select mode (a dropdown,
    // not a text field). Mobile keyboard opening is the desired behaviour.
    useEffect(() => {
        if (submitted || mode !== "type") return;
        // #1353 — preventScroll so the mount focus doesn't add a second
        // competing scroll on top of the step's own ``scrollIntoView``.
        sectionRef.current
            ?.querySelector<HTMLElement>('[data-testid="cloze-input-0"]')
            ?.focus({preventScroll: true});
        // Mount-only: the component remounts per step (keyed by step id).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (sentence === "" || blanks.length === 0) {
        return (
            <div data-testid="cloze-empty">
                {t(
                    "lesson.exercise.cloze.empty",
                    "This cloze exercise has no blanks.",
                )}
            </div>
        );
    }

    const correctCount = perBlankCorrect.filter(Boolean).length;
    const isAllCorrect = submitted && correctCount === blanks.length;

    // Shared blank input/select styling (was .cloze-blank-input /
    // .cloze-blank-select). 44px min touch target, accent focus ring.
    const blankBase =
        "min-h-11 min-w-20 rounded-sm border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-base text-[var(--fg)] [font-family:var(--font-sans)] focus:border-[var(--accent)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)] disabled:cursor-default disabled:opacity-[0.85]";
    // Per-blank correctness colour, applied directly on the control
    // (replaces the .cloze-blank-wrapper.is-correct descendant rule).
    const blankState = (idx: number): string | false =>
        submitted &&
        (perBlankCorrect[idx]
            ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))]"
            : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]");

    return (
        <section
            ref={sectionRef}
            className="flex flex-col gap-3"
            data-testid="cloze-exercise"
            data-cloze-mode={mode}
        >
            <ClozePromptRow
                prompt={exercise.prompt}
                ttsLang={ttsLang}
                codeMode={codeMode}
            />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="cloze-hint-button"
            />

            {mode === "select" ? (
                <ClozeSelectChoices
                    segments={segments}
                    blanks={blanks}
                    submitted={submitted}
                    inputs={inputs}
                    selectOptions={selectOptions}
                    perBlankCorrect={perBlankCorrect}
                    onChange={handleChange}
                />
            ) : (
                <ClozeSentence
                    segments={segments}
                    blanks={blanks}
                    mode={mode}
                    submitted={submitted}
                    perBlankCorrect={perBlankCorrect}
                    inputs={inputs}
                    selectOptions={selectOptions}
                    onChange={handleChange}
                    onKeyDown={handleBlankKeyDown}
                    blankBase={blankBase}
                    blankState={blankState}
                    codeMode={codeMode}
                />
            )}

            <ClozeHint
                hint={exercise.hint}
                submitted={submitted}
                showHint={showHint}
                onShowHint={() => setShowHint(true)}
            />

            <ClozeResult
                submitted={submitted}
                isAllCorrect={isAllCorrect}
                correctCount={correctCount}
                total={blanks.length}
                blanks={blanks}
                perBlankCorrect={perBlankCorrect}
                inputs={inputs}
                controlled={controlled}
                canCheck={allFilled}
                onCheck={submit}
                onRetry={reset}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
            />
        </section>
    );
}

const ClozeBlankExercise = forwardRef(ClozeExercise);

/** Dispatch on ``cloze_mode``: the #1195 ``multiselect`` ("select all
 *  that apply") question renders via the dedicated checkbox component;
 *  every other mode (``type`` / ``select``) uses the blank-based
 *  renderer. Both forward the same {@link ExerciseHandle} ref. */
function ClozeExerciseDispatch(
    props: ClozeExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    if (props.exercise.cloze_mode === "multiselect") {
        return (
            <ClozeMultiSelect
                ref={ref}
                exercise={props.exercise}
                setId={props.setId}
                lessonId={props.lessonId}
                onComplete={props.onComplete}
                controlled={props.controlled}
                onInteraction={props.onInteraction}
                reviewed={props.reviewed}
                ttsLang={props.ttsLang}
                onAdvance={props.onAdvance}
                advanceLabel={props.advanceLabel}
            />
        );
    }
    return <ClozeBlankExercise ref={ref} {...props} />;
}

export default forwardRef(ClozeExerciseDispatch);
