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

import {Check, RotateCcw, X} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useEffect, useImperativeHandle, useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import ReadAloudButton from "../lesson/ReadAloudButton";
import {deriveClozeAttempts} from "../../lib/element-attempt";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {ContentLessonExercise} from "../../storage/types";
import AnswerCelebration from "./AnswerCelebration";
import DiffHighlight from "./DiffHighlight";
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
    const blanks = exercise.blanks ?? [];
    const mode: "type" | "select" = exercise.cloze_mode ?? "type";
    const reviewedCloze = reviewed?.kind === "cloze" ? reviewed : null;

    const [inputs, setInputs] = useState<string[]>(() =>
        reviewedCloze
            ? blanks.map((_, i) => reviewedCloze.inputs[i] ?? "")
            : blanks.map(() => ""),
    );
    const [submitted, setSubmitted] = useState(reviewedCloze != null);
    const [perBlankCorrect, setPerBlankCorrect] = useState<boolean[]>(() =>
        reviewedCloze
            ? blanks.map((blank, i) =>
                  isFreeTextCorrect(
                      reviewedCloze.inputs[i] ?? "",
                      blank.accept,
                  ),
              )
            : blanks.map(() => false),
    );
    const [showHint, setShowHint] = useState(false);

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

    const handleChange = (idx: number, value: string) => {
        if (submitted) return;
        const next = [...inputs];
        next[idx] = value;
        setInputs(next);
    };

    const handleSubmit = () => {
        if (submitted || !allFilled) return;
        const perCorrect = blanks.map((blank, i) =>
            isFreeTextCorrect(inputs[i], blank.accept),
        );
        const correctCount = perCorrect.filter(Boolean).length;
        const attempts = deriveClozeAttempts(
            exercise,
            {setId, lessonId},
            inputs,
            perCorrect,
        );
        setPerBlankCorrect(perCorrect);
        setSubmitted(true);
        const scored: ExerciseScored = {
            correct: correctCount,
            total: blanks.length,
            attempts,
            raw_answer: {kind: "cloze", inputs: [...inputs]},
        };
        onComplete(scored);
    };

    const handleReset = () => {
        setInputs(blanks.map(() => ""));
        setPerBlankCorrect(blanks.map(() => false));
        setSubmitted(false);
    };

    useImperativeHandle(ref, () => ({submit: handleSubmit}));

    useEffect(() => {
        if (!controlled || reviewedCloze || submitted) return;
        onInteraction?.(allFilled);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlled, allFilled, submitted, reviewedCloze]);

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
            className="flex flex-col gap-3"
            data-testid="cloze-exercise"
            data-cloze-mode={mode}
        >
            <div className="exercise-prompt-row">
                <p className="m-0 font-medium" data-testid="cloze-prompt">
                    {exercise.prompt}
                </p>
                {ttsLang && !codeMode && (
                    <ReadAloudButton
                        text={exercise.prompt ?? ""}
                        lang={ttsLang}
                        testId="cloze-prompt"
                    />
                )}
            </div>

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
                        {segment}
                        {segIdx < blanks.length && (
                            <span
                                className={cn(
                                    "mx-1 inline-flex flex-col items-stretch gap-0.5 align-baseline",
                                    submitted &&
                                        (perBlankCorrect[segIdx]
                                            ? "is-correct"
                                            : "is-wrong"),
                                )}
                                data-testid={`cloze-blank-${segIdx}`}
                                data-result={
                                    submitted
                                        ? perBlankCorrect[segIdx]
                                            ? "correct"
                                            : "wrong"
                                        : "pending"
                                }
                            >
                                {mode === "type" ? (
                                    <input
                                        type="text"
                                        className={cn(
                                            blankBase,
                                            blankState(segIdx),
                                        )}
                                        value={inputs[segIdx]}
                                        onChange={(e) =>
                                            handleChange(
                                                segIdx,
                                                e.target.value,
                                            )
                                        }
                                        disabled={submitted}
                                        placeholder={
                                            blanks[segIdx].placeholder ??
                                            "?"
                                        }
                                        aria-label={
                                            blanks[segIdx].hint ??
                                            t(
                                                "lesson.exercise.cloze.blank_label",
                                                "Blank {n}",
                                            ).replace(
                                                "{n}",
                                                String(segIdx + 1),
                                            )
                                        }
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-testid={`cloze-input-${segIdx}`}
                                    />
                                ) : (
                                    <select
                                        className={cn(
                                            blankBase,
                                            blankState(segIdx),
                                        )}
                                        value={inputs[segIdx]}
                                        onChange={(e) =>
                                            handleChange(
                                                segIdx,
                                                e.target.value,
                                            )
                                        }
                                        disabled={submitted}
                                        aria-label={
                                            blanks[segIdx].hint ??
                                            t(
                                                "lesson.exercise.cloze.blank_label",
                                                "Blank {n}",
                                            ).replace(
                                                "{n}",
                                                String(segIdx + 1),
                                            )
                                        }
                                        data-testid={`cloze-select-${segIdx}`}
                                    >
                                        <option value="">
                                            {t(
                                                "lesson.exercise.cloze.select_placeholder",
                                                "Choose…",
                                            )}
                                        </option>
                                        {selectOptions[segIdx]?.map(
                                            (opt) => (
                                                <option
                                                    key={opt}
                                                    value={opt}
                                                >
                                                    {opt}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                )}
                                {blanks[segIdx].hint && !submitted && (
                                    <span
                                        className="text-xs italic text-[var(--fg-muted)]"
                                        data-testid={`cloze-blank-hint-${segIdx}`}
                                    >
                                        {blanks[segIdx].hint}
                                    </span>
                                )}
                            </span>
                        )}
                    </span>
                ))}
            </p>

            {exercise.hint && !submitted && (
                <div className="flex items-center gap-2">
                    {!showHint ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-[var(--accent-text)] hover:underline"
                            onClick={() => setShowHint(true)}
                            data-testid="cloze-hint-show"
                        >
                            {t(
                                "lesson.exercise.cloze.hint_show",
                                "Need a hint?",
                            )}
                        </Button>
                    ) : (
                        <p
                            className="m-0 rounded-sm bg-[var(--surface-2)] p-2 text-sm text-[var(--fg-muted)]"
                            data-testid="cloze-hint"
                        >
                            {exercise.hint}
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {!submitted && !controlled && (
                    <Button
                        type="button"
                        disabled={!allFilled}
                        onClick={handleSubmit}
                        data-testid="cloze-submit"
                    >
                        {t(
                            "lesson.exercise.cloze.submit",
                            "Check answers",
                        )}
                    </Button>
                )}
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
                            data-result={
                                isAllCorrect ? "correct" : "wrong"
                            }
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
                                        .replace(
                                            "{correct}",
                                            String(correctCount),
                                        )
                                        .replace(
                                            "{total}",
                                            String(blanks.length),
                                        )}
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
                        {!controlled && (
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={handleReset}
                                data-testid="cloze-retry"
                            >
                                <RotateCcw size={14} aria-hidden="true" />
                                {t(
                                    "lesson.exercise.cloze.retry",
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

export default forwardRef(ClozeExercise);
