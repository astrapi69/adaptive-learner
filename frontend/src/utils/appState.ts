/**
 * App-state snapshot source for the event recorder (EXP-028, EVT-02).
 *
 * Lives separately from ``eventRecorder.ts`` on purpose: capturing the
 * snapshot needs the storage barrel (``resolveStorageMode``), and the
 * recorder is imported by the api client which the storage barrel
 * pulls in — importing storage *into* the recorder would close that
 * loop into an import cycle. The recorder instead receives this
 * capturer via ``setAppStateProvider`` from a leaf component.
 *
 * The captured snapshot is deliberately minimal and PII-free: storage
 * mode, UI language, online/offline.
 */

import {resolveStorageMode} from "../storage";
import type {AppStateSnapshot} from "./eventRecorder";

/**
 * Current UI language. Updated by the i18n provider on language change
 * so the snapshot does not depend on a React hook at capture time.
 */
let currentLanguage = "de";

/** Record the active UI language. Called from the i18n provider. */
export function setCurrentLanguage(lang: string): void {
    currentLanguage = lang;
}

/** Read ``navigator.onLine`` defensively (absent in some test envs). */
function isOnline(): boolean {
    try {
        return typeof navigator !== "undefined" ? navigator.onLine : true;
    } catch {
        return true;
    }
}

/**
 * Capture the current app-state snapshot for attachment to an
 * error event.
 *
 * @example
 * setAppStateProvider(captureAppState);
 */
export function captureAppState(): AppStateSnapshot {
    return {
        storageMode: resolveStorageMode(),
        language: currentLanguage,
        online: isOnline(),
    };
}
