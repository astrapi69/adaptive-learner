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

import {useI18n} from "../../hooks/useI18n";
import ExerciseHint from "./ExerciseHint";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../lesson/ReadAloudButton";
import InlineMarkdown from "../../shared/data-display/InlineMarkdown";
import {deriveClozeAttempts} from "../../lib/element-attempt";
import {useControlledExercise} from "../../lib/exercises/useControlledExercise";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DiffHighlight from "./DiffHighlight";
import ExerciseFooter from "./ExerciseFooter";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";
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

/** Deterministic seeded shuffle so the select-mode options
 *  stay stable across re-renders. Same seed → same order. */
function _shuffle<T>(items: readonly T[], seed: string): T[] {
    const out = [...items];
    let acc = 0;
    for (const ch of seed) acc = (acc * 31 + ch.charCodeAt(0)) | 0;
    for (let i = out.length - 1; i > 0; i--) {
        acc = (acc * 1103515245 + 12345) & 0x7fffffff;
        const j = acc % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
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

/** Post-check feedback (all-correct vs N-of-M), the per-blank token
 *  diff on a miss, the celebration, and the shared exercise footer. */
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
}) {
    const {t} = useI18n();
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
                    {!isAllCorrect && (
                        <div
                            className="flex basis-full flex-col gap-1"
                            data-testid="cloze-diff-row"
                        >
                            {blanks.map((blank, idx) =>
                                perBlankCorrect[idx] ? null : (
                                    <DiffHighlight
                                        key={idx}
                                        tokens={tokenDiff(
                                            inputs[idx],
                                            blank.accept[0] ?? "",
                                        )}
                                        className="cloze-blank-diff"
                                    />
                                ),
                            )}
                        </div>
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
    }: ClozeExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const sentence = exercise.sentence ?? "";
    const blanks = useMemo(() => exercise.blanks ?? [], [exercise.blanks]);
    const mode: "type" | "select" = exercise.cloze_mode ?? "type";
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
            return _shuffle(pool, seed);
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
        sectionRef.current
            ?.querySelector<HTMLElement>('[data-testid="cloze-input-0"]')
            ?.focus();
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
            />
        </section>
    );
}

export default forwardRef(ClozeExercise);
