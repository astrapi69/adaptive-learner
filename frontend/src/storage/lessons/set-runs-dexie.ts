/**
 * Client-side Durchgang (run/pass) store for Dexie / GitHub Pages mode
 * (EXP-051 / #2125).
 *
 * Mirrors the backend ``app.services.set_runs`` 1:1 — same lazy
 * materialisation of the implicit run 1, same atomic
 * close-old-then-open-new start transition. The ``setRuns`` table records
 * which run of each ``(user, set)`` is active (``closed_at === null``);
 * the ``elementErrors`` rows carry the matching ``run_id`` so a second run
 * never overwrites the first.
 */

import {getDb} from "../dexie/db";
import type {SetRunRow} from "../dexie/db";
import type {SetRun} from "../types";

function runKey(userId: string, setId: string, runId: number): string {
    return `${userId}#${setId}#${runId}`;
}

function rowToWire(row: SetRunRow): SetRun {
    return {
        id: row.id,
        user_id: row.user_id,
        set_id: row.set_id,
        run_id: row.run_id,
        content_version_at_start: row.content_version_at_start ?? null,
        started_at: row.started_at,
        closed_at: row.closed_at,
    };
}

async function rowsForSet(userId: string, setId: string): Promise<SetRunRow[]> {
    const db = getDb();
    return db.setRuns
        .where("[user_id+set_id]")
        .equals([userId, setId])
        .toArray();
}

/**
 * Resolve the active ``run_id`` for ``(user, set)``, lazily creating the
 * implicit run 1 when the set has no ``setRuns`` row yet (EXP-051). Called
 * on the WRITE path so every set the learner works on carries a row.
 *
 * MUST run inside an ``rw`` transaction that includes ``db.setRuns`` (the
 * recording path wraps it together with ``db.elementErrors``), so the
 * lazy row and the attempt rows commit atomically.
 */
export async function ensureActiveRunDexie(
    userId: string,
    setId: string,
    nowIso: string,
): Promise<number> {
    const db = getDb();
    const rows = await rowsForSet(userId, setId);
    const open = rows.find((r) => r.closed_at === null);
    if (open) return open.run_id;
    // No open run. Normally the set has never been touched under the run
    // model — open run 1. Defensively, if only CLOSED runs exist, open the
    // run after the highest.
    const maxRun = rows.reduce((m, r) => Math.max(m, r.run_id), 0);
    const runId = maxRun === 0 ? 1 : maxRun + 1;
    await db.setRuns.put({
        id: runKey(userId, setId, runId),
        user_id: userId,
        set_id: setId,
        run_id: runId,
        content_version_at_start: null,
        started_at: nowIso,
        closed_at: null,
        updated_at: nowIso,
    });
    return runId;
}

/**
 * Start a fresh Durchgang: close the active run and open the next, in one
 * ``rw`` transaction. When no active run exists (a set worked under the
 * implicit run 1, or never worked), the prior run is materialised as
 * CLOSED first so the history is complete, then the next is opened. The
 * ``elementErrors`` rows are untouched — the closed run's rows stay frozen
 * under their ``run_id``; new attempts write fresh rows under the new run.
 */
export async function startRunDexie(
    userId: string,
    setId: string,
    opts: {contentVersion?: string} = {},
): Promise<SetRun> {
    const db = getDb();
    let created: SetRunRow | null = null;
    await db.transaction("rw", db.setRuns, async () => {
        const nowIso = new Date().toISOString();
        const rows = await rowsForSet(userId, setId);
        const open = rows.find((r) => r.closed_at === null);
        let nextRunId: number;
        if (open) {
            await db.setRuns.put({...open, closed_at: nowIso, updated_at: nowIso});
            nextRunId = open.run_id + 1;
        } else if (rows.length === 0) {
            // No run row at all: materialise the implicit run 1 as CLOSED,
            // then open run 2. Its start time predates the feature and is
            // not recoverable, so it is stamped at close time (best effort).
            await db.setRuns.put({
                id: runKey(userId, setId, 1),
                user_id: userId,
                set_id: setId,
                run_id: 1,
                content_version_at_start: null,
                started_at: nowIso,
                closed_at: nowIso,
                updated_at: nowIso,
            });
            nextRunId = 2;
        } else {
            // Runs exist but none is open (abnormal). Do NOT re-materialise
            // the highest run; just open the next.
            const maxRun = rows.reduce((m, r) => Math.max(m, r.run_id), 0);
            nextRunId = maxRun + 1;
        }
        const newRow: SetRunRow = {
            id: runKey(userId, setId, nextRunId),
            user_id: userId,
            set_id: setId,
            run_id: nextRunId,
            content_version_at_start: opts.contentVersion ?? null,
            started_at: nowIso,
            closed_at: null,
            updated_at: nowIso,
        };
        await db.setRuns.put(newRow);
        created = newRow;
    });
    // created is always assigned inside the transaction above.
    return rowToWire(created as unknown as SetRunRow);
}

/** List every Durchgang of a set, oldest run first (EXP-051). */
export async function listRunsDexie(
    userId: string,
    setId: string,
): Promise<SetRun[]> {
    const rows = await rowsForSet(userId, setId);
    rows.sort((a, b) => a.run_id - b.run_id);
    return rows.map(rowToWire);
}

/**
 * Map of ``set_id -> active run_id`` for the OPEN runs of the user (EXP-051).
 * The read paths (list, review queue) use it to keep only the active run's
 * rows: a set with no entry has no open run, so its rows (all ``run_id = 1``
 * by the migration) stay visible — backward-compatible.
 */
export async function openRunBySetDexie(
    userId: string,
    setId?: string,
): Promise<Map<string, number>> {
    const db = getDb();
    const rows =
        setId !== undefined
            ? await rowsForSet(userId, setId)
            : await db.setRuns.where("user_id").equals(userId).toArray();
    const map = new Map<string, number>();
    for (const r of rows) {
        if (r.closed_at === null) map.set(r.set_id, r.run_id);
    }
    return map;
}

/**
 * Active-run predicate (EXP-051): keep a row when its set has no open run
 * (default 1) OR the open run equals the row's ``run_id``. Mirrors the
 * backend ``_active_run_only`` SQL predicate.
 */
export function isActiveRunRow(
    row: {set_id: string; run_id?: number},
    openBySet: Map<string, number>,
): boolean {
    const open = openBySet.get(row.set_id);
    return open === undefined || open === (row.run_id ?? 1);
}

/**
 * Orphan cleanup (EXP-051 §Waisen): delete the user's run rows for the
 * given set ids across ALL runs. Returns the count deleted.
 */
export async function deleteRunsBySetIdsDexie(
    userId: string,
    setIds: readonly string[],
): Promise<number> {
    if (setIds.length === 0) return 0;
    const db = getDb();
    let deleted = 0;
    await db.transaction("rw", db.setRuns, async () => {
        for (const setId of setIds) {
            deleted += await db.setRuns
                .where("[user_id+set_id]")
                .equals([userId, setId])
                .delete();
        }
    });
    return deleted;
}
