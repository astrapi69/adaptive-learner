/**
 * Screen Wake Lock — keeps the display from auto-sleeping during
 * read-aloud playback (#2666).
 *
 * The lesson TTS engine (``useReadAloud``) is built entirely on
 * ``window.speechSynthesis``. iOS Safari (and mobile Chrome) suspend
 * speech synthesis once the device's inactivity timer turns the
 * screen off, which stops playback mid-lesson even though the
 * learner never touched a control. The Screen Wake Lock API
 * (https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API)
 * prevents exactly that inactivity-timeout screen-off. It cannot
 * prevent a manual power-button press — that is a platform limit no
 * web API can cross.
 *
 * A held wake lock is released automatically by the browser whenever
 * the document becomes hidden (tab switch, app backgrounding) and
 * does NOT reacquire itself when the page becomes visible again;
 * callers that still need it must request a new one.
 */

export type WakeLockHandle = WakeLockSentinel | null;

/** Whether the browser exposes ``navigator.wakeLock``. */
export function isWakeLockSupported(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Request a screen wake lock. Resolves to ``null`` when the API is
 * unsupported OR the request is refused (e.g. low battery, a hidden
 * document) — callers treat both as "no wake lock, playback continues
 * best-effort" rather than as an error.
 */
export async function requestWakeLock(): Promise<WakeLockHandle> {
    if (!isWakeLockSupported()) return null;
    try {
        return await navigator.wakeLock.request("screen");
    } catch {
        return null;
    }
}

/** Release a previously acquired wake lock. Safe to call with ``null``. */
export async function releaseWakeLock(handle: WakeLockHandle): Promise<void> {
    if (!handle) return;
    try {
        await handle.release();
    } catch {
        // Already released (e.g. the browser released it when the
        // document went hidden) — nothing left to do.
    }
}
