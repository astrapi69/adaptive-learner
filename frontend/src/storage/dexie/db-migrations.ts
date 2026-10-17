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

import {recordCompletedAttempt} from "../lessons/lesson-attempt";

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

/** What {@link completeRowsThatReachedSummary} did, for the log and tests. */
export interface CompletionRepairCounts {
    /** ``in_progress`` / ``paused`` rows looked at. */
    candidates: number;
    /** Rows completed by this run. */
    repaired: number;
    /** Candidates whose lesson is not in the local content cache. */
    withoutLesson: number;
}

/** Numeric ``a.b.c`` comparison (a string comparison puts "1.9" above "1.10", #3788). */
function compareVersions(a: string, b: string): number {
    const pa = String(a ?? "").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b ?? "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** Step count of the cached lesson, or null when it is not cached. */
async function cachedStepCount(
    contentSets: Table<MigrationRow, string>,
    contentSetFiles: Table<MigrationRow, string>,
    source: string,
    setId: string,
    filename: string,
): Promise<number | null> {
    const versions = (await contentSets.where("set_id").equals(setId).toArray()).filter(
        (row) => row.source === source,
    );
    if (versions.length === 0) return null;
    versions.sort((a, b) => compareVersions(String(a.version), String(b.version)));
    const latest = versions[versions.length - 1];
    const file = await contentSetFiles.get(`${latest.id}#lessons/${filename}`);
    if (!file || typeof file.body !== "string") return null;
    try {
        const steps = (JSON.parse(file.body) as {steps?: unknown}).steps;
        return Array.isArray(steps) && steps.length > 0 ? steps.length : null;
    } catch {
        return null;
    }
}

/**
 * #3792 one-time repair: complete the progress rows that reached the summary.
 *
 * Before #3792 only a "Mark as complete" button wrote ``completed``, so a
 * learner who went on with "Next lesson" kept every finished lesson
 * ``in_progress`` (``paused`` once left). A row reached the summary when its
 * ``current_step`` is at least the step count of the cached lesson: the
 * summary index is ``lesson.steps.length``, and that is what the lesson
 * writes as ``current_step`` when the learner moves past the last step.
 *
 * Only ``in_progress`` and ``paused`` rows are candidates, so a second run
 * finds nothing to do. A row whose lesson is not cached is left alone (its
 * step count is unknown). The completion is recorded at the row's
 * ``updated_at``, the last time the learner touched it, so "completed today"
 * missions do not count old lessons. No XP is granted and nothing is
 * celebrated: those belong to the summary's completion flow, which these runs
 * never reached.
 */
export async function completeRowsThatReachedSummary(
    lessonProgress: Table<MigrationRow, string>,
    contentSets: Table<MigrationRow, string>,
    contentSetFiles: Table<MigrationRow, string>,
): Promise<CompletionRepairCounts> {
    const counts: CompletionRepairCounts = {candidates: 0, repaired: 0, withoutLesson: 0};
    const rows = await lessonProgress
        .filter((row) => row.status === "in_progress" || row.status === "paused")
        .toArray();
    for (const row of rows) {
        counts.candidates += 1;
        const steps = await cachedStepCount(
            contentSets,
            contentSetFiles,
            String(row.source ?? ""),
            String(row.set_id ?? ""),
            String(row.lesson_filename ?? ""),
        );
        if (steps === null) {
            counts.withoutLesson += 1;
            continue;
        }
        if (Number(row.current_step ?? 0) < steps) continue;
        const at = String(row.updated_at ?? row.paused_at ?? "");
        const repaired = {...row} as MigrationRow & Parameters<typeof recordCompletedAttempt>[0];
        repaired.status = "completed";
        repaired.completed_at = at;
        repaired.paused_at = null;
        repaired.abandoned_at = null;
        recordCompletedAttempt(repaired, at);
        await lessonProgress.put(repaired);
        counts.repaired += 1;
    }
    return counts;
}
