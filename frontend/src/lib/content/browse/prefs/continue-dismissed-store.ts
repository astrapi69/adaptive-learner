/**
 * Mode-agnostic "hide this row from Weitermachen" persistence (#3023).
 *
 * ## Why this module exists
 *
 * The dashboard's entry block answers "what now?", and the learner is the one
 * who decides what still belongs there: a set they finished, an import they
 * only skimmed, a lesson they will not come back to this week. Without a way
 * to take a row out, the only lever is to stop touching the set - which is
 * exactly the opposite of what the block is for.
 *
 * ## What the X does NOT do
 *
 * It hides ONE ROW. It never deletes lesson progress, never touches review
 * cards, never removes the set from "Meine Inhalte" (the set actions menu owns
 * that, #1709 ``dismissed-sets``), and never changes the set's lifecycle status
 * (#2053 ``set-status-store``). A dashboard tile that destroys learning data on
 * a stray tap would be the wrong semantics for a one-click control.
 *
 * ## Semantics (deliberately self-healing)
 *
 * - Keys are ``source::set-id`` (the source-scoped set identity, matching
 *   ``set-status-store`` / ``dismissed-sets`` / ``lesson-order-store``).
 * - The stored VALUE is the row's ``updated_at`` at dismissal time, not a bare
 *   flag. {@link isContinueRowDismissed} hides the row only while the set's
 *   most recent progress is no newer than that stamp, so continuing to learn
 *   brings the row back on its own. The X means "not now", never "never
 *   again" - which is also what makes a mis-tap harmless.
 * - Write-through mirrored into the Dexie ``userData`` canonical store (#791
 *   pattern) so the record survives a Dexie restore and rides in the ``.alb``
 *   backup's localStorage snapshot - the key is registered in
 *   ``MANAGED_USER_DATA_KEYS``.
 *
 * All reads tolerate corrupt/absent storage by returning an empty map; writes
 * swallow quota errors (a dismissal is a convenience, not load-bearing data).
 * Tests pass an explicit ``storage`` override and stay pure (no Dexie side
 * effect) - the same contract ``set-status-store`` uses.
 */

import {mirrorUserData} from "../../../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.continue-dismissed";

function dismissalKey(source: string, setId: string): string {
    return `${source}::${setId}`;
}

function resolveStorage(override?: Storage): Storage | null {
    if (override) return override;
    if (typeof localStorage !== "undefined") return localStorage;
    return null;
}

function read(storage: Storage): Record<string, string> {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            // Drop a corrupt entry rather than the whole map.
            if (typeof value === "string" && value) out[key] = value;
        }
        return out;
    } catch {
        return {};
    }
}

function write(storage: Storage, map: Record<string, string>, mirror: boolean): void {
    try {
        const raw = JSON.stringify(map);
        storage.setItem(STORAGE_KEY, raw);
        if (mirror) void mirrorUserData(STORAGE_KEY, raw);
    } catch {
        /* quota / disabled storage - worst case the row reappears on reload */
    }
}

/** All recorded dismissals as ``source::set-id`` -> dismissed-at stamp. */
export function readContinueDismissals(storage?: Storage): Record<string, string> {
    const store = resolveStorage(storage);
    if (!store) return {};
    return read(store);
}

/**
 * Hide one entry row until the set is touched again.
 *
 * @param source - The set's content source.
 * @param setId - The set id.
 * @param updatedAt - The row's current ``updated_at``; the row stays hidden
 *   while the set's progress is no newer than this.
 */
export function dismissContinueRow(
    source: string,
    setId: string,
    updatedAt: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const key = dismissalKey(source, setId);
    const previous = map[key];
    // A second dismissal keeps the NEWER stamp: an older one would let the row
    // resurface immediately for progress the learner has already dismissed.
    if (previous && previous > updatedAt) return;
    map[key] = updatedAt;
    write(store, map, storage === undefined);
}

/** Undo a dismissal (the row shows again immediately). No-op when absent. */
export function restoreContinueRow(
    source: string,
    setId: string,
    storage?: Storage,
): void {
    const store = resolveStorage(storage);
    if (!store) return;
    const map = read(store);
    const key = dismissalKey(source, setId);
    if (!(key in map)) return;
    delete map[key];
    write(store, map, storage === undefined);
}

/**
 * True while this row is hidden: it was dismissed, and nothing newer has
 * happened on the set since.
 *
 * @param updatedAt - The set's most recent progress stamp (ISO 8601, compared
 *   lexicographically like everywhere else in the entry block).
 */
export function isContinueRowDismissed(
    source: string,
    setId: string,
    updatedAt: string,
    storage?: Storage,
): boolean {
    const store = resolveStorage(storage);
    if (!store) return false;
    const dismissedAt = read(store)[dismissalKey(source, setId)];
    if (!dismissedAt) return false;
    return dismissedAt >= updatedAt;
}
