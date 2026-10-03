/**
 * Bring an incoming backup row into the shape Dexie reads (#3362).
 *
 * An API-mode backup carries UUID ids and JSON text columns as strings
 * (``sync_service.serialize_row`` returns the raw ``Text`` column). Dexie
 * reads several stores by a composite key and expects those columns
 * parsed, so a verbatim restore left the rows unreachable: "Weitermachen"
 * listed a lesson whose page then found no row and started at step 0.
 * A Dexie-origin row already has this shape, so normalising it is a no-op.
 */

import {elementRowKey} from "../lessons/element-errors-dexie";
import {lessonProgressKey} from "../lessons/lesson-progress-dexie";
import {speechRecordingKey} from "../lessons/speech-recordings-dexie";
import type {RowDict} from "./backup-scope";

/** Backend ``Text`` columns holding JSON that Dexie stores parsed. */
const JSON_TEXT_COLUMNS: Readonly<Record<string, readonly string[]>> = {
    lesson_progress: ["step_results", "attempt_history", "recent_steps"],
    element_errors: ["attempt_history"],
    imported_conversations: ["analysis_result"],
    badges: ["tier_thresholds"],
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Stores Dexie reads by a composite key, and how to build that key.
 *  ``set_runs`` is absent on purpose: it is read by its ``[user, set]``
 *  index, never by id. */
const COMPOSITE_KEYS: Readonly<Record<string, (row: RowDict) => string>> = {
    lesson_progress: (row) =>
        lessonProgressKey(
            text(row.user_id),
            text(row.source),
            text(row.set_id),
            text(row.lesson_filename),
        ),
    speech_recordings: (row) =>
        speechRecordingKey(
            text(row.user_id),
            text(row.source),
            text(row.set_id),
            text(row.lesson_filename),
            text(row.exercise_id),
        ),
    element_errors: (row) =>
        elementRowKey(
            text(row.user_id),
            text(row.set_id),
            text(row.lesson_id),
            text(row.exercise_id),
            text(row.element_key),
            text(row.direction) || "target_to_source",
            typeof row.run_id === "number" ? row.run_id : 1,
        ),
};

/** Parse a JSON string column; a value that is not valid JSON stays as is. */
function parseJsonText(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

/**
 * Return ``record`` rekeyed onto the store's composite key and with its
 * JSON text columns parsed. Tables without either rule come back as is.
 *
 * @example
 * const row = normalizeRestoreRecord("lesson_progress", apiRow);
 * await db.lessonProgress.put(row);
 */
export function normalizeRestoreRecord(table: string, record: RowDict): RowDict {
    const jsonColumns = JSON_TEXT_COLUMNS[table] ?? [];
    const buildKey = COMPOSITE_KEYS[table];
    if (jsonColumns.length === 0 && buildKey === undefined) return record;
    const out: RowDict = {...record};
    for (const column of jsonColumns) {
        if (column in out) out[column] = parseJsonText(out[column]);
    }
    if (buildKey !== undefined) out.id = buildKey(out);
    return out;
}
