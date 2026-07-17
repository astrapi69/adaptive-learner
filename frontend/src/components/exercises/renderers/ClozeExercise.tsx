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
 * Split (#1782): this file keeps the answer state, the scoring
 * wiring (``useControlledExercise``), the Tab/focus handling, the
 * multiselect dispatch, and the composition. The editing/display
 * surfaces and the post-check feedback surfaces live in the
 * ``cloze/`` concern group next door (barrel export).
 *
 * Mobile-first: every input/select gets 44px min touch target.
 * Inputs render inline with the surrounding text via CSS so the
 * sentence reads naturally on a single line at desktop widths
 * and wraps gracefully at narrow viewports.
 */

import type {KeyboardEvent, Ref} from "react";
import {forwardRef, useEffect, useMemo, useRef, useState} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import ExerciseHint from "../feedback/ExerciseHint";
import {deriveClozeAttempts} from "../../../lib/srs/element-attempt";
import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";
import {seededShuffle} from "../../../lib/exercises/seeded-shuffle";
import type {ContentLessonExercise} from "../../../storage/types";
import ClozeMultiSelect from "./ClozeMultiSelect";
import {
    type ClozeBlank,
    ClozeHint,
    ClozePromptRow,
    ClozeResult,
    ClozeSelectChoices,
    ClozeSentence,
} from "./cloze";
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

/** Score a reviewed (read-only) cloze attempt: how many of the frozen
 *  inputs match their blank's accept list. ``codeMode`` selects the
 *  code normalizer (case-sensitive, whitespace-stripping, quote-unifying)
 *  so a reviewed code cloze re-scores exactly like a fresh submission
 *  (#1595). Returns null when there is no reviewed answer to score. */
function clozeReviewedResult(
    reviewedInputs: readonly string[] | null,
    blanks: readonly ClozeBlank[],
    codeMode: boolean,
): {correct: number; total: number} | null {
    if (!reviewedInputs) return null;
    return {
        correct: blanks.filter((blank, i) =>
            isFreeTextCorrect(reviewedInputs[i] ?? "", blank.accept, codeMode),
        ).length,
        total: blanks.length,
    };
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
        codeMode,
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
                isFreeTextCorrect(inputs[i], blank.accept, codeMode),
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
        ? blanks.map((blank, i) =>
              isFreeTextCorrect(inputs[i], blank.accept, codeMode),
          )
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
