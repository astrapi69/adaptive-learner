/**
 * Shared sub-question editor for the reading-comprehension + graded-quiz
 * extension authoring editors (#1852, editors 3+4). Both types embed a list
 * of questions, each a ``multiple_choice`` (options + correct flags) or a
 * ``free_text`` (accepted answers). Graded-quiz additionally carries points +
 * an optional partial-credit flag (``withPoints``).
 *
 * Pure + props-driven: the parent owns the question array; this renders one
 * question and reports edits via ``onChange``. Both branches keep their data
 * so a type switch never loses what the author typed.
 */

import {Plus, X} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import StringListEditor from "../../../shared/forms/StringListEditor";
import type {WizardSubQuestion} from "../../../lib/exercises";

type Translate = (key: string, fallback?: string) => string;

export interface SubQuestionEditorProps {
    question: WizardSubQuestion;
    index: number;
    withPoints: boolean;
    canRemove: boolean;
    onChange: (question: WizardSubQuestion) => void;
    onRemove: () => void;
    idPrefix: string;
    t: Translate;
}

export default function SubQuestionEditor({
    question,
    index,
    withPoints,
    canRemove,
    onChange,
    onRemove,
    idPrefix,
    t,
}: SubQuestionEditorProps) {
    const base = `${idPrefix}-${index}`;

    function patch(next: Partial<WizardSubQuestion>) {
        onChange({...question, ...next});
    }
    function setOption(i: number, next: {text?: string; correct?: boolean}) {
        patch({
            options: question.options.map((o, k) => (k === i ? {...o, ...next} : o)),
        });
    }

    return (
        <li
            className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3"
            data-testid={`${base}`}
        >
            <div className="flex items-start gap-2">
                <Input
                    type="text"
                    maxLength={500}
                    value={question.prompt}
                    className="min-w-0 flex-1"
                    placeholder={t(
                        "create_lesson.extensions.edit.q_prompt_placeholder",
                        "Question",
                    )}
                    aria-label={t(
                        "create_lesson.extensions.edit.q_prompt_label",
                        "Question",
                    )}
                    data-testid={`${base}-prompt`}
                    onChange={(e) => patch({prompt: e.target.value})}
                />
                {canRemove && (
                    <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                        aria-label={t(
                            "create_lesson.extensions.edit.q_remove",
                            "Remove question",
                        )}
                        data-testid={`${base}-remove`}
                        onClick={onRemove}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                )}
            </div>

            <fieldset className="m-0 flex items-center gap-4 border-0 p-0">
                <legend className="sr-only">
                    {t("create_lesson.extensions.edit.q_type_label", "Answer type")}
                </legend>
                <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
                    <input
                        type="radio"
                        name={`${base}-type`}
                        className="accent-[var(--accent)]"
                        checked={question.type === "multiple_choice"}
                        data-testid={`${base}-type-mc`}
                        onChange={() => patch({type: "multiple_choice"})}
                    />
                    {t("create_lesson.extensions.edit.q_type_mc", "Multiple choice")}
                </label>
                <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
                    <input
                        type="radio"
                        name={`${base}-type`}
                        className="accent-[var(--accent)]"
                        checked={question.type === "free_text"}
                        data-testid={`${base}-type-free`}
                        onChange={() => patch({type: "free_text"})}
                    />
                    {t("create_lesson.extensions.edit.q_type_free", "Free text")}
                </label>
            </fieldset>

            {question.type === "multiple_choice" ? (
                <div className="flex flex-col gap-2">
                    {question.options.map((option, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2"
                            data-testid={`${base}-opt-${i}`}
                        >
                            <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
                                <input
                                    type="checkbox"
                                    className="accent-[var(--accent)]"
                                    checked={option.correct}
                                    aria-label={t(
                                        "create_lesson.extensions.edit.q_option_correct",
                                        "Correct",
                                    )}
                                    data-testid={`${base}-opt-correct-${i}`}
                                    onChange={(e) => setOption(i, {correct: e.target.checked})}
                                />
                            </label>
                            <Input
                                type="text"
                                maxLength={300}
                                value={option.text}
                                className="min-w-0 flex-1"
                                placeholder={t(
                                    "create_lesson.extensions.edit.q_option_text_placeholder",
                                    "Answer option",
                                )}
                                data-testid={`${base}-opt-text-${i}`}
                                onChange={(e) => setOption(i, {text: e.target.value})}
                            />
                            <button
                                type="button"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                                aria-label={t(
                                    "create_lesson.extensions.edit.q_option_remove",
                                    "Remove option",
                                )}
                                data-testid={`${base}-opt-remove-${i}`}
                                onClick={() =>
                                    patch({
                                        options: question.options.filter((_o, k) => k !== i),
                                    })
                                }
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
                        data-testid={`${base}-opt-add`}
                        onClick={() =>
                            patch({options: [...question.options, {text: "", correct: false}]})
                        }
                    >
                        <Plus size={14} aria-hidden="true" />
                        {t("create_lesson.extensions.edit.q_option_add", "Add option")}
                    </Button>
                </div>
            ) : (
                <StringListEditor
                    values={question.accept}
                    onChange={(next) => patch({accept: next})}
                    label={t(
                        "create_lesson.extensions.edit.q_accept_label",
                        "Accepted answers",
                    )}
                    addButtonLabel={t("create_lesson.extensions.edit.q_accept_add", "Add")}
                    removeItemLabel={t(
                        "create_lesson.extensions.edit.q_accept_remove",
                        "Remove accepted answer",
                    )}
                    placeholder={t(
                        "create_lesson.extensions.edit.q_accept_placeholder",
                        "Accepted answer",
                    )}
                    testIdPrefix={`${base}-accept`}
                />
            )}

            {withPoints && (
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-fg-secondary">
                        {t("create_lesson.extensions.edit.q_points_label", "Points")}
                        <Input
                            type="number"
                            min={1}
                            value={String(question.points ?? 1)}
                            className="w-20"
                            data-testid={`${base}-points`}
                            onChange={(e) =>
                                patch({points: Number(e.target.value) || 0})
                            }
                        />
                    </label>
                    {question.type === "multiple_choice" && (
                        <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
                            <input
                                type="checkbox"
                                className="accent-[var(--accent)]"
                                checked={question.partial_credit === true}
                                data-testid={`${base}-partial`}
                                onChange={(e) => patch({partial_credit: e.target.checked})}
                            />
                            {t(
                                "create_lesson.extensions.edit.q_partial_label",
                                "Allow partial credit",
                            )}
                        </label>
                    )}
                </div>
            )}
        </li>
    );
}
