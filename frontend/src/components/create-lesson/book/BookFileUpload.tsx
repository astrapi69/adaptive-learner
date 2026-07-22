/**
 * BookFileUpload — file upload + section picker for the book-text wizard
 * path (#1927).
 *
 * Augments (never replaces) the paste textarea: the user picks an EPUB /
 * TXT / Markdown file, it is parsed CLIENT-SIDE ({@link parseBookFile} —
 * jszip + native DOMParser, no server roundtrip), and the detected
 * chapters appear in an inline picker. Applying a section fills the
 * existing text field via ``onApply``; a non-empty field asks for
 * confirmation first (the wizard is "one section per run", so apply
 * replaces). The parsed book lives only in component state — never in
 * IndexedDB or the draft autosave.
 *
 * The chapter list is a NATIVE ``<select>`` on purpose: portal-based
 * Radix selects are brittle under happy-dom (see lessons-learned on
 * Radix + Vitest), and a spine can carry 100+ entries — the native
 * control stays keyboard-accessible and trivially testable.
 *
 * Presentational + props-driven; the parser is injected for tests
 * (mirrors {@link BookTextStep}'s engine seams).
 */

import {useMemo, useRef, useState} from "react";
import {FileUp} from "lucide-react";

import {Button} from "@/components/ui/button";
import FormHint from "../../../shared/forms/FormHint";
import ConfirmDialog from "../../../shared/feedback/ConfirmDialog";
import {
    ACCEPTED_BOOK_EXTENSIONS,
    MAX_BOOK_FILE_SIZE,
    MAX_SECTION_CHARS,
    SOFT_SECTION_CHARS,
    parseBookFile as defaultParse,
} from "../../../lib/content/book-upload";
import type {
    BookParseErrorCode,
    ParsedBook,
} from "../../../lib/content/book-upload";

type Translate = (key: string, fallback?: string) => string;

/** Length of the section preview shown under the picker. */
const PREVIEW_CHARS = 200;

interface BookFileUploadProps {
    /** Current textarea content — a non-empty value asks before replacing. */
    currentText: string;
    /** Receives the chosen section's text (replaces the field). */
    onApply: (text: string) => void;
    t: Translate;
    /** Test seam; defaults to the real dispatcher. */
    parse?: typeof defaultParse;
}

function errorMessage(
    t: Translate,
    code: BookParseErrorCode,
    detail?: string,
): string {
    const maxMiB = String(Math.round(MAX_BOOK_FILE_SIZE / (1024 * 1024)));
    const messages: Record<BookParseErrorCode, string> = {
        file_too_large: t(
            "create_lesson.book.upload.err_too_large",
            "File too large (max {n} MiB).",
        ).replace("{n}", maxMiB),
        unsupported_format: t(
            "create_lesson.book.upload.err_unsupported",
            "Unsupported file type. Supported: EPUB, TXT, Markdown.",
        ),
        invalid_epub: t(
            "create_lesson.book.upload.err_invalid_epub",
            "This file could not be read as an EPUB.",
        ),
        no_sections: t(
            "create_lesson.book.upload.err_no_sections",
            "No text sections were found in this file.",
        ),
        parse_failed: t(
            "create_lesson.book.upload.err_parse_failed",
            "Reading the file failed.",
        ),
    };
    const base = messages[code];
    return detail ? `${base} (${detail})` : base;
}

/** Upload button + inline section picker feeding the book textarea. */
export default function BookFileUpload({
    currentText,
    onApply,
    t,
    parse = defaultParse,
}: BookFileUploadProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [book, setBook] = useState<ParsedBook | null>(null);
    const [selectedId, setSelectedId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const selected = useMemo(
        () => book?.sections.find((section) => section.id === selectedId) ?? null,
        [book, selectedId],
    );

    async function handleFile(file: File | undefined) {
        if (!file || busy) return;
        setBusy(true);
        setError(null);
        try {
            const result = await parse(file, {
                fallbackSectionLabel: t(
                    "create_lesson.book.upload.section_fallback",
                    "Section {n}",
                ),
            });
            if (!result.ok) {
                setBook(null);
                setError(errorMessage(t, result.error, result.detail));
                return;
            }
            setBook(result.book);
            setSelectedId(result.book.sections[0].id);
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    function applySelected() {
        if (!selected) return;
        if (selected.charCount > MAX_SECTION_CHARS) {
            setError(
                t(
                    "create_lesson.book.upload.err_section_too_long",
                    "Section too long (max {n} characters). Pick a smaller section.",
                ).replace("{n}", String(MAX_SECTION_CHARS)),
            );
            return;
        }
        setError(null);
        if (currentText.trim() !== "") {
            setConfirmOpen(true);
            return;
        }
        onApply(selected.text);
    }

    return (
        <div
            className="flex flex-col gap-3"
            data-testid="book-file-upload"
        >
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    data-testid="book-upload-button"
                >
                    {busy ? (
                        <span
                            className="btn-spinner"
                            data-testid="book-upload-spinner"
                            aria-hidden="true"
                        />
                    ) : (
                        <FileUp size={16} aria-hidden="true" className="mr-1" />
                    )}
                    {busy
                        ? t("create_lesson.book.upload.parsing", "Reading file…")
                        : t(
                              "create_lesson.book.upload.button",
                              "Load from file (EPUB, TXT, MD)",
                          )}
                </Button>
                <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_BOOK_EXTENSIONS.join(",")}
                    className="hidden"
                    data-testid="book-upload-input"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                />
            </div>

            {error && (
                <FormHint
                    variant="warning"
                    data-testid="book-upload-error"
                    role="alert"
                >
                    {error}
                </FormHint>
            )}

            {book && (
                <div
                    className="flex flex-col gap-2 rounded-lg border border-border p-3"
                    data-testid="book-upload-picker"
                >
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-fg-primary">
                            {t(
                                "create_lesson.book.upload.section_label",
                                "Detected sections",
                            )}
                        </span>
                        <select
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={selectedId}
                            data-testid="book-upload-section-select"
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            {book.sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    {`${section.title} (${section.charCount})`}
                                </option>
                            ))}
                        </select>
                    </label>
                    {selected && (
                        <p
                            className="text-xs text-fg-muted"
                            data-testid="book-upload-preview"
                        >
                            {selected.text.slice(0, PREVIEW_CHARS)}
                            {selected.charCount > PREVIEW_CHARS ? "…" : ""}
                        </p>
                    )}
                    {selected && selected.charCount > SOFT_SECTION_CHARS && (
                        <FormHint
                            variant="warning"
                            data-testid="book-upload-soft-hint"
                        >
                            {t(
                                "create_lesson.book.upload.soft_hint",
                                "Long section — shorter sections give better results.",
                            )}
                        </FormHint>
                    )}
                    <div>
                        <Button
                            type="button"
                            disabled={!selected}
                            onClick={applySelected}
                            data-testid="book-upload-apply"
                        >
                            {t(
                                "create_lesson.book.upload.apply",
                                "Insert into text field",
                            )}
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirmOpen}
                title={t(
                    "create_lesson.book.upload.replace_title",
                    "Replace text?",
                )}
                message={t(
                    "create_lesson.book.upload.replace_message",
                    "The text field already has content. Replace it with the selected section?",
                )}
                confirmLabel={t(
                    "create_lesson.book.upload.replace_confirm",
                    "Replace",
                )}
                cancelLabel={t("ui.cancel", "Cancel")}
                testId="book-upload-replace-confirm"
                onConfirm={() => {
                    setConfirmOpen(false);
                    if (selected) onApply(selected.text);
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
