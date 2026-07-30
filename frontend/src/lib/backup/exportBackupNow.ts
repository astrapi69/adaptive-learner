/**
 * exportBackupNow — a single, callable "export a full backup to disk" action,
 * so a feature that wants to OFFER a backup (e.g. the ja/ko/zh recovery notice,
 * #2161 condition 4: make an irreversible op reversible) can trigger the exact
 * same file the Settings > Data export produces, without re-inlining the
 * export + save flow a third time.
 *
 * Same path as ``BackupSection.handleExport`` / ``DangerZoneSection`` (#331):
 * one endpoint, one local-storage snapshot wrap, one save helper.
 */

import {withLocalStorageSnapshot} from "./localStorageSnapshot";
import {getStorage} from "../../storage";
import {backupFilename, saveBackupToDisk} from "../../utils/backup-download";

export type ExportBackupResult =
    | {status: "saved"; filename: string; records: number}
    | {status: "cancelled"};

/**
 * Export the given user's full backup and save it to disk.
 *
 * @param userId - Active learner whose data is exported.
 * @returns ``"saved"`` with the filename + record count, or ``"cancelled"``
 *   when the user dismisses the OS save dialog. Throws on a real export/write
 *   failure so the caller can surface it.
 */
export async function exportBackupNow(userId: string): Promise<ExportBackupResult> {
    const payload = withLocalStorageSnapshot(await getStorage().backup.export(userId));
    const outcome = await saveBackupToDisk(payload, backupFilename(userId));
    if (outcome.method === "cancelled") return {status: "cancelled"};
    return {
        status: "saved",
        filename: outcome.filename,
        records: payload.stats.total_records,
    };
}
