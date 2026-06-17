/**
 * Backup download helpers (Phase 41F).
 *
 * Two consumers today: ``BackupSection`` (the Settings > Backup
 * tab's Export button) and ``DangerZoneSection`` (the pre-reset
 * "Create backup first?" affordance). Both produce the same JSON
 * blob with the same filename convention so a user who exports
 * from either path lands on an interchangeable file.
 *
 * Pure utilities: no React, no storage dependency. The caller
 * fetches the ``BackupPayload`` via ``storage.backup.export`` and
 * passes it in.
 */

import type {BackupPayload} from "../types/domain";
import {buildAlbBytes, type BackupType} from "../lib/backup/albContainer";

export function triggerBackupDownload(
    payload: BackupPayload,
    filename: string,
    backupType: BackupType = "full",
): void {
    const blob = new Blob([buildAlbBytes(payload, backupType)], {
        type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- File System Access API (BACKUP-DIR-EXPORT-01) -----------------
//
// In Dexie mode (GitHub Pages) there is no server filesystem to
// write to, and the plain blob-download path gives the user no
// control over WHERE the file lands. ``showSaveFilePicker`` opens
// the native OS save dialog so the user picks the location. It is
// only available in Chromium-based browsers (Chrome / Edge /
// Opera); Firefox and Safari fall back to the download path.
//
// The picker types are declared inline rather than relying on
// ``lib.dom`` because the project's TS lib level does not yet ship
// the File System Access API ambient types.

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: {description: string; accept: Record<string, string[]>}[];
}

interface FileSystemWritableLike {
    write: (data: BufferSource | string) => Promise<void>;
    close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
    readonly name: string;
    createWritable: () => Promise<FileSystemWritableLike>;
}

type ShowSaveFilePicker = (
    options?: SaveFilePickerOptions,
) => Promise<FileSystemFileHandleLike>;

/** True when the native save-file picker is available. */
export function supportsSaveFilePicker(): boolean {
    return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

function isAbortError(err: unknown): boolean {
    // Chromium throws a DOMException named "AbortError" when the
    // user dismisses the dialog; some builds throw a plain object
    // carrying the same ``name``.
    return (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as {name?: unknown}).name === "AbortError"
    );
}

export type BackupSaveResult =
    | {method: "picker"; filename: string}
    | {method: "download"; filename: string}
    | {method: "cancelled"};

/**
 * Save a backup to disk, preferring the native save dialog and
 * falling back to a plain download. Returns how the file was
 * delivered so the caller can show the right confirmation, and
 * ``"cancelled"`` (no toast, no last-backup write) when the user
 * dismisses the OS dialog.
 */
export async function saveBackupToDisk(
    payload: BackupPayload,
    filename: string,
    backupType: BackupType = "full",
): Promise<BackupSaveResult> {
    const picker = (window as unknown as {showSaveFilePicker?: ShowSaveFilePicker})
        .showSaveFilePicker;
    if (supportsSaveFilePicker() && typeof picker === "function") {
        try {
            const handle = await picker({
                suggestedName: filename,
                types: [
                    {
                        description: "Adaptive Learner Backup",
                        accept: {"application/zip": [".alb"]},
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(buildAlbBytes(payload, backupType));
            await writable.close();
            return {method: "picker", filename: handle.name || filename};
        } catch (err) {
            if (isAbortError(err)) {
                return {method: "cancelled"};
            }
            // A real write failure (permission revoked mid-write,
            // disk full): fall back to the download path so the user
            // still gets their file rather than nothing.
            triggerBackupDownload(payload, filename, backupType);
            return {method: "download", filename};
        }
    }
    triggerBackupDownload(payload, filename, backupType);
    return {method: "download", filename};
}

export function backupFilename(userId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const short = userId.slice(0, 8);
    return `adaptive-learner-backup-${date}-${short}.alb`;
}
