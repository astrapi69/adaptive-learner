/**
 * ReminderScheduler — headless host for the daily learning reminder
 * (#723). Renders nothing; mounts the foreground scheduler app-wide so a
 * reminder can fire on any route while the app is open. Mounted once in
 * ``App`` alongside the other headless hosts (MilestoneHost, etc.).
 */

import {useReminderScheduler} from "../hooks/system/useReminderScheduler";

export default function ReminderScheduler() {
    useReminderScheduler();
    return null;
}
