/**
 * ExerciseEditor — inline editor for a single generated exercise, Step 3
 * of the Lesson Creator (#1844).
 *
 * The exercise generator produces a list of exercises; this component lets
 * the author edit ONE exercise's content in place, with the fields that
 * match its type (matching pairs, free-text accepted answers, cloze
 * sentence + blanks, word tiles, picture-choice images). It mirrors the
 * inline-edit pattern of {@link CardEditor}'s ``SortableCardRow``: it holds
 * a private draft, gates Save on {@link validateExerciseEdit}, and commits
 * the trimmed result via ``onSave`` (the parent merges it into the exercise
 * record — no separate save step).
 *
 * Presentational + props-driven; the parent owns the exercise array.
 */

import {useState} from "react";
import {Plus, Trash2, X} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import StringListEditor from "../../shared/forms/StringListEditor";
import CardImageField from "./CardImageField";
import {
    countClozeMarkers,
    normalizeExerciseEdit,
    validateExerciseEdit,
} from "../../lib/exercises";
import {exerciseEditErrorKey} from "../../lib/content/lesson/edit-error-keys";
import type {
    ContentLessonExercise,
    ContentLessonClozeBlank,
} from "../../storage/types";

export interface ExerciseEditorProps {
    exercise: ContentLessonExercise;
    onSave: (updated: ContentLessonExercise) => void;
    onCancel: () => void;
}

type Patch = Partial<ContentLessonExercise>;

export default function ExerciseEditor({
    exercise,
    onSave,
    onCancel,
}: ExerciseEditorProps) {
    const {t} = useI18n();
    const [draft, setDraft] = useState<ContentLessonExercise>(exercise);

    function patch(next: Patch) {
        setDraft((prev) => ({...prev, ...next}) as ContentLessonExercise);
    }

    const issue = validateExerciseEdit(draft);
    const id = exercise.id;

    function save() {
        if (!issue.valid) return;
        onSave(normalizeExerciseEdit(draft));
    }

    return (
        <div
            className="flex flex-col gap-3"
            data-testid={`exercise-editor-${id}`}
        >
            <label className="form-field flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t("create_lesson.exercises.edit.prompt_label", "Question / prompt")}
                </span>
                <Input
                    type="text"
                    maxLength={1000}
                    value={draft.prompt}
                    data-testid={`exercise-edit-prompt-${id}`}
                    onChange={(e) => patch({prompt: e.target.value})}
                />
            </label>

            <TypeFields draft={draft} onPatch={patch} />

            {!issue.valid && issue.code && (
                <FormHint
                    as="p"
                    variant="warning"
                    role="alert"
                    data-testid={`exercise-edit-error-${id}`}
                >
                    {t(
                        exerciseEditErrorKey(issue.code),
                        "Please complete the exercise fields.",
                    )}
                </FormHint>
            )}

            <div className="form-actions">
                <Button
                    type="button"
                    variant="secondary"
                    data-testid={`exercise-edit-cancel-${id}`}
                    onClick={onCancel}
                >
                    {t("create_lesson.cancel", "Cancel")}
                </Button>
                <Button
                    type="button"
                    data-testid={`exercise-edit-save-${id}`}
                    disabled={!issue.valid}
                    onClick={save}
                >
                    {t("create_lesson.exercises.edit.save", "Save")}
                </Button>
            </div>
        </div>
    );
}

interface TypeFieldsProps {
    draft: ContentLessonExercise;
    onPatch: (patch: Patch) => void;
}

/** Dispatches to the per-type field editor for the current exercise type. */
function TypeFields({draft, onPatch}: TypeFieldsProps) {
    switch (draft.type) {
        case "matching":
            return <MatchingFields draft={draft} onPatch={onPatch} />;
        case "free_text":
            return <FreeTextFields draft={draft} onPatch={onPatch} />;
        case "cloze":
            return <ClozeFields draft={draft} onPatch={onPatch} />;
        case "word_tiles":
            return <WordTilesFields draft={draft} onPatch={onPatch} />;
        case "picture_choice":
            return <PictureChoiceFields draft={draft} onPatch={onPatch} />;
        case "multiple_choice":
            return <MultipleChoiceFields draft={draft} onPatch={onPatch} />;
        default:
            return null;
    }
}

function MatchingFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    const id = draft.id;
    const pairs = draft.pairs ?? [];

    function setPair(index: number, side: "left" | "right", value: string) {
        onPatch({
            pairs: pairs.map((p, i) =>
                i === index ? {...p, [side]: value} : p,
            ),
        });
    }
    function addPair() {
        onPatch({pairs: [...pairs, {left: "", right: ""}]});
    }
    function removePair(index: number) {
        onPatch({pairs: pairs.filter((_p, i) => i !== index)});
    }

    return (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.exercises.edit.pairs_label", "Pairs")}
            </legend>
            {pairs.map((pair, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2"
                    data-testid={`exercise-edit-pair-${id}-${i}`}
                >
                    <Input
                        type="text"
                        maxLength={500}
                        value={pair.left}
                        className="min-w-0 flex-1"
                        aria-label={t("create_lesson.exercises.edit.pair_left", "Term")}
                        data-testid={`exercise-edit-pair-left-${id}-${i}`}
                        onChange={(e) => setPair(i, "left", e.target.value)}
                    />
                    <span aria-hidden="true" className="text-fg-muted">→</span>
                    <Input
                        type="text"
                        maxLength={500}
                        value={pair.right}
                        className="min-w-0 flex-1"
                        aria-label={t("create_lesson.exercises.edit.pair_right", "Match")}
                        data-testid={`exercise-edit-pair-right-${id}-${i}`}
                        onChange={(e) => setPair(i, "right", e.target.value)}
                    />
                    <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                        aria-label={t("create_lesson.exercises.edit.pair_remove", "Remove pair")}
                        data-testid={`exercise-edit-pair-remove-${id}-${i}`}
                        onClick={() => removePair(i)}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-edit-pair-add-${id}`}
                onClick={addPair}
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.exercises.edit.pair_add", "Add pair")}
            </Button>
        </fieldset>
    );
}

function FreeTextFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    return (
        <StringListEditor
            values={draft.accept ?? []}
            onChange={(next) => onPatch({accept: next})}
            label={t("create_lesson.exercises.edit.accept_label", "Accepted answers")}
            addButtonLabel={t("create_lesson.exercises.edit.accept_add", "Add")}
            removeItemLabel={t(
                "create_lesson.exercises.edit.accept_remove",
                "Remove accepted answer",
            )}
            placeholder={t(
                "create_lesson.exercises.edit.accept_placeholder",
                "Accepted answer",
            )}
            testIdPrefix={`exercise-edit-accept-${draft.id}`}
        />
    );
}

function ClozeFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    const id = draft.id;
    const markers = countClozeMarkers(draft.sentence);
    const blanks = draft.blanks ?? [];

    function setBlankAccept(index: number, accept: string[]) {
        const next: ContentLessonClozeBlank[] = [];
        for (let i = 0; i < markers; i++) {
            const source = blanks[i] ?? {accept: []};
            next.push(i === index ? {...source, accept} : source);
        }
        onPatch({blanks: next});
    }

    return (
        <div className="flex flex-col gap-3">
            <label className="form-field flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.exercises.edit.sentence_label",
                        "Sentence (use ___ for each blank)",
                    )}
                </span>
                <textarea
                    rows={2}
                    maxLength={1000}
                    value={draft.sentence ?? ""}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid={`exercise-edit-sentence-${id}`}
                    onChange={(e) => onPatch({sentence: e.target.value})}
                />
                <FormHint as="span">
                    {t(
                        "create_lesson.exercises.edit.sentence_hint",
                        "Mark each blank with ___ (three underscores).",
                    )}
                </FormHint>
            </label>
            {Array.from({length: markers}, (_v, i) => (
                <StringListEditor
                    key={i}
                    values={blanks[i]?.accept ?? []}
                    onChange={(next) => setBlankAccept(i, next)}
                    label={t(
                        "create_lesson.exercises.edit.blank_label",
                        "Blank {n}: accepted answers",
                    ).replace("{n}", String(i + 1))}
                    addButtonLabel={t("create_lesson.exercises.edit.accept_add", "Add")}
                    removeItemLabel={t(
                        "create_lesson.exercises.edit.accept_remove",
                        "Remove accepted answer",
                    )}
                    placeholder={t(
                        "create_lesson.exercises.edit.accept_placeholder",
                        "Accepted answer",
                    )}
                    testIdPrefix={`exercise-edit-blank-${id}-${i}`}
                />
            ))}
        </div>
    );
}

function WordTilesFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    const id = draft.id;
    const tiles = draft.tiles ?? [];

    function setTile(index: number, value: string) {
        onPatch({tiles: tiles.map((tk, i) => (i === index ? value : tk))});
    }
    function addTile() {
        onPatch({tiles: [...tiles, ""]});
    }
    function removeTile(index: number) {
        onPatch({tiles: tiles.filter((_tk, i) => i !== index)});
    }

    return (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t(
                    "create_lesson.exercises.edit.tiles_label",
                    "Tiles (in the correct order)",
                )}
            </legend>
            {tiles.map((tile, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2"
                    data-testid={`exercise-edit-tile-${id}-${i}`}
                >
                    <Input
                        type="text"
                        maxLength={500}
                        value={tile}
                        className="min-w-0 flex-1"
                        aria-label={t(
                            "create_lesson.exercises.edit.tile_placeholder",
                            "Word",
                        )}
                        data-testid={`exercise-edit-tile-input-${id}-${i}`}
                        onChange={(e) => setTile(i, e.target.value)}
                    />
                    <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                        aria-label={t("create_lesson.exercises.edit.tile_remove", "Remove tile")}
                        data-testid={`exercise-edit-tile-remove-${id}-${i}`}
                        onClick={() => removeTile(i)}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-edit-tile-add-${id}`}
                onClick={addTile}
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.exercises.edit.tile_add", "Add tile")}
            </Button>
        </fieldset>
    );
}

function PictureChoiceFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    const id = draft.id;
    const images = draft.images ?? [];

    function setImage(
        index: number,
        change: Partial<{src: string; label: string; is_correct: string | null}>,
    ) {
        onPatch({
            images: images.map((img, i) =>
                i === index ? {...img, ...change} : img,
            ),
        });
    }
    function markCorrect(index: number) {
        onPatch({
            images: images.map((img, i) => ({
                ...img,
                is_correct: i === index ? "true" : undefined,
            })),
        });
    }
    function addImage() {
        onPatch({images: [...images, {src: "", label: ""}]});
    }
    function removeImage(index: number) {
        onPatch({images: images.filter((_img, i) => i !== index)});
    }

    return (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.exercises.edit.images_label", "Image options")}
            </legend>
            {images.map((img, i) => (
                <div
                    key={i}
                    className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3"
                    data-testid={`exercise-edit-image-${id}-${i}`}
                >
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name={`exercise-edit-correct-${id}`}
                            className="accent-[var(--accent)]"
                            checked={img.is_correct === "true"}
                            data-testid={`exercise-edit-image-correct-${id}-${i}`}
                            onChange={() => markCorrect(i)}
                        />
                        <span className="text-sm text-fg-primary">
                            {t("create_lesson.exercises.edit.image_correct", "Correct answer")}
                        </span>
                        <button
                            type="button"
                            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                            aria-label={t("create_lesson.exercises.edit.image_remove", "Remove image")}
                            data-testid={`exercise-edit-image-remove-${id}-${i}`}
                            onClick={() => removeImage(i)}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                        </button>
                    </label>
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.exercises.edit.image_label_label", "Label")}
                        </span>
                        <Input
                            type="text"
                            maxLength={500}
                            value={img.label}
                            data-testid={`exercise-edit-image-label-${id}-${i}`}
                            onChange={(e) => setImage(i, {label: e.target.value})}
                        />
                    </label>
                    <CardImageField
                        value={img.src}
                        onChange={(v) => setImage(i, {src: v})}
                        previewAlt={img.label.trim() || undefined}
                        idPrefix={`exercise-edit-image-src-${id}-${i}`}
                    />
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-edit-image-add-${id}`}
                onClick={addImage}
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.exercises.edit.image_add", "Add image")}
            </Button>
        </fieldset>
    );
}

function MultipleChoiceFields({draft, onPatch}: TypeFieldsProps) {
    const {t} = useI18n();
    const id = draft.id;
    const options = draft.options ?? [];
    const multiple = draft.multiple === true;

    function setText(index: number, text: string) {
        onPatch({
            options: options.map((o, i) => (i === index ? {...o, text} : o)),
        });
    }
    function toggleCorrect(index: number) {
        onPatch({
            options: options.map((o, i) =>
                multiple
                    ? i === index
                        ? {...o, correct: !o.correct}
                        : o
                    : {...o, correct: i === index},
            ),
        });
    }
    function toggleMultiple() {
        const next = !multiple;
        // Switching to single-answer keeps only the first correct option.
        let nextOptions = options;
        if (!next) {
            const first = options.findIndex((o) => o.correct === true);
            nextOptions = options.map((o, i) => ({...o, correct: i === first}));
        }
        onPatch({multiple: next, options: nextOptions});
    }
    function addOption() {
        onPatch({options: [...options, {text: "", correct: false}]});
    }
    function removeOption(index: number) {
        onPatch({options: options.filter((_o, i) => i !== index)});
    }

    const correctLabel = t(
        "create_lesson.exercises.edit.mc_correct",
        "Correct answer",
    );

    return (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.exercises.edit.mc_options_label", "Answer options")}
            </legend>
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={multiple}
                    data-testid={`exercise-edit-mc-multiple-${id}`}
                    onChange={toggleMultiple}
                />
                <span className="text-sm text-fg-primary">
                    {t(
                        "create_lesson.exercises.edit.mc_multiple_label",
                        "Allow multiple correct answers",
                    )}
                </span>
            </label>
            {options.map((option, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2"
                    data-testid={`exercise-edit-mc-option-${id}-${i}`}
                >
                    <input
                        type={multiple ? "checkbox" : "radio"}
                        name={`exercise-edit-mc-correct-${id}`}
                        className="accent-[var(--accent)]"
                        checked={option.correct === true}
                        aria-label={correctLabel}
                        data-testid={`exercise-edit-mc-correct-${id}-${i}`}
                        onChange={() => toggleCorrect(i)}
                    />
                    <Input
                        type="text"
                        maxLength={500}
                        value={option.text}
                        className="min-w-0 flex-1"
                        aria-label={t(
                            "create_lesson.exercises.edit.mc_option_placeholder",
                            "Option text",
                        )}
                        data-testid={`exercise-edit-mc-text-${id}-${i}`}
                        onChange={(e) => setText(i, e.target.value)}
                    />
                    <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                        aria-label={t(
                            "create_lesson.exercises.edit.mc_option_remove",
                            "Remove option",
                        )}
                        data-testid={`exercise-edit-mc-remove-${id}-${i}`}
                        onClick={() => removeOption(i)}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-edit-mc-add-${id}`}
                onClick={addOption}
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.exercises.edit.mc_option_add", "Add option")}
            </Button>
        </fieldset>
    );
}
