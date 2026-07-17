/**
 * WordTilesExercise (Phase 45 / EXP-002 / 3F — F-109).
 *
 * Tap-to-place ordering exercise. The schema's
 * ``exercise.tiles`` is the canonical ordered list. The
 * renderer shuffles the tiles for display; the user taps
 * tiles from the scrambled bar (top) to fill the answer row
 * (bottom). Tapping a placed tile returns it to the
 * scrambled bar.
 *
 * Validation (D4): when ``exercise.accept_orderings`` is
 * present, ANY permutation in that list is accepted (each
 * is a list of indices into ``tiles``). When absent, ONLY
 * the canonical ``tiles`` order is correct. The schema
 * validator (content-loader / schema.py) already enforces
 * that each entry is a full permutation of [0..len-1]; the
 * renderer just compares index sequences.
 *
 * Result contract matches the sibling exercises:
 * ``onComplete({correct: 0|1, total: 1})``. Parent (Lesson
 * viewer) persists via ``recordStepResult``.
 *
 * Split (#1776): this file keeps the answer state, the scoring
 * wiring (``useControlledExercise``), and the composition. The
 * DnD mechanics, the editing surface, the hint / result / reveal
 * surfaces, and the shared tile styling live in the
 * ``word-tiles/`` concern group next door (barrel export).
 *
 * Mobile-first: scrambled bar wraps, each tile is 44px
 * min-height.
 */

import type {Ref} from "react";
import {forwardRef, useState} from "react";

import {useControlledExercise} from "../../../lib/exercises/useControlledExercise";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../hooks/lesson/modes/useLessonMode";
import ExerciseHint from "../feedback/ExerciseHint";
import ExercisePromptRow from "../shell/ExercisePromptRow";
import {
    WordTilesEditor,
    WordTilesHint,
    WordTilesResult,
    WordTilesReveal,
    useWordTilesDnd,
} from "./word-tiles";
import {deriveWordTilesAttempt} from "../../../lib/srs/element-attempt";
import {isWordTilesCorrect} from "../../../lib/exercises/word-tiles-equivalence";
import type {ContentLessonExercise} from "../../../storage/types";

export {isWordTilesCorrect} from "../../../lib/exercises/word-tiles-equivalence";
export {applyDragReorder} from "./word-tiles";
import DirectionInstruction from "../feedback/DirectionInstruction";
import {type AnswerView} from "../feedback/ExerciseAnswerToggle";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../shell/exercise-control";

export interface WordTilesExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    /** Phase 46B context for the element-attempt deriver.
     *  Optional in unit tests; required in production. */
    setId?: string;
    lessonId?: string;
    /** #1226 — the lesson's language pair + domain, forwarded to
     *  DirectionInstruction so a knowledge / same-language lesson shows a
     *  sentence-building instruction instead of "Build the translation".
     *  Optional; absent = language behaviour. */
    targetLanguage?: string | null;
    sourceLanguage?: string | null;
    domain?: string | null;
    /** Called on submit with the score (0 or 1 correct of 1
     *  total) plus the single-attempt SRS payload. */
    onComplete: (result: ExerciseScored) => void;
}

/** Per-position correctness of the learner's placed order, for the
 *  "My answer" view (#1005). A position is correct when its tile TEXT
 *  matches the canonical slot's text - duplicate tiles are interchangeable
 *  (#1544), so the marking follows the composed token sequence, not the
 *  physical tile index. When the whole answer is accepted (canonical OR an
 *  authored ``accept_orderings`` permutation), every position is marked
 *  correct so an accepted alternative shows all green. Pure + exported for
 *  unit tests. */
export function wordTilesPerTileCorrect(
    placed: readonly number[],
    tiles: readonly string[],
    isCorrect: boolean,
): boolean[] {
    if (isCorrect) return placed.map(() => true);
    return placed.map((tileIndex, slot) => tiles[tileIndex] === tiles[slot]);
}

/** Reviewed-revisit score for a persisted word-tiles answer, or null
 *  when there is no reviewed answer. */
function wordTilesReviewedResult(
    reviewedPlaced: readonly number[] | null | undefined,
    tiles: readonly string[],
    acceptOrderings: readonly (readonly number[])[] | null | undefined,
): {correct: number; total: number} | null {
    if (reviewedPlaced == null) return null;
    return {
        correct: isWordTilesCorrect(reviewedPlaced, tiles, acceptOrderings)
            ? 1
            : 0,
        total: 1,
    };
}

function WordTilesExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        ttsLang = null,
        codeMode = false,
        onAdvance,
        advanceLabel,
        targetLanguage = null,
        sourceLanguage = null,
        domain = null,
    }: WordTilesExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const tiles = exercise.tiles ?? [];
    const acceptOrderings = exercise.accept_orderings;
    const reviewedWordTiles =
        reviewed?.kind === "word_tiles" ? reviewed : null;

    /** Indices of tiles the user has placed, in the order
     *  they tapped them. */
    const [placed, setPlaced] = useState<number[]>(
        reviewedWordTiles ? [...reviewedWordTiles.placed] : [],
    );
    const [showHint, setShowHint] = useState(false);
    /** #1005 — after checking, toggle between the learner's graded order
     *  ("my-answer") and the correct order ("solution"). Default is the
     *  learner's own answer. */
    const [view, setView] = useState<AnswerView>("my-answer");

    const allPlaced = placed.length === tiles.length;

    const reviewedResult = wordTilesReviewedResult(
        reviewedWordTiles?.placed,
        tiles,
        acceptOrderings,
    );

    const {submitted, result, submit, reset} = useControlledExercise({
        ref,
        controlled,
        isAnswerable: allPlaced,
        onInteraction,
        onComplete,
        reviewedResult,
        score: (): ExerciseScored => {
            const isCorrect = isWordTilesCorrect(
                placed,
                tiles,
                acceptOrderings,
            );
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveWordTilesAttempt(
                        exercise,
                        {setId, lessonId},
                        placed,
                        isCorrect,
                    ),
                ],
                raw_answer: {kind: "word_tiles", placed: [...placed]},
            };
        },
        resetAnswer: () => {
            setPlaced([]);
            setView("my-answer");
        },
    });

    const dnd = useWordTilesDnd({
        exerciseId: exercise.id,
        tiles,
        placed,
        setPlaced,
        submitted,
    });

    if (tiles.length === 0) {
        return (
            <div data-testid="word-tiles-empty">
                {t(
                    "lesson.exercise.word_tiles.empty",
                    "This word-tiles exercise has no tiles.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;

    /** #1005 — the My-answer / Solution toggle views. My-answer shows the
     *  learner's tiles in their chosen order with per-position green/red;
     *  Solution shows the canonical ``tiles`` order, all green and readable
     *  (the schema guarantees the canonical order is always accepted). */
    const myAnswerLabels = placed.map((idx) => tiles[idx]);
    const myAnswerCorrectness = wordTilesPerTileCorrect(
        placed,
        tiles,
        isCorrect,
    );

    return (
        <section
            className="flex flex-col gap-3"
            data-testid="word-tiles-exercise"
        >
            <ExercisePromptRow
                prompt={exercise.prompt ?? ""}
                ttsLang={ttsLang}
                codeMode={codeMode}
                testId="word-tiles-prompt"
            />

            <ExerciseHint
                exercise={exercise}
                submitted={submitted}
                testId="word-tiles-hint-button"
            />

            <DirectionInstruction
                exercise={exercise}
                domain={domain}
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
            />

            <WordTilesEditor
                submitted={submitted}
                sensors={dnd.sensors}
                placed={placed}
                tiles={tiles}
                scrambledIndices={dnd.scrambledIndices}
                placedListRef={dnd.placedListRef}
                reduceMotion={dnd.reduceMotion}
                activeId={dnd.activeId}
                isCorrect={isCorrect}
                t={t}
                onDragStart={dnd.handleDragStart}
                onDragEnd={dnd.handleDragEnd}
                onDragCancel={dnd.handleDragCancel}
                onPlace={dnd.handlePlace}
                onRemove={dnd.handleReturn}
                onMove={dnd.reorder}
                onKeyReorder={dnd.handleTileKeyDown}
            />

            <WordTilesHint
                hint={exercise.hint}
                submitted={submitted}
                showHint={showHint}
                onShowHint={() => setShowHint(true)}
            />

            <WordTilesReveal
                submitted={submitted}
                showAnswerToggle={showAnswerToggle}
                isCorrect={isCorrect}
                onAdvance={onAdvance}
                advanceLabel={advanceLabel}
                view={view}
                onShowMyAnswer={() => setView("my-answer")}
                onShowSolution={() => setView("solution")}
                myAnswerLabels={myAnswerLabels}
                myAnswerCorrectness={myAnswerCorrectness}
                tiles={tiles}
                t={t}
            />

            <WordTilesResult
                submitted={submitted}
                isCorrect={isCorrect}
                controlled={controlled}
                canCheck={allPlaced}
                onCheck={submit}
                onRetry={reset}
                t={t}
            />
        </section>
    );
}

export default forwardRef(WordTilesExercise);
