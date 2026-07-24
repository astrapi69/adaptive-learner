/**
 * useReminderScheduler — fires the daily learning reminder while the app
 * is open (#723). Foreground scheduling only (see ``lib/notifications``).
 *
 * Every tick (and on mount + window focus) it re-reads the persisted
 * reminder settings, asks the pure ``isReminderDue`` whether today's slot
 * is active and unconsumed, and — if a review is actually due — shows a
 * notification whose click opens the review session. The day's slot is
 * consumed (``setLastShownDate``) only once a notification is actually
 * shown, so a 0-due reminder time can still fire later the same day when
 * reviews become due.
 *
 * Mounted once, app-wide, via the headless ``ReminderScheduler``.
 */

import {useEffect} from "react";
import {useNavigate} from "react-router";

import {readLearnerState} from "../../lib/learning/learnerState";
import {getDueReviewsSummary} from "../../lib/notifications/dueReviews";
import {isReminderDue, localDateKey} from "../../lib/notifications/reminder";
import {
    readLastShownDate,
    readReminderSettings,
    setLastShownDate,
} from "../../lib/notifications/reminderPref";
import {showReminderNotification} from "../../lib/notifications/showReminderNotification";
import {useI18n} from "../ui/useI18n";

/** How often the foreground scheduler re-evaluates the reminder slot. */
const TICK_MS = 30_000;

function notificationsGranted(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.Notification !== "undefined" &&
        window.Notification.permission === "granted"
    );
}

export function useReminderScheduler(): void {
    const {t} = useI18n();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        async function evaluate() {
            const settings = readReminderSettings();
            if (!settings.enabled) return;
            if (!isReminderDue(settings, new Date(), readLastShownDate())) {
                return;
            }
            if (!notificationsGranted()) return;

            const userId = readLearnerState().userId;
            if (!userId) return;

            const {count, firstSetId} = await getDueReviewsSummary(userId);
            if (cancelled || count === 0) return;

            const title = t(
                "settings.reminders_notification_title",
                "Time to review",
            );
            const body = t(
                "settings.reminders_notification_body",
                "{n} reviews are due. Keep your streak going!",
            ).replace("{n}", String(count));
            const href = firstSetId
                ? `/review/${encodeURIComponent(firstSetId)}`
                : "/dashboard";

            const shown = showReminderNotification({
                title,
                body,
                onClick: () => navigate(href),
            });
            if (shown) setLastShownDate(localDateKey(new Date()));
        }

        void evaluate();
        const timer = window.setInterval(() => void evaluate(), TICK_MS);
        const onFocus = () => void evaluate();
        window.addEventListener("focus", onFocus);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener("focus", onFocus);
        };
    }, [navigate, t]);
}
