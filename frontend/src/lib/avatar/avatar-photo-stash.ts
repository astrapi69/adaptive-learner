/**
 * Avatar photo stash (#2862) - one slot per user for the uploaded
 * photo displaced when a preset figure is chosen, so the switch is
 * never silently destructive: the profile section offers a restore
 * action while the slot is filled.
 *
 * The photo is the same cropped data URL that lived in
 * ``UserSettings.avatar`` (small by construction - the crop
 * renders at avatar resolution). Browser-local state without a
 * backend column, so the home is the ``mentor-notes`` /
 * ``selection-store`` pattern: localStorage keyed per user,
 * write-through mirrored into the Dexie ``userData`` store (#791),
 * registered in ``MANAGED_USER_DATA_KEYS`` and riding the ``.alb``
 * backup's localStorage snapshot. Reads tolerate corrupt storage;
 * writes swallow quota errors (worst case the stash is lost, the
 * dialog's promise degrades to a plain replace).
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.avatar.photo-stash";

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function readMap(storage: Storage): Record<string, string> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: Record<string, string> = {};
        for (const [key, val] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            if (typeof val === "string" && val) out[key] = val;
        }
        return out;
    } catch {
        return {};
    }
}

function writeMap(
    storage: Storage,
    map: Record<string, string>,
    mirror: boolean,
): void {
    try {
        const raw = JSON.stringify(map);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage - the stash degrades, nothing breaks */
    }
}

/** The stashed photo data URL for ``userId``, or ``null``. */
export function readStashedAvatarPhoto(
    userId: string,
    storage?: Storage,
): string | null {
    const store = resolveStorage(storage);
    if (!store) return null;
    return readMap(store)[userId] ?? null;
}

/** Park ``photoDataUrl`` in the user's slot (replaces a previous stash). */
export function stashAvatarPhoto(
    userId: string,
    photoDataUrl: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store || !photoDataUrl) return;
    const map = readMap(store);
    map[userId] = photoDataUrl;
    writeMap(store, map, storage === undefined);
}

/** Empty the user's slot (after a restore, or when a real photo returns). */
export function clearStashedAvatarPhoto(
    userId: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = readMap(store);
    if (!(userId in map)) return;
    delete map[userId];
    writeMap(store, map, storage === undefined);
}
