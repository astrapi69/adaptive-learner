/**
 * notifications/showReminderNotification — fire a single foreground
 * reminder notification (#723) and wire its click to a callback.
 *
 * Foreground scope: the app is open, so a page-context ``Notification``
 * with an ``onclick`` handler is the simplest path that also lets the
 * click navigate in-app (background/closed-PWA delivery would need the
 * Push API + a server, which is out of scope). Returns whether a
 * notification was actually shown so the caller can decide what to do on
 * an unsupported / not-granted browser.
 */

export interface ReminderNotificationOptions {
    title: string;
    body: string;
    /** Invoked when the user clicks the notification. */
    onClick: () => void;
}

/**
 * Show a single foreground reminder notification and wire its click
 * to ``options.onClick``. Returns false (showing nothing) when the
 * Notification API is unavailable or permission is not granted.
 */
export function showReminderNotification(
    options: ReminderNotificationOptions,
): boolean {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
        return false;
    }
    if (window.Notification.permission !== "granted") return false;

    try {
        const notification = new window.Notification(options.title, {
            body: options.body,
            // Stable tag: a second reminder the same day replaces rather
            // than stacks (defensive — the scheduler already fires once/day).
            tag: "adaptive-learner-daily-reminder",
        });
        notification.onclick = () => {
            try {
                window.focus();
            } catch {
                /* no-op */
            }
            notification.close();
            options.onClick();
        };
        return true;
    } catch {
        return false;
    }
}
