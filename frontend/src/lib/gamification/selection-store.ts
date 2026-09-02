/**
 * Generic per-user selection store for unlockable cosmetics (#2861).
 *
 * A surface (avatar frames, mascot variants, ...) keeps its selected
 * item and its XP-purchased ids as browser-local state without a
 * backend column, so the home is ONE localStorage store behaving
 * identically in both storage modes (the ``mentor-notes-store`` /
 * ``dismissed-sets`` pattern; a per-mode write path is the recurring
 * #2053 class). Extracted from ``avatar-frame-store`` (#2850) when
 * the mascot variants became the second consumer.
 *
 * - Entries are keyed by ``userId``.
 * - Write-through mirrored into the Dexie ``userData`` canonical
 *   store (#791) so the state survives a Dexie restore and rides the
 *   ``.alb`` backup's localStorage snapshot - every ``storageKey``
 *   MUST be registered in ``MANAGED_USER_DATA_KEYS``.
 * - Reads tolerate corrupt/absent storage (default state); writes
 *   swallow quota errors (a lost cosmetic choice is an
 *   inconvenience).
 * - Every write dispatches ``changeEvent`` on ``window`` so open
 *   consumers (the lesson mascot, the header avatar) update live.
 * - Tests pass an explicit ``storage`` override and stay pure (no
 *   Dexie side effect) - the sibling stores' contract.
 */

import {mirrorUserData} from "../../storage/dexie/dexie-user-data";

export interface SelectionState {
    /** Item id from the surface's catalog. */
    selected: string;
    /** Ids of XP-purchased items, in purchase order. */
    purchased: string[];
}

export interface SelectionStore {
    /** The localStorage key (registered in ``MANAGED_USER_DATA_KEYS``). */
    storageKey: string;
    /** ``window`` event name fired after every write. */
    changeEvent: string;
    read(userId: string, storage?: Storage): SelectionState;
    setSelected(userId: string, id: string, storage?: Storage): void;
    addPurchased(userId: string, id: string, storage?: Storage): void;
}

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function isSelectionState(value: unknown): value is SelectionState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.selected === "string" &&
        Array.isArray(candidate.purchased) &&
        candidate.purchased.every((p) => typeof p === "string")
    );
}

/**
 * Build the store for one cosmetic surface.
 *
 * @param storageKey - Namespaced localStorage key
 *     (``adaptive-learner.<surface>``), also registered in
 *     ``MANAGED_USER_DATA_KEYS``.
 * @param defaultId - Catalog id reported when nothing is stored.
 *
 * @example
 * const store = createSelectionStore(
 *     "adaptive-learner.mascot.variants", "funke");
 */
export function createSelectionStore(
    storageKey: string,
    defaultId: string,
): SelectionStore {
    const changeEvent = `${storageKey}:changed`;

    function readMap(storage: Storage): Record<string, SelectionState> {
        try {
            const raw = storage.getItem(storageKey);
            if (!raw) return {};
            const parsed: unknown = JSON.parse(raw);
            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return {};
            }
            const out: Record<string, SelectionState> = {};
            for (const [key, val] of Object.entries(
                parsed as Record<string, unknown>,
            )) {
                if (isSelectionState(val)) out[key] = val;
            }
            return out;
        } catch {
            return {};
        }
    }

    function writeMap(
        storage: Storage,
        map: Record<string, SelectionState>,
        mirror: boolean,
    ): void {
        try {
            const raw = JSON.stringify(map);
            storage.setItem(storageKey, raw);
            if (mirror) void mirrorUserData(storageKey, raw);
        } catch {
            /* quota / disabled storage - worst case the choice resets */
        }
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(changeEvent));
        }
    }

    function defaultState(): SelectionState {
        return {selected: defaultId, purchased: []};
    }

    return {
        storageKey,
        changeEvent,
        read(userId, storage) {
            const store = resolveStorage(storage);
            if (!store) return defaultState();
            const entry = readMap(store)[userId];
            return entry
                ? {selected: entry.selected, purchased: [...entry.purchased]}
                : defaultState();
        },
        setSelected(userId, id, storage) {
            const store = resolveStorage(storage);
            if (!store) return;
            const map = readMap(store);
            const current = map[userId] ?? defaultState();
            map[userId] = {...current, selected: id};
            writeMap(store, map, storage === undefined);
        },
        addPurchased(userId, id, storage) {
            const store = resolveStorage(storage);
            if (!store) return;
            const map = readMap(store);
            const current = map[userId] ?? defaultState();
            if (current.purchased.includes(id)) return;
            map[userId] = {
                ...current,
                purchased: [...current.purchased, id],
            };
            writeMap(store, map, storage === undefined);
        },
    };
}
