/**
 * Inline editor for a wizard-authored EXTENSION exercise (#1852; #1887 added
 * dictation). Dispatches the five authored types: ``ext:al-categorization`` +
 * ``ext:al-error-correction`` (inline fields), ``ext:al-reading-comprehension``
 * + ``ext:al-graded-quiz`` + ``ext:al-dictation`` (field components).
 *
 * Same interaction model as the core-type ``ExerciseEditor`` (#1845): a
 * private draft, a Save gated on the shipped payload validator
 * (``validateExtensionExercise``), commit via ``onSave`` after
 * normalization. Each type gets its own field component (no overloaded
 * shared surface); the differing data shapes live under ``ext_payload``.
 */

import {useState} from "react";
import {Plus, X} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useI18n} from "../../hooks/ui/useI18n";
import FormHint from "../../shared/forms/FormHint";
import StringListEditor from "../../shared/forms/StringListEditor";
import {
    CATEGORIZATION_EXT_TYPE,
    DICTATION_EXT_TYPE,
    ERROR_CORRECTION_EXT_TYPE,
    GRADED_QUIZ_EXT_TYPE,
    READING_COMPREHENSION_EXT_TYPE,
    normalizeExtensionExercise,
    validateExtensionExercise,
    type WizardSubQuestion,
} from "../../lib/exercises";
import {extensionEditErrorKey} from "../../lib/content/lesson/edit-error-keys";
import {
    DictationFields,
    GradedQuizFields,
    ReadingComprehensionFields,
} from "./extension-fields";
import type {ContentLessonExercise} from "../../storage/types";

export interface ExtensionExerciseEditorProps {
    exercise: ContentLessonExercise;
    onSave: (updated: ContentLessonExercise) => void;
    onCancel: () => void;
}

type Patch = Partial<ContentLessonExercise>;

interface CategorizationPayload {
    categories: {name: string; items: string[]}[];
}
interface ErrorCorrectionPayload {
    tokens: string[];
    error_index: number;
    accept: string[];
}
interface DictationPayload {
    audio: string;
    accept: string[];
}

export default function ExtensionExerciseEditor({
    exercise,
    onSave,
    onCancel,
}: ExtensionExerciseEditorProps) {
    const {t} = useI18n();
    const [draft, setDraft] = useState<ContentLessonExercise>(exercise);
    const id = exercise.id;

    function patch(next: Patch) {
        setDraft((prev) => ({...prev, ...next}) as ContentLessonExercise);
    }
    function patchPayload(payload: unknown) {
        patch({ext_payload: payload} as Patch);
    }

    const issue = validateExtensionExercise(draft);

    return (
        <div
            className="flex flex-col gap-3"
            data-testid={`exercise-ext-editor-${id}`}
        >
            <label className="form-field flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.extensions.edit.prompt_label",
                        "Instruction / prompt",
                    )}
                </span>
                <Input
                    type="text"
                    maxLength={1000}
                    value={draft.prompt}
                    data-testid={`exercise-ext-prompt-${id}`}
                    onChange={(e) => patch({prompt: e.target.value})}
                />
            </label>

            {draft.type === CATEGORIZATION_EXT_TYPE && (
                <CategorizationFields
                    id={id}
                    payload={draft.ext_payload as unknown as CategorizationPayload}
                    onChange={patchPayload}
                />
            )}
            {draft.type === ERROR_CORRECTION_EXT_TYPE && (
                <ErrorCorrectionFields
                    id={id}
                    payload={draft.ext_payload as unknown as ErrorCorrectionPayload}
                    onChange={patchPayload}
                />
            )}
            {draft.type === READING_COMPREHENSION_EXT_TYPE && (
                <ReadingComprehensionFields
                    id={id}
                    payload={
                        draft.ext_payload as unknown as {
                            passage: string;
                            questions: WizardSubQuestion[];
                        }
                    }
                    onChange={patchPayload}
                    t={t}
                />
            )}
            {draft.type === GRADED_QUIZ_EXT_TYPE && (
                <GradedQuizFields
                    id={id}
                    payload={
                        draft.ext_payload as unknown as {
                            pass_threshold?: number;
                            questions: WizardSubQuestion[];
                        }
                    }
                    onChange={patchPayload}
                    t={t}
                />
            )}
            {draft.type === DICTATION_EXT_TYPE && (
                <DictationFields
                    id={id}
                    payload={draft.ext_payload as unknown as DictationPayload}
                    onChange={patchPayload}
                    t={t}
                />
            )}

            {!issue.valid && issue.code && (
                <FormHint
                    as="p"
                    variant="warning"
                    role="alert"
                    data-testid={`exercise-ext-error-${id}`}
                >
                    {t(
                        extensionEditErrorKey(issue.code),
                        "Please complete the exercise fields.",
                    )}
                </FormHint>
            )}

            <div className="form-actions">
                <Button
                    type="button"
                    variant="secondary"
                    data-testid={`exercise-ext-cancel-${id}`}
                    onClick={onCancel}
                >
                    {t("create_lesson.cancel", "Cancel")}
                </Button>
                <Button
                    type="button"
                    data-testid={`exercise-ext-save-${id}`}
                    disabled={!issue.valid}
                    onClick={() =>
                        issue.valid && onSave(normalizeExtensionExercise(draft))
                    }
                >
                    {t("create_lesson.extensions.edit.save", "Save")}
                </Button>
            </div>
        </div>
    );
}

function CategorizationFields({
    id,
    payload,
    onChange,
}: {
    id: string;
    payload: CategorizationPayload;
    onChange: (payload: CategorizationPayload) => void;
}) {
    const {t} = useI18n();
    const categories = payload?.categories ?? [];

    function setName(index: number, name: string) {
        onChange({
            categories: categories.map((c, i) =>
                i === index ? {...c, name} : c,
            ),
        });
    }
    function setItems(index: number, items: string[]) {
        onChange({
            categories: categories.map((c, i) =>
                i === index ? {...c, items} : c,
            ),
        });
    }
    function addCategory() {
        onChange({categories: [...categories, {name: "", items: []}]});
    }
    function removeCategory(index: number) {
        onChange({categories: categories.filter((_c, i) => i !== index)});
    }

    return (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t(
                    "create_lesson.extensions.edit.cat_categories_label",
                    "Categories",
                )}
            </legend>
            {categories.map((category, i) => (
                <div
                    key={i}
                    className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3"
                    data-testid={`exercise-ext-cat-${id}-${i}`}
                >
                    <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            maxLength={200}
                            value={category.name}
                            className="min-w-0 flex-1"
                            placeholder={t(
                                "create_lesson.extensions.edit.cat_name_placeholder",
                                "Category name",
                            )}
                            aria-label={t(
                                "create_lesson.extensions.edit.cat_name_label",
                                "Category name",
                            )}
                            data-testid={`exercise-ext-cat-name-${id}-${i}`}
                            onChange={(e) => setName(i, e.target.value)}
                        />
                        <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                            aria-label={t(
                                "create_lesson.extensions.edit.cat_remove",
                                "Remove category",
                            )}
                            data-testid={`exercise-ext-cat-remove-${id}-${i}`}
                            onClick={() => removeCategory(i)}
                        >
                            <X size={14} aria-hidden="true" />
                        </button>
                    </div>
                    <StringListEditor
                        values={category.items ?? []}
                        onChange={(next) => setItems(i, next)}
                        label={t(
                            "create_lesson.extensions.edit.cat_items_label",
                            "Items in this category",
                        )}
                        addButtonLabel={t(
                            "create_lesson.extensions.edit.cat_item_add",
                            "Add",
                        )}
                        removeItemLabel={t(
                            "create_lesson.extensions.edit.cat_item_remove",
                            "Remove item",
                        )}
                        placeholder={t(
                            "create_lesson.extensions.edit.cat_item_placeholder",
                            "Item",
                        )}
                        testIdPrefix={`exercise-ext-cat-items-${id}-${i}`}
                    />
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                data-testid={`exercise-ext-cat-add-${id}`}
                onClick={addCategory}
            >
                <Plus size={14} aria-hidden="true" />
                {t("create_lesson.extensions.edit.cat_add", "Add category")}
            </Button>
        </fieldset>
    );
}

function ErrorCorrectionFields({
    id,
    payload,
    onChange,
}: {
    id: string;
    payload: ErrorCorrectionPayload;
    onChange: (payload: ErrorCorrectionPayload) => void;
}) {
    const {t} = useI18n();
    const tokens = payload?.tokens ?? [];
    const errorIndex = payload?.error_index ?? 0;
    const accept = payload?.accept ?? [];

    function setToken(index: number, value: string) {
        onChange({...payload, tokens: tokens.map((tk, i) => (i === index ? value : tk))});
    }
    function markError(index: number) {
        onChange({...payload, error_index: index});
    }
    function addToken() {
        onChange({...payload, tokens: [...tokens, ""]});
    }
    function removeToken(index: number) {
        const nextTokens = tokens.filter((_tk, i) => i !== index);
        // Keep error_index pointing at a valid token after a removal.
        let nextIndex = errorIndex;
        if (index < errorIndex) nextIndex -= 1;
        nextIndex = Math.min(Math.max(0, nextIndex), Math.max(0, nextTokens.length - 1));
        onChange({...payload, tokens: nextTokens, error_index: nextIndex});
    }

    return (
        <div className="flex flex-col gap-3">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.extensions.edit.ec_tokens_label",
                        "Sentence words (mark the wrong one)",
                    )}
                </legend>
                {tokens.map((token, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-2"
                        data-testid={`exercise-ext-token-${id}-${i}`}
                    >
                        <input
                            type="radio"
                            name={`exercise-ext-error-${id}`}
                            className="accent-[var(--accent)]"
                            checked={errorIndex === i}
                            aria-label={t(
                                "create_lesson.extensions.edit.ec_mark_error",
                                "This word is the error",
                            )}
                            data-testid={`exercise-ext-token-error-${id}-${i}`}
                            onChange={() => markError(i)}
                        />
                        <Input
                            type="text"
                            maxLength={200}
                            value={token}
                            className="min-w-0 flex-1"
                            aria-label={t(
                                "create_lesson.extensions.edit.ec_token_placeholder",
                                "Word",
                            )}
                            data-testid={`exercise-ext-token-input-${id}-${i}`}
                            onChange={(e) => setToken(i, e.target.value)}
                        />
                        <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                            aria-label={t(
                                "create_lesson.extensions.edit.ec_token_remove",
                                "Remove word",
                            )}
                            data-testid={`exercise-ext-token-remove-${id}-${i}`}
                            onClick={() => removeToken(i)}
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
                    data-testid={`exercise-ext-token-add-${id}`}
                    onClick={addToken}
                >
                    <Plus size={14} aria-hidden="true" />
                    {t("create_lesson.extensions.edit.ec_token_add", "Add word")}
                </Button>
            </fieldset>
            <StringListEditor
                values={accept}
                onChange={(next) => onChange({...payload, accept: next})}
                label={t(
                    "create_lesson.extensions.edit.ec_accept_label",
                    "Accepted corrections",
                )}
                addButtonLabel={t("create_lesson.extensions.edit.ec_accept_add", "Add")}
                removeItemLabel={t(
                    "create_lesson.extensions.edit.ec_accept_remove",
                    "Remove correction",
                )}
                placeholder={t(
                    "create_lesson.extensions.edit.ec_accept_placeholder",
                    "Correct word",
                )}
                testIdPrefix={`exercise-ext-accept-${id}`}
            />
        </div>
    );
}
