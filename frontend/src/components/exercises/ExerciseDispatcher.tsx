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

import {forwardRef} from "react";
import type {Ref} from "react";

import {useI18n} from "../../hooks/useI18n";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../storage/types";
import ClozeExercise from "./ClozeExercise";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";
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

export interface ExerciseDispatcherProps extends ControlledExerciseProps {
    step: ContentLessonStep;
    /** Phase 46B context propagated to each exercise so the
     *  element-attempt deriver can stamp set_id + lesson_id
     *  on every produced ElementAttempt. */
    setId: string;
    lessonId: string;
    /** Phase 54C / v1.37.0 — content source slug
     *  ("owner/name"). Threaded through to PictureChoice so
     *  useAsset can resolve images from the right content
     *  cache. Optional; review / adaptive sessions pass
     *  empty and accept the text-only fallback. */
    source?: string;
    /** UX bugfix — the lesson's BCP-47 language pair, forwarded to
     *  MatchingExercise so its column headers can name the actual
     *  languages. Optional; only the matching renderer reads them. */
    targetLanguage?: string | null;
    sourceLanguage?: string | null;
    /** Schema v1.3 — the lesson's cards, so the dispatcher can read the
     *  referenced card's ``media_type`` / ``code_language`` and switch
     *  the free-text / cloze renderers into code mode (monospace input,
     *  whitespace-tolerant matching). Optional; review / adaptive
     *  sessions may pass an empty list and get the plain-text path. */
    cards?: ContentLessonCard[];
    onComplete: (result: ExerciseScored) => Promise<void>;
}

/** Code context for an exercise: true when its FIRST referenced card is
 *  a code/formula card (schema v1.3). Drives the code-aware renderers. */
export function resolveCodeContext(
    exercise: ContentLessonExercise,
    cards: ContentLessonCard[],
): {codeMode: boolean; codeLanguage: string | null} {
    const firstId = exercise.card_ids?.[0];
    const card = firstId
        ? cards.find((c) => c.id === firstId)
        : undefined;
    const codeMode =
        card?.media_type === "code" || card?.media_type === "formula";
    return {codeMode, codeLanguage: card?.code_language ?? null};
}

/** Forwards a ref to the active exercise so the controlled
 *  (Lesson) parent can drive the shared "Prüfen" button.
 *  ``controlled`` / ``onInteraction`` / ``reviewed`` are
 *  optional + default off, so the Review + AdaptiveLesson
 *  pages keep each exercise's self-contained behaviour. */
function ExerciseDispatcher(
    {
        step,
        setId,
        lessonId,
        source = "",
        targetLanguage = null,
        sourceLanguage = null,
        cards = [],
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
    }: ExerciseDispatcherProps,
    ref: Ref<ExerciseHandle>,
) {
    const ex: ContentLessonExercise | null = step.exercise ?? null;
    if (ex === null) return <ExerciseStepPlaceholder step={step} />;
    const supported = SUPPORTED_EXERCISE_TYPES.has(ex.type);
    if (!supported) {
        return <ExerciseStepPlaceholder step={step} />;
    }
    const {codeMode, codeLanguage} = resolveCodeContext(ex, cards);
    const shared = {
        controlled,
        onInteraction,
        reviewed,
        // TTS feature C2 — language used to read the prompt aloud, and
        // a flag so renderers suppress read-aloud on code/formula
        // content (reading code aloud is useless).
        ttsLang: targetLanguage,
        codeMode,
        onComplete: (scored: ExerciseScored) => {
            void onComplete(scored);
        },
    };
    if (ex.type === "matching") {
        return (
            <MatchingExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                targetLanguage={targetLanguage}
                sourceLanguage={sourceLanguage}
                {...shared}
            />
        );
    }
    if (ex.type === "picture_choice") {
        return (
            <PictureChoiceExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                source={source}
                {...shared}
            />
        );
    }
    if (ex.type === "free_text") {
        return (
            <FreeTextExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                codeLanguage={codeLanguage}
                {...shared}
            />
        );
    }
    if (ex.type === "word_tiles") {
        return (
            <WordTilesExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                {...shared}
            />
        );
    }
    if (ex.type === "cloze") {
        return (
            <ClozeExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                {...shared}
            />
        );
    }
    return <ExerciseStepPlaceholder step={step} />;
}

const ForwardedExerciseDispatcher = forwardRef(ExerciseDispatcher);
export {ForwardedExerciseDispatcher as ExerciseDispatcher};

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
