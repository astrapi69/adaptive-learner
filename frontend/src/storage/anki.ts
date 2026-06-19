/**
 * Dexie-mode Anki service (Phase 30B / v1.17.0).
 *
 * Full CRUD on ``anki_card_suggestions`` runs against IndexedDB.
 *
 * Card extraction (#807) runs browser-direct: with a configured API key, the
 * conversation/session transcript is sent through the active provider (see
 * ``anki-extraction``), extracting language vocabulary AND knowledge concepts
 * — the same result as the API-mode backend. The conversation path also keeps
 * a deterministic ``analysis_result.vocabulary`` fallback for the no-key case.
 */

import {ApiError} from "../api/client";

import {getDb, newId, nowIso} from "./db";
import type {AnkiCardRow} from "./db";
import {
    aiExtractCards,
    resolveDexieAiConfig,
    type ExtractedCard,
} from "./anki-extraction";
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
            // eslint-disable-next-line security/detect-non-literal-regexp -- input is regex-escaped on the next line
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

/** Persist extracted cards as ``anki_card_suggestions`` rows (Dexie). */
async function persistDexieCards(
    cards: ExtractedCard[],
    owner: {
        userId: string;
        sessionId: string | null;
        conversationId: string | null;
        projectId: string | null;
    },
): Promise<AnkiCardSuggestion[]> {
    const db = getDb();
    const ts = nowIso();
    const inserted: AnkiCardRow[] = cards.map((c) => ({
        id: newId(),
        user_id: owner.userId,
        session_id: owner.sessionId,
        conversation_id: owner.conversationId,
        project_id: owner.projectId,
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

/**
 * #807 — extract Anki cards from an imported conversation in Dexie mode.
 *
 * When an API key is configured, run a browser-direct AI extraction over the
 * transcript (handles language vocabulary AND knowledge concepts, same as the
 * API-mode backend). With no key, fall back to the deterministic
 * vocabulary-from-analysis path (free, no AI); if that is also empty, ask the
 * user to configure a key.
 */
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

    const aiConfig = await resolveDexieAiConfig(conv.user_id);
    let cards: ExtractedCard[];
    if (aiConfig) {
        const messages = await db.importedMessages
            .where("conversation_id")
            .equals(conversationId)
            .sortBy("order_index");
        const transcript = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n\n");
        cards = await aiExtractCards(aiConfig, transcript);
        // If the model returned nothing usable, fall back to any vocabulary
        // the analysis already captured so the user still gets cards.
        if (cards.length === 0) cards = cardsFromVocabulary(vocab);
    } else {
        cards = cardsFromVocabulary(vocab);
        if (cards.length === 0) {
            throw new ApiError(
                400,
                "An API key is required to extract cards from this " +
                    "conversation. Configure a provider in Settings.",
            );
        }
    }
    if (cards.length === 0) {
        throw new ApiError(
            400,
            "No cards could be extracted from this conversation.",
        );
    }
    return persistDexieCards(cards, {
        userId: conv.user_id,
        sessionId: null,
        conversationId,
        projectId: conv.project_id ?? null,
    });
}

/**
 * #807 — browser-direct AI extraction from a session transcript in Dexie
 * mode. Requires a configured API key (no deterministic fallback exists for
 * a free-form session).
 */
export async function extractFromSessionDexie(
    sessionId: string,
): Promise<AnkiCardSuggestion[]> {
    const db = getDb();
    const session = await db.learningSessions.get(sessionId);
    if (!session) {
        throw new ApiError(404, `Session ${sessionId} not found`);
    }
    const project = session.project_id
        ? await db.learningProjects.get(session.project_id)
        : null;
    const aiConfig = await resolveDexieAiConfig(project?.user_id ?? "");
    if (!aiConfig) {
        throw new ApiError(
            400,
            "An API key is required to extract cards from this session. " +
                "Configure a provider in Settings.",
        );
    }
    const messages = await db.sessionMessages
        .where("session_id")
        .equals(sessionId)
        .sortBy("created_at");
    const transcript = messages
        .filter((m) => m.role !== "system")
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n\n");
    const cards = await aiExtractCards(aiConfig, transcript);
    if (cards.length === 0) {
        throw new ApiError(
            400,
            "No cards could be extracted from this session.",
        );
    }
    return persistDexieCards(cards, {
        userId: project?.user_id ?? "",
        sessionId,
        conversationId: null,
        projectId: session.project_id ?? null,
    });
}
