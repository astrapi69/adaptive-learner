/**
 * Exercise generator — Step 3 of the Lesson Creator (Phase 65C).
 *
 * Auto-generates a config-driven mix of exercises from the cards via
 * the shared ``generateExercises`` (the same generator the chat-
 * analysis path uses). The user tunes the count, the type mix, and
 * the drill direction, previews the result, reorders (@dnd-kit) or
 * deletes individual exercises, and can regenerate.
 *
 * The advanced manual-exercise editor is the EXP-021 "Folge-Ausbau"
 * (follow-on) and is intentionally not part of this step yet; the
 * auto path is the default + only path for now.
 */

import {useEffect, useState} from "react";
import {Sparkles, Trash2, GripVertical, Pencil} from "lucide-react";
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import ExerciseEditor from "./ExerciseEditor";
import type {
    ExerciseGenConfig,
    GeneratableType,
} from "../../lib/content/lesson/exercise-generator";
import type {ContentLessonExercise} from "../../storage/types";

export const MIN_EXERCISES = 5;
export const EXERCISE_COUNT_MIN = 5;
export const EXERCISE_COUNT_MAX = 20;

/**
 * Coerce a raw exercise-count value onto the valid `[MIN, MAX]` band.
 *
 * Non-numeric or non-finite input (empty field, `"abc"`, `NaN`) falls
 * back to the minimum; out-of-range numbers clamp to the nearest
 * bound; fractional input rounds. This is the single guard the number
 * input and the slider both commit through, so they can never diverge
 * from the generator's expectations (`selectExercises` also caps with
 * `Math.max(1, count)`).
 */
export function clampExerciseCount(value: number): number {
    if (!Number.isFinite(value)) return EXERCISE_COUNT_MIN;
    return Math.min(
        EXERCISE_COUNT_MAX,
        Math.max(EXERCISE_COUNT_MIN, Math.round(value)),
    );
}

const ALL_TYPES: GeneratableType[] = [
    "matching",
    "free_text",
    "cloze",
    "word_tiles",
    "picture_choice",
];

export interface ExerciseGeneratorProps {
    exercises: ContentLessonExercise[];
    config: ExerciseGenConfig;
    onConfigChange: (config: ExerciseGenConfig) => void;
    onGenerate: () => void;
    onReorder: (exercises: ContentLessonExercise[]) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updated: ContentLessonExercise) => void;
}

export default function ExerciseGenerator({
    exercises,
    config,
    onConfigChange,
    onGenerate,
    onReorder,
    onDelete,
    onUpdate,
}: ExerciseGeneratorProps) {
    const {t} = useI18n();
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Uncommitted text of the number input: lets the user clear + retype
    // freely (a directly-clamped controlled value would fight mid-edit).
    // Committed on blur / Enter; the slider commits `config.count`
    // immediately and this stays in sync via the effect below.
    const [countDraft, setCountDraft] = useState(String(config.count));
    useEffect(() => {
        setCountDraft(String(config.count));
    }, [config.count]);

    function commitCountDraft() {
        const clamped = clampExerciseCount(Number(countDraft));
        setCountDraft(String(clamped));
        if (clamped !== config.count) {
            onConfigChange({...config, count: clamped});
        }
    }

    const countLabel = t(
        "create_lesson.exercises.count_label",
        "Number of exercises",
    );

    function toggleType(type: GeneratableType) {
        const set = new Set(config.types);
        if (set.has(type)) set.delete(type);
        else set.add(type);
        onConfigChange({...config, types: Array.from(set)});
    }

    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = exercises.findIndex((e) => e.id === active.id);
        const newIndex = exercises.findIndex((e) => e.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onReorder(arrayMove(exercises, oldIndex, newIndex));
    }

    return (
        <section
            className="create-lesson-step flex flex-col gap-6"
            data-testid="create-lesson-step-3"
            aria-label={t("create_lesson.exercises.heading", "Generate exercises")}
        >
            <h2 className="text-xl font-semibold text-fg-primary">
                {t("create_lesson.exercises.heading", "Generate exercises")}
            </h2>

            {/* Config */}
            <div
                className="exercise-gen-config flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
                data-testid="exercise-gen-config"
            >
                <div className="form-row flex flex-col gap-1.5">
                    <label
                        htmlFor="exercise-count-input"
                        className="form-label text-sm font-medium text-fg-primary"
                    >
                        {countLabel}
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={EXERCISE_COUNT_MIN}
                            max={EXERCISE_COUNT_MAX}
                            value={config.count}
                            className="min-w-0 flex-1 accent-[var(--accent)]"
                            data-testid="exercise-count-slider"
                            aria-label={countLabel}
                            onChange={(e) =>
                                onConfigChange({
                                    ...config,
                                    count: Number(e.target.value),
                                })
                            }
                        />
                        <Input
                            id="exercise-count-input"
                            type="number"
                            inputMode="numeric"
                            min={EXERCISE_COUNT_MIN}
                            max={EXERCISE_COUNT_MAX}
                            value={countDraft}
                            className="w-20 shrink-0 text-center"
                            data-testid="exercise-count-input"
                            aria-label={countLabel}
                            onChange={(e) => setCountDraft(e.target.value)}
                            onBlur={commitCountDraft}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitCountDraft();
                            }}
                        />
                    </div>
                </div>

                <fieldset className="exercise-gen-types m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="form-label text-sm font-medium text-fg-primary">
                        {t("create_lesson.exercises.types_label", "Exercise types")}
                    </legend>
                    {ALL_TYPES.map((type) => (
                        <label key={type} className="exercise-gen-type flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="accent-[var(--accent)]"
                                data-testid={`exercise-type-${type}`}
                                checked={config.types.includes(type)}
                                onChange={() => toggleType(type)}
                            />
                            {t(`create_lesson.exercises.type.${type}`, type)}
                        </label>
                    ))}
                </fieldset>

                <label className="form-field flex flex-col gap-1.5">
                    <span className="form-label text-sm font-medium text-fg-primary">
                        {t("create_lesson.exercises.direction_label", "Direction")}
                    </span>
                    <select
                        data-testid="exercise-direction"
                        className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={config.direction}
                        onChange={(e) =>
                            onConfigChange({
                                ...config,
                                direction:
                                    e.target
                                        .value as ExerciseGenConfig["direction"],
                            })
                        }
                    >
                        {(["auto", "receptive", "productive", "balanced"] as const).map(
                            (d) => (
                                <option key={d} value={d}>
                                    {t(`create_lesson.exercises.dir.${d}`, d)}
                                </option>
                            ),
                        )}
                    </select>
                </label>

                <div className="form-actions">
                    <Button
                        type="button"
                        data-testid="exercise-generate"
                        onClick={onGenerate}
                        disabled={config.types.length === 0}
                    >
                        <Sparkles size={14} aria-hidden="true" />
                        {exercises.length === 0
                            ? t(
                                  "create_lesson.exercises.generate",
                                  "Auto-generate exercises",
                              )
                            : t("create_lesson.exercises.regenerate", "Regenerate")}
                    </Button>
                </div>
            </div>

            {/* Count + minimum */}
            <div className="exercise-gen-count flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-fg-primary" data-testid="exercise-list-count">
                    {t("create_lesson.exercises.count", "{n} exercises").replace(
                        "{n}",
                        String(exercises.length),
                    )}
                </span>
                {exercises.length > 0 && exercises.length < MIN_EXERCISES && (
                    <FormHint
                        as="span"
                        variant="warning"
                        data-testid="exercise-min-hint"
                    >
                        {t(
                            "create_lesson.exercises.min_hint",
                            "{n} exercises needed",
                        ).replace("{n}", String(MIN_EXERCISES))}
                    </FormHint>
                )}
            </div>

            {/* Preview list (sortable) */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={exercises.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul
                        className="exercise-gen-list flex list-none flex-col gap-2 p-0"
                        data-testid="exercise-list"
                    >
                        {exercises.map((ex) => (
                            <SortableExerciseRow
                                key={ex.id}
                                exercise={ex}
                                onDelete={onDelete}
                                onUpdate={onUpdate}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </section>
    );
}

/** A short human description of an exercise for the preview row. */
function describe(ex: ContentLessonExercise): string {
    switch (ex.type) {
        case "matching":
            return `${ex.pairs?.length ?? 0} pairs`;
        case "cloze":
            return ex.sentence ?? "";
        case "word_tiles":
            return (ex.tiles ?? []).join(" ");
        case "picture_choice":
            return `${ex.images?.length ?? 0} images`;
        case "free_text":
        default:
            return ex.prompt;
    }
}

interface SortableExerciseRowProps {
    exercise: ContentLessonExercise;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updated: ContentLessonExercise) => void;
}

function SortableExerciseRow({
    exercise,
    onDelete,
    onUpdate,
}: SortableExerciseRowProps) {
    const {t} = useI18n();
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
        useSortable({id: exercise.id});
    const [editing, setEditing] = useState(false);
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    if (editing) {
        return (
            <li
                ref={setNodeRef}
                style={style}
                className="exercise-row is-editing flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
                data-testid={`exercise-row-${exercise.id}`}
                data-type={exercise.type}
            >
                <span className="exercise-row-type w-fit rounded-md bg-bg-elevated px-2 py-0.5 text-xs font-medium text-fg-secondary">
                    {t(`create_lesson.exercises.type.${exercise.type}`, exercise.type)}
                </span>
                <ExerciseEditor
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
            ref={setNodeRef}
            style={style}
            className="exercise-row flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            data-testid={`exercise-row-${exercise.id}`}
            data-type={exercise.type}
        >
            <button
                type="button"
                className="card-row-handle flex shrink-0 cursor-grab items-center text-fg-muted"
                aria-label={t("create_lesson.exercises.drag", "Drag to reorder")}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} aria-hidden="true" />
            </button>
            <span className="exercise-row-type shrink-0 rounded-md bg-bg-elevated px-2 py-0.5 text-xs font-medium text-fg-secondary">
                {t(`create_lesson.exercises.type.${exercise.type}`, exercise.type)}
            </span>
            <span className="exercise-row-desc muted min-w-0 flex-1 truncate text-sm text-fg-muted">{describe(exercise)}</span>
            <button
                type="button"
                className="card-row-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`exercise-edit-${exercise.id}`}
                aria-label={t("create_lesson.exercises.edit.edit", "Edit exercise")}
                onClick={() => setEditing(true)}
            >
                <Pencil size={14} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="card-row-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                data-testid={`exercise-delete-${exercise.id}`}
                aria-label={t("create_lesson.exercises.delete", "Delete exercise")}
                onClick={() => onDelete(exercise.id)}
            >
                <Trash2 size={14} aria-hidden="true" />
            </button>
        </li>
    );
}
