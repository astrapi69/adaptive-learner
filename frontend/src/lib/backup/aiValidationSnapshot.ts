/**
 * Cached AI content-check reports travel with the backup (#3412).
 *
 * A report is not a plain cache: it carries the AIV-09 signature (content
 * hash plus the provider's response ids) the "AI-checked" badge is built
 * from, and a new one only comes from the AI validation dialog, by hand,
 * with a paid call and an API key. Neither backup carried the reports, so
 * after Export -> new device -> Import the badges were gone.
 *
 * The block rides the payload like ``plugin_settings``: captured and applied
 * frontend-side through ``getStorage().contentLoader``, so no backup table
 * outside the sync surface is needed. API mode has no report cache: its
 * export yields an empty block and its import writes nothing.
 *
 * @example
 * const payload = await withAiValidationSnapshot(exported);
 * await restoreAiValidationSnapshot(payload.ai_validation_results);
 */

import {getStorage, resolveStorageMode} from "../../storage";
import type {AiValidationCacheRecord} from "../../storage/types";

/** The storage surface this module needs (``getStorage().contentLoader``). */
export interface AiValidationStore {
    /** False where no report cache exists (API mode): import writes nothing. */
    isEnabled?(): boolean;
    list(): Promise<AiValidationCacheRecord[]>;
    get(source: string, setId: string): Promise<AiValidationCacheRecord | null>;
    save(record: AiValidationCacheRecord): Promise<void>;
}

function defaultStore(): AiValidationStore {
    const loader = getStorage().contentLoader;
    return {
        isEnabled: () => resolveStorageMode() === "dexie",
        list: () => loader.listAiValidationCache(),
        get: (source, setId) => loader.getAiValidationCache(source, setId),
        save: (record) => loader.saveAiValidationCache(record),
    };
}

/**
 * Every cached report, read through the active storage.
 *
 * @param store - Report surface; defaults to ``getStorage()``.
 * @returns The reports; empty in API mode, and empty (with a warning) when
 *   the cache cannot be read, rather than failing the export.
 */
export async function captureAiValidationSnapshot(
    store: AiValidationStore = defaultStore(),
): Promise<AiValidationCacheRecord[]> {
    try {
        return await store.list();
    } catch (err) {
        console.warn("[Backup] AI content-check reports not readable, left out:", err);
        return [];
    }
}

/** ``payload`` with a fresh ``ai_validation_results`` block. */
export async function withAiValidationSnapshot<
    T extends {ai_validation_results?: AiValidationCacheRecord[]},
>(payload: T, store: AiValidationStore = defaultStore()): Promise<T> {
    return {...payload, ai_validation_results: await captureAiValidationSnapshot(store)};
}

/** A backup entry this import can key and order (source, set_id, checked_at). */
function isRestorable(entry: unknown): entry is AiValidationCacheRecord {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Partial<AiValidationCacheRecord>;
    return (
        typeof record.source === "string" &&
        typeof record.set_id === "string" &&
        typeof record.checked_at === "string"
    );
}

/**
 * Merge a backup's reports into this device's.
 *
 * Per (source, set_id) the newer ``checked_at`` wins; on a tie the local
 * report stays. An outdated report is harmless: the badge checks it against
 * the set's current content hash or version anyway.
 *
 * @param snapshot - The payload's ``ai_validation_results`` block, or undefined.
 * @param store - Report surface; defaults to ``getStorage()``.
 * @returns How many reports were written.
 */
export async function restoreAiValidationSnapshot(
    snapshot: AiValidationCacheRecord[] | undefined,
    store: AiValidationStore = defaultStore(),
): Promise<number> {
    if (!Array.isArray(snapshot) || store.isEnabled?.() === false) return 0;
    let applied = 0;
    for (const incoming of snapshot.filter(isRestorable)) {
        const local = await store.get(incoming.source, incoming.set_id);
        if (local && Date.parse(local.checked_at) >= Date.parse(incoming.checked_at)) continue;
        await store.save(incoming);
        applied += 1;
    }
    return applied;
}
