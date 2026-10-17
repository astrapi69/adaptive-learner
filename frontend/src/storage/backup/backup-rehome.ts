/**
 * Re-home a backup made by another learner onto the local one (#3785).
 *
 * The device switch: the learner sets the app up on the new device first
 * (its own user id), then imports the old device's backup through Settings.
 * The restore is scoped to the local user, so every row of the backup's user
 * used to be skipped. The backend restore re-homes such a backup
 * (``_remap_user_identity``, #129); this is the same rule for the browser:
 * the backup's ``users`` row and every ``user_id`` of the backup's user move
 * to the local user, so the rows land and merge with the local ones.
 *
 * Ids that embed the user id follow along. ``lesson_progress``,
 * ``element_errors`` and ``speech_recordings`` are rekeyed afterwards by
 * ``normalizeRestoreRecord`` from the rewritten ``user_id``; ``set_runs`` is
 * not, so its id is rebuilt here with the producer's own key.
 *
 * @example
 * const data = rehomeBackupData(payload.data, payload.user_id, localUserId);
 */

import {setRunKey} from "../lessons/set-runs-dexie";
import type {RowDict} from "./backup-scope";

/** The user id a backup was made under: ``user_id``, else its first users row. */
export function backupOwnerId(payload: {user_id?: unknown; data?: Record<string, unknown>}): string | null {
    if (typeof payload.user_id === "string" && payload.user_id !== "") return payload.user_id;
    const users = payload.data?.users;
    if (Array.isArray(users) && users.length > 0) {
        const id = (users[0] as RowDict).id;
        if (typeof id === "string" && id !== "") return id;
    }
    return null;
}

/** One backup row moved from ``sourceUserId`` to ``targetUserId``. */
function rehomeRow(table: string, row: RowDict, sourceUserId: string, targetUserId: string): RowDict {
    const out: RowDict = {...row};
    if (table === "users" && out.id === sourceUserId) out.id = targetUserId;
    if (out.user_id !== sourceUserId) return out;
    out.user_id = targetUserId;
    if (table === "set_runs" && typeof out.set_id === "string" && typeof out.run_id === "number") {
        out.id = setRunKey(targetUserId, out.set_id, out.run_id);
    }
    return out;
}

/**
 * Return ``data`` with every row of ``sourceUserId`` moved to
 * ``targetUserId``. Rows of any other user are left as they are (the
 * restore's ownership check still skips them). The same user on both
 * sides, or an unknown source, returns ``data`` unchanged.
 */
export function rehomeBackupData(
    data: Record<string, unknown>,
    sourceUserId: string | null,
    targetUserId: string,
): Record<string, unknown> {
    if (sourceUserId === null || sourceUserId === targetUserId) return data;
    const out: Record<string, unknown> = {};
    for (const [table, records] of Object.entries(data)) {
        out[table] = Array.isArray(records)
            ? records.map((row) =>
                  typeof row === "object" && row !== null
                      ? rehomeRow(table, row as RowDict, sourceUserId, targetUserId)
                      : row,
              )
            : records;
    }
    return out;
}
