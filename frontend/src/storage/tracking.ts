/**
 * Local (Dexie-mode) tracking aggregator (Phase 10E).
 *
 * Ports ``adaptive_learner_tracking.summary.aggregate`` and the
 * ``commits.build_commit_kwargs`` helper to TypeScript so the
 * Dashboard's TrackingSummary and Progress page's commits list
 * work end-to-end without the backend.
 */

import {LEARNING_METHODS, type LearningMethod} from "../lib/constants";
import type {
    LearningSessionRow,
    ProgressCommitRow,
    SessionRatingRow,
} from "./dexie/db";
import {newId} from "./dexie/db";
import type {
    MethodDistributionEntry,
    ProgressCommit,
    RecentSessionEntry,
    TrackingSummary,
} from "../types/domain";

const TREND_WINDOW = 5;
const RATING_SCALE = 5;

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000;
}

function normaliseRating(value: number): number {
    const rescaled = value / RATING_SCALE;
    return Math.max(0, Math.min(1, rescaled));
}

function durationMinutes(startedAt: string, endedAt: string | null): number {
    if (!endedAt) return 0;
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    const seconds = Math.max(0, (end - start) / 1000);
    return Math.floor(seconds / 60);
}

/**
 * Translate ``(session, rating)`` into the kwargs for a new
 * ProgressCommit row. Returns ``null`` when the session has not
 * been ended yet or the rating data is missing — the row would
 * be useless without it.
 */
export function buildCommitFromSession(
    session: LearningSessionRow,
    rating: SessionRatingRow | null,
): ProgressCommitRow | null {
    if (!session.id || !session.project_id || !session.method) return null;
    if (!rating) return null;
    return {
        id: newId(),
        project_id: session.project_id,
        session_id: session.id,
        method: session.method,
        understanding: normaliseRating(rating.understanding),
        stress: normaliseRating(rating.stress),
        error_rate: 0,
        duration_minutes: durationMinutes(session.started_at, session.ended_at),
        committed_at: new Date().toISOString(),
    };
}

function parseIsoDate(value: string | null | undefined): string | null {
    if (typeof value !== "string" || value.length < 10) return null;
    const slice = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null;
    return slice;
}

function currentStreakDays(commitDates: Set<string>, today: string): number {
    if (!commitDates.has(today)) return 0;
    let streak = 0;
    let cursor = today;
    while (commitDates.has(cursor)) {
        streak += 1;
        const next = new Date(cursor + "T00:00:00.000Z");
        next.setUTCDate(next.getUTCDate() - 1);
        cursor = next.toISOString().slice(0, 10);
    }
    return streak;
}

function methodDistribution(
    sessionsPerMethod: Record<string, number>,
    totalSessions: number,
): MethodDistributionEntry[] {
    const entries: MethodDistributionEntry[] = LEARNING_METHODS.map((method) => {
        const count = sessionsPerMethod[method] ?? 0;
        const percentage = totalSessions > 0 ? Math.round((count * 100) / totalSessions) : 0;
        return {method, count, percentage};
    });
    // Stable sort: descending by count; ties keep canonical order.
    entries.sort((a, b) => b.count - a.count);
    return entries;
}

/**
 * Aggregate progress commits into the TrackingSummary the
 * Dashboard renders. Commits must arrive chronological (oldest
 * first); the recent-trend slice walks the tail.
 *
 * ``today`` is injected for deterministic tests; defaults to
 * the local UTC date.
 */
export function aggregateProgress(
    commits: ProgressCommitRow[],
    today?: string,
): TrackingSummary {
    const sessionsPerMethod: Partial<Record<LearningMethod, number>> = {};
    const understanding: number[] = [];
    const stress: number[] = [];
    let totalMinutes = 0;
    const commitDates = new Set<string>();
    for (const c of commits) {
        if (LEARNING_METHODS.includes(c.method)) {
            sessionsPerMethod[c.method] = (sessionsPerMethod[c.method] ?? 0) + 1;
        }
        understanding.push(c.understanding);
        stress.push(c.stress);
        totalMinutes += c.duration_minutes;
        const d = parseIsoDate(c.committed_at);
        if (d) commitDates.add(d);
    }
    const streakToday = today ?? new Date().toISOString().slice(0, 10);
    const streakDays = currentStreakDays(commitDates, streakToday);
    const totalSessions = commits.length;
    const distribution = methodDistribution(
        sessionsPerMethod as Record<string, number>,
        totalSessions,
    );

    const recentSessions: RecentSessionEntry[] = [...commits]
        .slice(-TREND_WINDOW)
        .reverse()
        .map((row) => ({
            id: row.id,
            session_id: row.session_id,
            method: row.method,
            understanding: row.understanding,
            stress: row.stress,
            duration_minutes: row.duration_minutes,
            committed_at: row.committed_at,
        }));

    return {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        streak_days: streakDays,
        sessions_per_method: sessionsPerMethod,
        method_distribution: distribution,
        recent_understanding: understanding.slice(-TREND_WINDOW),
        recent_stress: stress.slice(-TREND_WINDOW),
        mean_understanding: mean(understanding),
        mean_stress: mean(stress),
        recent_sessions: recentSessions,
    };
}

/**
 * Convert a stored ProgressCommitRow into the wire-shape DTO
 * the frontend consumes. Callers in DexieStorage join the
 * matching SessionRating row's ``notes`` field separately (the
 * ProgressCommitRow has no notes column of its own — it lives
 * on ``session_ratings``).
 */
export function rowToCommit(
    row: ProgressCommitRow,
    notes?: string | null,
): ProgressCommit {
    return {
        id: row.id,
        project_id: row.project_id,
        session_id: row.session_id,
        method: row.method,
        understanding: row.understanding,
        stress: row.stress,
        error_rate: row.error_rate,
        duration_minutes: row.duration_minutes,
        committed_at: row.committed_at,
        notes: notes ?? null,
    };
}
