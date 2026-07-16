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

import {Sparkles, Trash2, GripVertical} from "lucide-react";
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
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import type {
    ExerciseGenConfig,
    GeneratableType,
} from "../../lib/content/lesson/exercise-generator";
import type {ContentLessonExercise} from "../../storage/types";

export const MIN_EXERCISES = 5;
export const EXERCISE_COUNT_MIN = 5;
export const EXERCISE_COUNT_MAX = 20;

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
}

export default function ExerciseGenerator({
    exercises,
    config,
    onConfigChange,
    onGenerate,
    onReorder,
    onDelete,
}: ExerciseGeneratorProps) {
    const {t} = useI18n();
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
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
            className="create-lesson-step"
            data-testid="create-lesson-step-3"
            aria-label={t("create_lesson.exercises.heading", "Generate exercises")}
        >
            <h2>{t("create_lesson.exercises.heading", "Generate exercises")}</h2>

            {/* Config */}
            <div className="exercise-gen-config" data-testid="exercise-gen-config">
                <label className="form-row">
                    <span className="form-label">
                        {t("create_lesson.exercises.count_label", "Number of exercises")}:{" "}
                        <strong data-testid="exercise-count-value">
                            {config.count}
                        </strong>
                    </span>
                    <input
                        type="range"
                        min={EXERCISE_COUNT_MIN}
                        max={EXERCISE_COUNT_MAX}
                        value={config.count}
                        data-testid="exercise-count-slider"
                        onChange={(e) =>
                            onConfigChange({
                                ...config,
                                count: Number(e.target.value),
                            })
                        }
                    />
                </label>

                <fieldset className="exercise-gen-types">
                    <legend className="form-label">
                        {t("create_lesson.exercises.types_label", "Exercise types")}
                    </legend>
                    {ALL_TYPES.map((type) => (
                        <label key={type} className="exercise-gen-type">
                            <input
                                type="checkbox"
                                data-testid={`exercise-type-${type}`}
                                checked={config.types.includes(type)}
                                onChange={() => toggleType(type)}
                            />
                            {t(`create_lesson.exercises.type.${type}`, type)}
                        </label>
                    ))}
                </fieldset>

                <label className="form-field">
                    <span className="form-label">
                        {t("create_lesson.exercises.direction_label", "Direction")}
                    </span>
                    <select
                        data-testid="exercise-direction"
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
            <div className="exercise-gen-count">
                <span data-testid="exercise-list-count">
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
                        className="exercise-gen-list"
                        data-testid="exercise-list"
                    >
                        {exercises.map((ex) => (
                            <SortableExerciseRow
                                key={ex.id}
                                exercise={ex}
                                onDelete={onDelete}
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
}

function SortableExerciseRow({exercise, onDelete}: SortableExerciseRowProps) {
    const {t} = useI18n();
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
        useSortable({id: exercise.id});
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };
    return (
        <li
            ref={setNodeRef}
            style={style}
            className="exercise-row"
            data-testid={`exercise-row-${exercise.id}`}
            data-type={exercise.type}
        >
            <button
                type="button"
                className="card-row-handle"
                aria-label={t("create_lesson.exercises.drag", "Drag to reorder")}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={16} aria-hidden="true" />
            </button>
            <span className="exercise-row-type">
                {t(`create_lesson.exercises.type.${exercise.type}`, exercise.type)}
            </span>
            <span className="exercise-row-desc muted">{describe(exercise)}</span>
            <button
                type="button"
                className="card-row-action"
                data-testid={`exercise-delete-${exercise.id}`}
                aria-label={t("create_lesson.exercises.delete", "Delete exercise")}
                onClick={() => onDelete(exercise.id)}
            >
                <Trash2 size={14} aria-hidden="true" />
            </button>
        </li>
    );
}
