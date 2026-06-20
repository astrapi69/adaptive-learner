/**
 * Dexie-mode daily missions (EXP-010 / Phase 56C).
 *
 * Client-side assignment + progress evaluation against the
 * existing IndexedDB tables (lessonProgress, elementErrors,
 * userStreaks, userXp) - no API roundtrip, full GH-Pages support.
 *
 * ``getDailyMissionsDexie`` is idempotent for a given day: it
 * assigns the day's missions on first call (deterministic via the
 * generator) and re-evaluates live progress on every call,
 * persisting completion transitions.
 */

import {computeStars} from "../../lib/gamification/lesson-xp";
import {awardXPFlat} from "../gamification/gamification";
import {assignDailyMissions} from "../../lib/missions/generator";
import {evaluateProgress} from "../../lib/missions/progress";
import type {
    DailyMission,
    DifficultyMix,
    MissionProfile,
    MissionStats,
} from "../../lib/missions/types";
import {getTemplate} from "../../lib/missions/catalog";
import {getDb, newId, nowIso, type UserMissionRow} from "../db/db";

export interface MissionDailyOptions {
    count?: number;
    difficultyMix?: DifficultyMix;
    /** Override "today" (YYYY-MM-DD). Defaults to the UTC date.
     *  56D refines this with the user's timezone. */
    todayIso?: string;
}

export interface MissionDailyResult {
    missions: DailyMission[];
    newlyCompleted: DailyMission[];
}

function utcToday(): string {
    return new Date().toISOString().slice(0, 10);
}

function isoDate(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : "";
}

function previousDay(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

function isWeekendIso(iso: string): boolean {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
}

async function gatherProfile(
    userId: string,
    today: string,
): Promise<MissionProfile> {
    const db = getDb();
    const completedLessons = await db.lessonProgress
        .where({user_id: userId})
        .filter((r) => r.status === "completed")
        .count();
    const activeErrors = await db.elementErrors
        .where({user_id: userId})
        .filter((r) => !r.mastered)
        .count();
    const xp = await db.userXp.where({user_id: userId}).first();
    return {
        lessonsCompleted: completedLessons,
        hasErrors: activeErrors > 0,
        level: xp?.level ?? 1,
        isWeekend: isWeekendIso(today),
    };
}

async function gatherStats(
    userId: string,
    today: string,
): Promise<MissionStats> {
    const db = getDb();
    const lessons = await db.lessonProgress.where({user_id: userId}).toArray();
    const errors = await db.elementErrors.where({user_id: userId}).toArray();
    const streak = await db.userStreaks.where({user_id: userId}).first();

    const completedToday = lessons.filter(
        (r) => r.status === "completed" && isoDate(r.completed_at) === today,
    );
    const startedTodaySets = new Set(
        lessons
            .filter((r) => isoDate(r.started_at) === today)
            .map((r) => r.set_id),
    );
    const minutes = Math.floor(
        lessons
            .filter((r) => isoDate(r.updated_at) === today)
            .reduce((sum, r) => sum + (r.time_spent_seconds ?? 0), 0) / 60,
    );
    const reviewedToday = errors.filter(
        (r) => isoDate(r.last_attempt_at) === today,
    ).length;
    const masteredToday = errors.filter(
        (r) => r.mastered && isoDate(r.mastered_at) === today,
    ).length;

    const lessonsCompletedToday = completedToday.length;
    const minStars = (min: number) =>
        completedToday.filter(
            (r) => computeStars(r.score_correct, r.score_total) >= min,
        ).length;
    const perfectToday = completedToday.filter(
        (r) => r.score_total > 0 && r.score_correct === r.score_total,
    ).length;
    const activeToday = lessonsCompletedToday > 0 ? 1 : 0;

    return {
        lessons_completed_today: lessonsCompletedToday,
        lessons_min_2_stars_today: minStars(2),
        lessons_min_3_stars_today: minStars(3),
        new_sets_started_today: startedTodaySets.size,
        elements_reviewed_today: reviewedToday,
        review_sessions_completed_today: 0,
        overdue_cleared_today: 0,
        elements_mastered_today: masteredToday,
        perfect_lessons_today: perfectToday,
        adaptive_lessons_started_today: 0,
        cloze_exercises_today: 0,
        exercise_types_used_today: 0,
        minutes_learned_today: minutes,
        streak_kept_today: activeToday,
        current_streak_days: streak?.current_streak_days ?? 0,
        weekend_learning_today: isWeekendIso(today) && activeToday ? 1 : 0,
    };
}

async function assignForDay(
    userId: string,
    today: string,
    options: MissionDailyOptions,
): Promise<UserMissionRow[]> {
    const db = getDb();
    const profile = await gatherProfile(userId, today);
    const yesterday = previousDay(today);
    const yRows = await db.userMissions
        .where("[user_id+assigned_date]")
        .equals([userId, yesterday])
        .toArray();
    const templates = assignDailyMissions(userId, today, profile, {
        count: options.count,
        difficultyMix: options.difficultyMix,
        excludeIds: yRows.map((r) => r.template_id),
    });
    const now = nowIso();
    const rows: UserMissionRow[] = templates.map((t) => ({
        id: newId(),
        user_id: userId,
        template_id: t.id,
        assigned_date: today,
        progress: 0,
        completed: false,
        completed_at: null,
        xp_awarded: false,
        created_at: now,
        updated_at: now,
    }));
    if (rows.length > 0) {
        await db.userMissions.bulkAdd(rows);
    }
    return rows;
}

const DIFFICULTY_RANK: Record<string, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
};

/** Stable display order: easy -> medium -> hard, then template id.
 *  The persisted-read path returns rows in index order, so a
 *  deterministic sort keeps the widget order stable across calls. */
function compareMissions(a: DailyMission, b: DailyMission): number {
    const da = DIFFICULTY_RANK[a.template.difficulty] ?? 9;
    const db = DIFFICULTY_RANK[b.template.difficulty] ?? 9;
    if (da !== db) return da - db;
    return a.template_id < b.template_id ? -1 : a.template_id > b.template_id ? 1 : 0;
}

function toDailyMission(row: UserMissionRow): DailyMission | null {
    const template = getTemplate(row.template_id);
    if (!template) return null;
    return {
        id: row.id,
        template_id: row.template_id,
        assigned_date: row.assigned_date,
        progress: row.progress,
        target: template.target_value,
        completed: row.completed,
        xp_awarded: row.xp_awarded,
        template,
    };
}

/**
 * Return today's missions, assigning them on first call and
 * re-evaluating live progress (persisting completion transitions)
 * on every call.
 */
export async function getDailyMissionsDexie(
    userId: string,
    options: MissionDailyOptions = {},
): Promise<MissionDailyResult> {
    const db = getDb();
    const today = options.todayIso ?? utcToday();

    let rows = await db.userMissions
        .where("[user_id+assigned_date]")
        .equals([userId, today])
        .toArray();
    if (rows.length === 0) {
        rows = await assignForDay(userId, today, options);
    }

    const stats = await gatherStats(userId, today);
    const newlyCompleted: DailyMission[] = [];
    const now = nowIso();

    for (const row of rows) {
        const template = getTemplate(row.template_id);
        if (!template) continue;
        const prog = evaluateProgress(template, stats);
        const wasCompleted = row.completed;
        row.progress = prog.current;
        if (prog.completed && !wasCompleted) {
            row.completed = true;
            row.completed_at = now;
            const dm = toDailyMission(row);
            if (dm) newlyCompleted.push(dm);
        }
        // Award the bonus XP exactly once per completed mission
        // (idempotent via the xp_awarded guard; covers this call's
        // flip and any earlier completion left un-awarded).
        if (row.completed && !row.xp_awarded && template.xp_reward > 0) {
            try {
                await awardXPFlat(
                    userId,
                    template.xp_reward,
                    `mission:${template.id}`,
                );
                row.xp_awarded = true;
            } catch {
                /* leave xp_awarded false to retry on the next refresh */
            }
        }
        row.updated_at = now;
        await db.userMissions.put(row);
    }

    const missions = rows
        .map(toDailyMission)
        .filter((m): m is DailyMission => m !== null)
        .sort(compareMissions);
    return {missions, newlyCompleted};
}

/** Force-regenerate today's missions (Settings reset). */
export async function regenerateDailyMissionsDexie(
    userId: string,
    options: MissionDailyOptions = {},
): Promise<MissionDailyResult> {
    const db = getDb();
    const today = options.todayIso ?? utcToday();
    const existing = await db.userMissions
        .where("[user_id+assigned_date]")
        .equals([userId, today])
        .toArray();
    await db.userMissions.bulkDelete(existing.map((r) => r.id));
    return getDailyMissionsDexie(userId, options);
}
