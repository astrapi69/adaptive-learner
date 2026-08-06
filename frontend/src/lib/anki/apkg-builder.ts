/**
 * .apkg builder (Phase 30A / v1.17.0).
 *
 * Builds an Anki-compatible ``.apkg`` package CLIENT-SIDE using
 * sql.js (SQLite-WASM) + JSZip. All dependencies are loaded via
 * dynamic ``import()`` so the ~1 MB WASM + JSZip aren't paid
 * for until the user clicks "Export as .apkg".
 *
 * The .apkg format is documented here:
 *   https://github.com/ankidroid/Anki-Android/wiki/Database-Structure
 *   https://github.com/ankitects/anki/blob/main/docs/sync.md
 *
 * Format summary:
 *   .apkg = ZIP with:
 *     - ``collection.anki2``  : SQLite DB (the schema from
 *                               ``apkg-schema.ts``)
 *     - ``media``             : JSON manifest (``{"0": "img.png"}``);
 *                               always ``{}`` for our deck (no media)
 *
 * Card type semantics:
 *   - ``basic``  → one note (Front + Back) → one card
 *   - ``cloze``  → one note (Text + Extra) → N cards (one per
 *                  ``{{cN::...}}`` in Text)
 */

import type {Database as SqlJsDatabase, SqlJsStatic} from "sql.js";

import {
    ANKI_SCHEMA_VERSION,
    BASIC_MODEL,
    BASIC_MODEL_ID,
    CLOZE_MODEL,
    CLOZE_MODEL_ID,
    COLLECTION_DDL,
    DEFAULT_CONF,
    DEFAULT_DCONF,
} from "./apkg-schema";

export type AnkiCardType = "basic" | "cloze";

export interface AnkiCardInput {
    /** Stable id, used for the note ``guid``. Re-exporting the
     *  same card across runs keeps the same guid so Anki's
     *  import dedup recognises it. */
    guid: string;
    type: AnkiCardType;
    /** Front for basic, Text for cloze. */
    front: string;
    /** Back for basic, Extra for cloze. */
    back: string;
    tags?: string[];
}

export interface DeckMetadata {
    /** Deck name shown in Anki's deck list. */
    name: string;
    /** Long-form description. Anki shows it in the deck info
     *  panel. */
    description?: string;
}

// ---- sql.js init (lazy, cached) ----

let _sqlJs: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
    if (_sqlJs !== null) return _sqlJs;
    const initSqlJs = (await import("sql.js")).default;
    // Vite bundles the .wasm alongside the .js when imported via
    // ?url; this resolves to the asset URL at build time.
    const wasmUrl = (await import("sql.js/dist/sql-wasm.wasm?url"))
        .default as string;
    _sqlJs = await initSqlJs({locateFile: () => wasmUrl});
    return _sqlJs;
}

// ---- Helpers ----

/** Anki uses CRC-style checksums on the first field. We use a
 *  simple FNV-1a hash truncated to 31 bits; Anki only requires
 *  determinism + uniqueness within the export. */
function fieldChecksum(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash & 0x7fffffff;
}

/** Count cloze deletions ``{{cN::text}}`` to decide how many
 *  cards the cloze note generates. */
function countClozeOrds(text: string): number[] {
    const ords = new Set<number>();
    const re = /\{\{c(\d+)::/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        ords.add(Number.parseInt(match[1], 10) - 1);
    }
    if (ords.size === 0) {
        // Cloze note with no markers — Anki rejects on import.
        // Fall back to ord 0 so the card at least loads.
        ords.add(0);
    }
    return [...ords].sort((a, b) => a - b);
}

function tagString(tags: string[] | undefined): string {
    // Anki stores tags as space-separated, with leading + trailing
    // space if non-empty.
    if (!tags || tags.length === 0) return "";
    const cleaned = tags
        .map((t) => t.replace(/\s+/g, "_"))
        .filter(Boolean);
    if (cleaned.length === 0) return "";
    return ` ${cleaned.join(" ")} `;
}

// ---- Core builder ----

export interface ApkgResult {
    /** ZIP bytes, ready to be downloaded as ``deck.apkg``. */
    blob: Blob;
    /** Suggested filename. */
    filename: string;
    /** How many cards Anki will see (cloze notes can fan out). */
    cardCount: number;
}

/**
 * Build a .apkg in-memory and return it as a Blob.
 *
 * Implementation notes:
 *  - All timestamps are seconds since epoch (Anki convention).
 *  - ``id`` columns are millisecond timestamps + a small offset
 *    to ensure uniqueness across notes / cards in the same export.
 *  - ``did`` (deck id) is pinned to 1 for the single deck we ship.
 *    Multiple decks per export aren't needed for v1.17.0.
 */
export async function buildApkg(
    cards: AnkiCardInput[],
    deck: DeckMetadata,
): Promise<ApkgResult> {
    if (cards.length === 0) {
        throw new Error("buildApkg: cannot export an empty deck");
    }
    const SQL = await loadSqlJs();
    const JSZipMod = (await import("jszip")).default;

    const db: SqlJsDatabase = new SQL.Database();
    try {
        db.run(COLLECTION_DDL);

        const now = Math.floor(Date.now() / 1000);
        const nowMs = Date.now();
        const deckId = 1;

        // --- col row -----------------------------------------
        const decks = {
            [String(deckId)]: {
                id: deckId,
                name: deck.name,
                desc: deck.description ?? "",
                extendRev: 50,
                usn: 0,
                collapsed: false,
                browserCollapsed: false,
                newToday: [0, 0],
                revToday: [0, 0],
                lrnToday: [0, 0],
                timeToday: [0, 0],
                dyn: 0,
                extendNew: 10,
                conf: 1,
                mod: now,
                mid: 0,
            },
        };
        const models = {
            [String(BASIC_MODEL_ID)]: BASIC_MODEL,
            [String(CLOZE_MODEL_ID)]: CLOZE_MODEL,
        };
        db.run(
            `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
             VALUES (1, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, '{}')`,
            [
                now,
                now,
                now,
                ANKI_SCHEMA_VERSION,
                JSON.stringify(DEFAULT_CONF),
                JSON.stringify(models),
                JSON.stringify(decks),
                JSON.stringify(DEFAULT_DCONF),
            ],
        );

        // --- notes + cards ----------------------------------
        let noteId = nowMs;
        let cardId = nowMs;
        let totalCards = 0;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const isBasic = card.type === "basic";
            const modelId = isBasic ? BASIC_MODEL_ID : CLOZE_MODEL_ID;
            // Anki field separator is U+001F (Unit Separator).
            const flds = `${card.front}\u001f${card.back}`;
            const sfld = card.front; // sort field = first field
            const csum = fieldChecksum(card.front);

            db.run(
                `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
                 VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, '')`,
                [
                    noteId,
                    card.guid,
                    modelId,
                    now,
                    tagString(card.tags),
                    flds,
                    sfld,
                    csum,
                ],
            );

            const cardOrds = isBasic ? [0] : countClozeOrds(card.front);
            for (const ord of cardOrds) {
                db.run(
                    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
                     VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
                    [cardId, noteId, deckId, ord, now, totalCards + 1],
                );
                cardId += 1;
                totalCards += 1;
            }
            noteId += 1;
        }

        const sqliteBytes = db.export();

        // --- Bundle into the ZIP -----------------------------
        const zip = new JSZipMod();
        zip.file("collection.anki2", sqliteBytes);
        // No media in v1.17.0; the empty manifest is still
        // required by Anki's importer.
        zip.file("media", JSON.stringify({}));
        const blob = await zip.generateAsync({type: "blob"});

        const safeName = deck.name
            .replace(/[^a-zA-Z0-9_\- ]/g, "_")
            .slice(0, 80)
            .trim()
            .replace(/\s+/g, "_");
        return {
            blob,
            filename: `${safeName || "deck"}.apkg`,
            cardCount: totalCards,
        };
    } finally {
        db.close();
    }
}

// ---- Pure helpers, also exported for unit tests ----

export const _testing = {
    fieldChecksum,
    countClozeOrds,
    tagString,
};
