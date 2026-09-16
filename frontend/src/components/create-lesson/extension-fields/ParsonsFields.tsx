/**
 * Authoring fields for ``ext:al-parsons`` (#3110): a code textarea plus an
 * optional language for highlighting. Pure + props-driven — the parent owns
 * the ``ext_payload``.
 *
 * Per the issue's authoring contract, indentation is DERIVED from each
 * line's leading spaces (4 per level) rather than authored via a separate
 * per-line control: the author pastes/types code exactly as it should
 * read once solved, and this field converts it to ``{code, indent}[]`` on
 * every change. The textarea's displayed value is the reverse projection
 * (``linesToParsonsText``) of the current payload, so the two stay in
 * sync; blank lines are dropped (they are not a draggable code tile).
 */

import {Input} from "@/components/ui/input";
import type {ParsonsLine} from "../../../lib/exercises/payload/parsons";

type Translate = (key: string, fallback?: string) => string;

interface ParsonsPayload {
    lines: ParsonsLine[];
    language?: string;
}

const INDENT_SPACES = 4;

/** Render ``lines`` back into editable text: each line's code, prefixed by
 *  ``indent * 4`` leading spaces. The inverse of {@link parsonsTextToLines}. */
export function linesToParsonsText(lines: ParsonsLine[]): string {
    return lines
        .map((line) => " ".repeat(Math.max(0, line.indent) * INDENT_SPACES) + line.code)
        .join("\n");
}

/** Parse a textarea's raw text into ``{code, indent}[]``: indent is the
 *  line's leading-space count divided by 4 (floored), code is the
 *  trimmed remainder. Blank lines are dropped — they are not a code tile. */
export function parsonsTextToLines(text: string): ParsonsLine[] {
    return text
        .split("\n")
        .map((raw) => {
            const leading = raw.match(/^ */)?.[0].length ?? 0;
            return {code: raw.trim(), indent: Math.floor(leading / INDENT_SPACES)};
        })
        .filter((line) => line.code !== "");
}

export default function ParsonsFields({
    id,
    payload,
    onChange,
    t,
}: {
    id: string;
    payload: ParsonsPayload;
    onChange: (payload: ParsonsPayload) => void;
    t: Translate;
}) {
    const lines = payload?.lines ?? [];
    const language = payload?.language ?? "";

    return (
        <div className="flex flex-col gap-3">
            <label className="form-field flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg-primary">
                    {t("create_lesson.extensions.edit.parsons_code_label", "Code")}
                </span>
                <textarea
                    value={linesToParsonsText(lines)}
                    onChange={(e) =>
                        onChange({lines: parsonsTextToLines(e.target.value), language})
                    }
                    rows={8}
                    className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 font-mono text-sm text-fg-primary"
                    data-testid={`exercise-ext-parsons-code-${id}`}
                    placeholder={t(
                        "create_lesson.extensions.edit.parsons_code_placeholder",
                        "def greet(name):\n    print(name)",
                    )}
                />
            </label>
            <label className="form-field flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.extensions.edit.parsons_language_label",
                        "Language (optional, for syntax highlighting)",
                    )}
                </span>
                <Input
                    type="text"
                    maxLength={40}
                    value={language}
                    data-testid={`exercise-ext-parsons-language-${id}`}
                    onChange={(e) => onChange({lines, language: e.target.value})}
                />
            </label>
        </div>
    );
}
