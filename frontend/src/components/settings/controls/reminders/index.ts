/**
 * Barrel for the `reminders` settings controls (#1275 god-folder split).
 * Re-exports each control's default + named members so consumers can
 * import from the concern folder or the parent `controls` barrel.
 */

export * from "./DailyRemindersControl";
export { default as DailyRemindersControl } from "./DailyRemindersControl";
export * from "./ReminderScheduler";
export { default as ReminderScheduler } from "./ReminderScheduler";
