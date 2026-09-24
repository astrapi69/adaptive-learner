/**
 * OrderingExercise (#3110) — renderer for the adopted extension type
 * ``ext:al-ordering``: place a set of steps into their correct order.
 *
 * Reuses the shared building blocks rather than reinventing them:
 *   - {@link useWordTilesDnd} (#1776, word-tiles concern group) — the
 *     tap-to-place + drag-to-reorder mechanics, already fully generic on
 *     ``tiles: string[]`` / ``placed: number[]``.
 *   - {@link TileSequenceEditor} (#3110) — the shared presentational shell
 *     for an exact-sequence tile editor (no authored alternatives), also
 *     used by the sibling ``ext:al-parsons`` renderer.
 *   - {@link isOrderingCorrect} — the exact index-sequence match (the
 *     payload's ``items`` order IS canonical; no ``accept_orderings``
 *     equivalent exists for this type).
 *
 * Result contract: ``onComplete({correct, total, attempts, raw_answer})``
 * with ``total`` always 1 and ``raw_answer.kind === "al_ordering"``.
 */

import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../../hooks/lesson/modes/useLessonMode";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {
    asOrderingPayload,
    ORDERING_EXT_TYPE,
} from "../../../../lib/exercises/payload/ordering";
import {isOrderingCorrect} from "../../../../lib/exercises/grading/ordering-correctness";
import {deriveOrderingAttempt} from "../../../../lib/srs/element-attempt";
import {useWordTilesDnd} from "../word-tiles/useWordTilesDnd";
import {TileSequenceEditor} from "../../shared/TileSequenceEditor";
import ExercisePromptRow from "../../shell/ExercisePromptRow";
import ExerciseHint from "../../feedback/ExerciseHint";
import ExerciseFooter from "../../shell/ExerciseFooter";
import AnswerCelebration from "../../feedback/AnswerCelebration";
import ExerciseSuccessAdvance from "../../feedback/ExerciseSuccessAdvance";
import {OrderingReview} from "./ordering-review";
import type {ContentLessonExercise} from "../../../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../../shell/exercise-control";

export {ORDERING_EXT_TYPE};

export interface OrderingExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    onComplete: (result: ExerciseScored) => void;
}

const I18N_PREFIX = "lesson.exercise.al_ordering";
const TESTID_PREFIX = "ordering";

function OrderingExercise(
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
    }: OrderingExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle, immediateFeedback} = useLessonMode();
    const payload = useMemo(() => asOrderingPayload(exercise), [exercise]);
    const items = payload?.items ?? [];

    const reviewedOrdering = reviewed?.kind === "al_ordering" ? reviewed : null;
    const [placed, setPlaced] = useState<number[]>(
        reviewedOrdering ? [...reviewedOrdering.placed] : [],
    );

    const allPlaced = placed.length === items.length && items.length > 0;

    const reviewedResult = reviewedOrdering
        ? {
              correct: isOrderingCorrect(reviewedOrdering.placed, items.length) ? 1 : 0,
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
            const isCorrect = isOrderingCorrect(placed, items.length);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveOrderingAttempt(exercise, {setId, lessonId}, items, placed, isCorrect),
                ],
                raw_answer: {kind: "al_ordering", placed: [...placed]},
            };
        },
        resetAnswer: () => setPlaced([]),
    });

    const dnd = useWordTilesDnd({
        exerciseId: exercise.id,
        tiles: items,
        placed,
        setPlaced,
        submitted,
    });

    if (!payload) {
        return (
            <div data-testid="ordering-empty">
                {t(
                    `${I18N_PREFIX}.empty`,
                    "This ordering exercise has no items.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;

    return (
        <section className="flex flex-col gap-3" data-testid="ordering-exercise">
            <ExercisePromptRow prompt={exercise.prompt ?? ""} testId="ordering-prompt" />

            <ExerciseHint exercise={exercise} submitted={submitted} testId="ordering-hint-button" />

            <TileSequenceEditor
                submitted={submitted}
                sensors={dnd.sensors}
                placed={placed}
                tiles={items}
                scrambledIndices={dnd.scrambledIndices}
                placedListRef={dnd.placedListRef}
                reduceMotion={dnd.reduceMotion}
                activeId={dnd.activeId}
                isCorrect={isCorrect}
                t={t}
                i18nPrefix={I18N_PREFIX}
                testIdPrefix={TESTID_PREFIX}
                onDragStart={dnd.handleDragStart}
                onDragEnd={dnd.handleDragEnd}
                onDragCancel={dnd.handleDragCancel}
                onPlace={dnd.handlePlace}
                onRemove={dnd.handleReturn}
                onMove={dnd.reorder}
                onKeyReorder={dnd.handleTileKeyDown}
            />

            {/* #3260: the editor unmounts on check; show WHAT was wrong. */}
            {submitted && immediateFeedback && (
                <OrderingReview items={items} placed={placed} isCorrect={isCorrect} t={t} />
            )}

            <OrderingResult
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

/** Post-check verdict + the shared celebration + check/retry footer. Split
 *  out to keep the renderer's complexity flat (mirrors DictationResult). */
function OrderingResult({
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
                    data-testid="ordering-result"
                    data-result={isCorrect ? "correct" : "wrong"}
                >
                    {isCorrect
                        ? t(`${I18N_PREFIX}.result_correct`, "Correct!")
                        : t(`${I18N_PREFIX}.result_wrong`, "Not quite - the order is not right yet.")}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {submitted && <AnswerCelebration isCorrect={isCorrect} />}
                {submitted && isCorrect && showAnswerToggle && onAdvance && (
                    <ExerciseSuccessAdvance
                        onAdvance={onAdvance}
                        label={advanceLabel}
                        testIdPrefix="ordering"
                    />
                )}
                <ExerciseFooter
                    testidPrefix="ordering"
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

export default forwardRef(OrderingExercise);
