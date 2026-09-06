/**
 * ExplanationField (#2992) - the optional post-answer ``explanation`` of an
 * exercise in the Lesson Creator's inline editors (core + extension).
 *
 * A plain Markdown textarea (the learner-facing panel renders it with
 * react-markdown, see ``ExerciseExplanation``), a live character counter
 * against the schema cap, and - while the field is empty - an "Insert
 * template" action that pastes the engine's authoring convention skeleton
 * (rule, word for word, further examples, typical mistake) so an author
 * starts from the agreed shape instead of a blank box.
 *
 * Presentational + props-driven: the parent owns the draft.
 *
 * @example
 * <ExplanationField
 *     value={draft.explanation}
 *     onChange={(explanation) => patch({explanation})}
 *     idPrefix={`exercise-edit-${draft.id}`}
 * />
 */

import {FileText} from "lucide-react";

import {Button} from "@/components/ui/button";
import {useI18n} from "../../../hooks/ui/useI18n";
import FormHint from "../../../shared/forms/FormHint";
import {EXPLANATION_MAX_CHARS} from "../../../lib/exercises";

export interface ExplanationFieldProps {
    /** The draft's explanation (Markdown); null/undefined reads as empty. */
    value: string | null | undefined;
    onChange: (value: string) => void;
    /** Testid prefix of the owning editor (``exercise-edit-<id>`` /
     *  ``exercise-ext-<id>``); the field appends ``-explanation``. */
    idPrefix: string;
}

/** The English convention skeleton; the catalogs carry a localized one. */
const TEMPLATE_FALLBACK = [
    "**Rule:** ",
    "",
    "**Word for word:**",
    "- *token* - literal meaning (grammatical note)",
    "",
    "**Further examples:**",
    "- *sentence* - translation",
    "",
    "**Typical mistake:** ",
].join("\n");

/** Markdown textarea for an exercise's post-answer explanation. */
export default function ExplanationField({
    value,
    onChange,
    idPrefix,
}: ExplanationFieldProps) {
    const {t} = useI18n();
    const text = value ?? "";
    const testId = `${idPrefix}-explanation`;
    const counter = t(
        "create_lesson.exercises.edit.explanation_counter",
        "{n} / {max} characters",
    )
        .replace("{n}", String(text.length))
        .replace("{max}", String(EXPLANATION_MAX_CHARS));

    return (
        <div className="form-field flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.exercises.edit.explanation_label",
                        "Explanation after the answer (optional, Markdown)",
                    )}
                </span>
                <textarea
                    rows={6}
                    maxLength={EXPLANATION_MAX_CHARS}
                    value={text}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid={testId}
                    onChange={(e) => onChange(e.target.value)}
                />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <FormHint as="span">
                    {t(
                        "create_lesson.exercises.edit.explanation_hint",
                        "Shown after the learner answers: rule, word for word, further examples, typical mistake.",
                    )}
                </FormHint>
                <span
                    className="text-xs text-fg-muted"
                    data-testid={`${testId}-count`}
                    aria-live="polite"
                >
                    {counter}
                </span>
            </div>
            {text.trim().length === 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    data-testid={`${testId}-template`}
                    onClick={() =>
                        onChange(
                            t(
                                "create_lesson.exercises.edit.explanation_template_body",
                                TEMPLATE_FALLBACK,
                            ),
                        )
                    }
                >
                    <FileText size={14} aria-hidden="true" />
                    {t(
                        "create_lesson.exercises.edit.explanation_template",
                        "Insert template",
                    )}
                </Button>
            )}
        </div>
    );
}
