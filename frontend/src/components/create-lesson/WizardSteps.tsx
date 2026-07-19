/**
 * The standard (non-book) authoring steps of the Lesson Creator: the
 * card editor (step 2), the exercise generator (step 3) and the review
 * step (step 4). Extracted from CreateLesson so the page component keeps
 * its cyclomatic complexity under the gate once the edit-mode (#1740) and
 * book-text (#1743) paths co-exist — symmetric with {@link BookSteps}.
 *
 * Pure presentation: every value + callback comes via props; the same
 * ``data-testid``s render, so the wizard's behaviour is unchanged.
 */

import CardEditor, {MIN_CARDS} from "./CardEditor";
import ExerciseGenerator, {MIN_EXERCISES} from "./ExerciseGenerator";
import ReviewStep from "./ReviewStep";
import type {ExerciseGenConfig} from "../../lib/content/lesson/exercise/exercise-generator";
import type {
    DraftValidationChecks,
} from "../../lib/content/lesson/draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface WizardStepsProps {
    step: number;
    saved: boolean;
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
    genConfig: ExerciseGenConfig;
    cardError: boolean;
    exerciseError: boolean;
    draftChecks: DraftValidationChecks;
    saving: boolean;
    editMode: boolean;
    onAddCard: (c: {
        front: string;
        back: string;
        notes: string;
        image: string;
        altAnswers: string[];
    }) => void;
    onUpdateCard: (id: string, patch: Partial<LessonCardDraft>) => void;
    onDeleteCard: (id: string) => void;
    onReorderCards: (cards: LessonCardDraft[]) => void;
    onImportCards: (rows: {front: string; back: string; notes: string}[]) => void;
    onGenerate: () => void;
    onConfigChange: (config: ExerciseGenConfig) => void;
    onReorderExercises: (exercises: ContentLessonExercise[]) => void;
    onDeleteExercise: (id: string) => void;
    onUpdateExercise: (id: string, updated: ContentLessonExercise) => void;
    onSaveLocal: () => void;
    onSaveShare: () => void;
    onSaveCopy?: () => void;
    t: Translate;
}

/** Steps 2-4 of the standard (card-driven) authoring path. */
export default function WizardSteps({
    step,
    saved,
    meta,
    cards,
    exercises,
    genConfig,
    cardError,
    exerciseError,
    draftChecks,
    saving,
    editMode,
    onAddCard,
    onUpdateCard,
    onDeleteCard,
    onReorderCards,
    onImportCards,
    onGenerate,
    onConfigChange,
    onReorderExercises,
    onDeleteExercise,
    onUpdateExercise,
    onSaveLocal,
    onSaveShare,
    onSaveCopy,
    t,
}: WizardStepsProps) {
    return (
        <>
            {step === 2 && (
                <>
                    <CardEditor
                        cards={cards}
                        onAdd={onAddCard}
                        onUpdate={onUpdateCard}
                        onDelete={onDeleteCard}
                        onReorder={onReorderCards}
                        onClearAll={() => onReorderCards([])}
                        onImport={onImportCards}
                    />
                    {cardError && cards.length < MIN_CARDS && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-card-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.cards.min_to_advance",
                                "Add at least {n} cards to continue.",
                            ).replace("{n}", String(MIN_CARDS))}
                        </p>
                    )}
                </>
            )}

            {step === 3 && (
                <>
                    <ExerciseGenerator
                        exercises={exercises}
                        config={genConfig}
                        onConfigChange={onConfigChange}
                        onGenerate={onGenerate}
                        onReorder={onReorderExercises}
                        onDelete={onDeleteExercise}
                        onUpdate={onUpdateExercise}
                    />
                    {exerciseError && exercises.length < MIN_EXERCISES && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-exercise-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.exercises.min_to_advance",
                                "Generate at least {n} exercises to continue.",
                            ).replace("{n}", String(MIN_EXERCISES))}
                        </p>
                    )}
                </>
            )}

            {step === 4 && !saved && (
                <ReviewStep
                    meta={meta}
                    cards={cards}
                    exercises={exercises}
                    draftChecks={draftChecks}
                    saving={saving}
                    editMode={editMode}
                    onSaveLocal={onSaveLocal}
                    onSaveShare={onSaveShare}
                    onSaveCopy={onSaveCopy}
                    t={t}
                />
            )}
        </>
    );
}
