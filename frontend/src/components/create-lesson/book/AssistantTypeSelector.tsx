/**
 * #2510 — exercise-type selector for the book-text AI assistant.
 *
 * The user picks which exercise types the assistant produces from the pasted
 * text. Standard types are pre-selected; extension types are opt-in; the three
 * asset-bound types (picture_choice, image-description, dictation) are shown
 * greyed-out with a one-line explanation (never hidden, so the user learns the
 * possibility exists). At least one type must stay selected — deselecting the
 * last one is blocked and says so.
 *
 * Pure presentation: the selection state lives in the parent (persisted via
 * {@link saveAssistantTypes}); this component only renders + toggles.
 */

import {useState} from "react";

import FormHint from "../../../shared/forms/FormHint";
import {
    ASSISTANT_EXTENSION_TYPES,
    ASSISTANT_STANDARD_TYPES,
    ASSISTANT_UNAVAILABLE_TYPES,
} from "../../../lib/exercises";

type Translate = (key: string, fallback?: string) => string;

/** Short slug for a type's testid / i18n key (strips the ``ext:al-`` prefix). */
function typeSlug(type: string): string {
    return type.replace("ext:al-", "");
}

/** i18n label key: core types under exercises.type.*, ext types under
 *  extensions.type.* — mirrors the manual editor's label resolver. */
function labelKey(type: string): string {
    return type.startsWith("ext:")
        ? `create_lesson.extensions.type.${typeSlug(type)}`
        : `create_lesson.exercises.type.${type}`;
}

interface AssistantTypeSelectorProps {
    selected: string[];
    onChange: (types: string[]) => void;
    t: Translate;
}

export default function AssistantTypeSelector({
    selected,
    onChange,
    t,
}: AssistantTypeSelectorProps) {
    // Transient min-one message: shown when a deselect is refused because it
    // would empty the selection. Cleared on the next successful change.
    const [floorHit, setFloorHit] = useState(false);
    const chosen = new Set(selected);

    function toggle(type: string) {
        if (chosen.has(type)) {
            if (selected.length <= 1) {
                setFloorHit(true);
                return;
            }
            setFloorHit(false);
            onChange(selected.filter((t) => t !== type));
        } else {
            setFloorHit(false);
            onChange([...selected, type]);
        }
    }

    return (
        <fieldset
            className="m-0 flex flex-col gap-3 border-0 p-0"
            data-testid="assistant-type-selector"
        >
            <legend className="form-label text-sm font-medium text-fg-primary">
                {t("create_lesson.book.types.heading", "Exercise types")}
            </legend>

            <SelectableGroup
                testid="standard"
                label={t("create_lesson.book.types.group_standard", "Standard types")}
                types={ASSISTANT_STANDARD_TYPES}
                chosen={chosen}
                onToggle={toggle}
                t={t}
            />
            <SelectableGroup
                testid="extension"
                label={t(
                    "create_lesson.book.types.group_extension",
                    "Extension types",
                )}
                types={ASSISTANT_EXTENSION_TYPES}
                chosen={chosen}
                onToggle={toggle}
                t={t}
            />

            {/* Asset-bound types: greyed out, explained, never selectable. */}
            <div className="flex flex-col gap-1.5" role="group" aria-labelledby="assistant-type-group-unavailable">
                <span
                    id="assistant-type-group-unavailable"
                    className="text-sm font-medium text-fg-secondary"
                    data-testid="assistant-type-group-unavailable"
                >
                    {t(
                        "create_lesson.book.types.group_unavailable",
                        "Not generatable from text",
                    )}
                </span>
                <p
                    id="assistant-type-unavailable-reason"
                    className="text-xs text-fg-muted"
                    data-testid="assistant-type-unavailable-reason"
                >
                    {t(
                        "create_lesson.book.types.unavailable_reason",
                        "Images and audio cannot be generated from text. You can add these types later in the editor.",
                    )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {ASSISTANT_UNAVAILABLE_TYPES.map((type) => (
                        <label
                            key={type}
                            className="flex items-center gap-2 text-sm text-fg-muted"
                        >
                            <input
                                type="checkbox"
                                className="accent-[var(--accent)]"
                                data-testid={`assistant-type-unavailable-${typeSlug(type)}`}
                                checked={false}
                                disabled
                                aria-disabled="true"
                                aria-describedby="assistant-type-unavailable-reason"
                                readOnly
                            />
                            {t(labelKey(type), type)}
                        </label>
                    ))}
                </div>
            </div>

            {floorHit && (
                <FormHint
                    as="p"
                    variant="warning"
                    data-testid="assistant-type-floor-hint"
                    role="alert"
                >
                    {t(
                        "create_lesson.book.types.floor_hint",
                        "At least one exercise type must stay selected.",
                    )}
                </FormHint>
            )}
        </fieldset>
    );
}

interface SelectableGroupProps {
    testid: string;
    label: string;
    types: readonly string[];
    chosen: ReadonlySet<string>;
    onToggle: (type: string) => void;
    t: Translate;
}

function SelectableGroup({
    testid,
    label,
    types,
    chosen,
    onToggle,
    t,
}: SelectableGroupProps) {
    const groupId = `assistant-type-group-${testid}`;
    return (
        <div
            className="flex flex-col gap-1.5"
            role="group"
            aria-labelledby={groupId}
        >
            <span
                id={groupId}
                className="text-sm font-medium text-fg-primary"
                data-testid={groupId}
            >
                {label}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {types.map((type) => (
                    <label
                        key={type}
                        className="flex items-center gap-2 text-sm text-fg-primary"
                    >
                        <input
                            type="checkbox"
                            className="accent-[var(--accent)]"
                            data-testid={`assistant-type-${typeSlug(type)}`}
                            checked={chosen.has(type)}
                            onChange={() => onToggle(type)}
                        />
                        {t(labelKey(type), type)}
                    </label>
                ))}
            </div>
        </div>
    );
}
