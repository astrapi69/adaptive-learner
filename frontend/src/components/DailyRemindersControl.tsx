/**
 * DailyRemindersControl — Settings → Learning control for daily learning
 * reminders (#723): a master toggle, the reminder time, the weekdays, and
 * a notification-permission request with denied/unsupported guidance.
 *
 * Persists via ``lib/notifications/reminderPref`` (same localStorage
 * pattern as the hint/feedback controls). Per the feature-state policy
 * the time/weekday controls stay visible but disabled when reminders are
 * off, rather than vanishing. Weekday labels are derived from ``Intl`` in
 * the active language — no per-weekday i18n keys needed.
 */

import {useMemo, useState} from "react";

import {useI18n} from "../hooks/ui/useI18n";
import {useNotificationPermission} from "../hooks/system/useNotificationPermission";
import {
    readReminderSettings,
    setReminderTime,
    setReminderWeekdays,
    setRemindersEnabled,
} from "../lib/notifications/reminderPref";

/** Localized short weekday labels indexed by JS getDay() (0 = Sunday). */
function useWeekdayLabels(lang: string): string[] {
    return useMemo(() => {
        try {
            const formatter = new Intl.DateTimeFormat(lang, {weekday: "short"});
            // 2024-01-07 is a Sunday; +d walks Sun..Sat.
            return Array.from({length: 7}, (_, day) =>
                formatter.format(new Date(Date.UTC(2024, 0, 7 + day))),
            );
        } catch {
            return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        }
    }, [lang]);
}

export default function DailyRemindersControl() {
    const {t, lang} = useI18n();
    const {permission, supported, request} = useNotificationPermission();
    const weekdayLabels = useWeekdayLabels(lang);

    const initial = readReminderSettings();
    const [enabled, setEnabled] = useState(initial.enabled);
    const [time, setTime] = useState(initial.time);
    const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays);

    const handleEnabled = async (next: boolean) => {
        setEnabled(next);
        setRemindersEnabled(next);
        // Turning reminders on is the natural moment to ask for permission.
        if (next && supported && permission === "default") {
            await request();
        }
    };

    const handleTime = (next: string) => {
        setTime(next);
        setReminderTime(next);
    };

    const toggleWeekday = (day: number) => {
        const next = weekdays.includes(day)
            ? weekdays.filter((d) => d !== day)
            : [...weekdays, day].sort((a, b) => a - b);
        setWeekdays(next);
        setReminderWeekdays(next);
    };

    const controlsDisabled = !enabled;

    return (
        <section
            className="settings-section"
            data-testid="settings-section-reminders"
        >
            <h2 className="settings-section-title">
                {t("settings.section_reminders", "Reminders")}
            </h2>

            <label className="form-row form-row-toggle">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t(
                            "settings.reminders_enabled",
                            "Daily learning reminders",
                        )}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.reminders_enabled_desc",
                            "Get a browser notification when reviews are due. Fires only while the app is open.",
                        )}
                    </span>
                </span>
                <input
                    type="checkbox"
                    data-testid="settings-reminders-toggle"
                    checked={enabled}
                    onChange={(e) => void handleEnabled(e.target.checked)}
                />
            </label>

            <label className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.reminders_time", "Reminder time")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.reminders_time_desc",
                            "When to remind you each day.",
                        )}
                    </span>
                </span>
                <input
                    type="time"
                    data-testid="settings-reminders-time"
                    value={time}
                    disabled={controlsDisabled}
                    onChange={(e) => handleTime(e.target.value)}
                />
            </label>

            <div className="form-row">
                <span className="form-label-stack">
                    <span className="form-label">
                        {t("settings.reminders_weekdays", "Days")}
                    </span>
                    <span className="form-hint">
                        {t(
                            "settings.reminders_weekdays_desc",
                            "Which days to remind you.",
                        )}
                    </span>
                </span>
                <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label={t("settings.reminders_weekdays", "Days")}
                    data-testid="settings-reminders-weekdays"
                >
                    {weekdayLabels.map((label, day) => {
                        const active = weekdays.includes(day);
                        return (
                            <button
                                key={day}
                                type="button"
                                className={`rounded-md border px-2 py-1 text-xs ${
                                    active
                                        ? "border-accent bg-accent text-accent-foreground"
                                        : "border-border text-fg-secondary"
                                }`}
                                aria-pressed={active}
                                disabled={controlsDisabled}
                                data-testid={`settings-reminders-weekday-${day}`}
                                onClick={() => toggleWeekday(day)}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {enabled && supported && permission === "denied" && (
                <p
                    className="form-hint text-warning"
                    data-testid="settings-reminders-denied"
                >
                    {t(
                        "settings.reminders_permission_denied",
                        "Notifications are blocked. Enable them in your browser's site settings to receive reminders.",
                    )}
                </p>
            )}
            {enabled && supported && permission === "default" && (
                <button
                    type="button"
                    className="btn btn-outline"
                    data-testid="settings-reminders-request"
                    onClick={() => void request()}
                >
                    {t(
                        "settings.reminders_permission_request",
                        "Enable notifications",
                    )}
                </button>
            )}
            {enabled && !supported && (
                <p
                    className="form-hint text-fg-secondary"
                    data-testid="settings-reminders-unsupported"
                >
                    {t(
                        "settings.reminders_unsupported",
                        "Your browser does not support notifications.",
                    )}
                </p>
            )}
        </section>
    );
}
