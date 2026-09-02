/**
 * Mode-agnostic avatar-frame persistence (#2850).
 *
 * The selected frame and the set of XP-purchased frames are
 * browser-local decoration state without a backend column, so their
 * home is ONE localStorage store that behaves identically in both
 * storage modes (the ``mentor-notes-store`` / ``dismissed-sets``
 * pattern; a per-mode write path is the recurring #2053 class).
 *
 * - Entries are keyed by ``userId``.
 * - Write-through mirrored into the Dexie ``userData`` canonical
 *   store (#791) so the state survives a Dexie restore and rides the
 *   ``.alb`` backup's localStorage snapshot - the key is registered
 *   in ``MANAGED_USER_DATA_KEYS``.
 * - Reads tolerate corrupt/absent storage (default state); writes
 *   swallow quota errors (a lost ring choice is an inconvenience).
 * - Tests pass an explicit ``storage`` override and stay pure (no
 *   Dexie side effect) - the sibling stores' contract.
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.avatar.frames";

export interface AvatarFrameState {
    /** Frame id from the catalog; "none" when nothing is chosen. */
    selected: string;
    /** Ids of XP-purchased frames, in purchase order. */
    purchased: string[];
}

const DEFAULT_STATE: AvatarFrameState = {selected: "none", purchased: []};

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function isFrameState(value: unknown): value is AvatarFrameState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.selected === "string" &&
        Array.isArray(candidate.purchased) &&
        candidate.purchased.every((p) => typeof p === "string")
    );
}

function read(storage: Storage): Record<string, AvatarFrameState> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: Record<string, AvatarFrameState> = {};
        for (const [key, val] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            if (isFrameState(val)) out[key] = val;
        }
        return out;
    } catch {
        return {};
    }
}

function write(
    storage: Storage,
    map: Record<string, AvatarFrameState>,
    mirror: boolean,
): void {
    try {
        const raw = JSON.stringify(map);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage - worst case the choice resets */
    }
}

/** The stored frame state for ``userId`` (default: none, nothing bought). */
export function readAvatarFrameState(
    userId: string,
    storage?: Storage,
): AvatarFrameState {
    const store = resolveStorage(storage);
    if (!store) return {...DEFAULT_STATE, purchased: []};
    const entry = read(store)[userId];
    return entry
        ? {selected: entry.selected, purchased: [...entry.purchased]}
        : {...DEFAULT_STATE, purchased: []};
}

/** Persist the selected frame for ``userId``. */
export function setSelectedAvatarFrame(
    userId: string,
    frameId: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const current = map[userId] ?? {...DEFAULT_STATE, purchased: []};
    map[userId] = {...current, selected: frameId};
    write(store, map, storage === undefined);
}

/** Record an XP purchase for ``userId`` (idempotent). */
export function addPurchasedAvatarFrame(
    userId: string,
    frameId: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const current = map[userId] ?? {...DEFAULT_STATE, purchased: []};
    if (current.purchased.includes(frameId)) return;
    map[userId] = {...current, purchased: [...current.purchased, frameId]};
    write(store, map, storage === undefined);
}
