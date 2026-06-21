/**
 * Anki deck export — render content cards as an Anki-importable
 * tab-separated text file (``.txt``).
 *
 * Library-First: the Anki "Basic" note import format is plain TSV with
 * optional ``#`` header directives — no SQLite/ZIP needed (that is the
 * separate ``.apkg`` path in ``lib/anki``, used by the AI-extracted-
 * flashcards workflow). This module is pure + dependency-free;
 * ``downloadAnkiDeck`` is the only DOM seam (it reuses ``downloadBlob``).
 *
 * @example
 * downloadAnkiDeck(lessonCardsToAnki(lesson.cards), lesson.title);
 */

import {downloadBlob} from "../lesson/result-download";
import type {ContentLessonCard} from "../../storage/types/content/content";

/** Minimal front/back/tags shape — all an Anki Basic note needs. */
export interface AnkiExportCard {
    front: string;
    back: string;
    tags?: string[];
}

/** UTF-8 byte-order mark — Anki's convention for non-Latin text files. */
const BOM = "\uFEFF";

/**
 * Anki breaks a ROW on a literal tab and a FIELD on a newline; it
 * renders HTML, so newlines become ``<br>`` and tabs collapse to a
 * space. Keeps every card on exactly one TSV line.
 */
function sanitizeField(value: string): string {
    return value
        .replace(/\r\n?|\n/g, "<br>")
        .replace(/\t/g, " ")
        .trim();
}

/** An Anki tag may not contain whitespace; join words with ``_``. */
function sanitizeTag(tag: string): string {
    return tag.trim().replace(/\s+/g, "_");
}

/**
 * Map content-set cards to the export shape, preferring ``back`` and
 * falling back to a code snippet / expected output for technical cards
 * that carry their answer in ``code_snippet`` rather than ``back``.
 */
export function lessonCardsToAnki(
    cards: readonly ContentLessonCard[],
): AnkiExportCard[] {
    return cards.map((card) => ({
        front: card.front ?? "",
        back: card.back || card.code_snippet || card.expected_output || "",
        tags: card.tags ?? [],
    }));
}

export interface AnkiTsvOptions {
    /** Deck-level tags prepended to every card's tag column. */
    deckTags?: readonly string[];
    /** Emit the ``#`` header directives (default ``true``). */
    header?: boolean;
}

/**
 * Render cards as Anki-importable TSV. Cards with no front AND no back
 * are skipped. The result starts with a UTF-8 BOM so accented /
 * non-Latin text imports correctly.
 */
export function cardsToAnkiTsv(
    cards: readonly AnkiExportCard[],
    options: AnkiTsvOptions = {},
): string {
    const {deckTags = [], header = true} = options;
    const lines: string[] = [];
    if (header) {
        lines.push("#separator:tab", "#html:true", "#tags column:3");
    }
    for (const card of cards) {
        const front = sanitizeField(card.front ?? "");
        const back = sanitizeField(card.back ?? "");
        if (!front && !back) continue;
        const tags = [...deckTags, ...(card.tags ?? [])]
            .map(sanitizeTag)
            .filter(Boolean)
            .join(" ");
        lines.push([front, back, tags].join("\t"));
    }
    return BOM + lines.join("\n") + "\n";
}

/** Slugify a title into a safe ``{slug}-anki.txt`` filename. */
export function ankiFilename(title: string): string {
    const slug =
        title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "deck";
    return `${slug}-anki.txt`;
}

/** Build + trigger a browser download of the Anki deck. */
export function downloadAnkiDeck(
    cards: readonly AnkiExportCard[],
    title: string,
    options?: AnkiTsvOptions,
): void {
    const tsv = cardsToAnkiTsv(cards, options);
    downloadBlob(tsv, ankiFilename(title), "text/plain;charset=utf-8");
}
