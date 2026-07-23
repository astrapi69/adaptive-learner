/**
 * #1949 — exclusion heuristic for the book-file section picker.
 *
 * When a whole book is parsed into sections, most files carry front- and
 * back-matter (preface, glossary, table of contents, imprint, index, …)
 * that is not learning content. This module recognises those titles so the
 * multi-select picker can DESELECT them by default — a pre-selection aid,
 * never a hard rule: every section stays visible and the user can override.
 *
 * Library-grade: no app imports; pure string predicate. The pattern list is
 * deliberately multilingual (DE / EN / FR) and matched conservatively — a
 * title only matches when it STARTS with a known keyword, so a real chapter
 * that merely mentions "index" or "appendix" mid-title is kept as content.
 */

import type {BookSection} from "./types";

/**
 * Front/back-matter keyword patterns, anchored at the (numbering-stripped)
 * start of a lowercased title. Kept tight on purpose — "Einleitung" /
 * "Introduction" are real content and intentionally absent.
 */
const NON_CONTENT_PATTERNS: RegExp[] = [
    // German
    /^vorwort/,
    /^geleitwort/,
    /^vorbemerkung/,
    /^nachwort/,
    /^widmung/,
    /^danksagung/,
    /^inhaltsverzeichnis/,
    /^inhalt$/,
    /^glossar/,
    /^impressum/,
    /^ue?ber (den|die) autor/,
    /^ue?ber (den|die) verfasser/,
    /^anhang/,
    /^stichwortverzeichnis/,
    /^literaturverzeichnis/,
    /^quellenverzeichnis/,
    /^abbildungsverzeichnis/,
    /^register$/,
    /^urheberrecht/,
    // English
    /^foreword/,
    /^preface/,
    /^afterword/,
    /^acknowledge?ments?$/,
    /^acknowledgements?$/,
    /^table of contents/,
    /^contents$/,
    /^glossary/,
    /^imprint/,
    /^colophon/,
    /^about the authors?/,
    /^appendix/,
    /^index$/,
    /^bibliography/,
    /^references$/,
    /^further reading/,
    /^dedication/,
    /^copyright/,
    // French
    /^preface/,
    /^avant-propos/,
    /^remerciements/,
    /^glossaire/,
    /^table des matieres/,
    /^annexe/,
    /^bibliographie/,
    /^a propos de l/,
];

/** Leading punctuation / separators (em/en dash, dot, colon, …). */
const LEADING_JUNK = /^[\s.):\-—–]+/;
/**
 * A leading numbering TOKEN followed by a separator: an arabic run or a
 * roman-numeral run, then at least one separator. Requiring the trailing
 * separator is what keeps this from eating the leading letters of real
 * words ("Vorwort", "Index" start with roman-numeral letters).
 */
const LEADING_NUMBER = /^(\d+|[ivxlcdm]+)[.):\-—–\s]+/;

/**
 * Normalise a title for matching: trim, lowercase, fold German umlauts +
 * common accents to their ASCII base (so "Über"/"Uber" and "Préface"/
 * "Preface" both match a single pattern), then drop any leading
 * separators + one numbering token.
 */
function normalizeTitle(title: string): string {
    const folded = title
        .trim()
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    return folded
        .replace(LEADING_JUNK, "")
        .replace(LEADING_NUMBER, "")
        .replace(LEADING_JUNK, "");
}

/**
 * Return ``true`` when a section title looks like non-learning front/back
 * matter (preface, glossary, table of contents, imprint, index, …).
 */
export function isLikelyNonContentSection(title: string): boolean {
    const normalized = normalizeTitle(title);
    if (normalized === "") return false;
    return NON_CONTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * The default checkbox selection for a parsed book: every content section,
 * with the heuristic front/back-matter sections deselected. Order follows
 * the input (document order). May be empty if every section is excluded —
 * the caller keeps all sections visible and manually selectable.
 */
export function defaultSelectedSectionIds(sections: BookSection[]): string[] {
    return sections
        .filter((section) => !isLikelyNonContentSection(section.title))
        .map((section) => section.id);
}
