/**
 * The extension-authoring branch of the Lesson Creator (#1852), symmetric
 * with {@link BookSteps}: step 2 authors the extension exercises (the #1852
 * editors 1+2), step 3 reviews + saves. Entered from the "Advanced exercise
 * types" template card on step 1.
 *
 * Pure presentation: the parent owns the exercise array + save flow. The
 * inline editing reuses {@link ExtensionExerciseEditor}; the add/edit/delete
 * row interaction mirrors the core step-3 list.
 */

import {useState} from "react";
import {Pencil, Plus, Trash2} from "lucide-react";

import {Button} from "@/components/ui/button";
import FormHint from "../../shared/forms/FormHint";
import ExtensionExerciseEditor from "./ExtensionExerciseEditor";
import {
    EXTENSION_WIZARD_TYPES,
    createBlankExtensionExercise,
    newExtensionExerciseId,
    type ExtensionWizardType,
} from "../../lib/exercises";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

/** Short slug for a type's testid / i18n key (strips the ``ext:al-``
 *  prefix): ``ext:al-error-correction`` -> ``error-correction``. */
function extSlug(type: string): string {
    return type.replace("ext:al-", "");
}

interface ExtensionStepsProps {
    step: number;
    saved: boolean;
    meta: LessonMeta;
    exercises: ContentLessonExercise[];
    advanceBlocked: boolean;
    saving: boolean;
    onAddExercise: (exercise: ContentLessonExercise) => void;
    onUpdateExercise: (id: string, updated: ContentLessonExercise) => void;
    onDeleteExercise: (id: string) => void;
    onSaveLocal: () => void;
    t: Translate;
}

export default function ExtensionSteps({
    step,
    saved,
    meta,
    exercises,
    advanceBlocked,
    saving,
    onAddExercise,
    onUpdateExercise,
    onDeleteExercise,
    onSaveLocal,
    t,
}: ExtensionStepsProps) {
    const [picking, setPicking] = useState(false);
    const [autoEditId, setAutoEditId] = useState<string | null>(null);

    function addExtension(type: ExtensionWizardType) {
        const exercise = createBlankExtensionExercise(type, newExtensionExerciseId());
        onAddExercise(exercise);
        setAutoEditId(exercise.id);
        setPicking(false);
    }

    if (step === 2) {
        return (
            <section
                className="create-lesson-step flex flex-col gap-4"
                data-testid="create-lesson-extension-step"
                aria-label={t(
                    "create_lesson.extensions.heading",
                    "Advanced exercise types",
                )}
            >
                <h2 className="text-xl font-semibold text-fg-primary">
                    {t("create_lesson.extensions.heading", "Advanced exercise types")}
                </h2>
                <FormHint as="p">
                    {t(
                        "create_lesson.extensions.notice",
                        "These exercise types are advanced and may not be supported by every app or older versions.",
                    )}
                </FormHint>

                <ul
                    className="flex list-none flex-col gap-2 p-0"
                    data-testid="extension-list"
                >
                    {exercises.map((ex) => (
                        <ExtensionRow
                            key={ex.id}
                            exercise={ex}
                            autoEdit={ex.id === autoEditId}
                            onUpdate={onUpdateExercise}
                            onDelete={onDeleteExercise}
                            t={t}
                        />
                    ))}
                </ul>

                {picking ? (
                    <div
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                        data-testid="extension-add-picker"
                    >
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t(
                                "create_lesson.extensions.add_heading",
                                "Choose an extension type",
                            )}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {EXTENSION_WIZARD_TYPES.map((type) => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid={`extension-add-type-${extSlug(type)}`}
                                    onClick={() => addExtension(type)}
                                >
                                    {t(`create_lesson.extensions.type.${extSlug(type)}`, type)}
                                </Button>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-fit"
                            data-testid="extension-add-cancel"
                            onClick={() => setPicking(false)}
                        >
                            {t("create_lesson.cancel", "Cancel")}
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        data-testid="extension-add"
                        onClick={() => setPicking(true)}
                    >
                        <Plus size={14} aria-hidden="true" />
                        {t("create_lesson.extensions.add", "Add extension exercise")}
                    </Button>
                )}

                {advanceBlocked && (
                    <p
                        className="form-hint form-hint-warning"
                        data-testid="create-lesson-extension-error"
                        role="alert"
                    >
                        {t(
                            "create_lesson.extensions.min_to_advance",
                            "Add at least one complete extension exercise to continue.",
                        )}
                    </p>
                )}
            </section>
        );
    }

    if (step === 3 && !saved) {
        return (
            <section
                className="create-lesson-step flex flex-col gap-4"
                data-testid="create-lesson-extension-review"
            >
                <h2 className="text-xl font-semibold text-fg-primary">
                    {t("create_lesson.review.heading", "Review and save")}
                </h2>
                <dl className="flex flex-col gap-1">
                    <div className="flex gap-2">
                        <dt className="font-medium text-fg-primary">
                            {t("create_lesson.review.title", "Title")}:
                        </dt>
                        <dd className="text-fg-secondary">{meta.title}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="font-medium text-fg-primary">
                            {t("create_lesson.review.exercises", "Exercises")}:
                        </dt>
                        <dd
                            className="text-fg-secondary"
                            data-testid="extension-review-count"
                        >
                            {exercises.length}
                        </dd>
                    </div>
                </dl>
                <div className="form-actions">
                    <Button
                        type="button"
                        data-testid="create-lesson-save-local"
                        disabled={saving}
                        onClick={onSaveLocal}
                    >
                        {t("create_lesson.save.save_local", "Save locally")}
                    </Button>
                </div>
            </section>
        );
    }

    return null;
}

/** One extension exercise row: collapsed preview, or the inline editor. */
function ExtensionRow({
    exercise,
    autoEdit,
    onUpdate,
    onDelete,
    t,
}: {
    exercise: ContentLessonExercise;
    autoEdit: boolean;
    onUpdate: (id: string, updated: ContentLessonExercise) => void;
    onDelete: (id: string) => void;
    t: Translate;
}) {
    const [editing, setEditing] = useState(autoEdit);
    const slug = extSlug(exercise.type);

    if (editing) {
        return (
            <li
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
                data-testid={`extension-row-${exercise.id}`}
                data-type={exercise.type}
            >
                <span className="w-fit rounded-md bg-bg-elevated px-2 py-0.5 text-xs font-medium text-fg-secondary">
                    {t(`create_lesson.extensions.type.${slug}`, exercise.type)}
                </span>
                <ExtensionExerciseEditor
                    exercise={exercise}
                    onSave={(updated) => {
                        onUpdate(exercise.id, updated);
                        setEditing(false);
                    }}
                    onCancel={() => setEditing(false)}
                />
            </li>
        );
    }

    return (
        <li
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            data-testid={`extension-row-${exercise.id}`}
            data-type={exercise.type}
        >
            <span className="shrink-0 rounded-md bg-bg-elevated px-2 py-0.5 text-xs font-medium text-fg-secondary">
                {t(`create_lesson.extensions.type.${slug}`, exercise.type)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
                {exercise.prompt}
            </span>
            <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`extension-edit-${exercise.id}`}
                aria-label={t("create_lesson.extensions.edit_row", "Edit exercise")}
                onClick={() => setEditing(true)}
            >
                <Pencil size={14} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`extension-delete-${exercise.id}`}
                aria-label={t("create_lesson.extensions.delete_row", "Delete exercise")}
                onClick={() => onDelete(exercise.id)}
            >
                <Trash2 size={14} aria-hidden="true" />
            </button>
        </li>
    );
}
