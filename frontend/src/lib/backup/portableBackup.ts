/**
 * The full backup as it leaves and re-enters this app (#3412).
 *
 * The storage export carries the DB tables and the content sets. Three
 * blocks are added and applied frontend-side, in both storage modes, because
 * the backend import ignores them: the ``local_storage`` snapshot
 * (preferences, contributions), the ``plugin_settings`` block (connected
 * repositories, redeemed invites, the Learning Repository switch) and the
 * ``ai_validation_results`` block (cached AI content-check reports, empty in
 * API mode). Every full-backup path goes through these two helpers so the
 * blocks cannot drift between them.
 *
 * @example
 * const payload = await exportPortableBackup(userId);
 * await storage.backup.import(userId, payload);
 * await restoreClientSnapshots(payload);
 */

import {getStorage} from "../../storage";
import type {BackupPayload} from "../../types/domain";
import {backupOwnerId} from "../../storage/backup";
import {
    rehomeLocalStorageSnapshot,
    restoreLocalStorageSnapshot,
    withLocalStorageSnapshot,
} from "./localStorageSnapshot";
import {restorePluginSettingsSnapshot, withPluginSettingsSnapshot} from "./pluginSettingsSnapshot";
import {restoreAiValidationSnapshot, withAiValidationSnapshot} from "./aiValidationSnapshot";

/** The storage export plus the ``local_storage``, ``plugin_settings`` and
 *  ``ai_validation_results`` blocks. */
export async function exportPortableBackup(userId: string): Promise<BackupPayload> {
    const exported = await getStorage().backup.export(userId);
    return withAiValidationSnapshot(await withPluginSettingsSnapshot(withLocalStorageSnapshot(exported)));
}

/** What {@link restoreClientSnapshots} applied, for the round-trip trace. */
export interface ClientSnapshotsApplied {
    /** localStorage keys written. */
    localStorageKeys: number;
    /** Plugins whose settings were merged. */
    pluginSettings: string[];
    /** Cached AI content-check reports written (#3412). */
    aiValidationResults: number;
}

/**
 * Apply the payload's client-side blocks after the storage import. A legacy
 * backup without them is a no-op.
 *
 * @param payload - The imported backup.
 * @param localUserId - The learner the storage import restored under. When
 *   the backup belongs to another learner, the values keyed by its user id
 *   move to this one, the same way the rows did (#3785). Omitted, the
 *   snapshot applies as it is (the first-run restore adopts the backup's
 *   own identity).
 */
export async function restoreClientSnapshots(
    payload: BackupPayload,
    localUserId?: string,
): Promise<ClientSnapshotsApplied> {
    const snapshot =
        localUserId === undefined
            ? payload.local_storage
            : rehomeLocalStorageSnapshot(payload.local_storage, backupOwnerId(payload), localUserId);
    const localStorageKeys = await restoreLocalStorageSnapshot(snapshot);
    const pluginSettings = await restorePluginSettingsSnapshot(payload.plugin_settings);
    const aiValidationResults = await restoreAiValidationSnapshot(payload.ai_validation_results);
    return {localStorageKeys, pluginSettings, aiValidationResults};
}
