/**
 * #1967 — the cardless (theory/exercise) EDIT path of the Lesson Creator.
 *
 * A lesson authored via the book-text path (#1743) has ``cards: []``,
 * multiple ``theory-*`` steps and generated exercises. Reopening it must let
 * the user edit the ACTUAL generated exercises — not the empty vocabulary-card
 * editor the card-driven ``WizardSteps`` would show. This is the compact
 * three-step edit flow: Metadata (rendered by the page) -> Exercises -> Review.
 *
 * Symmetric with {@link WizardSteps}/{@link BookSteps}: pure presentation, all
 * state + callbacks arrive via props. It reuses the shared
 * {@link ExerciseGenerator} (edit / add / delete / reorder the exercises) and
 * {@link ReviewStep} in ``cardless`` mode (no card requirement), so the
 * authored theory (preserved by the page on save) survives the edit.
 */

import ExerciseGenerator, {MIN_EXERCISES} from "./ExerciseGenerator";
import ReviewStep from "./ReviewStep";
import type {ExerciseGenConfig} from "../../lib/exercises";
import type {DraftValidationChecks} from "../../lib/content/lesson/draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface ExerciseEditStepsProps {
    /** Current wizard step (2 = exercise editor, 3 = review). */
    step: number;
    saved: boolean;
    meta: LessonMeta;
    /** Always empty for a cardless lesson; passed to the review summary. */
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
    genConfig: ExerciseGenConfig;
    exerciseError: boolean;
    draftChecks: DraftValidationChecks;
    saving: boolean;
    onGenerate: () => void;
    onConfigChange: (config: ExerciseGenConfig) => void;
    onReorderExercises: (exercises: ContentLessonExercise[]) => void;
    onDeleteExercise: (id: string) => void;
    onUpdateExercise: (id: string, updated: ContentLessonExercise) => void;
    onAddExercise: (exercise: ContentLessonExercise) => void;
    onSaveLocal: () => void;
    onSaveShare: () => void;
    onSaveCopy?: () => void;
    t: Translate;
}

/** Steps 2-3 of the cardless (book/theory-lesson) edit path. */
export default function ExerciseEditSteps({
    step,
    saved,
    meta,
    cards,
    exercises,
    genConfig,
    exerciseError,
    draftChecks,
    saving,
    onGenerate,
    onConfigChange,
    onReorderExercises,
    onDeleteExercise,
    onUpdateExercise,
    onAddExercise,
    onSaveLocal,
    onSaveShare,
    onSaveCopy,
    t,
}: ExerciseEditStepsProps) {
    return (
        <>
            {step === 2 && (
                <>
                    <ExerciseGenerator
                        exercises={exercises}
                        config={genConfig}
                        onConfigChange={onConfigChange}
                        onGenerate={onGenerate}
                        onReorder={onReorderExercises}
                        onDelete={onDeleteExercise}
                        onUpdate={onUpdateExercise}
                        onAdd={onAddExercise}
                    />
                    {exerciseError && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-exercise-error"
                            role="alert"
                        >
                            {exercises.length < MIN_EXERCISES
                                ? t(
                                      "create_lesson.exercises.min_to_advance",
                                      "Generate at least {n} exercises to continue.",
                                  ).replace("{n}", String(MIN_EXERCISES))
                                : t(
                                      "create_lesson.exercises.incomplete_to_advance",
                                      "Complete or remove the incomplete exercises to continue.",
                                  )}
                        </p>
                    )}
                </>
            )}

            {step === 3 && !saved && (
                <ReviewStep
                    meta={meta}
                    cards={cards}
                    exercises={exercises}
                    draftChecks={draftChecks}
                    saving={saving}
                    editMode
                    cardless
                    onSaveLocal={onSaveLocal}
                    onSaveShare={onSaveShare}
                    onSaveCopy={onSaveCopy}
                    t={t}
                />
            )}
        </>
    );
}
