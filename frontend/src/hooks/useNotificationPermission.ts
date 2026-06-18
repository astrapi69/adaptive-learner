/**
 * useNotificationPermission — thin reactive wrapper around the Web
 * Notifications permission state (#723). Reports whether the browser
 * supports notifications and the current permission, and exposes a
 * ``request()`` that prompts and returns the resulting permission.
 *
 * Pure browser API, no storage, both storage modes.
 */

import {useCallback, useState} from "react";

export type NotificationPermissionState =
    | "default"
    | "granted"
    | "denied"
    | "unsupported";

function currentPermission(): NotificationPermissionState {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
        return "unsupported";
    }
    return window.Notification.permission;
}

export interface UseNotificationPermissionResult {
    /** Current permission, or ``"unsupported"`` when the API is absent. */
    permission: NotificationPermissionState;
    /** True when the browser exposes the Notifications API. */
    supported: boolean;
    /** Prompt for permission; resolves to the resulting state. */
    request: () => Promise<NotificationPermissionState>;
}

export function useNotificationPermission(): UseNotificationPermissionResult {
    const [permission, setPermission] = useState<NotificationPermissionState>(
        () => currentPermission(),
    );

    const request = useCallback(async (): Promise<NotificationPermissionState> => {
        if (typeof window === "undefined" || typeof window.Notification === "undefined") {
            setPermission("unsupported");
            return "unsupported";
        }
        try {
            const result = await window.Notification.requestPermission();
            setPermission(result);
            return result;
        } catch {
            // Older browsers reject or never resolve; re-read the state.
            const fallback = currentPermission();
            setPermission(fallback);
            return fallback;
        }
    }, []);

    return {
        permission,
        supported: permission !== "unsupported",
        request,
    };
}
