/**
 * StringListEditor — a small, repeatable "add / remove short text value"
 * list control (astrapi69/adaptive-learner#1797).
 *
 * Fully presentational and app-agnostic: no i18n, no storage. The caller
 * owns the array and passes already-translated labels. First used for a
 * free-text card's additional accepted answers in the Lesson Creator, but
 * carries nothing card-specific — reuse it anywhere a list of short strings
 * (tags, aliases, distractors) is edited.
 *
 * Behaviour: type a value, press Enter or click Add → the trimmed value is
 * appended (blank and exact-duplicate additions are ignored) and the input
 * clears. Each existing value shows with a remove button. Token-backed
 * Tailwind only.
 *
 * @example
 * <StringListEditor
 *   values={altAnswers}
 *   onChange={setAltAnswers}
 *   label={t("create_lesson.cards.alt_answers_label")}
 *   addButtonLabel={t("create_lesson.cards.alt_answers_add")}
 *   removeItemLabel={t("create_lesson.cards.alt_answers_remove")}
 *   placeholder={t("create_lesson.cards.alt_answers_placeholder")}
 * />
 */

import {useState} from "react";
import {Plus, X} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

export interface StringListEditorProps {
    /** The current list of values (caller-owned). */
    values: string[];
    /** Called with the next list on add or remove. */
    onChange: (values: string[]) => void;
    /** Visible label above the control. */
    label: string;
    /** Text for the Add button. */
    addButtonLabel: string;
    /** Accessible name for each row's remove button. */
    removeItemLabel: string;
    /** Placeholder for the entry input. */
    placeholder?: string;
    /** Max length of a single entry. */
    maxLength?: number;
    /** Test-id prefix. Default ``"string-list"``. */
    testIdPrefix?: string;
}

export default function StringListEditor({
    values,
    onChange,
    label,
    addButtonLabel,
    removeItemLabel,
    placeholder,
    maxLength = 500,
    testIdPrefix = "string-list",
}: StringListEditorProps) {
    const [entry, setEntry] = useState("");

    function add() {
        const trimmed = entry.trim();
        if (!trimmed || values.includes(trimmed)) return;
        onChange([...values, trimmed]);
        setEntry("");
    }

    function removeAt(index: number) {
        onChange(values.filter((_v, i) => i !== index));
    }

    return (
        <div className="flex flex-col gap-1.5" data-testid={testIdPrefix}>
            <span className="form-label text-sm font-medium text-fg-primary">
                {label}
            </span>
            {values.length > 0 && (
                <ul
                    className="flex list-none flex-col gap-1.5 p-0"
                    data-testid={`${testIdPrefix}-list`}
                >
                    {values.map((value, index) => (
                        <li
                            key={`${value}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-2 py-1"
                            data-testid={`${testIdPrefix}-item-${index}`}
                        >
                            <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                                {value}
                            </span>
                            <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                                aria-label={removeItemLabel}
                                data-testid={`${testIdPrefix}-remove-${index}`}
                                onClick={() => removeAt(index)}
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex items-center gap-2">
                <Input
                    type="text"
                    value={entry}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    aria-label={label}
                    data-testid={`${testIdPrefix}-input`}
                    onChange={(e) => setEntry(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`${testIdPrefix}-add`}
                    onClick={add}
                >
                    <Plus size={14} aria-hidden="true" />
                    {addButtonLabel}
                </Button>
            </div>
        </div>
    );
}
