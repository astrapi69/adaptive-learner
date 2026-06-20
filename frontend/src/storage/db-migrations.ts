/**
 * Dexie upgrade-time data migrations (extracted from ``db.ts``).
 *
 * These are the dedup helpers the schema's ``version(n).upgrade(...)``
 * callbacks run to repair already-populated browsers when a new unique index
 * lands (the #390 read-modify-write remediation: v25 -> v27 singleton +
 * badge-catalog + user-badge dedup). They are pure data-shaping over a Dexie
 * transaction table — no schema knowledge — so they live next to, but apart
 * from, the schema declaration in ``db.ts``.
 *
 * Internal to the storage layer; consumed only by ``db.ts``.
 */

import type {Table} from "dexie";

/** A generic upgrade-time row: an opaque record with a string ``id``. */
export type MigrationRow = Record<string, unknown> & {id: string};

/**
 * Delete duplicate singleton rows so a store keeps exactly one row per
 * ``user_id``. ``aWins(a, b)`` returns true when ``a`` should survive
 * over the currently-held ``b`` (the loser is deleted).
 */
export async function dedupeSingletonByUser(
    table: Table<MigrationRow, string>,
    aWins: (a: MigrationRow, b: MigrationRow) => boolean,
): Promise<void> {
    const rows = await table.toArray();
    const winnerByUser = new Map<string, MigrationRow>();
    const toDelete: string[] = [];
    for (const row of rows) {
        const userId = String(row.user_id ?? "");
        const current = winnerByUser.get(userId);
        if (!current) {
            winnerByUser.set(userId, row);
            continue;
        }
        if (aWins(row, current)) {
            toDelete.push(current.id);
            winnerByUser.set(userId, row);
        } else {
            toDelete.push(row.id);
        }
    }
    for (const id of toDelete) await table.delete(id);
}

/**
 * Dedup the badge catalog by ``key``: pick the first row per key as the
 * survivor, remap every ``userBadges.badge_id`` that points at a
 * duplicate onto the survivor's id, then delete the duplicate badge rows.
 */
export async function dedupeBadgesByKey(
    badges: Table<MigrationRow, string>,
    userBadges: Table<MigrationRow, string>,
): Promise<void> {
    const survivorByKey = new Map<string, MigrationRow>();
    const remap = new Map<string, string>();
    const toDelete: string[] = [];
    for (const badge of await badges.toArray()) {
        const key = String(badge.key ?? "");
        const survivor = survivorByKey.get(key);
        if (!survivor) {
            survivorByKey.set(key, badge);
            continue;
        }
        remap.set(badge.id, survivor.id);
        toDelete.push(badge.id);
    }
    if (remap.size > 0) {
        for (const userBadge of await userBadges.toArray()) {
            const target = remap.get(String(userBadge.badge_id ?? ""));
            if (target) {
                userBadge.badge_id = target;
                await userBadges.put(userBadge);
            }
        }
    }
    for (const id of toDelete) await badges.delete(id);
}

const TIER_RANK: Record<string, number> = {bronze: 0, silver: 1, gold: 2};

/** Keep one userBadges row per (user_id, badge_id); on a clash keep the
 *  higher tier, else the earlier ``earned_at``. */
export async function dedupeUserBadgesByPair(
    table: Table<MigrationRow, string>,
): Promise<void> {
    const winnerByPair = new Map<string, MigrationRow>();
    const toDelete: string[] = [];
    for (const row of await table.toArray()) {
        const pair = `${String(row.user_id ?? "")}#${String(row.badge_id ?? "")}`;
        const current = winnerByPair.get(pair);
        if (!current) {
            winnerByPair.set(pair, row);
            continue;
        }
        const rowRank = TIER_RANK[String(row.tier ?? "bronze")] ?? 0;
        const curRank = TIER_RANK[String(current.tier ?? "bronze")] ?? 0;
        const rowWins =
            rowRank > curRank ||
            (rowRank === curRank &&
                String(row.earned_at ?? "").localeCompare(
                    String(current.earned_at ?? ""),
                ) < 0);
        if (rowWins) {
            toDelete.push(current.id);
            winnerByPair.set(pair, row);
        } else {
            toDelete.push(row.id);
        }
    }
    for (const id of toDelete) await table.delete(id);
}
