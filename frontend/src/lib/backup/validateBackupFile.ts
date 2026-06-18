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
import {
    type AlbManifest,
    isZipBytes,
    parseAlbBytes,
} from "./albContainer";

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
    | {
          ok: true;
          payload: BackupPayload;
          /** ``"alb"`` for a ZIP container, ``"json"`` for a legacy file. */
          container: "alb" | "json";
          /** Present only for an ``.alb`` file (BAK-03 version check). */
          manifest?: AlbManifest;
      }
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
    return {ok: true, payload: parsed, container: "json"};
}

/**
 * Validate raw `.alb` (ZIP) bytes: unzip, then run ``data.json`` through
 * the SAME {@link validateBackupPayload} contract as the legacy path, so
 * the two cannot drift. Returns the manifest too (for the pre-import
 * version check). Never throws.
 */
export function validateAlbBytes(bytes: Uint8Array): BackupFileResult {
    let parsed;
    try {
        parsed = parseAlbBytes(bytes, MAX_BACKUP_BYTES);
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    try {
        validateBackupPayload(parsed.payload);
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    return {
        ok: true,
        payload: parsed.payload,
        container: "alb",
        manifest: parsed.manifest,
    };
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
    // Format is decided by MAGIC BYTES, not the extension (users rename):
    // a ZIP signature (PK\x03\x04) is an `.alb` container; anything else is
    // parsed as legacy JSON (#642 contract). EXP-031 / BAK-03.
    let buffer: ArrayBuffer;
    try {
        buffer = await file.arrayBuffer();
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    const bytes = new Uint8Array(buffer);
    if (isZipBytes(bytes)) {
        return validateAlbBytes(bytes);
    }
    let text: string;
    try {
        text = new TextDecoder().decode(bytes);
    } catch {
        return {ok: false, error: "not_a_backup"};
    }
    return validateBackupText(text);
}
