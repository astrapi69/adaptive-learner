/**
 * Dexie-mode Anki service (Phase 30B / v1.17.0).
 *
 * Full CRUD on ``anki_card_suggestions`` runs against IndexedDB.
 * Vocabulary extraction from an imported conversation's
 * ``analysis_result.vocabulary`` (Phase 30D) also runs locally —
 * no AI call required.
 *
 * AI session extraction is deferred in Dexie mode: the
 * browser-direct AI path needs the user's stored API key + a
 * model + a prompt, and reproducing the full backend pipeline
 * client-side is meaningful additional surface. v1.17.0 throws
 * a clear error so the user knows to switch to API mode for
 * that flow (the Anki page surfaces the error as a toast).
 */

import {ApiError} from "../api/client";

import {getDb, newId, nowIso} from "./db";
import type {AnkiCardRow} from "./db";
import type {
    AnkiCardCreateBody,
    AnkiCardListFilters,
    AnkiCardSuggestion,
    AnkiCardUpdateBody,
} from "./types";

function rowToOut(row: AnkiCardRow): AnkiCardSuggestion {
    let tags: string[] = [];
    try {
        const parsed = JSON.parse(row.tags || "[]");
        if (Array.isArray(parsed)) {
            tags = parsed.filter((t): t is string => typeof t === "string");
        }
    } catch {
        /* fall through to empty */
    }
    return {
        id: row.id,
        user_id: row.user_id,
        session_id: row.session_id,
        conversation_id: row.conversation_id,
        project_id: row.project_id,
        card_type: row.card_type,
        front: row.front,
        back: row.back,
        tags,
        accepted: row.accepted,
        rejected: row.rejected,
        exported_at: row.exported_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function listAnkiCards(
    userId: string,
    filters?: AnkiCardListFilters,
): Promise<AnkiCardSuggestion[]> {
    const db = getDb();
    const rows = await db.ankiCards.where({user_id: userId}).toArray();
    const filtered = rows.filter((r) => {
        if (filters?.projectId && r.project_id !== filters.projectId)
            return false;
        if (filters?.acceptedOnly && !r.accepted) return false;
        if (!filters?.includeRejected && r.rejected) return false;
        return true;
    });
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.map(rowToOut);
}

export async function createAnkiCard(
    userId: string,
    body: AnkiCardCreateBody,
): Promise<AnkiCardSuggestion> {
    if (body.card_type && body.card_type !== "basic" && body.card_type !== "cloze") {
        throw new ApiError(
            400,
            `card_type must be 'basic' or 'cloze' (got ${body.card_type}).`,
        );
    }
    const db = getDb();
    const ts = nowIso();
    const row: AnkiCardRow = {
        id: newId(),
        user_id: userId,
        session_id: body.session_id ?? null,
        conversation_id: body.conversation_id ?? null,
        project_id: body.project_id ?? null,
        card_type: (body.card_type as "basic" | "cloze") ?? "basic",
        front: body.front,
        back: body.back,
        tags: JSON.stringify(body.tags ?? []),
        accepted: body.accepted ?? false,
        rejected: false,
        exported_at: null,
        created_at: ts,
        updated_at: ts,
    };
    await db.ankiCards.put(row);
    return rowToOut(row);
}

export async function updateAnkiCard(
    cardId: string,
    body: AnkiCardUpdateBody,
): Promise<AnkiCardSuggestion> {
    const db = getDb();
    const existing = await db.ankiCards.get(cardId);
    if (!existing) {
        throw new ApiError(404, `AnkiCard ${cardId} not found`);
    }
    if (body.card_type !== undefined) {
        if (body.card_type !== "basic" && body.card_type !== "cloze") {
            throw new ApiError(
                400,
                `card_type must be 'basic' or 'cloze' (got ${body.card_type}).`,
            );
        }
        existing.card_type = body.card_type;
    }
    if (body.front !== undefined) existing.front = body.front;
    if (body.back !== undefined) existing.back = body.back;
    if (body.tags !== undefined) existing.tags = JSON.stringify(body.tags);
    // Accept + reject mutual exclusion (same shape as backend).
    if (body.accepted === true) {
        existing.accepted = true;
        existing.rejected = false;
    } else if (body.rejected === true) {
        existing.rejected = true;
        existing.accepted = false;
    } else {
        if (body.accepted === false) existing.accepted = false;
        if (body.rejected === false) existing.rejected = false;
    }
    existing.updated_at = nowIso();
    await db.ankiCards.put(existing);
    return rowToOut(existing);
}

export async function deleteAnkiCard(cardId: string): Promise<void> {
    const db = getDb();
    await db.ankiCards.delete(cardId);
}

export async function markAnkiCardsExported(
    cardIds: string[],
): Promise<{updated: number}> {
    const db = getDb();
    const ts = nowIso();
    let updated = 0;
    for (const id of cardIds) {
        const row = await db.ankiCards.get(id);
        if (!row) continue;
        row.exported_at = ts;
        row.updated_at = ts;
        await db.ankiCards.put(row);
        updated += 1;
    }
    return {updated};
}

/**
 * Mirror of the backend ``_cards_from_vocabulary`` transform.
 * Keeping a parity copy on the frontend means the Dexie path
 * produces byte-identical cards for the same input.
 */
function cardsFromVocabulary(
    entries: unknown,
): Array<{
    card_type: "basic" | "cloze";
    front: string;
    back: string;
    tags: string[];
}> {
    if (!Array.isArray(entries)) return [];
    const out: Array<{
        card_type: "basic" | "cloze";
        front: string;
        back: string;
        tags: string[];
    }> = [];
    for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const word = String(e.word ?? "").trim();
        const translation = String(e.translation ?? "").trim();
        const example = String(e.example ?? "").trim();
        const phonetic = String(e.phonetic ?? "").trim();
        if (!word || !translation) continue;
        const rawTags = Array.isArray(e.tags) ? e.tags : [];
        const tags = rawTags
            .map((t) =>
                typeof t === "string" || typeof t === "number"
                    ? String(t).trim().toLowerCase()
                    : "",
            )
            .filter(Boolean);
        tags.push("vocabulary");
        let front: string;
        let card_type: "basic" | "cloze";
        if (example && example.toLowerCase().includes(word.toLowerCase())) {
            const re = new RegExp(
                word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i",
            );
            front = example.replace(re, `{{c1::${word}}}`);
            card_type = "cloze";
        } else {
            front = word;
            card_type = "basic";
        }
        const back = phonetic
            ? `${translation}\n[${phonetic}]`
            : translation;
        out.push({card_type, front, back, tags});
    }
    return out;
}

export async function extractFromConversationDexie(
    conversationId: string,
): Promise<AnkiCardSuggestion[]> {
    const db = getDb();
    const conv = await db.importedConversations.get(conversationId);
    if (!conv) {
        throw new ApiError(404, `Conversation ${conversationId} not found`);
    }
    const analysis = conv.analysis_result;
    const vocab = (analysis && typeof analysis === "object"
        ? (analysis as Record<string, unknown>).vocabulary
        : null) ?? null;
    const cards = cardsFromVocabulary(vocab);
    if (cards.length === 0) {
        // No vocabulary in this conversation's analysis. Dexie
        // mode doesn't yet support browser-direct AI extraction
        // for the transcript path; surface a clear error so the
        // page can toast it.
        throw new ApiError(
            400,
            "No vocabulary found in this conversation's analysis. " +
                "AI extraction from the transcript is only available " +
                "in API mode for now.",
        );
    }
    const ts = nowIso();
    const inserted: AnkiCardRow[] = cards.map((c) => ({
        id: newId(),
        user_id: conv.user_id,
        session_id: null,
        conversation_id: conversationId,
        project_id: conv.project_id ?? null,
        card_type: c.card_type,
        front: c.front,
        back: c.back,
        tags: JSON.stringify(c.tags),
        accepted: false,
        rejected: false,
        exported_at: null,
        created_at: ts,
        updated_at: ts,
    }));
    await db.ankiCards.bulkPut(inserted);
    return inserted.map(rowToOut);
}

export async function extractFromSessionDexie(
    _sessionId: string,
): Promise<AnkiCardSuggestion[]> {
    // Browser-direct AI extraction from a session transcript
    // is a meaningful surface (provider switch, model picker,
    // streaming progress). Deferred to a polish patch — for
    // v1.17.0, Dexie users can still manually add cards in the
    // Anki page UI.
    throw new ApiError(
        501,
        "AI session-extraction is not yet available in Dexie mode. " +
            "Switch to API mode in Settings, or add cards manually.",
    );
}
