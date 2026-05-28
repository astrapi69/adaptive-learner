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
import {useMemo, useState} from "react";

import {useI18n} from "../../hooks/useI18n";
import {deriveClozeAttempts} from "../../lib/element-attempt";
import {tokenDiff} from "../../lib/exercises/token-diff";
import type {
    ContentLessonExercise,
    ElementAttempt,
} from "../../storage/types";
import DiffHighlight from "./DiffHighlight";
import {isFreeTextCorrect} from "./FreeTextExercise";

export interface ClozeExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** Called on submit with the score (sum of correct blanks
     *  of total blanks) + the per-blank SRS attempts. */
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => void;
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

export default function ClozeExercise({
    exercise,
    setId = "",
    lessonId = "",
    onComplete,
}: ClozeExerciseProps) {
    const {t} = useI18n();
    const sentence = exercise.sentence ?? "";
    const blanks = exercise.blanks ?? [];
    const mode: "type" | "select" = exercise.cloze_mode ?? "type";

    const [inputs, setInputs] = useState<string[]>(
        () => blanks.map(() => ""),
    );
    const [submitted, setSubmitted] = useState(false);
    const [perBlankCorrect, setPerBlankCorrect] = useState<boolean[]>(
        () => blanks.map(() => false),
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

    const segments = _splitOnMarkers(sentence);
    const allFilled = inputs.every((s) => s.trim() !== "");

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
        onComplete({
            correct: correctCount,
            total: blanks.length,
            attempts,
        });
    };

    const handleReset = () => {
        setInputs(blanks.map(() => ""));
        setPerBlankCorrect(blanks.map(() => false));
        setSubmitted(false);
    };

    const correctCount = perBlankCorrect.filter(Boolean).length;
    const isAllCorrect = submitted && correctCount === blanks.length;

    return (
        <section
            className="cloze-exercise"
            data-testid="cloze-exercise"
            data-cloze-mode={mode}
        >
            <p className="cloze-prompt" data-testid="cloze-prompt">
                {exercise.prompt}
            </p>

            <p
                className="cloze-sentence"
                data-testid="cloze-sentence"
                aria-label={t(
                    "lesson.exercise.cloze.sentence_label",
                    "Cloze sentence",
                )}
            >
                {segments.map((segment, segIdx) => (
                    <span
                        key={`seg-${segIdx}`}
                        className="cloze-segment"
                    >
                        {segment}
                        {segIdx < blanks.length && (
                            <span
                                className={`cloze-blank-wrapper${
                                    submitted
                                        ? perBlankCorrect[segIdx]
                                            ? " is-correct"
                                            : " is-wrong"
                                        : ""
                                }`}
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
                                        className="cloze-blank-input"
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
                                        className="cloze-blank-select"
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
                                        className="cloze-blank-hint"
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
                <div className="cloze-hint-row">
                    {!showHint ? (
                        <button
                            type="button"
                            className="cloze-hint-toggle"
                            onClick={() => setShowHint(true)}
                            data-testid="cloze-hint-show"
                        >
                            {t(
                                "lesson.exercise.cloze.hint_show",
                                "Need a hint?",
                            )}
                        </button>
                    ) : (
                        <p
                            className="cloze-hint"
                            data-testid="cloze-hint"
                        >
                            {exercise.hint}
                        </p>
                    )}
                </div>
            )}

            <div className="cloze-actions">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!allFilled}
                        onClick={handleSubmit}
                        data-testid="cloze-submit"
                    >
                        {t(
                            "lesson.exercise.cloze.submit",
                            "Check answers",
                        )}
                    </button>
                ) : (
                    <>
                        <p
                            className={`cloze-result${
                                isAllCorrect
                                    ? " is-correct"
                                    : " is-wrong"
                            }`}
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
                                className="cloze-diff-row"
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
                        <button
                            type="button"
                            className="btn"
                            onClick={handleReset}
                            data-testid="cloze-retry"
                        >
                            <RotateCcw size={14} aria-hidden="true" />
                            {t(
                                "lesson.exercise.cloze.retry",
                                "Try again",
                            )}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}
