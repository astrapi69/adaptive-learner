/**
 * Restore helpers for rows a device already holds under another id (#3694).
 *
 * Two kinds of store carry a unique key besides ``id`` and get a row the
 * restore does not know by id:
 *
 * - the badge catalog (``badges.&key``): every device seeds it with random
 *   ids, so the backup's badge ids are foreign here, and the earned badges
 *   (``user_badges.badge_id``) point at them;
 * - per-user singletons (``userStreaks`` / ``userXp`` / ``userSettings``,
 *   ``&user_id``): the app writes a default row on its own, e.g. the streak
 *   on its read path.
 *
 * A restore that looked rows up by id only hit the unique key on ``add`` and
 * skipped the backup's row. These helpers find the local row by its unique
 * index, record the backup-id to local-id mapping, redirect child foreign
 * keys through it (the backend does the same with ``id_remap``, #49/#115),
 * and let a backup row replace a local row that is still the app's untouched
 * default.
 *
 * @example
 * const existing = (await store.get(id)) ?? (await findByUniqueIndex(store, record));
 */

import type {EntityTable} from "dexie";

import type {RowDict} from "./backup-scope";

/** ``{table: {backup_id: local_id}}`` for rows matched under another id. */
export type IdRemap = Map<string, Map<string, string>>;

/**
 * Child columns that reference a parent the restore can match under another
 * id. Dexie has no foreign-key graph to derive this from, unlike the backend
 * (``_FK_PARENTS``); the badge catalog is the only parent with a unique key
 * that children reference by id.
 */
const FK_PARENTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    user_badges: {badge_id: "badges"},
};

/**
 * Local rows that are still the app's default and carry no user data, by
 * table. They mirror the default factories (``getOrCreateRow`` in
 * storage/gamification/streaks.ts, ``getOrCreateUserXP`` in
 * storage/gamification/gamification.ts).
 */
const PRISTINE_DEFAULTS: Readonly<Record<string, (row: RowDict) => boolean>> = {
    user_streaks: (row) =>
        !row.freezes_available &&
        !row.current_streak_days &&
        !row.longest_streak_days &&
        !row.weekend_mode &&
        row.last_freeze_earned_on == null &&
        row.last_freeze_used_on == null,
    user_xp: (row) => !row.total_xp && (row.level ?? 1) === 1,
};

/**
 * The local row that shares a unique index value with ``record``.
 *
 * @param store - The Dexie table the record restores into.
 * @param record - The incoming backup row.
 * @returns The matching local row, or ``undefined`` when no unique index
 *   matches (or the record lacks a value for it).
 */
export async function findByUniqueIndex(
    store: EntityTable<RowDict, "id">,
    record: RowDict,
): Promise<RowDict | undefined> {
    for (const index of store.schema.indexes) {
        if (!index.unique || index.keyPath == null) continue;
        const paths = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath];
        const values = paths.map((path) => record[path]);
        if (values.some((value) => value === undefined || value === null)) continue;
        const key = (index.compound ? values : values[0]) as string | string[];
        const hit = await store.where(index.name).equals(key).first();
        if (hit) return hit;
    }
    return undefined;
}

/** Record that ``table``'s backup row ``backupId`` lives here as ``localId``. */
export function rememberRemap(
    idRemap: IdRemap,
    table: string,
    backupId: string,
    localId: string,
): void {
    const forTable = idRemap.get(table) ?? new Map<string, string>();
    forTable.set(backupId, localId);
    idRemap.set(table, forTable);
}

/** ``record`` with its parent references redirected to local ids. */
export function redirectFks(table: string, record: RowDict, idRemap: IdRemap): RowDict {
    const parents = FK_PARENTS[table];
    if (!parents) return record;
    const out = {...record};
    for (const [column, parent] of Object.entries(parents)) {
        const value = out[column];
        const mapped = typeof value === "string" ? idRemap.get(parent)?.get(value) : undefined;
        if (mapped) out[column] = mapped;
    }
    return out;
}

/** Whether ``row`` is still the app's untouched default for ``table``. */
export function isPristineDefault(table: string, row: RowDict): boolean {
    return PRISTINE_DEFAULTS[table]?.(row) ?? false;
}
