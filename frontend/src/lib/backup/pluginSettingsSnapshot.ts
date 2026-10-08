/**
 * Plugin settings that belong to the learner travel with the backup (#3412).
 *
 * Connected content repositories and redeemed invites live in the
 * ``content-loader`` plugin settings, the Learning Repository switch in
 * ``learning-repo``. Neither backup carried plugin settings, so after
 * Export -> new device -> Import the sets came back without their sources.
 *
 * The block rides the payload like ``local_storage``: captured and applied
 * frontend-side through ``getStorage().pluginSettings`` (the backend import
 * ignores it), so one implementation serves both storage modes.
 *
 * Only listed keys travel. Secrets are not in these settings (a coach
 * repo's token lives in the per-repo token store), and device-local values
 * stay behind (``repos_dir`` is a folder on this machine).
 *
 * @example
 * const payload = await withPluginSettingsSnapshot(exported);
 * await restorePluginSettingsSnapshot(payload.plugin_settings);
 */

import {getStorage} from "../../storage";

/** Plugin name -> the settings keys that belong to the learner. */
export const PLUGIN_SETTINGS_BACKUP_KEYS: Readonly<Record<string, readonly string[]>> = {
    "content-loader": ["user_repos", "invite_redemptions"],
    // repos_dir is left out on purpose: a folder path on this device.
    "learning-repo": ["enable_git"],
};

/** The ``plugin_settings`` block of a backup payload. */
export type PluginSettingsSnapshot = Record<string, Record<string, unknown>>;

/** The storage surface this module needs (``getStorage().pluginSettings``). */
export interface PluginSettingsStore {
    get(name: string): Promise<{plugin: string; settings: Record<string, unknown>}>;
    update(
        name: string,
        body: {settings: Record<string, unknown>},
    ): Promise<{plugin: string; settings: Record<string, unknown>}>;
}

type Entry = Record<string, unknown>;

/** How two list entries are recognised as the same, per list key. */
const IDENTITY: Readonly<Record<string, (entry: Entry) => string>> = {
    user_repos: (repo) => `${String(repo.owner)}/${String(repo.repo)}`.toLowerCase(),
    invite_redemptions: (redemption) => String(redemption.code).toUpperCase(),
};

function defaultStore(): PluginSettingsStore {
    return getStorage().pluginSettings;
}

/**
 * The listed keys of every plugin, read through the active storage.
 *
 * @param store - Plugin-settings surface; defaults to ``getStorage()``.
 * @returns ``{plugin: {key: value}}``; a plugin whose settings cannot be
 *   read is left out rather than failing the export.
 */
export async function capturePluginSettingsSnapshot(
    store: PluginSettingsStore = defaultStore(),
): Promise<PluginSettingsSnapshot> {
    const snapshot: PluginSettingsSnapshot = {};
    for (const [plugin, keys] of Object.entries(PLUGIN_SETTINGS_BACKUP_KEYS)) {
        let settings: Record<string, unknown>;
        try {
            settings = (await store.get(plugin)).settings;
        } catch (err) {
            console.warn("[Backup] plugin settings not readable, left out:", plugin, err);
            continue;
        }
        const picked: Record<string, unknown> = {};
        for (const key of keys) {
            if (key in settings) picked[key] = settings[key];
        }
        if (Object.keys(picked).length > 0) snapshot[plugin] = picked;
    }
    return snapshot;
}

/** ``payload`` with a fresh ``plugin_settings`` block. */
export async function withPluginSettingsSnapshot<T extends {plugin_settings?: PluginSettingsSnapshot}>(
    payload: T,
    store: PluginSettingsStore = defaultStore(),
): Promise<T> {
    return {...payload, plugin_settings: await capturePluginSettingsSnapshot(store)};
}

/** Local entries first, then the backup's entries this device lacks. */
function mergeList(key: string, local: unknown, incoming: unknown): unknown {
    const identity = IDENTITY[key];
    if (!identity || !Array.isArray(incoming)) return incoming;
    const kept = Array.isArray(local) ? (local as Entry[]) : [];
    const known = new Set(kept.map(identity));
    const added = (incoming as Entry[]).filter((entry) => !known.has(identity(entry)));
    return [...kept, ...added];
}

/**
 * Merge a backup's plugin settings into this device's.
 *
 * Lists (repos, invites) keep the local entries and add the backup's
 * missing ones; a scalar takes the backup's value; keys outside the list
 * (and plugins outside it) are never written.
 *
 * @param snapshot - The payload's ``plugin_settings`` block, or undefined.
 * @param store - Plugin-settings surface; defaults to ``getStorage()``.
 * @returns The plugins whose settings were written.
 */
export async function restorePluginSettingsSnapshot(
    snapshot: PluginSettingsSnapshot | undefined,
    store: PluginSettingsStore = defaultStore(),
): Promise<string[]> {
    const applied: string[] = [];
    if (!snapshot) return applied;
    for (const [plugin, keys] of Object.entries(PLUGIN_SETTINGS_BACKUP_KEYS)) {
        const incoming = snapshot[plugin];
        if (!incoming || typeof incoming !== "object") continue;
        const present = keys.filter((key) => key in incoming);
        if (present.length === 0) continue;
        const current = (await store.get(plugin)).settings;
        const next = {...current};
        for (const key of present) next[key] = mergeList(key, current[key], incoming[key]);
        await store.update(plugin, {settings: next});
        applied.push(plugin);
    }
    return applied;
}
