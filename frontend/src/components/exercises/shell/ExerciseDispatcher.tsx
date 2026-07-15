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
import type {ReactElement, Ref} from "react";

import {useI18n} from "../../../hooks/ui/useI18n";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../../storage/types";
import CategorizationExercise from "../renderers/CategorizationExercise";
import ErrorCorrectionExercise from "../renderers/ErrorCorrectionExercise";
import ReadingComprehensionExercise from "../renderers/ReadingComprehensionExercise";
import GradedQuizExercise from "../renderers/GradedQuizExercise";
import ClozeExercise from "../renderers/ClozeExercise";
import type {
    ControlledExerciseProps,
    ExerciseHandle,
    ExerciseScored,
} from "./exercise-control";
import ListenFirstAudio from "../shared/ListenFirstAudio";
import FreeTextExercise from "../renderers/FreeTextExercise";
import MatchingExercise from "../renderers/MatchingExercise";
import MultipleChoiceExercise from "../renderers/MultipleChoiceExercise";
import PictureChoiceExercise from "../renderers/PictureChoiceExercise";
import WordTilesExercise from "../renderers/WordTilesExercise";

export const SUPPORTED_EXERCISE_TYPES: ReadonlySet<string> = new Set([
    "matching",
    "picture_choice",
    "free_text",
    "word_tiles",
    "cloze",
    "multiple_choice",
]);

/** The ext: extension types this app has ADOPTED (#1579) - kept
 *  separate from the core set because the parity gate locks
 *  SUPPORTED_EXERCISE_TYPES to the schema's closed core enum, while
 *  this set is locked to the load guard's SUPPORTED_EXTENSIONS
 *  (dispatcher and guard must agree: everything loadable is renderable). */
export const SUPPORTED_EXT_EXERCISE_TYPES: ReadonlySet<string> = new Set([
    "ext:al-categorization",
    "ext:al-error-correction",
    "ext:al-reading-comprehension",
    "ext:al-graded-quiz",
]);

/** The prop bag every renderer shares (everything except the exercise, the
 *  set/lesson ids, and any type-specific extras). */
type SharedExerciseProps = ControlledExerciseProps & {
    onComplete: (scored: ExerciseScored) => void;
};

/** Route an adopted ``ext:`` exercise to its renderer. The adopted extension
 *  renderers all take the same props, so they factor into this one helper -
 *  keeping ``ExerciseDispatcher``'s cyclomatic complexity flat as more
 *  extensions are adopted. The type set here is kept in sync with
 *  ``SUPPORTED_EXT_EXERCISE_TYPES`` by the dispatcher<->guard parity gate. */
function renderAdoptedExtension(
    ex: ContentLessonExercise,
    ref: Ref<ExerciseHandle>,
    ids: {setId: string; lessonId: string},
    shared: SharedExerciseProps,
): ReactElement | null {
    if (ex.type === "ext:al-categorization") {
        return <CategorizationExercise ref={ref} exercise={ex} setId={ids.setId} lessonId={ids.lessonId} {...shared} />;
    }
    if (ex.type === "ext:al-error-correction") {
        return <ErrorCorrectionExercise ref={ref} exercise={ex} setId={ids.setId} lessonId={ids.lessonId} {...shared} />;
    }
    if (ex.type === "ext:al-reading-comprehension") {
        return <ReadingComprehensionExercise ref={ref} exercise={ex} setId={ids.setId} lessonId={ids.lessonId} {...shared} />;
    }
    if (ex.type === "ext:al-graded-quiz") {
        return <GradedQuizExercise ref={ref} exercise={ex} setId={ids.setId} lessonId={ids.lessonId} {...shared} />;
    }
    return null;
}

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
    /** #149 — the lesson's domain ("language" | "programming" |
     *  "psychology" | …). Forwarded to MatchingExercise so a
     *  knowledge lesson drops the translation-specific wording
     *  (instructions, column labels) that only fits language sets.
     *  Optional; defaults to language behaviour when absent. */
    domain?: string | null;
    /** Schema v1.3 — the lesson's cards, so the dispatcher can read the
     *  referenced card's ``media_type`` / ``code_language`` and switch
     *  the free-text / cloze renderers into code mode (monospace input,
     *  whitespace-tolerant matching). Optional; review / adaptive
     *  sessions may pass an empty list and get the plain-text path. */
    cards?: ContentLessonCard[];
    onComplete: (result: ExerciseScored) => Promise<void>;
}

/** Listen-first audio for an exercise (#1600 Option A): the ``audio`` path
 *  of the first referenced card that carries one, or null. Only free_text
 *  and matching consume it (the receptive "listen, then answer" flow);
 *  cards without audio - the entire pre-#1600 corpus - yield null and the
 *  exercise renders exactly as before. */
export function resolveListenAudio(
    exercise: ContentLessonExercise,
    cards: ContentLessonCard[],
): string | null {
    for (const cid of exercise.card_ids ?? []) {
        const audio = cards.find((c) => c.id === cid)?.audio;
        if (typeof audio === "string" && audio.trim() !== "") return audio;
    }
    return null;
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
        domain = null,
        cards = [],
        onComplete,
        controlled = false,
        onInteraction,
        reviewed = null,
        onAdvance,
        advanceLabel,
    }: ExerciseDispatcherProps,
    ref: Ref<ExerciseHandle>,
) {
    const ex: ContentLessonExercise | null = step.exercise ?? null;
    if (ex === null) return <ExerciseStepPlaceholder step={step} />;
    const supported =
        SUPPORTED_EXERCISE_TYPES.has(ex.type) ||
        SUPPORTED_EXT_EXERCISE_TYPES.has(ex.type);
    if (!supported) {
        return <ExerciseStepPlaceholder step={step} />;
    }
    const {codeMode, codeLanguage} = resolveCodeContext(ex, cards);
    const shared = {
        controlled,
        onInteraction,
        reviewed,
        // #1218 — the success-merge "Continue" wiring (lesson only).
        onAdvance,
        advanceLabel,
        // TTS feature C2 — language used to read the prompt aloud, and
        // a flag so renderers suppress read-aloud on code/formula
        // content (reading code aloud is useless).
        ttsLang: targetLanguage,
        codeMode,
        onComplete: (scored: ExerciseScored) => {
            void onComplete(scored);
        },
    };
    const extElement = renderAdoptedExtension(ex, ref, {setId, lessonId}, shared);
    if (extElement) return extElement;
    if (ex.type === "matching") {
        return (
            <>
                <ListenFirstAudio
                    source={source}
                    setId={setId}
                    audioPath={resolveListenAudio(ex, cards)}
                />
                <MatchingExercise
                    ref={ref}
                    exercise={ex}
                    setId={setId}
                    lessonId={lessonId}
                    targetLanguage={targetLanguage}
                    sourceLanguage={sourceLanguage}
                    domain={domain}
                    {...shared}
                />
            </>
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
            <>
                <ListenFirstAudio
                    source={source}
                    setId={setId}
                    audioPath={resolveListenAudio(ex, cards)}
                />
                <FreeTextExercise
                    ref={ref}
                    exercise={ex}
                    setId={setId}
                    lessonId={lessonId}
                    codeLanguage={codeLanguage}
                    {...shared}
                />
            </>
        );
    }
    if (ex.type === "word_tiles") {
        return (
            <WordTilesExercise
                ref={ref}
                exercise={ex}
                setId={setId}
                lessonId={lessonId}
                targetLanguage={targetLanguage}
                sourceLanguage={sourceLanguage}
                domain={domain}
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
    if (ex.type === "multiple_choice") {
        return (
            <MultipleChoiceExercise
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

/**
 * Fallback shown when an exercise step can't render its real widget.
 * Distinguishes three reasons rather than collapsing to one "unknown":
 * - `missing` — the exercise carries no type (empty/null/whitespace): a
 *   CONTENT defect (the renderer exists, the data is incomplete).
 * - `loading` — a supported type momentarily on the placeholder path.
 * - `unsupported` — a non-empty type the app does not (yet) render: the
 *   genuine "ships in a future version" case.
 */
export function ExerciseStepPlaceholder({
    step,
}: {
    step: ContentLessonStep;
}) {
    const {t} = useI18n();
    const rawType = step.exercise?.type;
    const missingType =
        rawType === undefined ||
        rawType === null ||
        (typeof rawType === "string" && rawType.trim() === "");
    const exerciseType = missingType ? "unknown" : rawType;
    const supported =
        !missingType && SUPPORTED_EXERCISE_TYPES.has(exerciseType);

    let state: "missing" | "loading" | "unsupported";
    let message: string;
    if (missingType) {
        state = "missing";
        message = t(
            "lesson.exercise.missing_type",
            "This exercise is missing its type. Please update the content.",
        );
    } else if (supported) {
        state = "loading";
        message = t("lesson.exercise.loading", "Exercise loading…");
    } else {
        state = "unsupported";
        message = t(
            "lesson.exercise.coming_soon",
            "This exercise type ({type}) ships in a future version. Skip to the next step.",
        ).replace("{type}", exerciseType);
    }

    return (
        <div
            className="lesson-exercise-placeholder"
            data-testid={`lesson-exercise-placeholder-${exerciseType}`}
        >
            <p data-testid={`lesson-exercise-placeholder-${state}`}>
                {message}
            </p>
            {step.exercise?.prompt && (
                <p className="lesson-exercise-prompt-preview">
                    <em>{step.exercise.prompt}</em>
                </p>
            )}
        </div>
    );
}
