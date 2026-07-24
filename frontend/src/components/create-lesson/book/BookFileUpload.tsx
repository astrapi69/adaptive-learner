/**
 * BookFileUpload — file upload + section picker for the book-text wizard
 * path (#1927, multi-select + batch #1949).
 *
 * Augments (never replaces) the paste textarea: the user picks an EPUB /
 * TXT / Markdown file, it is parsed CLIENT-SIDE ({@link parseBookFile} —
 * jszip + native DOMParser, no server roundtrip), and the detected
 * chapters appear in an inline CHECKBOX list (#1949, previously a single
 * ``<select>``). An exclusion heuristic ({@link defaultSelectedSectionIds})
 * deselects likely front/back matter (preface, glossary, index, …) by
 * default while keeping every section visible and checkable.
 *
 * Two apply modes, chosen by the selection count:
 *   - Exactly one section selected -> "Insert into text field": fills the
 *     existing textarea via ``onApply`` (the #1927 single path, unchanged;
 *     a non-empty field asks for confirmation first).
 *   - More than one -> "Generate N lessons": hands the selected sections
 *     (in DOCUMENT order) up via ``onGenerateSections`` for batch
 *     generation — one standalone lesson per section.
 *
 * The parsed book lives only in component state — never in IndexedDB or the
 * draft autosave. Checkboxes stay native on purpose (portal-based Radix is
 * brittle under happy-dom; a spine can carry 100+ entries) — keyboard-
 * accessible and trivially testable.
 *
 * Presentational + props-driven; the parser is injected for tests.
 */

import {useMemo, useRef, useState} from "react";
import {FileUp, Sparkles} from "lucide-react";

import {Button} from "@/components/ui/button";
import FormHint from "../../../shared/forms/FormHint";
import ConfirmDialog from "../../../shared/feedback/ConfirmDialog";
import {
    ACCEPTED_BOOK_EXTENSIONS,
    MAX_BOOK_FILE_SIZE,
    MAX_SECTION_CHARS,
    SOFT_SECTION_CHARS,
    defaultSelectedSectionIds,
    isLikelyNonContentSection,
    parseBookFile as defaultParse,
} from "../../../lib/content/book-upload";
import type {
    BookParseErrorCode,
    BookSection,
    ParsedBook,
} from "../../../lib/content/book-upload";
import type {BatchSectionInput} from "../../../lib/ai/generation/generate-book-lessons";

type Translate = (key: string, fallback?: string) => string;

/** Length of the section preview shown under the picker (single select). */
const PREVIEW_CHARS = 200;

interface BookFileUploadProps {
    /** Current textarea content — a non-empty value asks before replacing. */
    currentText: string;
    /** Receives the chosen section's text (single-select path; replaces the
     *  field). */
    onApply: (text: string) => void;
    /** Receives the selected sections in document order for batch
     *  generation (multi-select path). */
    onGenerateSections: (sections: BatchSectionInput[]) => void;
    /** True while a batch generation is running (disables the button). */
    generating?: boolean;
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
            "Unsupported file type. Supported: EPUB, DOCX, TXT, Markdown.",
        ),
        invalid_epub: t(
            "create_lesson.book.upload.err_invalid_epub",
            "This file could not be read as an EPUB.",
        ),
        invalid_docx: t(
            "create_lesson.book.upload.err_invalid_docx",
            "This file could not be read as a DOCX.",
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

/** Upload button + inline multi-select section picker feeding the book
 *  textarea (single) or the batch generator (multi). */
export default function BookFileUpload({
    currentText,
    onApply,
    onGenerateSections,
    generating = false,
    t,
    parse = defaultParse,
}: BookFileUploadProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [book, setBook] = useState<ParsedBook | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    /** Sections in DOCUMENT order that are currently checked. */
    const selectedSections = useMemo<BookSection[]>(
        () =>
            book ? book.sections.filter((s) => selectedIds.has(s.id)) : [],
        [book, selectedIds],
    );

    /** How many sections the heuristic deselected by default. */
    const excludedCount = useMemo(
        () =>
            book
                ? book.sections.filter((s) => isLikelyNonContentSection(s.title))
                      .length
                : 0,
        [book],
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
                setSelectedIds(new Set());
                setError(errorMessage(t, result.error, result.detail));
                return;
            }
            setBook(result.book);
            setSelectedIds(new Set(defaultSelectedSectionIds(result.book.sections)));
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    function toggle(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    /** Single-select apply: fill the textarea (the #1927 path). */
    function applySingle(section: BookSection) {
        if (section.charCount > MAX_SECTION_CHARS) {
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
        onApply(section.text);
    }

    function handleAction() {
        if (selectedSections.length === 0) return;
        if (selectedSections.length === 1) {
            applySingle(selectedSections[0]);
            return;
        }
        onGenerateSections(
            selectedSections.map((s) => ({title: s.title, text: s.text})),
        );
    }

    const single = selectedSections.length === 1;
    const previewSection = single ? selectedSections[0] : null;

    return (
        <div className="flex flex-col gap-3" data-testid="book-file-upload">
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
                              "Load from file (EPUB, DOCX, TXT, MD)",
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
                    <span className="text-sm font-medium text-fg-primary">
                        {t(
                            "create_lesson.book.upload.section_label",
                            "Detected sections",
                        )}
                    </span>
                    {excludedCount > 0 && (
                        <p
                            className="text-xs text-fg-muted"
                            data-testid="book-upload-exclude-hint"
                        >
                            {t(
                                "create_lesson.book.upload.exclude_hint",
                                "Sections that look like front or back matter (preface, glossary, index, …) are unchecked by default. Check them to include them.",
                            )}
                        </p>
                    )}
                    <ul
                        className="flex max-h-64 flex-col gap-1 overflow-y-auto"
                        data-testid="book-upload-section-list"
                    >
                        {book.sections.map((section) => (
                            <li key={section.id}>
                                <label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-fg-primary hover:bg-muted">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 shrink-0 accent-accent"
                                        checked={selectedIds.has(section.id)}
                                        onChange={() => toggle(section.id)}
                                        data-testid={`book-upload-section-checkbox-${section.id}`}
                                    />
                                    <span className="truncate">
                                        {section.title}
                                    </span>
                                    <span className="ml-auto shrink-0 text-xs text-fg-muted">
                                        {section.charCount}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>

                    {previewSection && (
                        <p
                            className="text-xs text-fg-muted"
                            data-testid="book-upload-preview"
                        >
                            {previewSection.text.slice(0, PREVIEW_CHARS)}
                            {previewSection.charCount > PREVIEW_CHARS ? "…" : ""}
                        </p>
                    )}
                    {previewSection &&
                        previewSection.charCount > SOFT_SECTION_CHARS && (
                            <FormHint
                                variant="warning"
                                data-testid="book-upload-soft-hint"
                            >
                                {t(
                                    "create_lesson.book.upload.soft_hint",
                                    "Long section - shorter sections give better results.",
                                )}
                            </FormHint>
                        )}

                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            disabled={selectedSections.length === 0 || generating}
                            onClick={handleAction}
                            data-testid="book-upload-apply"
                        >
                            {!single && (
                                <Sparkles
                                    size={16}
                                    aria-hidden="true"
                                    className="mr-1"
                                />
                            )}
                            {single
                                ? t(
                                      "create_lesson.book.upload.apply",
                                      "Insert into text field",
                                  )
                                : t(
                                      "create_lesson.book.upload.generate_n",
                                      "Generate {n} lessons",
                                  ).replace(
                                      "{n}",
                                      String(selectedSections.length),
                                  )}
                        </Button>
                        <span
                            className="text-xs text-fg-muted"
                            data-testid="book-upload-selected-count"
                        >
                            {t(
                                "create_lesson.book.upload.selected_count",
                                "{n} selected",
                            ).replace("{n}", String(selectedSections.length))}
                        </span>
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
                    if (single) onApply(selectedSections[0].text);
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
