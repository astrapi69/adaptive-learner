/**
 * ParsonsExercise (#3110) — renderer for the adopted extension type
 * ``ext:al-parsons``: arrange shuffled code lines into the correct order
 * AND at the correct indentation depth (a Parsons problem).
 *
 * Reuses the same shared building blocks as the sibling
 * ``ext:al-ordering`` renderer:
 *   - {@link useWordTilesDnd} — tap-to-place + drag-to-reorder mechanics.
 *   - {@link TileSequenceEditor} — the shared exact-sequence tile shell,
 *     here fed a ``renderTileExtra`` slot for the per-tile indent stepper
 *     and ``monospace`` for code styling.
 *   - {@link isParsonsCorrect} — order AND indent must both match.
 *
 * Indent state is tracked BY TILE IDENTITY (``indentByTile``), not by
 * slot: a learner's chosen depth for a line should travel WITH that tile
 * when they drag-reorder it, not stay pinned to the slot it briefly
 * occupied. The slot-aligned projection (matching {@link isParsonsCorrect}
 * and the persisted ``RawAnswer``'s contract) is computed only at
 * grading / attempt-deriving time.
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})``
 * with ``total`` always 1 and ``raw_answer.kind === "al_parsons"``.
 */

import {Minus, Plus} from "lucide-react";
import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../../hooks/lesson/modes/useLessonMode";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {
    asParsonsPayload,
    PARSONS_EXT_TYPE,
} from "../../../../lib/exercises/payload/parsons";
import {
    diagnoseParsonsLines,
    isParsonsCorrect,
} from "../../../../lib/exercises/grading/parsons-correctness";
import {deriveParsonsAttempt} from "../../../../lib/srs/element-attempt";
import {useWordTilesDnd} from "../word-tiles/useWordTilesDnd";
import {TileSequenceEditor} from "../../shared/TileSequenceEditor";
import ExercisePromptRow from "../../shell/ExercisePromptRow";
import {ParsonsReview} from "./parsons-review";
import ExerciseHint from "../../feedback/ExerciseHint";
import ExerciseFooter from "../../shell/ExerciseFooter";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import type {ContentLessonExercise} from "../../../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../../shell/exercise-control";

export {PARSONS_EXT_TYPE};

export interface ParsonsExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    onComplete: (result: ExerciseScored) => void;
}

const I18N_PREFIX = "lesson.exercise.al_parsons";

/** Project the tile-keyed indent map onto the placed SLOT order — the
 *  contract ``isParsonsCorrect`` / ``deriveParsonsAttempt`` /
 *  ``RawAnswer["al_parsons"]`` all share. */
function indentsBySlot(
    placed: readonly number[],
    indentByTile: Readonly<Record<number, number>>,
): number[] {
    return placed.map((tileIndex) => indentByTile[tileIndex] ?? 0);
}

function ParsonsExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: ParsonsExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle, immediateFeedback} = useLessonMode();
    const payload = useMemo(() => asParsonsPayload(exercise), [exercise]);
    const lines = useMemo(() => payload?.lines ?? [], [payload]);
    const codeLines = useMemo(() => lines.map((line) => line.code), [lines]);

    const reviewedParsons = reviewed?.kind === "al_parsons" ? reviewed : null;
    const [placed, setPlaced] = useState<number[]>(
        reviewedParsons ? [...reviewedParsons.placed] : [],
    );
    const [indentByTile, setIndentByTile] = useState<Record<number, number>>(
        () =>
            reviewedParsons
                ? Object.fromEntries(
                      reviewedParsons.placed.map((tileIndex, slot) => [
                          tileIndex,
                          reviewedParsons.indents[slot] ?? 0,
                      ]),
                  )
                : {},
    );

    const allPlaced = placed.length === lines.length && lines.length > 0;

    const reviewedResult = reviewedParsons
        ? {
              correct: isParsonsCorrect(
                  reviewedParsons.placed,
                  reviewedParsons.indents,
                  lines,
              )
                  ? 1
                  : 0,
              total: 1,
          }
        : null;

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPlaced,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const slotIndents = indentsBySlot(placed, indentByTile);
            const isCorrect = isParsonsCorrect(placed, slotIndents, lines);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveParsonsAttempt(
                        exercise,
                        {setId, lessonId},
                        lines,
                        placed,
                        slotIndents,
                        isCorrect,
                    ),
                ],
                raw_answer: {kind: "al_parsons", placed: [...placed], indents: slotIndents},
            };
        },
        resetAnswer: () => {
            setPlaced([]);
            setIndentByTile({});
        },
    });

    const dnd = useWordTilesDnd({
        exerciseId: exercise.id,
        tiles: codeLines,
        placed,
        setPlaced,
        submitted,
    });

    if (!payload) {
        return (
            <div data-testid="parsons-empty">
                {t(`${I18N_PREFIX}.empty`, "This code-ordering exercise has no lines.")}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;

    function bumpIndent(tileIndex: number, delta: number) {
        if (submitted) return;
        setIndentByTile((prev) => ({
            ...prev,
            [tileIndex]: Math.max(0, (prev[tileIndex] ?? 0) + delta),
        }));
    }

    return (
        <section className="flex flex-col gap-3" data-testid="parsons-exercise">
            <ExercisePromptRow prompt={exercise.prompt ?? ""} testId="parsons-prompt" />

            <ExerciseHint exercise={exercise} submitted={submitted} testId="parsons-hint-button" />

            <TileSequenceEditor
                submitted={submitted}
                sensors={dnd.sensors}
                placed={placed}
                tiles={codeLines}
                scrambledIndices={dnd.scrambledIndices}
                placedListRef={dnd.placedListRef}
                reduceMotion={dnd.reduceMotion}
                activeId={dnd.activeId}
                isCorrect={isCorrect}
                t={t}
                i18nPrefix={I18N_PREFIX}
                testIdPrefix="parsons"
                monospace
                onDragStart={dnd.handleDragStart}
                onDragEnd={dnd.handleDragEnd}
                onDragCancel={dnd.handleDragCancel}
                onPlace={dnd.handlePlace}
                onRemove={dnd.handleReturn}
                onMove={dnd.reorder}
                onKeyReorder={dnd.handleTileKeyDown}
                renderTileExtra={(slot, tileIndex) => (
                    <IndentStepper
                        slot={slot}
                        submitted={submitted}
                        value={indentByTile[tileIndex] ?? 0}
                        t={t}
                        onInc={() => bumpIndent(tileIndex, 1)}
                        onDec={() => bumpIndent(tileIndex, -1)}
                    />
                )}
            />

            {/* #3218: the editor unmounts on check; show WHAT was wrong. */}
            {submitted && immediateFeedback && (
                <ParsonsReview
                    diagnosis={diagnoseParsonsLines(
                        placed,
                        indentsBySlot(placed, indentByTile),
                        lines,
                    )}
                    solution={lines}
                    isCorrect={isCorrect}
                    t={t}
                />
            )}

            <ParsonsResult
                submitted={submitted}
                isCorrect={isCorrect}
                showAnswerToggle={showAnswerToggle}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                controlled={controlled}
                canCheck={allPlaced}
                onCheck={submit}
                onRetry={reset}
            />
        </section>
    );
}

/** Per-placed-tile indent control: "-" / current depth / "+". Rendered
 *  via ``TileSequenceEditor``'s ``renderTileExtra`` slot. */
function IndentStepper({
    slot,
    submitted,
    value,
    t,
    onInc,
    onDec,
}: {
    slot: number;
    submitted: boolean;
    value: number;
    t: (key: string, fallback?: string) => string;
    onInc: () => void;
    onDec: () => void;
}) {
    return (
        <span
            className="inline-flex items-center gap-0.5 rounded-sm border border-border bg-[var(--surface-2)] px-1"
            data-testid={`parsons-indent-group-${slot}`}
        >
            <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--fg-muted)] enabled:hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-30"
                onClick={onDec}
                disabled={submitted || value === 0}
                tabIndex={-1}
                aria-label={t(`${I18N_PREFIX}.indent_dec`, "Decrease indent")}
                data-testid={`parsons-indent-dec-${slot}`}
            >
                <Minus size={12} aria-hidden="true" />
            </button>
            <span
                className="min-w-4 text-center text-xs tabular-nums"
                data-testid={`parsons-indent-${slot}`}
            >
                {value}
            </span>
            <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--fg-muted)] enabled:hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-30"
                onClick={onInc}
                disabled={submitted}
                tabIndex={-1}
                aria-label={t(`${I18N_PREFIX}.indent_inc`, "Increase indent")}
                data-testid={`parsons-indent-inc-${slot}`}
            >
                <Plus size={12} aria-hidden="true" />
            </button>
        </span>
    );
}

/** Post-check verdict + the shared celebration + check/retry footer. Split
 *  out to keep the renderer's complexity flat (mirrors OrderingResult). */
function ParsonsResult({
    submitted,
    isCorrect,
    showAnswerToggle,
    onAdvance,
    advanceLabel,
    controlled,
    canCheck,
    onCheck,
    onRetry,
}: {
    submitted: boolean;
    isCorrect: boolean;
    showAnswerToggle: boolean;
    onAdvance?: () => void;
    advanceLabel?: string;
    controlled: boolean;
    canCheck: boolean;
    onCheck: () => void;
    onRetry: () => void;
}) {
    const {t} = useI18n();
    return (
        <>
            {submitted && (
                <p
                    className={`answer-feedback m-0 font-medium ${
                        isCorrect ? "is-correct text-[var(--success)]" : "is-wrong text-[var(--danger)]"
                    }`}
                    data-testid="parsons-result"
                    data-result={isCorrect ? "correct" : "wrong"}
                >
                    {isCorrect
                        ? t(`${I18N_PREFIX}.result_correct`, "Correct!")
                        : t(
                              `${I18N_PREFIX}.result_wrong`,
                              "Not quite — check the order and the indentation.",
                          )}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {submitted && <AnswerCelebration isCorrect={isCorrect} />}
                {submitted && isCorrect && showAnswerToggle && onAdvance && (
                    <ExerciseSuccessAdvance
                        onAdvance={onAdvance}
                        label={advanceLabel}
                        testIdPrefix="parsons"
                    />
                )}
                <ExerciseFooter
                    testidPrefix="parsons"
                    controlled={controlled}
                    submitted={submitted}
                    canCheck={canCheck}
                    onCheck={onCheck}
                    onRetry={onRetry}
                    checkLabel={t(`${I18N_PREFIX}.submit`, "Check answer")}
                    retryLabel={t(`${I18N_PREFIX}.retry`, "Try again")}
                />
            </div>
        </>
    );
}

export default forwardRef(ParsonsExercise);
