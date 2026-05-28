/**
 * ExerciseDispatcher — routes a step.exercise to the right
 * renderer (Phase 44 / extracted Phase 46D / C15).
 *
 * Used by both ``pages/Lesson.tsx`` (the main viewer) and
 * ``pages/Review.tsx`` (the SRS review session). Moving it
 * out of Lesson.tsx into a shared module avoids duplicating
 * the if-cascade across the two pages.
 *
 * Future schema_version bumps that add a fifth exercise
 * type land here: extend ``SUPPORTED_EXERCISE_TYPES`` +
 * add a new ``if (ex.type === ...)`` branch. The defensive
 * placeholder fallback (``ExerciseStepPlaceholder``) catches
 * any runtime type outside the closed union.
 */

import {useI18n} from "../../hooks/useI18n";
import type {
    ContentLessonExercise,
    ContentLessonStep,
    ElementAttempt,
} from "../../storage/types";
import ClozeExercise from "./ClozeExercise";
import FreeTextExercise from "./FreeTextExercise";
import MatchingExercise from "./MatchingExercise";
import PictureChoiceExercise from "./PictureChoiceExercise";
import WordTilesExercise from "./WordTilesExercise";

export const SUPPORTED_EXERCISE_TYPES: ReadonlySet<string> = new Set([
    "matching",
    "picture_choice",
    "free_text",
    "word_tiles",
    "cloze",
]);

export interface ExerciseDispatcherProps {
    step: ContentLessonStep;
    /** Phase 46B context propagated to each exercise so the
     *  element-attempt deriver can stamp set_id + lesson_id
     *  on every produced ElementAttempt. */
    setId: string;
    lessonId: string;
    onComplete: (result: {
        correct: number;
        total: number;
        attempts: ElementAttempt[];
    }) => Promise<void>;
}

export function ExerciseDispatcher({
    step,
    setId,
    lessonId,
    onComplete,
}: ExerciseDispatcherProps) {
    const ex: ContentLessonExercise | null = step.exercise ?? null;
    if (ex === null) return <ExerciseStepPlaceholder step={step} />;
    const supported = SUPPORTED_EXERCISE_TYPES.has(ex.type);
    if (!supported) {
        return <ExerciseStepPlaceholder step={step} />;
    }
    if (ex.type === "matching") {
        return (
            <MatchingExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "picture_choice") {
        return (
            <PictureChoiceExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "free_text") {
        return (
            <FreeTextExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "word_tiles") {
        return (
            <WordTilesExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    if (ex.type === "cloze") {
        return (
            <ClozeExercise
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                onComplete={(scored) => {
                    void onComplete(scored);
                }}
            />
        );
    }
    return <ExerciseStepPlaceholder step={step} />;
}

export function ExerciseStepPlaceholder({
    step,
}: {
    step: ContentLessonStep;
}) {
    const {t} = useI18n();
    const exerciseType = step.exercise?.type ?? "unknown";
    const supported = SUPPORTED_EXERCISE_TYPES.has(exerciseType);
    return (
        <div
            className="lesson-exercise-placeholder"
            data-testid={`lesson-exercise-placeholder-${exerciseType}`}
        >
            <p>
                {supported
                    ? t(
                          "lesson.exercise.loading",
                          "Exercise loading…",
                      )
                    : t(
                          "lesson.exercise.coming_soon",
                          "This exercise type ({type}) ships in a future version. Skip to the next step.",
                      ).replace("{type}", exerciseType)}
            </p>
            {step.exercise?.prompt && (
                <p className="lesson-exercise-prompt-preview">
                    <em>{step.exercise.prompt}</em>
                </p>
            )}
        </div>
    );
}
