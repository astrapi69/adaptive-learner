/**
 * #1927 phase 2b — client-side DOCX parser for the Create-Lesson upload.
 *
 * Zero new dependencies: a DOCX is a ZIP (jszip, already shipped) of XML
 * (native ``DOMParser``). Heading detection deliberately does NOT match
 * English style names (the mammoth.js weakness rejected in the Phase-1
 * design): the primary signal is the locale-independent ``w:outlineLvl``
 * — read from ``word/styles.xml`` per styleId and from a paragraph's own
 * ``w:pPr`` — with a styleId-regex fallback for common localized
 * built-in ids (``Heading1`` / ``berschrift1`` / ``Titre1`` /
 * ``Ttulo1``, umlauts and accents stripped by Word itself).
 *
 * Sections split adaptively at the shallowest heading level that yields
 * at least two sections (mirrors ``text-parser.ts``); a document without
 * detectable headings degrades to ONE whole-document section — the text
 * still lands editable in the wizard's textarea. The split works on
 * OOXML paragraph nodes rather than text lines, so it is implemented
 * here instead of sharing the line-slice-exact splitter of the
 * Markdown parser.
 *
 * Library-grade: no app imports; never throws — every failure returns a
 * machine-readable {@link ParseBookResult} error code.
 */

import JSZip from "jszip";

import {
    fallbackLabel,
    type BookParseOptions,
    type BookSection,
    type ParseBookResult,
} from "./types";

/** Localized built-in heading styleIds Word emits (accents stripped). */
const HEADING_STYLE_ID = /^(?:heading|berschrift|titre|ttulo|titulo)(\d)$/i;

/** One extracted document paragraph with its detected heading level. */
interface DocxParagraph {
    text: string;
    /** 1-based heading level, or ``null`` for body text. */
    headingLevel: number | null;
}

function parseXml(source: string): Document {
    return new DOMParser().parseFromString(source, "text/xml");
}

/** Read ``w:styleId -> outlineLvl`` (0-based) from word/styles.xml. */
function readStyleOutlineLevels(stylesXml: string | null): Map<string, number> {
    const levels = new Map<string, number>();
    if (!stylesXml) return levels;
    for (const style of Array.from(
        parseXml(stylesXml).getElementsByTagName("w:style"),
    )) {
        const styleId = style.getAttribute("w:styleId");
        const outline = style
            .getElementsByTagName("w:outlineLvl")[0]
            ?.getAttribute("w:val");
        if (styleId && outline !== null && outline !== undefined) {
            const level = Number.parseInt(outline, 10);
            if (Number.isFinite(level)) levels.set(styleId, level);
        }
    }
    return levels;
}

/** Concatenate a paragraph's run text (``w:t``; ``w:br``/``w:cr`` ->
 *  newline, ``w:tab`` -> space). */
function paragraphText(paragraph: Element): string {
    const parts: string[] = [];
    const walk = (node: Node): void => {
        if (node.nodeType !== 1) return;
        const tag = (node as Element).tagName;
        if (tag === "w:t") {
            parts.push(node.textContent ?? "");
            return;
        }
        if (tag === "w:br" || tag === "w:cr") {
            parts.push("\n");
            return;
        }
        if (tag === "w:tab") {
            parts.push(" ");
            return;
        }
        for (const child of Array.from(node.childNodes)) walk(child);
    };
    walk(paragraph);
    return parts.join("").replace(/[ \t]+/g, " ").trim();
}

/** Detect a paragraph's 1-based heading level (direct ``w:outlineLvl``,
 *  styles.xml lookup, then the localized styleId regex). */
function headingLevelOf(
    paragraph: Element,
    styleLevels: Map<string, number>,
): number | null {
    const pPr = paragraph.getElementsByTagName("w:pPr")[0];
    if (!pPr) return null;
    const direct = pPr
        .getElementsByTagName("w:outlineLvl")[0]
        ?.getAttribute("w:val");
    if (direct !== null && direct !== undefined) {
        const level = Number.parseInt(direct, 10);
        if (Number.isFinite(level)) return level + 1;
    }
    const styleId = pPr
        .getElementsByTagName("w:pStyle")[0]
        ?.getAttribute("w:val");
    if (!styleId) return null;
    const styled = styleLevels.get(styleId);
    if (styled !== undefined) return styled + 1;
    const match = HEADING_STYLE_ID.exec(styleId);
    return match ? Number.parseInt(match[1], 10) : null;
}

/** Extract the document's non-empty paragraphs with heading levels. */
function readParagraphs(
    documentXml: string,
    styleLevels: Map<string, number>,
): DocxParagraph[] {
    const paragraphs: DocxParagraph[] = [];
    for (const node of Array.from(
        parseXml(documentXml).getElementsByTagName("w:p"),
    )) {
        const text = paragraphText(node);
        if (text === "") continue;
        paragraphs.push({text, headingLevel: headingLevelOf(node, styleLevels)});
    }
    return paragraphs;
}

/** Shallowest heading level whose cut points yield >= 2 sections. */
function pickSplitLevel(paragraphs: DocxParagraph[]): number | null {
    const levels = paragraphs
        .map((p) => p.headingLevel)
        .filter((level): level is number => level !== null);
    if (levels.length === 0) return null;
    for (let level = 1; level <= 9; level += 1) {
        if (levels.filter((l) => l <= level).length >= 2) return level;
    }
    return Math.min(...levels);
}

function toSection(
    paragraphs: DocxParagraph[],
    title: string,
    id: number,
): BookSection {
    const text = paragraphs.map((p) => p.text).join("\n\n");
    return {id: `section-${id}`, title, text, charCount: text.length};
}

/** Split the paragraph stream at the adaptive heading level. */
function splitIntoSections(
    paragraphs: DocxParagraph[],
    options?: BookParseOptions,
): BookSection[] {
    const level = pickSplitLevel(paragraphs);
    const isCut = (p: DocxParagraph) =>
        level !== null && p.headingLevel !== null && p.headingLevel <= level;
    const cutCount = paragraphs.filter(isCut).length;
    if (cutCount < 2) {
        const title =
            paragraphs.find(isCut)?.text ?? fallbackLabel(options, 1);
        return [toSection(paragraphs, title, 1)];
    }
    const sections: BookSection[] = [];
    let current: DocxParagraph[] = [];
    let currentTitle: string | null = null;
    const flush = () => {
        if (current.length === 0) return;
        sections.push(
            toSection(
                current,
                currentTitle ?? fallbackLabel(options, sections.length + 1),
                sections.length + 1,
            ),
        );
    };
    for (const paragraph of paragraphs) {
        if (isCut(paragraph)) {
            flush();
            current = [paragraph];
            currentTitle = paragraph.text;
        } else {
            current.push(paragraph);
        }
    }
    flush();
    return sections;
}

/**
 * Parse a DOCX file's bytes into selectable chapter sections.
 *
 * @param data - The raw ``.docx`` bytes.
 * @param options - Translated fallback-label template.
 * @returns Document-ordered sections; ``invalid_docx`` when the OOXML
 *          container is broken, ``no_sections`` when no paragraph
 *          carries text. Never throws.
 */
export async function parseDocx(
    data: ArrayBuffer,
    options?: BookParseOptions,
): Promise<ParseBookResult> {
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(data);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {ok: false, error: "invalid_docx", detail};
    }
    try {
        const documentXml = await zip.file("word/document.xml")?.async("string");
        if (!documentXml) {
            return {
                ok: false,
                error: "invalid_docx",
                detail: "word/document.xml missing",
            };
        }
        const stylesXml =
            (await zip.file("word/styles.xml")?.async("string")) ?? null;
        const paragraphs = readParagraphs(
            documentXml,
            readStyleOutlineLevels(stylesXml),
        );
        if (paragraphs.length === 0) {
            return {ok: false, error: "no_sections"};
        }
        return {
            ok: true,
            book: {format: "docx", sections: splitIntoSections(paragraphs, options)},
        };
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return {ok: false, error: "parse_failed", detail};
    }
}
