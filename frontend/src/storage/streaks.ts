/**
 * Browser-side enhanced streak service (Phase 29C / v1.16.0).
 *
 * Mirrors ``adaptive_learner_gamification.streak_service`` so a
 * Dexie-mode user sees the same freeze + weekend-mode behaviour
 * as an API-mode user. Same constants, same walk semantics.
 */

import {getDb, newId, nowIso} from "./dexie/db";
import type {UserStreakRow} from "./dexie/db";

const FREEZE_GRANT_INTERVAL_DAYS = 7;
const FREEZE_STOCK_CAP = 3;

export interface StreakState {
    user_id: string;
    current_streak_days: number;
    longest_streak_days: number;
    freezes_available: number;
    weekend_mode: boolean;
    last_freeze_earned_on: string | null;
    last_freeze_used_on: string | null;
}

export interface HeatmapEntry {
    date: string;
    count: number;
}

function isWeekend(iso: string): boolean {
    // Monday=1 .. Sunday=0 in JS getUTCDay; Sat=6, Sun=0.
    const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return d === 0 || d === 6;
}

function daysBetween(a: string, b: string): number {
    const da = new Date(`${a}T00:00:00Z`).getTime();
    const db = new Date(`${b}T00:00:00Z`).getTime();
    return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

async function getOrCreateRow(userId: string): Promise<UserStreakRow> {
    const db = getDb();
    // #390 Phase 2: first-or-create inside one rw transaction so two
    // concurrent callers (the streak is written on the read path too)
    // converge to a single row. The &user_id unique index (Dexie v27)
    // is the DB-level backstop.
    let result: UserStreakRow | null = null;
    await db.transaction("rw", db.userStreaks, async () => {
        const existing = await db.userStreaks
            .where({user_id: userId})
            .first();
        if (existing) {
            result = existing;
            return;
        }
        const row: UserStreakRow = {
            id: newId(),
            user_id: userId,
            freezes_available: 0,
            last_freeze_earned_on: null,
            last_freeze_used_on: null,
            weekend_mode: false,
            current_streak_days: 0,
            longest_streak_days: 0,
            updated_at: nowIso(),
        };
        await db.userStreaks.put(row);
        result = row;
    });
    return result as unknown as UserStreakRow;
}

async function userActivityDates(userId: string): Promise<Set<string>> {
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    if (projectIds.size === 0) return new Set();
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    const days = new Set<string>();
    for (const s of sessions) {
        if (s.started_at) days.add(s.started_at.slice(0, 10));
    }
    return days;
}

/** Pure walker mirroring the Python implementation. */
export function computeCurrentStreakWithState(
    activityDates: Set<string>,
    today: string,
    weekendMode: boolean,
    freezesAvailable: number,
): {streak: number; freezesConsumed: number} {
    if (
        !activityDates.has(today) &&
        !weekendMode &&
        freezesAvailable <= 0
    ) {
        return {streak: 0, freezesConsumed: 0};
    }
    let streak = 0;
    let freezesUsed = 0;
    const cursor = new Date(`${today}T00:00:00Z`);
    while (true) {
        const iso = cursor.toISOString().slice(0, 10);
        if (activityDates.has(iso)) {
            streak += 1;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
            continue;
        }
        if (weekendMode && isWeekend(iso)) {
            cursor.setUTCDate(cursor.getUTCDate() - 1);
            continue;
        }
        if (freezesUsed < freezesAvailable) {
            freezesUsed += 1;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
            continue;
        }
        break;
    }
    return {streak, freezesConsumed: freezesUsed};
}

export async function updateStreakState(userId: string): Promise<StreakState> {
    await getOrCreateRow(userId);
    const activity = await userActivityDates(userId);
    const today = nowIso().slice(0, 10);
    // ``modify`` reads the streak row AND writes it back inside one
    // IndexedDB readwrite transaction, so a concurrent
    // ``setWeekendMode`` (or another ``updateStreakState`` on the
    // read path) can't clobber the row with a stale snapshot (#390
    // Class A). ``weekend_mode`` is read from the row INSIDE the
    // modify, so a just-committed toggle is honoured.
    let captured: StreakState | null = null;
    await getDb()
        .userStreaks.where({user_id: userId})
        .modify((row) => {
            const {streak, freezesConsumed} = computeCurrentStreakWithState(
                activity,
                today,
                row.weekend_mode,
                row.freezes_available,
            );
            let newFreezes = Math.max(0, row.freezes_available - freezesConsumed);
            let lastUsed = row.last_freeze_used_on;
            if (freezesConsumed > 0) {
                lastUsed = nowIso();
            }
            let lastEarned = row.last_freeze_earned_on;
            if (streak > 0 && streak % FREEZE_GRANT_INTERVAL_DAYS === 0) {
                const tooSoon =
                    lastEarned !== null &&
                    daysBetween(lastEarned.slice(0, 10), today) < 6;
                if (!tooSoon && newFreezes < FREEZE_STOCK_CAP) {
                    newFreezes += 1;
                    lastEarned = nowIso();
                }
            }
            const longest = Math.max(row.longest_streak_days, streak);
            row.freezes_available = newFreezes;
            row.last_freeze_used_on = lastUsed;
            row.last_freeze_earned_on = lastEarned;
            row.current_streak_days = streak;
            row.longest_streak_days = longest;
            row.updated_at = nowIso();
            captured = {
                user_id: userId,
                current_streak_days: streak,
                longest_streak_days: longest,
                freezes_available: newFreezes,
                weekend_mode: row.weekend_mode,
                last_freeze_earned_on: lastEarned,
                last_freeze_used_on: lastUsed,
            };
        });
    if (captured !== null) return captured;
    // Defensive: row vanished between ensure and modify.
    const fallback = await getOrCreateRow(userId);
    return {
        user_id: userId,
        current_streak_days: fallback.current_streak_days,
        longest_streak_days: fallback.longest_streak_days,
        freezes_available: fallback.freezes_available,
        weekend_mode: fallback.weekend_mode,
        last_freeze_earned_on: fallback.last_freeze_earned_on,
        last_freeze_used_on: fallback.last_freeze_used_on,
    };
}

export async function getStreakState(userId: string): Promise<StreakState> {
    return await updateStreakState(userId);
}

export async function setWeekendMode(
    userId: string,
    enabled: boolean,
): Promise<StreakState> {
    await getOrCreateRow(userId);
    // Atomic single-field write so a concurrent ``updateStreakState``
    // (which preserves whatever ``weekend_mode`` it reads) cannot
    // clobber the toggle with a stale snapshot (#390 Class A).
    await getDb()
        .userStreaks.where({user_id: userId})
        .modify((row) => {
            row.weekend_mode = enabled;
            row.updated_at = nowIso();
        });
    return await updateStreakState(userId);
}

export async function calendarHeatmap(
    userId: string,
    days: number = 365,
): Promise<HeatmapEntry[]> {
    const clamped = Math.max(7, Math.min(730, days));
    const today = new Date(nowIso().slice(0, 10) + "T00:00:00Z");
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - (clamped - 1));
    const db = getDb();
    const projects = await db.learningProjects
        .where({user_id: userId})
        .toArray();
    const projectIds = new Set(projects.map((p) => p.id));
    const sessions = await db.learningSessions
        .filter((s) => projectIds.has(s.project_id))
        .toArray();
    const counts = new Map<string, number>();
    for (const s of sessions) {
        if (!s.started_at) continue;
        const day = s.started_at.slice(0, 10);
        const startIso = start.toISOString().slice(0, 10);
        const todayIso = today.toISOString().slice(0, 10);
        if (day < startIso || day > todayIso) continue;
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const out: HeatmapEntry[] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
        const iso = cursor.toISOString().slice(0, 10);
        out.push({date: iso, count: counts.get(iso) ?? 0});
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
}
