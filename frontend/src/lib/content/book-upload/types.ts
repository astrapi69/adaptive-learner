/**
 * #1927 — shared types for the Create-Lesson book file upload.
 *
 * Library-grade: no app imports; consumed by the format parsers
 * (epub/text, later docx) and the BookFileUpload UI.
 */

/** One selectable chapter/section extracted from an uploaded book. */
export interface BookSection {
    /** Stable id within the parsed book (spine order / split index). */
    id: string;
    /** Human-readable title shown in the section picker. */
    title: string;
    /** Plain text of the section (block-separated by blank lines). */
    text: string;
    /** ``text.length`` — precomputed for the picker label. */
    charCount: number;
}

/** Source format a book was parsed from. */
export type BookFormat = "epub" | "text";

/** A successfully parsed book: ordered, non-empty sections. */
export interface ParsedBook {
    format: BookFormat;
    sections: BookSection[];
}

/**
 * Machine-readable parse failure reasons; the UI maps each code to a
 * translated, actionable message (never a generic "failed").
 */
export type BookParseErrorCode =
    | "file_too_large"
    | "unsupported_format"
    | "invalid_epub"
    | "no_sections"
    | "parse_failed";

/** Discriminated parse outcome (mirrors ``lesson-import.ts``'s shape). */
export type ParseBookResult =
    | {ok: true; book: ParsedBook}
    | {ok: false; error: BookParseErrorCode; detail?: string};

/** Options shared by the parsers. */
export interface BookParseOptions {
    /**
     * Label template for a section without a detectable title;
     * ``{n}`` is replaced with the 1-based section number. The caller
     * passes a translated template (default: ``"Section {n}"``).
     */
    fallbackSectionLabel?: string;
}

/** Resolve the fallback label template for section ``n`` (1-based). */
export function fallbackLabel(
    options: BookParseOptions | undefined,
    n: number,
): string {
    const template = options?.fallbackSectionLabel ?? "Section {n}";
    return template.replace("{n}", String(n));
}
