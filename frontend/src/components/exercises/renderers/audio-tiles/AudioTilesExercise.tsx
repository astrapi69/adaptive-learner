/**
 * AudioTilesExercise (engine#68 idea 2) — renderer for the adopted
 * extension type ``ext:al-audio-tiles``: a spoken source-language sentence,
 * built up as a target-language translation from word tiles.
 *
 * Reuses the app's existing word-tiles editor/DnD machinery
 * ({@link WordTilesEditor}, ``useWordTilesDnd``, ``isWordTilesCorrect``) as-is
 * — the puzzle mechanic is identical to core ``word_tiles``, only the tile
 * list's SOURCE differs (``ext_payload.tiles`` here, ``exercise.tiles`` for
 * the core type). The only new surface is the audio player up top, played
 * via the shared {@link ListenFirstAudio} (the same control ``ext:al-dictation``
 * uses for its single audio field).
 */

import type {Ref} from "react";
import {forwardRef, useMemo, useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import {useLessonMode} from "../../../../hooks/lesson/modes/useLessonMode";
import {useControlledExercise} from "../../../../lib/exercises/useControlledExercise";
import {asAudioTilesPayload} from "../../../../lib/exercises/payload/audio-tiles";
import {isWordTilesCorrect} from "../../../../lib/exercises/grading/word-tiles-equivalence";
import {deriveAudioTilesAttempt} from "../../../../lib/srs/element-attempt";
import ListenFirstAudio from "../../shared/ListenFirstAudio";
import ExerciseHint from "../../feedback/ExerciseHint";
import ExercisePromptRow from "../../shell/ExercisePromptRow";
import {wordTilesPerTileCorrect} from "../word-tiles/WordTilesExercise";
import {
    WordTilesEditor,
    WordTilesHint,
    WordTilesResult,
    WordTilesReveal,
    useWordTilesDnd,
} from "../word-tiles";
import {type AnswerView} from "../../feedback/ExerciseAnswerToggle";
import type {ContentLessonExercise} from "../../../../storage/types";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "../../shell/exercise-control";

export interface AudioTilesExerciseProps extends ControlledExerciseProps {
    exercise: ContentLessonExercise;
    setId?: string;
    lessonId?: string;
    /** Content source slug ("owner/name") for the sentence audio's asset
     *  lookup; empty on review/adaptive routes (audio-less fallback). */
    source?: string;
    onComplete: (result: ExerciseScored) => void;
}

/** Reviewed-revisit score for a persisted audio-tiles answer, or null when
 *  there is no reviewed answer. */
function audioTilesReviewedResult(
    reviewedPlaced: readonly number[] | null | undefined,
    tiles: readonly string[],
    acceptOrderings: readonly (readonly number[])[] | null | undefined,
): {correct: number; total: number} | null {
    if (reviewedPlaced == null) return null;
    return {
        correct: isWordTilesCorrect(reviewedPlaced, tiles, acceptOrderings) ? 1 : 0,
        total: 1,
    };
}

function AudioTilesExercise(
    {
        exercise,
        setId = "",
        lessonId = "",
        source = "",
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: AudioTilesExerciseProps,
    ref: Ref<ExerciseHandle>,
) {
    const {t} = useI18n();
    const {showAnswerToggle} = useLessonMode();
    const payload = useMemo(() => asAudioTilesPayload(exercise), [exercise]);
    const tiles = payload?.tiles ?? [];
    const acceptOrderings = payload?.accept_orderings;
    const reviewedTiles = reviewed?.kind === "al_audio_tiles" ? reviewed : null;

    const [placed, setPlaced] = useState<number[]>(
        reviewedTiles ? [...reviewedTiles.placed] : [],
    );
    const [showHint, setShowHint] = useState(false);
    const [view, setView] = useState<AnswerView>("my-answer");

    const allPlaced = placed.length === tiles.length && tiles.length > 0;

    const reviewedResult = audioTilesReviewedResult(
        reviewedTiles?.placed,
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
            const isCorrect = isWordTilesCorrect(placed, tiles, acceptOrderings);
            return {
                correct: isCorrect ? 1 : 0,
                total: 1,
                attempts: [
                    deriveAudioTilesAttempt(exercise, {setId, lessonId}, tiles, placed, isCorrect),
                ],
                raw_answer: {kind: "al_audio_tiles", placed: [...placed]},
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

    if (!payload || tiles.length === 0) {
        return (
            <div data-testid="audio-tiles-empty">
                {t(
                    "lesson.exercise.al_audio_tiles.empty",
                    "This audio-tiles exercise has no tiles.",
                )}
            </div>
        );
    }

    const isCorrect = result !== null && result.correct > 0;
    const myAnswerLabels = placed.map((idx) => tiles[idx]);
    const myAnswerCorrectness = wordTilesPerTileCorrect(placed, tiles, isCorrect);

    return (
        <section className="flex flex-col gap-3" data-testid="audio-tiles-exercise">
            <ExercisePromptRow
                prompt={exercise.prompt ?? ""}
                testId="audio-tiles-prompt"
            />

            <ListenFirstAudio source={source} setId={setId} audioPath={payload.audio} />

            <ExerciseHint exercise={exercise} submitted={submitted} testId="audio-tiles-hint-button" />

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

export default forwardRef(AudioTilesExercise);
