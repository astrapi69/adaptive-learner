import {useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent} from "react";
import type {Editor} from "@tiptap/react";
import type {JSONContent} from "@tiptap/core";

import {Button} from "@/components/ui/button";
import {useButtonTooltips} from "../../hooks/settings/useButtonTooltips";
import {useDialogFocus} from "../../hooks/ui/useDialogFocus";
import {useI18n} from "../../hooks/ui/useI18n";
import RichTextEditor from "../editor/RichTextEditor";
import EditorToolbar from "../editor/EditorToolbar";
import {serializeEditorContent} from "../editor/content-utils";

interface RatingDialogProps {
    open: boolean;
    onCancel: () => void;
    onSubmit: (rating: RatingValues) => void;
    submitting?: boolean;
    /**
     * v1.4.0 — multi-cycle session summary. When the user has
     * completed more than one auto-loop cycle, the dialog prepends
     * a "cycles completed" block summarising the journey.
     */
    cycleCount?: number;
    cycleTopics?: {
        cycle: number;
        topic: string;
        summary: string;
        next_topic: string;
    }[];
}

export interface RatingValues {
    understanding: number;
    stress: number;
    method_fit: number;
    /**
     * v1.14.0 / Phase 27B — notes are now a serialised TipTap
     * JSON document (or the empty string when the user did not
     * type anything). The persistence pipeline stores the
     * string verbatim in ``session_ratings.notes`` (TEXT
     * column); ``content-utils.parseEditorContent`` round-trips
     * it on read. Legacy rows written before v1.14.0 keep their
     * plain-text shape and still render correctly.
     */
    notes: string;
}

/**
 * Modal dialog (rendered inline, no portal — keeps the SR DOM
 * minimal) for collecting end-of-session ratings: understanding,
 * stress and method-fit each as a 1..5 tap-button group, plus
 * an optional free-text notes field.
 *
 * v0.6.0 / 9C: button group replaces the slider input. Universal
 * swap (not mobile-only) — sliders for a 5-position scale are
 * imprecise on every input device. A 5-button row gives the
 * exact value with one click on desktop and one thumb-tap on
 * mobile, and stays accessible to keyboard users (each button
 * focusable, arrow keys not required for value selection).
 *
 * v1.14.0 / Phase 27B: the notes textarea is now a
 * ``RichTextEditor`` + ``EditorToolbar`` pair. The dialog hides
 * the heading buttons (a 1-3 line note has no use for H1) but
 * keeps the inline marks, lists, link, code and quote tools.
 *
 * Returns early with ``null`` when ``open`` is false so the
 * dialog markup doesn't pollute the DOM unnecessarily.
 */
export default function RatingDialog({
    open,
    onCancel,
    onSubmit,
    submitting = false,
    cycleCount,
    cycleTopics,
}: RatingDialogProps) {
    const {t} = useI18n();
    const [understanding, setUnderstanding] = useState(3);
    const [stress, setStress] = useState(3);
    const [methodFit, setMethodFit] = useState(3);
    const [notesDoc, setNotesDoc] = useState<JSONContent | null>(null);
    const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
    const [charCount, setCharCount] = useState(0);
    const dialogRef = useRef<HTMLDivElement>(null);

    // WCAG 2.1.2 / 2.4.3: initial focus, focus trap, focus return.
    useDialogFocus(dialogRef, {open});

    // WCAG SC 2.1.2 (No Keyboard Trap): close on Escape.
    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !submitting) onCancel();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, submitting, onCancel]);

    if (!open) return null;

    const handleEditorReady = (editor: Editor) => {
        setNotesEditor(editor);
        // Subscribe to update / selection events to refresh the
        // character-count read-out on every transaction.
        const refresh = () => {
            const storage = editor.storage.characterCount as
                | {characters: () => number}
                | undefined;
            setCharCount(storage?.characters() ?? 0);
        };
        editor.on("update", refresh);
        editor.on("selectionUpdate", refresh);
        refresh();
    };

    return (
        <div className="modal-overlay" data-testid="rating-dialog">
            <div
                ref={dialogRef}
                className="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rating-title"
            >
                <h2 id="rating-title" className="modal-title">
                    {t("session.rating_title", "How did the session go?")}
                </h2>
                {cycleCount && cycleCount > 1 && (
                    <div
                        className="rating-cycles-summary"
                        data-testid="rating-cycles-summary"
                    >
                        <p>
                            <strong>
                                {t(
                                    "session.cycles_completed",
                                    "Cycles completed",
                                )}
                                :
                            </strong>{" "}
                            {cycleCount}
                        </p>
                        {cycleTopics && cycleTopics.length > 0 && (
                            <ol className="rating-cycles-list">
                                {cycleTopics.map((c) => (
                                    <li key={c.cycle}>
                                        <strong>{c.topic}</strong>
                                        {c.summary && (
                                            <span> - {c.summary}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}
                <form
                    className="rating-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const serialised = serializeEditorContent(notesDoc) ?? "";
                        onSubmit({
                            understanding,
                            stress,
                            method_fit: methodFit,
                            notes: serialised,
                        });
                    }}
                >
                    <RatingRow
                        labelKey="session.rating_understanding"
                        fallback="How well did you understand?"
                        testid="rating-understanding"
                        value={understanding}
                        onChange={setUnderstanding}
                        disabled={submitting}
                    />
                    <RatingRow
                        labelKey="session.rating_stress"
                        fallback="How stressful was it?"
                        testid="rating-stress"
                        value={stress}
                        onChange={setStress}
                        disabled={submitting}
                    />
                    <RatingRow
                        labelKey="session.rating_method_fit"
                        fallback="How well did the method fit?"
                        testid="rating-method-fit"
                        value={methodFit}
                        onChange={setMethodFit}
                        disabled={submitting}
                    />
                    <div className="form-row">
                        <span className="form-label" id="rating-notes-label">
                            {t("session.rating_notes", "Notes (optional)")}
                        </span>
                        <EditorToolbar
                            editor={notesEditor}
                            testidNamespace="rating-notes-toolbar"
                            showHeadings={false}
                            showHistory={false}
                        />
                        <RichTextEditor
                            content={notesDoc}
                            onChange={setNotesDoc}
                            onEditorReady={handleEditorReady}
                            editable={!submitting}
                            placeholder={t(
                                "session.rating_notes_placeholder",
                                "What worked, what didn't, what to try next time...",
                            )}
                            testidNamespace="rating-notes"
                            minHeight={120}
                            ariaLabel={t(
                                "session.rating_notes_aria",
                                "Session notes",
                            )}
                        />
                        <div
                            className="editor-character-count"
                            data-testid="rating-notes-character-count"
                        >
                            {t("editor.character_count", "{count} characters").replace(
                                "{count}",
                                String(charCount),
                            )}
                        </div>
                    </div>
                    <div className="form-actions">
                        <Button
                            variant="secondary"
                            type="button"
                            data-testid="rating-cancel"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            variant="default"
                            type="submit"
                            data-testid="rating-submit"
                            disabled={submitting}
                        >
                            {t("session.rating_submit", "Submit rating")}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface RatingRowProps {
    labelKey: string;
    fallback: string;
    testid: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}

function RatingRow({
    labelKey,
    fallback,
    testid,
    value,
    onChange,
    disabled,
}: RatingRowProps) {
    const {t} = useI18n();
    const tooltipsOn = useButtonTooltips();
    const groupRef = useRef<HTMLDivElement | null>(null);
    // Rating buttons display just a number (1-5) so the
    // visible text is ambiguous; every button needs an
    // explicit aria-label + tooltip describing its tier.
    // The tiers map: 1-2 -> low, 3 -> medium, 4-5 -> high.
    const tierKey = (n: number): "rating_low" | "rating_medium" | "rating_high" =>
        n <= 2 ? "rating_low" : n === 3 ? "rating_medium" : "rating_high";

    // WAI-ARIA Radio Group keyboard pattern (SC 2.1.1
    // Keyboard). Arrow keys move between options AND update
    // the value; Home/End jump to first/last; the active
    // option is the only tab stop (roving tabindex) so Tab
    // exits the group rather than walking through five
    // buttons.
    function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
        if (disabled) return;
        let next: number;
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                next = value >= 5 ? 1 : value + 1;
                break;
            case "ArrowLeft":
            case "ArrowUp":
                next = value <= 1 ? 5 : value - 1;
                break;
            case "Home":
                next = 1;
                break;
            case "End":
                next = 5;
                break;
            default:
                return;
        }
        e.preventDefault();
        onChange(next);
        const node = groupRef.current?.querySelector<HTMLButtonElement>(
            `[data-testid="${testid}-${next}"]`,
        );
        node?.focus();
    }

    return (
        <div className="rating-row" data-testid={testid}>
            <span className="form-label rating-row-label">
                {t(labelKey, fallback)}{" "}
                <span className="rating-value" data-testid={`${testid}-value`}>
                    {value} / 5
                </span>
            </span>
            <div
                className="rating-buttons"
                role="radiogroup"
                aria-label={t(labelKey, fallback)}
                ref={groupRef}
                onKeyDown={handleKeyDown}
            >
                {[1, 2, 3, 4, 5].map((n) => {
                    const tierLabel = t(
                        `ui.tooltips.${tierKey(n)}`,
                        n <= 2 ? "Low" : n === 3 ? "Medium" : "High",
                    ).replace("{n}", String(n));
                    const checked = value === n;
                    return (
                        <button
                            type="button"
                            key={n}
                            role="radio"
                            aria-checked={checked}
                            aria-label={tierLabel}
                            tabIndex={checked ? 0 : -1}
                            title={tooltipsOn ? tierLabel : undefined}
                            disabled={disabled}
                            data-testid={`${testid}-${n}`}
                            className={`rating-button${checked ? " is-active" : ""}`}
                            onClick={() => onChange(n)}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
