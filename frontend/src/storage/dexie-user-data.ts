/**
 * Device-local user-data: Dexie-canonical store with a localStorage cache
 * (#791 Teil B).
 *
 * A small class of genuine *user data* historically lived only in
 * ``localStorage`` — the community-contribution history + remembered
 * contributor name, and the Curriculum-Builder custom paths. localStorage is
 * not part of the canonical IndexedDB store: it is not covered by the Dexie
 * ``.alb`` record set and is the most fragile browser storage. Teil A made the
 * data *portable* (it travels in the backup's localStorage snapshot); Teil B
 * promotes IndexedDB (Dexie) to the **canonical** home so the data survives in
 * the durable store and a Dexie restore re-seeds it.
 *
 * To avoid an async rewrite of the (synchronous) lib readers + their React
 * callers, the design keeps the localStorage copy as a **synchronous read
 * cache** that is reconciled with the Dexie canonical store:
 *
 * - **Write-through** ({@link mirrorUserData}): every lib write mirrors the
 *   new value into Dexie (fire-and-forget; a Dexie failure never breaks the
 *   localStorage write that already succeeded).
 * - **Boot reconcile** ({@link syncUserDataAtBoot}): at app start Dexie wins
 *   when it has a value (covers a Dexie restore), otherwise an existing
 *   localStorage value seeds Dexie (first run after the upgrade).
 *
 * All operations are **no-ops outside Dexie mode** — in API mode the canonical
 * store is the backend, and these keys ride along in the localStorage snapshot
 * exactly as before.
 */

import {getDb} from "./db";

const STORAGE_MODE_KEY = "adaptive-learner.storage_mode";

/** localStorage keys promoted to the Dexie ``userData`` canonical store. */
export const MANAGED_USER_DATA_KEYS = [
    "adaptive-learner.contributions",
    "adaptive-learner.contributor-name",
    "adaptive-learner.custom-paths",
] as const;

/**
 * Whether the app runs in Dexie (browser-canonical) mode. Read inline rather
 * than importing ``resolveStorageMode`` from ``./index`` to avoid the
 * storage-module import cycle (``index`` already imports the concrete
 * implementations). Mirrors ``resolveStorageMode``'s precedence:
 * persisted preference, then the build-time default.
 */
function isDexieMode(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_MODE_KEY);
        if (raw === "dexie") return true;
        if (raw === "api") return false;
    } catch {
        /* localStorage unavailable — fall through to the build-time default */
    }
    return (import.meta.env.VITE_STORAGE_MODE as string | undefined) === "dexie";
}

function readLocal(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeLocal(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* quota / disabled — the Dexie copy remains canonical */
    }
}

/**
 * Write-through a managed key into the Dexie canonical store. Pass ``null`` to
 * delete the row (the key was cleared). No-op outside Dexie mode; swallows
 * Dexie errors so the already-succeeded localStorage write is never undone.
 *
 * @param key - The managed ``adaptive-learner.*`` localStorage key.
 * @param value - The raw stored string, or ``null`` to clear it.
 */
export async function mirrorUserData(key: string, value: string | null): Promise<void> {
    if (!isDexieMode()) return;
    try {
        const db = getDb();
        if (value === null) await db.userData.delete(key);
        else await db.userData.put({key, value});
    } catch {
        /* Dexie unavailable; localStorage copy remains the source */
    }
}

/**
 * Reconcile each managed key between the Dexie canonical store and the
 * localStorage cache, once at app boot. Dexie wins when it holds a value
 * (a restore / future sync brought it); otherwise an existing localStorage
 * value seeds Dexie. No-op outside Dexie mode.
 *
 * @param keys - Override the managed-key list (tests). Defaults to
 *   {@link MANAGED_USER_DATA_KEYS}.
 */
export async function syncUserDataAtBoot(
    keys: readonly string[] = MANAGED_USER_DATA_KEYS,
): Promise<void> {
    if (!isDexieMode()) return;
    let db: ReturnType<typeof getDb>;
    try {
        db = getDb();
    } catch {
        return;
    }
    for (const key of keys) {
        try {
            const row = await db.userData.get(key);
            const lsVal = readLocal(key);
            if (row) {
                if (lsVal !== row.value) writeLocal(key, row.value);
            } else if (lsVal !== null) {
                await db.userData.put({key, value: lsVal});
            }
        } catch {
            /* skip this key; a single bad row must not block the others */
        }
    }
}

const KEY_USER_ID = "adaptive-learner.user_id";
const KEY_LANGUAGE = "adaptive-learner.language";

/**
 * Resolve the ``adaptive-learner.language`` redundancy (#791 Teil B): the
 * learner language lived in BOTH localStorage and the Dexie
 * ``user_settings.language`` column. Dexie ``user_settings`` is the single
 * source of truth — at boot, hydrate the localStorage cache from the active
 * user's ``user_settings.language`` so the two never diverge (and a Dexie
 * restore propagates into the cache). No-op outside Dexie mode, when no user
 * is resolved yet, or when settings carry no language.
 */
export async function syncLanguageAtBoot(): Promise<void> {
    if (!isDexieMode()) return;
    const userId = readLocal(KEY_USER_ID);
    if (!userId) return;
    try {
        const db = getDb();
        const settings = await db.userSettings.where("user_id").equals(userId).first();
        const lang = settings?.language;
        if (typeof lang === "string" && lang && readLocal(KEY_LANGUAGE) !== lang) {
            writeLocal(KEY_LANGUAGE, lang);
        }
    } catch {
        /* Dexie unavailable; the localStorage cache stays as-is */
    }
}
