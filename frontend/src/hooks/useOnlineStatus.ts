import {useEffect, useState} from "react";

/**
 * v0.6.0 / 9D — reactive online/offline status hook.
 *
 * Reads ``navigator.onLine`` at mount and subscribes to the
 * window's ``online`` / ``offline`` events. Returns ``true`` when
 * the browser believes the device has network connectivity.
 *
 * Caveats:
 * - ``navigator.onLine`` reports the OS-level state. It can be
 *   true while the actual API endpoint is unreachable
 *   (captive portal, DNS issue, backend down). This hook is a
 *   coarse signal, not a connectivity guarantee. Callers that
 *   need a true reachability probe should pair it with a
 *   periodic fetch to a known endpoint — out of scope for
 *   v0.6.0.
 * - In environments without ``window.navigator`` (SSR / certain
 *   test harnesses), the hook defaults to ``true`` so the UI
 *   doesn't render in degraded mode by accident.
 */
export function useOnlineStatus(): boolean {
    const [online, setOnline] = useState<boolean>(() => {
        if (typeof navigator === "undefined") return true;
        return navigator.onLine;
    });

    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    return online;
}
