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

export function triggerBackupDownload(
    payload: BackupPayload,
    filename: string,
): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
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

export function backupFilename(userId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const short = userId.slice(0, 8);
    return `adaptive-learner-backup-${date}-${short}.json`;
}
