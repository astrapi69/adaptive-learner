/**
 * Merge two ``lesson_progress`` rows on restore (#3787).
 *
 * A restore used to replace a whole row whenever the backup's ``updated_at``
 * was newer, so a lesson completed on one device and later only opened on
 * another fell back to "in progress". The rule keeps the learner's balance
 * and respects a deliberate restart:
 *
 * - The balance never shrinks: the most ``attempts`` (each one a completion,
 *   #983), the better best score by percentage (a tie keeps the local pair),
 *   the joined ``attempt_history`` (newest {@link ATTEMPT_HISTORY_CAP}), the
 *   latest ``completed_at``, the earliest ``started_at``, the most
 *   ``time_spent_seconds``.
 * - The run state ({@link LIFECYCLE_FIELDS}) comes whole from one side: a
 *   completed side wins over a side that has seen fewer completions, two runs
 *   keep the furthest step, and otherwise the newer side wins as before. A
 *   side that already holds a completion and restarted afterwards keeps its
 *   restart. A completed row without ``attempts`` (a 1.2.0 backup) counts as
 *   one completion.
 *
 * The API-mode restore applies the same rule
 * (``backend/app/services/progress_merge.py``); both run the cases in
 * ``tests/fixtures/progress-merge-parity/cases.json``.
 *
 * @example
 * const {row, changed} = mergeLessonProgress(localRow, backupRecord);
 * if (changed) await store.put({...row, id: localId});
 */

import {ATTEMPT_HISTORY_CAP} from "./lesson-attempt";

type Row = Record<string, unknown>;

/** The table this merge applies to. */
export const PROGRESS_TABLE = "lesson_progress";

/** The run state, taken together from one side so it stays consistent. */
export const LIFECYCLE_FIELDS: readonly string[] = [
    "status",
    "lesson_mode",
    "step_results",
    "score_correct",
    "score_total",
    "current_step",
    "run_time_seconds",
    "paused_at",
    "abandoned_at",
    "recent_steps",
    "updated_at",
];

const ACTIVE = new Set(["in_progress", "paused"]);

/**
 * Merge a backup's ``lesson_progress`` row into the local one.
 *
 * @param local - The local row.
 * @param backup - The backup's record, normalized for the browser.
 * @returns The merged row (local identity and local-only fields kept; a field
 *   the winning side lacks keeps its local value) and whether it differs from
 *   ``local``.
 */
export function mergeLessonProgress(local: Row, backup: Row): {row: Row; changed: boolean} {
    const source = runStateFromBackup(local, backup) ? backup : local;
    const row: Row = {...local};
    for (const field of LIFECYCLE_FIELDS) {
        if (field in source) {
            row[field] = source[field];
        }
    }
    Object.assign(row, balance(local, backup));
    const changed = Object.keys(row).some((key) => stable(row[key]) !== stable(local[key]));
    return {row, changed};
}

function runStateFromBackup(local: Row, backup: Row): boolean {
    const localDone = local.status === "completed";
    const backupDone = backup.status === "completed";
    if (backupDone && !localDone && completions(local) < completions(backup)) {
        return true;
    }
    if (localDone && !backupDone && completions(backup) < completions(local)) {
        return false;
    }
    if (ACTIVE.has(String(local.status)) && ACTIVE.has(String(backup.status))) {
        const localStep = int(local, "current_step");
        const backupStep = int(backup, "current_step");
        if (localStep !== backupStep) {
            return backupStep > localStep;
        }
    }
    const remote = time(backup.updated_at);
    const own = time(local.updated_at);
    return remote === null || own === null || remote > own;
}

function balance(local: Row, backup: Row): Row {
    const out: Row = {};
    const either = (field: string) => field in local || field in backup;
    if (either("attempts")) {
        out.attempts = Math.max(int(local, "attempts"), int(backup, "attempts"));
    }
    if (either("attempt_history")) {
        out.attempt_history = joinedHistory(local, backup);
    }
    if (either("best_score_correct") || either("best_score_total")) {
        const best = pct(backup) > pct(local) ? backup : local;
        out.best_score_correct = int(best, "best_score_correct");
        out.best_score_total = int(best, "best_score_total");
    }
    if (either("completed_at")) {
        out.completed_at = pickTime(local.completed_at, backup.completed_at, true);
    }
    if (either("started_at")) {
        out.started_at = pickTime(local.started_at, backup.started_at, false);
    }
    if (either("time_spent_seconds")) {
        out.time_spent_seconds = Math.max(int(local, "time_spent_seconds"), int(backup, "time_spent_seconds"));
    }
    return out;
}

function completions(row: Row): number {
    return Math.max(int(row, "attempts"), row.status === "completed" ? 1 : 0);
}

function int(row: Row, field: string): number {
    const value = row[field];
    return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function pct(row: Row): number {
    const total = int(row, "best_score_total");
    return total ? int(row, "best_score_correct") / total : -1;
}

function history(row: Row): Row[] {
    const value = parseJson(row.attempt_history);
    return Array.isArray(value) ? value.filter((e): e is Row => typeof e === "object" && e !== null) : [];
}

/** Both histories, one entry per ``at`` (the local one on a tie), oldest first. */
function joinedHistory(local: Row, backup: Row): Row[] {
    const byAt = new Map<string, Row>();
    for (const entry of [...history(backup), ...history(local)]) {
        byAt.set(String(entry.at), entry);
    }
    const ordered = [...byAt.values()].sort(
        (a, b) => (time(a.at) ?? Number.NEGATIVE_INFINITY) - (time(b.at) ?? Number.NEGATIVE_INFINITY),
    );
    return ordered.slice(-ATTEMPT_HISTORY_CAP);
}

/** The later (or earlier) of two timestamps, as the side wrote it; an unreadable one loses. */
function pickTime(local: unknown, backup: unknown, latest: boolean): unknown {
    const own = time(local);
    const remote = time(backup);
    if (remote === null) {
        return local;
    }
    if (own === null) {
        return backup;
    }
    return (latest ? remote > own : remote < own) ? backup : local;
}

function time(value: unknown): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseJson(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

/** A value as a string with sorted object keys, for comparing two rows. */
function stable(value: unknown): string {
    return JSON.stringify(value === undefined ? null : value, (_key, v: unknown) =>
        v !== null && typeof v === "object" && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v as Row).sort(([a], [b]) => a.localeCompare(b)))
            : v,
    );
}
