/**
 * Pre-import backup-file validation (#642).
 *
 * A user can pick ANY file at the restore surfaces (onboarding first-run
 * restore + Settings > Data import). Picking a non-backup file — another
 * app's backup, a lesson JSON, a config file, a text file, a truncated
 * download, or a huge file — is a user mistake, not an app fault. This
 * module turns "is this a usable Adaptive Learner backup?" into one pure,
 * exhaustively-tested function that returns a typed result instead of
 * throwing, so the UI can show a friendly, localized message and never
 * crashes or leaks a stacktrace.
 *
 * "Is this ours?" is decided by the same contract the exporter writes
 * (`validateBackupPayload` in `storage/backup.ts`): a top-level
 * `format === "adaptive-learner-backup"` marker, a non-empty string
 * `version`, and an object `data` segment. That validator is the single
 * source of truth — this module reuses it rather than re-stating the
 * rules, so the two cannot drift.
 */

import type {BackupPayload} from "../../types/domain";
import {validateBackupPayload} from "../../storage/backup";

/**
 * Largest file we attempt to read + parse (uncompressed). A multi-hundred-
 * MB JSON blocks the main thread on `JSON.parse`; we reject by size first.
 * Checked against the raw (uncompressed) byte length on purpose — a 1 GB
 * JSON that happens to be a small download is still too big to parse.
 */
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** Why a file was rejected — maps to a `backup.*` i18n key in the UI. */
export type BackupFileError = "too_large" | "not_a_backup";

export type BackupFileResult =
    | {ok: true; payload: BackupPayload}
    | {ok: false; error: BackupFileError};

/**
 * Validate the text content of a candidate backup file.
 *
 * Handles every malformed shape gracefully (returns a result, never
 * throws): invalid/truncated JSON, a non-object (`42`, `"hello"`,
 * `null`), an array, an empty object `{}`, a foreign `format`, a
 * missing/empty `version`, or a missing `data` segment.
 *
 * @param text - Raw file contents.
 * @returns `{ok: true, payload}` for a valid backup, else
 *   `{ok: false, error: "not_a_backup"}`.
 */
export function validateBackupText(text: string): BackupFileResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    try {
        // Throws on any non-conforming shape; narrows `parsed` on success.
        validateBackupPayload(parsed);
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    return {ok: true, payload: parsed};
}

/**
 * Read + validate a picked File as an Adaptive Learner backup.
 *
 * Rejects by size BEFORE reading (an over-large file never reaches
 * `JSON.parse`). An empty (0-byte) file reads as `""`, which fails JSON
 * parsing and is reported as `not_a_backup`.
 *
 * @param file - The user-selected file.
 * @returns A typed result; never throws for bad input.
 */
export async function readBackupFile(file: File): Promise<BackupFileResult> {
    if (file.size > MAX_BACKUP_BYTES) {
        return {ok: false, error: "too_large"};
    }
    let text: string;
    try {
        text = await file.text();
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    return validateBackupText(text);
}
