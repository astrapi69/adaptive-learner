/**
 * Browser-side badge catalog + evaluator (Phase 29B).
 *
 * Mirrors ``adaptive_learner_gamification.badge_service`` so a
 * Dexie-mode user earns the same badges as an API-mode user.
 * The catalog is seeded once on first ``listBadges`` call from
 * the bundled YAML constant below — kept in-source to avoid a
 * runtime YAML dependency in the browser bundle.
 */

import {getDb, newId, nowIso} from "./dexie/db";
import type {BadgeRow, UserBadgeRow} from "./dexie/db";
import {computeLevel, persistXP} from "./gamification";
import type {
    BadgeEvaluationResult,
    BadgeTierUpgrade,
    BadgeWithProgress,
} from "./types";

import {BUNDLED_BADGES} from "./dexie/badges-data";

// Re-exported so existing ``import {BUNDLED_BADGES} from "./badges"``
// sites keep working; the data now lives in badges-data.ts (no
// db.ts cycle) so db.ts can static-import it for the v21 upgrade.
export {BUNDLED_BADGES};

async function ensureCatalogSeeded(): Promise<Map<string, BadgeRow>> {
    const db = getDb();
    const existing = await db.badges.toArray();
    if (existing.length >= BUNDLED_BADGES.length) {
        return new Map(existing.map((b) => [b.key, b]));
    }
    // #390 Phase 2: seed inside one rw transaction so two concurrent
    // first-evals don't each insert the full catalog (duplicate key
    // rows). The seen-set is re-read INSIDE the tx, so the serialized
    // second caller observes the first's inserts. The ``&key`` unique
    // index (Dexie v27) is the DB-level backstop.
    await db.transaction("rw", db.badges, async () => {
        const now = nowIso();
        const seen = new Map(
            (await db.badges.toArray()).map((b) => [b.key, b]),
        );
        for (const spec of BUNDLED_BADGES) {
            if (seen.has(spec.key)) {
                continue;
            }
            const row: BadgeRow = {
                id: newId(),
                key: spec.key,
                name_key: spec.name_key,
                description_key: spec.description_key,
                icon: spec.icon,
                category: spec.category,
                base_tier: spec.base_tier ?? "bronze",
                tier_thresholds: spec.tier_thresholds ?? null,
                created_at: now,
                updated_at: now,
            };
            await db.badges.put(row);
            seen.set(spec.key, row);
        }
    });
    const seeded = await db.badges.toArray();
    return new Map(seeded.map((b) => [b.key, b]));
}

async function completedSessionCount(userId: string): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter(
            (s) => projectIds.has(s.project_id) && s.status === "completed",
        )
        .toArray();
    return sessions.length;
}

async function sessionsForMethod(
    userId: string,
    method: string,
): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const rows = await db.learningSessions
        .filter(
            (s) =>
                projectIds.has(s.project_id) &&
                s.method === method &&
                s.status === "completed",
        )
        .toArray();
    return rows.length;
}

async function distinctMethodsUsed(userId: string): Promise<Set<string>> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return new Set();
    const sessions = await db.learningSessions
        .filter(
            (s) => projectIds.has(s.project_id) && s.status === "completed",
        )
        .toArray();
    return new Set(sessions.map((s) => s.method));
}

async function currentStreakDaysForUser(userId: string): Promise<number> {
    const {currentStreakDays} = await import("./gamification");
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    const days = new Set<string>();
    for (const s of sessions) {
        if (s.started_at) days.add(s.started_at.slice(0, 10));
    }
    const today = nowIso().slice(0, 10);
    return currentStreakDays(days, today);
}

async function userLevel(userId: string): Promise<number> {
    const db = getDb();
    const row = await db.userXp.where({user_id: userId}).first();
    if (!row) return 1;
    return computeLevel(row.total_xp);
}

async function hasAssessment(userId: string): Promise<boolean> {
    const db = getDb();
    const profile = await db.learningProfiles
        .where({user_id: userId})
        .first();
    return profile !== undefined;
}

async function importCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.importedConversations.where({user_id: userId}).count();
}

async function providerCount(userId: string): Promise<number> {
    const db = getDb();
    const settings = await db.userSettings.where({user_id: userId}).first();
    if (!settings) return 0;
    return [
        settings.api_key_anthropic,
        settings.api_key_openai,
        settings.api_key_gemini,
    ].filter(Boolean).length;
}

async function languagesUsed(userId: string): Promise<number> {
    const db = getDb();
    const langs = new Set<string>();
    const user = await db.users.get(userId);
    if (user?.language) langs.add(user.language);
    const settings = await db.userSettings.where({user_id: userId}).first();
    if (settings?.language) langs.add(settings.language);
    const curricula = await db.curricula.where({user_id: userId}).toArray();
    for (const c of curricula) {
        if (c.language) langs.add(c.language);
    }
    return langs.size;
}

async function maxCycleCountInOneSession(userId: string): Promise<number> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return 0;
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    let max = 0;
    for (const s of sessions) {
        // ``cycle_count`` was added in v1.4.0 / Phase 17 but the
        // Dexie row type doesn't carry it as a typed field; read
        // defensively.
        const cc = Number((s as unknown as {cycle_count?: number}).cycle_count ?? 0);
        if (cc > max) max = cc;
    }
    return max;
}

// --- Lesson-badge helpers (Phase 50E / v1.33.0 / D-DEXIE-GAMIFICATION)
//
// Mirror the Python helpers in ``badge_service.py``:
//   _completed_lesson_count, _last_n_lessons_all_three_star,
//   _mastered_elements_count.

async function completedLessonCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.lessonProgress
        .where({user_id: userId})
        .filter((row) => row.status === "completed")
        .count();
}

async function lastNLessonsAllThreeStar(
    userId: string,
    n: number,
): Promise<boolean> {
    const db = getDb();
    const rows = await db.lessonProgress
        .where({user_id: userId})
        .filter((row) => row.status === "completed")
        .toArray();
    if (rows.length < n) {
        return false;
    }
    // Order by completed_at desc; rows without completed_at sort to
    // the end (newest-first equivalent of Python's
    // ``order_by(completed_at.desc()).limit(n)``).
    rows.sort((a, b) => {
        const ac = a.completed_at ?? "";
        const bc = b.completed_at ?? "";
        return bc.localeCompare(ac);
    });
    const top = rows.slice(0, n);
    const {computeStars} = await import("../lib/gamification/lesson-xp");
    return top.every(
        (row) => computeStars(row.score_correct, row.score_total) === 3,
    );
}

async function masteredElementsCount(userId: string): Promise<number> {
    const db = getDb();
    return await db.elementErrors
        .where({user_id: userId})
        .filter((row) => row.mastered === true)
        .count();
}

type Evaluator = (userId: string) => Promise<boolean>;

const EVALUATORS: Record<string, Evaluator> = {
    first_session: async (uid) => (await completedSessionCount(uid)) >= 1,
    first_assessment: async (uid) => await hasAssessment(uid),
    first_import: async (uid) => (await importCount(uid)) >= 1,
    streak_3_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 3,
    streak_7_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 7,
    streak_30_days: async (uid) => (await currentStreakDaysForUser(uid)) >= 30,
    streak_100_days: async (uid) =>
        (await currentStreakDaysForUser(uid)) >= 100,
    all_six_methods: async (uid) =>
        (await distinctMethodsUsed(uid)).size >= 6,
    deductive_10: async (uid) =>
        (await sessionsForMethod(uid, "deductive")) >= 10,
    inductive_10: async (uid) =>
        (await sessionsForMethod(uid, "inductive")) >= 10,
    error_based_10: async (uid) =>
        (await sessionsForMethod(uid, "error_based")) >= 10,
    dialogic_10: async (uid) =>
        (await sessionsForMethod(uid, "dialogic")) >= 10,
    contextual_10: async (uid) =>
        (await sessionsForMethod(uid, "contextual")) >= 10,
    ai_adaptive_10: async (uid) =>
        (await sessionsForMethod(uid, "ai_adaptive")) >= 10,
    five_cycles_one_session: async (uid) =>
        (await maxCycleCountInOneSession(uid)) >= 5,
    sessions_10: async (uid) => (await completedSessionCount(uid)) >= 10,
    sessions_50: async (uid) => (await completedSessionCount(uid)) >= 50,
    sessions_100: async (uid) => (await completedSessionCount(uid)) >= 100,
    level_5: async (uid) => (await userLevel(uid)) >= 5,
    level_10: async (uid) => (await userLevel(uid)) >= 10,
    level_25: async (uid) => (await userLevel(uid)) >= 25,
    two_languages: async (uid) => (await languagesUsed(uid)) >= 2,
    three_providers: async (uid) => (await providerCount(uid)) >= 3,
    import_10_conversations: async (uid) => (await importCount(uid)) >= 10,
    // Lesson badges (Phase 50E / v1.33.0 / D-DEXIE-GAMIFICATION).
    first_lesson: async (uid) => (await completedLessonCount(uid)) >= 1,
    lessons_10: async (uid) => (await completedLessonCount(uid)) >= 10,
    three_star_streak: async (uid) => await lastNLessonsAllThreeStar(uid, 3),
    review_master: async (uid) => (await masteredElementsCount(uid)) >= 50,
};

// --- Tier evaluation (Phase 57 / v1.40.0) ---------------------------------
// Mirrors the Python ``badge_service`` tier logic; a cross-language
// golden (tests/fixtures/badge-tier-parity/) pins evaluateBadgeTier +
// tierUpgradeXp byte-identically.

export const TIER_ORDER = ["bronze", "silver", "gold"] as const;

type TierThresholds = Record<string, {threshold: number; xp_bonus: number}>;

/** A pending badge award resolved in Phase A (outside any transaction)
 *  and applied atomically in Phase B of ``evaluateBadgesForUser``. */
type BadgeDecision =
    | {
          kind: "dynamic";
          key: string;
          badgeId: string;
          target: string;
          thresholds: TierThresholds;
      }
    | {kind: "static"; key: string; badgeId: string; baseTier: string};

/** DYNAMIC badge metrics — key -> count. MUST match the Python
 *  ``_TIER_METRICS`` and the keys carrying ``tier_thresholds`` in
 *  BUNDLED_BADGES. */
const DYNAMIC_TIER_METRICS: Record<
    string,
    (userId: string) => Promise<number>
> = {
    lessons_10: completedLessonCount,
    review_master: masteredElementsCount,
};

/** Highest tier whose threshold ``value`` meets, else null. */
export function evaluateBadgeTier(
    value: number,
    thresholds: TierThresholds,
): string | null {
    let earned: string | null = null;
    for (const tier of TIER_ORDER) {
        const spec = thresholds[tier];
        if (spec !== undefined && value >= spec.threshold) earned = tier;
    }
    return earned;
}

/** XP delta for old -> new tier (cumulative xp_bonus totals). */
export function tierUpgradeXp(
    oldTier: string | null,
    newTier: string,
    thresholds: TierThresholds,
): number {
    const newTotal = thresholds[newTier].xp_bonus;
    const oldTotal = oldTier ? thresholds[oldTier].xp_bonus : 0;
    return Math.max(0, newTotal - oldTotal);
}

function tierIndex(tier: string | null | undefined): number {
    if (!tier) return -1;
    return (TIER_ORDER as readonly string[]).indexOf(tier);
}

/**
 * Run every evaluator; insert newly-earned rows + climb dynamic-badge
 * tiers in place (high-water mark, never demote), awarding the XP
 * delta on each transition. Returns the newly-earned keys + the tier
 * upgrades (for the celebration bus). Mirrors the Python
 * ``evaluate_user``.
 */
export async function evaluateBadgesForUser(
    userId: string,
): Promise<BadgeEvaluationResult> {
    const catalog = await ensureCatalogSeeded();
    const db = getDb();

    // Phase A (no transaction): compute every evaluator's decision.
    // The metric reads, the metric helpers' dynamic ``import()``s, and
    // the defensive per-evaluator try/catch all happen HERE, outside any
    // transaction. A Dexie ``rw`` transaction must never await a
    // non-Dexie promise (it commits the zone early), so the dynamic
    // imports cannot live inside the critical section below.
    const decisions: BadgeDecision[] = [];
    for (const [key, predicate] of Object.entries(EVALUATORS)) {
        const badge = catalog.get(key);
        if (!badge) continue;
        const metricFn = DYNAMIC_TIER_METRICS[key];
        const thresholds = badge.tier_thresholds ?? null;
        try {
            if (metricFn && thresholds) {
                const value = await metricFn(userId);
                const target = evaluateBadgeTier(value, thresholds);
                if (target === null) continue;
                decisions.push({
                    kind: "dynamic",
                    key,
                    badgeId: badge.id,
                    target,
                    thresholds,
                });
            } else if (await predicate(userId)) {
                decisions.push({
                    kind: "static",
                    key,
                    badgeId: badge.id,
                    baseTier: badge.base_tier ?? "bronze",
                });
            }
        } catch (err) {
            console.warn(`Badge evaluator ${key} threw`, err);
        }
    }

    // Phase B (atomic): re-read the earned state INSIDE one rw
    // transaction over [userBadges, userXp] and apply the inserts /
    // tier upgrades there, so two concurrent evaluations (e.g. a lesson
    // completion overlapping a session end) can't double-insert the
    // same badge row or double-award the tier XP (#390 Class A). The XP
    // deltas are accumulated and persisted once via ``persistXP`` (which
    // joins this transaction because ``userXp`` is in scope).
    const earned: string[] = [];
    const upgrades: BadgeTierUpgrade[] = [];
    let pendingXp = 0;
    await db.transaction("rw", [db.userBadges, db.userXp], async () => {
        const earnedRows = await db.userBadges
            .where({user_id: userId})
            .toArray();
        const rowByBadgeId = new Map(earnedRows.map((r) => [r.badge_id, r]));
        for (const decision of decisions) {
            const existing = rowByBadgeId.get(decision.badgeId);
            if (decision.kind === "dynamic") {
                if (!existing) {
                    const now = nowIso();
                    const row: UserBadgeRow = {
                        id: newId(),
                        user_id: userId,
                        badge_id: decision.badgeId,
                        tier: decision.target,
                        earned_at: now,
                        updated_at: now,
                    };
                    await db.userBadges.put(row);
                    rowByBadgeId.set(decision.badgeId, row);
                    const xp = tierUpgradeXp(null, decision.target, decision.thresholds);
                    earned.push(decision.key);
                    upgrades.push({
                        key: decision.key,
                        old_tier: null,
                        new_tier: decision.target,
                        xp_awarded: xp,
                    });
                    pendingXp += xp;
                } else if (tierIndex(decision.target) > tierIndex(existing.tier)) {
                    const old = existing.tier ?? "bronze";
                    await db.userBadges.update(existing.id, {
                        tier: decision.target,
                        updated_at: nowIso(),
                    });
                    existing.tier = decision.target;
                    const xp = tierUpgradeXp(old, decision.target, decision.thresholds);
                    upgrades.push({
                        key: decision.key,
                        old_tier: old,
                        new_tier: decision.target,
                        xp_awarded: xp,
                    });
                    pendingXp += xp;
                }
            } else {
                if (existing) continue;
                const now = nowIso();
                const row: UserBadgeRow = {
                    id: newId(),
                    user_id: userId,
                    badge_id: decision.badgeId,
                    tier: decision.baseTier,
                    earned_at: now,
                    updated_at: now,
                };
                await db.userBadges.put(row);
                rowByBadgeId.set(decision.badgeId, row);
                earned.push(decision.key);
            }
        }
        if (pendingXp > 0) {
            await persistXP(userId, pendingXp);
        }
    });
    return {earned, upgrades};
}

/** Catalog + per-user earn state for the dashboard showcase. */
export async function listBadgesWithProgress(
    userId: string,
): Promise<BadgeWithProgress[]> {
    const catalog = await ensureCatalogSeeded();
    const db = getDb();
    const earned = await db.userBadges.where({user_id: userId}).toArray();
    const earnedMap = new Map(earned.map((r) => [r.badge_id, r]));
    const out: BadgeWithProgress[] = [];
    for (const badge of Array.from(catalog.values()).sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        return c !== 0 ? c : a.key.localeCompare(b.key);
    })) {
        const earnedRow = earnedMap.get(badge.id);
        const baseTier = badge.base_tier ?? "bronze";
        // Earned tier when earned, else the badge's locked base tier.
        const tier = earnedRow?.tier ?? baseTier;
        out.push({
            key: badge.key,
            name_key: badge.name_key,
            description_key: badge.description_key,
            icon: badge.icon,
            category: badge.category,
            base_tier: baseTier,
            tier,
            tier_thresholds: badge.tier_thresholds ?? null,
            earned: earnedRow !== undefined,
            earned_at: earnedRow?.earned_at ?? null,
            progress: null,
        });
    }
    return out;
}
