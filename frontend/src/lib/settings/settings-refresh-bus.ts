/**
 * settings-refresh-bus — a minimal module-level pub/sub so any section that
 * mutates the persisted ``UserSettings`` (encrypted key-vault import, backup
 * restore) can ask the Settings page to RE-READ its loaded settings, without a
 * page reload (#1765).
 *
 * Background: the Settings page loads ``UserSettings`` once on mount into local
 * state; sections that write settings straight to storage (KeyVaultSection,
 * BackupSection) never notified it, so an imported key still read as "Empty" on
 * the AI tab until a manual F5. This fixes the class, not just the one case:
 * every settings-mutating section emits, the Settings page subscribes and
 * re-fetches.
 *
 * Same shape as ``lib/pwa/updateStore`` (module singleton + listener set) — the
 * established reactive-signal precedent in this codebase. Carries no payload:
 * the subscriber owns the re-fetch, so nothing here ever touches key material.
 */

const listeners = new Set<() => void>();

/**
 * Subscribe to settings-refresh requests. Returns an unsubscribe function.
 *
 * @example
 * useEffect(() => subscribeSettingsRefresh(refetchSettings), []);
 */
export function subscribeSettingsRefresh(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Signal that the persisted user settings changed and any live view of them
 * should re-read from storage. Call after a successful key-vault import or a
 * backup restore.
 */
export function emitSettingsRefresh(): void {
    for (const listener of [...listeners]) listener();
}

/** Clear all listeners — TEST ONLY. */
export function resetSettingsRefreshBus(): void {
    listeners.clear();
}
