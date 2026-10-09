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
import {restoreLocalStorageSnapshot, withLocalStorageSnapshot} from "./localStorageSnapshot";
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
 */
export async function restoreClientSnapshots(payload: BackupPayload): Promise<ClientSnapshotsApplied> {
    const localStorageKeys = await restoreLocalStorageSnapshot(payload.local_storage);
    const pluginSettings = await restorePluginSettingsSnapshot(payload.plugin_settings);
    const aiValidationResults = await restoreAiValidationSnapshot(payload.ai_validation_results);
    return {localStorageKeys, pluginSettings, aiValidationResults};
}
