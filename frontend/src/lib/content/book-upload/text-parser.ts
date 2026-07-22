/**
 * #1927 — TXT/Markdown book parser for the Create-Lesson upload.
 *
 * Splits Markdown at ATX headings (``#`` .. ``######``) using the
 * adaptive rule agreed in the Phase-1 design: the shallowest heading
 * level whose cut points yield at least two sections wins; when no level
 * does (or the file is plain text), the whole input becomes one section.
 * Setext headings (``===`` underlines) are deliberately out of scope.
 *
 * Library-grade: no app imports; labels arrive translated via
 * {@link BookParseOptions.fallbackSectionLabel}.
 */

import {
    fallbackLabel,
    type BookParseOptions,
    type BookSection,
    type ParseBookResult,
} from "./types";

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

interface HeadingLine {
    index: number;
    level: number;
    title: string;
}

/** Collect every ATX heading with its line index and level. */
function findHeadings(lines: string[]): HeadingLine[] {
    const headings: HeadingLine[] = [];
    let inFence = false;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        const match = ATX_HEADING.exec(line);
        if (match) {
            headings.push({
                index,
                level: match[1].length,
                title: match[2].trim(),
            });
        }
    }
    return headings;
}

/** Pick the shallowest level whose headings yield >= 2 cut points. */
function pickSplitLevel(headings: HeadingLine[]): number | null {
    for (let level = 1; level <= 6; level += 1) {
        if (headings.filter((h) => h.level <= level).length >= 2) {
            return level;
        }
    }
    return headings.length > 0 ? headings[0].level : null;
}

function toSection(
    lines: string[],
    from: number,
    to: number,
    title: string,
    id: number,
): BookSection | null {
    const text = lines.slice(from, to).join("\n").trim();
    if (text === "") return null;
    return {id: `section-${id}`, title, text, charCount: text.length};
}

/**
 * Parse pasted-file text (``.txt`` / ``.md``) into selectable sections.
 *
 * @param raw - The file's full text content.
 * @param options - Translated fallback-label template.
 * @returns Sections in document order, or ``no_sections`` for
 *          whitespace-only input. Never throws.
 */
export function parseTextOrMarkdown(
    raw: string,
    options?: BookParseOptions,
): ParseBookResult {
    if (raw.trim() === "") {
        return {ok: false, error: "no_sections"};
    }
    const lines = raw.split(/\r\n?|\n/);
    const headings = findHeadings(lines);
    const level = pickSplitLevel(headings);
    const cuts = level === null ? [] : headings.filter((h) => h.level <= level);

    if (cuts.length < 2) {
        const text = raw.trim();
        const title = cuts[0]?.title ?? fallbackLabel(options, 1);
        return {
            ok: true,
            book: {
                format: "text",
                sections: [
                    {id: "section-1", title, text, charCount: text.length},
                ],
            },
        };
    }

    const sections: BookSection[] = [];
    const preamble = toSection(
        lines,
        0,
        cuts[0].index,
        fallbackLabel(options, 1),
        sections.length + 1,
    );
    if (preamble) sections.push(preamble);
    for (let i = 0; i < cuts.length; i += 1) {
        const end = i + 1 < cuts.length ? cuts[i + 1].index : lines.length;
        const section = toSection(
            lines,
            cuts[i].index,
            end,
            cuts[i].title,
            sections.length + 1,
        );
        if (section) sections.push(section);
    }
    if (sections.length === 0) {
        return {ok: false, error: "no_sections"};
    }
    return {ok: true, book: {format: "text", sections}};
}
