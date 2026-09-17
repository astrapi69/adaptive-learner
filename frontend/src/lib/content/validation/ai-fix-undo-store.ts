/**
 * Undo snapshots for AIV-07 (#3060): the last apply per set.
 *
 * ``applyFixes`` rewrites a set in place, so the fields it changed are
 * recorded here first and ``undoFixes`` plays them back. Same pattern as
 * ``lib/content/browse/prefs/continue-dismissed-store``: a localStorage
 * map (``source::set-id`` -> snapshot) write-through mirrored into the
 * Dexie ``userData`` store, the key registered in
 * ``MANAGED_USER_DATA_KEYS`` so it rides the ``.alb`` backup. One slot per
 * set: a newer apply replaces the older snapshot.
 *
 * @example
 * writeFixSnapshot(snapshot);
 * const previous = readFixSnapshot("user-generated", "my-set");
 */

import {mirrorUserData} from "../../../storage/dexie/dexie-user-data";
import type {FixSnapshot} from "./ai-fix";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.ai-fix-undo";

function snapshotKey(source: string, setId: string): string {
    return `${source}::${setId}`;
}

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function isSnapshot(value: unknown): value is FixSnapshot {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.source === "string" &&
        typeof record.setId === "string" &&
        typeof record.appliedAt === "string" &&
        Array.isArray(record.changes)
    );
}

function readAll(storage: Storage): Record<string, FixSnapshot> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const out: Record<string, FixSnapshot> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (isSnapshot(value)) out[key] = value;
        }
        return out;
    } catch {
        return {};
    }
}

function writeAll(storage: Storage, map: Record<string, FixSnapshot>, mirror: boolean): void {
    try {
        const raw = JSON.stringify(map);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage: the apply still went through, only undo is lost */
    }
}

/** The last apply recorded for the set, or null. */
export function readFixSnapshot(
    source: string,
    setId: string,
    storage?: Storage,
): FixSnapshot | null {
    const store = resolveStorage(storage);
    if (!store) return null;
    return readAll(store)[snapshotKey(source, setId)] ?? null;
}

/** Record the last apply for its set (replaces an older snapshot). */
export function writeFixSnapshot(snapshot: FixSnapshot, storage?: Storage, mirror = true): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = readAll(store);
    map[snapshotKey(snapshot.source, snapshot.setId)] = snapshot;
    writeAll(store, map, mirror);
}

/** Forget the set's snapshot (after an undo). */
export function clearFixSnapshot(
    source: string,
    setId: string,
    storage?: Storage,
    mirror = true,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = readAll(store);
    delete map[snapshotKey(source, setId)];
    writeAll(store, map, mirror);
}
