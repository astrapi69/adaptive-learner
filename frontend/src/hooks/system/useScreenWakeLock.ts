/**
 * Hold a screen wake lock while ``active`` (#3358).
 *
 * One hook for every "someone is reading" state: silent reading in a
 * lesson, the runner modes and read-aloud. Before, only read-aloud held a
 * lock, so the screen turned off during silent reading, and its re-acquire
 * after an app switch never ran: the handle was not cleared when the
 * browser released the lock on hide.
 *
 * - The sentinel's ``release`` event clears the handle, so returning to
 *   the page requests a fresh lock.
 * - A refused request (hidden document, a platform without a user
 *   gesture) is logged with its reason and retried once on the next
 *   ``pointerdown`` or ``keydown``.
 * - A power-button press cannot be prevented; that is a platform limit.
 *
 * @example
 * useScreenWakeLock(status === "ready" && !isSummary && keepScreenOn);
 */

import {useEffect} from "react";

import {
    isWakeLockSupported,
    releaseWakeLock,
    requestWakeLock,
    type WakeLockHandle,
} from "../../lib/voice/wake-lock";

export function useScreenWakeLock(active: boolean): void {
    useEffect(() => {
        if (!active || !isWakeLockSupported()) return;
        let cancelled = false;
        let handle: WakeLockHandle = null;

        const onGesture = () => {
            window.removeEventListener("pointerdown", onGesture);
            window.removeEventListener("keydown", onGesture);
            if (!handle) void acquire(false);
        };

        const acquire = async (retryOnGesture: boolean) => {
            if (document.visibilityState !== "visible") return;
            const lock = await requestWakeLock();
            if (cancelled) {
                void releaseWakeLock(lock);
                return;
            }
            if (lock) {
                handle = lock;
                lock.addEventListener("release", () => {
                    if (handle === lock) handle = null;
                });
            } else if (retryOnGesture) {
                window.addEventListener("pointerdown", onGesture);
                window.addEventListener("keydown", onGesture);
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible" && !handle) void acquire(true);
        };

        void acquire(true);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pointerdown", onGesture);
            window.removeEventListener("keydown", onGesture);
            void releaseWakeLock(handle);
        };
    }, [active]);
}
