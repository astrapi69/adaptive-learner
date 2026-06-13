/**
 * Gamification helpers (Phase 29A / v1.16.0).
 *
 * Mirrors the Python ``adaptive_learner_gamification.xp_service``
 * module so the Dexie storage backing produces the same XP shape
 * as the API backing. In Dexie mode there is no backend, so the
 * calculator + persistence run browser-side; in API mode this
 * file's pure-function helpers are still reused by the
 * ``XPNotification`` component for the floating-toast delta.
 *
 * Spec (Phase 29A):
 *   - Base session XP: 50
 *   - Per completed cycle: +10
 *   - Per cycle that reached step 7: +25 (seven-step bonus)
 *   - First session in a new method: +50
 *   - Daily streak multiplier: +25% per consecutive day, caps at 7
 *   - Assessment complete: 100 (flat, no multiplier)
 *   - Conversation imported + analyzed: 75 (flat, no multiplier)
 *
 * Level curve (exponential): threshold(n) = 50 * n * (n - 1).
 * Level 1 starts at 0 XP; level 2 at 100; level 3 at 300; ...
 */

import type {LearningMethod} from "../lib/constants";

import {getDb, newId, nowIso} from "./db";
import type {UserXPRow} from "./db";
import type {XPAwardResult, XPState} from "./types";

// ---- Pure helpers ---------------------------------------------------------

/** XP required to REACH the given level. ``threshold(1) === 0``. */
export function levelThreshold(level: number): number {
    if (level < 1) {
        return 0;
    }
    return 50 * level * (level - 1);
}

/** Highest level the user has reached at this XP total. */
export function computeLevel(totalXp: number): number {
    if (totalXp <= 0) {
        return 1;
    }
    let level = 1;
    while (levelThreshold(level + 1) <= totalXp) {
        level += 1;
        if (level > 1000) {
            break;
        }
    }
    return level;
}

/**
 * Count consecutive calendar days ending at ``today`` that appear
 * in ``activityDates``. Returns 0 if today has no activity.
 */
export function currentStreakDays(
    activityDates: Set<string>,
    today: string,
): number {
    if (!activityDates.has(today)) {
        return 0;
    }
    let streak = 0;
    const cursor = new Date(`${today}T00:00:00Z`);
    while (true) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!activityDates.has(iso)) {
            break;
        }
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

export interface SessionXPInputs {
    cycle_step: number;
    cycle_count: number;
    streak_days: number;
    is_first_method_session: boolean;
}

export function calculateSessionXP(input: SessionXPInputs): XPAwardResult {
    const breakdown: Record<string, number> = {base: 50};
    let completedCycles = Math.max(0, input.cycle_count - 1);
    if (input.cycle_step >= 7) {
        completedCycles += 1;
    }
    if (completedCycles > 0) {
        breakdown.cycle_bonus = 10 * completedCycles;
        breakdown.seven_step_bonus = 25 * completedCycles;
    }
    if (input.is_first_method_session) {
        breakdown.first_method_bonus = 50;
    }
    const preMultiplier = Object.values(breakdown).reduce(
        (acc, n) => acc + n,
        0,
    );
    const cappedDays = Math.min(input.streak_days, 7);
    const multiplier = 1.0 + 0.25 * cappedDays;
    // Match Python's banker's rounding: round half to even. This
    // keeps the API-mode and Dexie-mode results byte-identical.
    const xpEarned = bankersRound(preMultiplier * multiplier);
    if (input.streak_days > 0) {
        breakdown.streak_multiplier_pct = Math.round((multiplier - 1.0) * 100);
    }
    return {
        xp_earned: xpEarned,
        xp_total: 0,
        level: 1,
        level_up: false,
        multiplier,
        breakdown,
        reason: "session_complete",
    };
}

function bankersRound(value: number): number {
    // Python's ``round`` uses banker's rounding. The naive JS
    // ``Math.round`` rounds half AWAY from zero (1.5 -> 2, 2.5 -> 3).
    // We need 0.5 -> 0, 1.5 -> 2, 2.5 -> 2, 3.5 -> 4.
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly 0.5 — pick even neighbour.
    return floor % 2 === 0 ? floor : floor + 1;
}

// ---- Dexie persistence ----------------------------------------------------

async function getOrCreateUserXP(userId: string): Promise<UserXPRow> {
    const db = getDb();
    const existing = await db.userXp.where({user_id: userId}).first();
    if (existing) {
        return existing;
    }
    const row: UserXPRow = {
        id: newId(),
        user_id: userId,
        total_xp: 0,
        level: 1,
        updated_at: nowIso(),
    };
    await db.userXp.put(row);
    return row;
}

export async function persistXP(
    userId: string,
    deltaXP: number,
): Promise<{row: UserXPRow; levelUp: boolean}> {
    const db = getDb();
    // Ensure the singleton row exists; the create-race on this
    // (two concurrent first-awards) is handled in #390 Phase 2 via
    // a unique index on user_id. Phase 1 closes the increment race.
    await getOrCreateUserXP(userId);
    // ``modify`` runs the read AND the write inside one IndexedDB
    // readwrite transaction. Concurrent ``modify`` calls on the
    // same store are serialized by IndexedDB, so ``total_xp +=
    // deltaXP`` is atomic — no lost update when a lesson-complete
    // and a session-end award overlap (#390 Class A).
    let captured: {row: UserXPRow; levelUp: boolean} | null = null;
    await db.userXp
        .where({user_id: userId})
        .modify((row) => {
            const previousLevel = row.level;
            row.total_xp += deltaXP;
            row.level = computeLevel(row.total_xp);
            row.updated_at = nowIso();
            captured = {row: {...row}, levelUp: row.level > previousLevel};
        });
    if (captured === null) {
        // Defensive: the ensure-step above guarantees a row, so this
        // only fires if the row vanished between ensure and modify.
        const fallback = await getOrCreateUserXP(userId);
        return {row: fallback, levelUp: false};
    }
    return captured;
}

export async function userActivityDates(userId: string): Promise<Set<string>> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) {
        return new Set();
    }
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    const days = new Set<string>();
    for (const s of sessions) {
        if (s.started_at) {
            days.add(s.started_at.slice(0, 10));
        }
    }
    return days;
}

async function isFirstSessionForMethod(
    userId: string,
    method: LearningMethod,
    excludeSessionId: string | null,
): Promise<boolean> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    const sessions = await db.learningSessions
        .filter(
            (s) =>
                projectIds.has(s.project_id) &&
                s.method === method &&
                s.status === "completed" &&
                (excludeSessionId === null || s.id !== excludeSessionId),
        )
        .toArray();
    return sessions.length === 0;
}

export interface SessionAwardContext {
    userId: string;
    sessionId: string | null;
    method: LearningMethod;
    cycleStep: number;
    cycleCount: number;
}

/**
 * Award XP for a completed session in Dexie mode. Mirrors the
 * backend ``award_xp_for_session`` so a Dexie-mode session-end
 * shows the same animation as the API-mode equivalent.
 */
export async function awardXPForSession(
    ctx: SessionAwardContext,
): Promise<XPAwardResult> {
    const today = nowIso().slice(0, 10);
    const activity = await userActivityDates(ctx.userId);
    const streak = currentStreakDays(activity, today);
    const firstTime = await isFirstSessionForMethod(
        ctx.userId,
        ctx.method,
        ctx.sessionId,
    );
    const award = calculateSessionXP({
        cycle_step: ctx.cycleStep,
        cycle_count: ctx.cycleCount,
        streak_days: streak,
        is_first_method_session: firstTime,
    });
    const {row, levelUp} = await persistXP(ctx.userId, award.xp_earned);
    return {
        ...award,
        xp_total: row.total_xp,
        level: row.level,
        level_up: levelUp,
    };
}

/** Flat earn (assessment, import). No multiplier. */
export async function awardXPFlat(
    userId: string,
    amount: number,
    reason: string,
): Promise<XPAwardResult> {
    const {row, levelUp} = await persistXP(userId, amount);
    return {
        xp_earned: amount,
        xp_total: row.total_xp,
        level: row.level,
        level_up: levelUp,
        multiplier: 1.0,
        breakdown: {flat: amount},
        reason,
    };
}

/** Read-only state for the dashboard XP widget. */
export async function getXPState(userId: string): Promise<XPState> {
    const db = getDb();
    const row = await db.userXp.where({user_id: userId}).first();
    if (!row) {
        return {
            user_id: userId,
            total_xp: 0,
            level: 1,
            xp_into_level: 0,
            xp_to_next_level: levelThreshold(2),
            next_level_threshold: levelThreshold(2),
        };
    }
    const current = levelThreshold(row.level);
    const next = levelThreshold(row.level + 1);
    return {
        user_id: userId,
        total_xp: row.total_xp,
        level: row.level,
        xp_into_level: row.total_xp - current,
        xp_to_next_level: Math.max(0, next - row.total_xp),
        next_level_threshold: next,
        updated_at: row.updated_at,
    };
}
