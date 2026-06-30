/**
 * Barrel for the Settings controls, grouped by concern (#1275
 * god-folder split): `lesson` (lesson-playthrough + content
 * settings), `motivation` (gamification, missions, feedback,
 * sound), and `reminders` (daily reminder + headless scheduler).
 * Re-exports every control so existing `controls`-barrel consumers
 * keep working unchanged.
 */

export * from "./lesson";
export * from "./motivation";
export * from "./reminders";
