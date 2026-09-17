/**
 * Disclosure open-state preference (#2959).
 *
 * Remembers whether a collapsible settings block was left open, keyed
 * by the caller (one localStorage key per disclosure). A per-viewer
 * convenience, not learner data: it is deliberately NOT registered in
 * ``MANAGED_USER_DATA_KEYS`` - keys under the ``adaptive-learner.``
 * prefix already ride the backup snapshot, and a fresh browser simply
 * starts from the caller's default.
 *
 * Every read and write is try/catch wrapped: a blocked, full or absent
 * storage (private window, quota, disabled site data) falls back to
 * the default instead of breaking the render. Only the literal strings
 * ``"true"`` / ``"false"`` count as stored state; anything else is
 * treated as unset.
 *
 * @example
 * const KEY = "adaptive-learner.settings.playful_details_open";
 * const open = readDisclosureOpen(KEY, false);
 * writeDisclosureOpen(KEY, !open);
 */

/** The remembered open state for ``key``, or ``fallback`` when unset / unreadable. */
export function readDisclosureOpen(key: string, fallback: boolean): boolean {
    try {
        const raw = localStorage.getItem(key);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* storage unavailable: fall through to the default */
    }
    return fallback;
}

/** Persist the open state for ``key``; a throwing storage is a no-op. */
export function writeDisclosureOpen(key: string, open: boolean): void {
    try {
        localStorage.setItem(key, open ? "true" : "false");
    } catch {
        /* no-op: storage unavailable */
    }
}
