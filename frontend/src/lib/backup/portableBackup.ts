/**
 * The full backup as it leaves and re-enters this app (#3412).
 *
 * The storage export carries the DB tables and the content sets. Two blocks
 * are added and applied frontend-side, in both storage modes, because the
 * backend import ignores them: the ``local_storage`` snapshot (preferences,
 * contributions) and the ``plugin_settings`` block (connected repositories,
 * redeemed invites, the Learning Repository switch). Every full-backup path
 * goes through these two helpers so the blocks cannot drift between them.
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

/** The storage export plus the ``local_storage`` and ``plugin_settings`` blocks. */
export async function exportPortableBackup(userId: string): Promise<BackupPayload> {
    const exported = await getStorage().backup.export(userId);
    return withPluginSettingsSnapshot(withLocalStorageSnapshot(exported));
}

/** What {@link restoreClientSnapshots} applied, for the round-trip trace. */
export interface ClientSnapshotsApplied {
    /** localStorage keys written. */
    localStorageKeys: number;
    /** Plugins whose settings were merged. */
    pluginSettings: string[];
}

/**
 * Apply the payload's client-side blocks after the storage import. A legacy
 * backup without them is a no-op.
 */
export async function restoreClientSnapshots(payload: BackupPayload): Promise<ClientSnapshotsApplied> {
    const localStorageKeys = await restoreLocalStorageSnapshot(payload.local_storage);
    const pluginSettings = await restorePluginSettingsSnapshot(payload.plugin_settings);
    return {localStorageKeys, pluginSettings};
}
