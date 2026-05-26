/**
 * Developer-mode preference (DEV-MODE-FRIENDLY-ERRORS-01).
 *
 * Returns whether the user has opted into Developer Mode. Off
 * by default. When ON:
 *   - Error toasts render the FULL technical message (status
 *     code, endpoint, raw detail) instead of the friendly
 *     status-code-mapped message.
 *   - A small "DEV" badge appears in the Navigation bar as a
 *     visual reminder that error display is in technical mode.
 *
 * eventRecorder captures full technical detail in BOTH modes;
 * dev mode only affects what the user SEES. The
 * ErrorReportDialog likewise always carries full technical
 * detail into the GitHub issue body — the production-mode
 * friendly toast text never leaks into the submitted report.
 *
 * Storage: ``localStorage`` under
 * ``adaptive-learner.developer_mode``. Default OFF (matching the
 * "users see no technical errors" production posture).
 *
 * Updates: a custom ``adaptive-learner:developer-mode-changed``
 * event fires when the Settings toggle flips so every subscribed
 * component re-renders in lockstep. The standard ``storage``
 * event handles cross-tab sync.
 *
 * Module-level read: ``isDevMode()`` is callable from non-React
 * contexts (notify.ts decides at toast time, where hooks are
 * unavailable).
 */

import {useEffect, useState} from "react";

const STORAGE_KEY = "adaptive-learner.developer_mode";
const EVENT_NAME = "adaptive-learner:developer-mode-changed";

function readPreference(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === "true";
    } catch {
        return false;
    }
}

/**
 * Synchronous module-level read. Use from non-React contexts
 * (notify.ts). React components should use ``useDevMode`` so the
 * UI re-renders when the toggle flips.
 */
export function isDevMode(): boolean {
    return readPreference();
}

/**
 * Hook returning the current Developer Mode value. Re-renders
 * the consumer whenever the Settings toggle changes the
 * preference, in this tab or another.
 */
export function useDevMode(): boolean {
    const [enabled, setEnabled] = useState<boolean>(() => readPreference());

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            typeof window.addEventListener !== "function"
        ) {
            return;
        }
        const handler = () => setEnabled(readPreference());
        window.addEventListener(EVENT_NAME, handler);
        const storageHandler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setEnabled(readPreference());
            }
        };
        window.addEventListener("storage", storageHandler);
        return () => {
            window.removeEventListener(EVENT_NAME, handler);
            window.removeEventListener("storage", storageHandler);
        };
    }, []);

    return enabled;
}

/**
 * Imperative setter for the Settings toggle. Persists the
 * preference + dispatches the change event so every consumer
 * re-renders immediately.
 */
export function setDevModeEnabled(value: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
        /* localStorage unavailable — best effort */
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {value}}));
    }
}
