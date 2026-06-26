/**
 * "Have we offered the online-to-local data migration yet?" flag (#1085).
 *
 * A per-install (per-browser) UI flag: once the welcome dialog has been shown
 * and acted on, it stays dismissed. localStorage (not a synced setting) is the
 * right home — it is a property of THIS device's first run, not of the user's
 * data, so it must not travel in a backup and re-trigger on the next install.
 * Never throws (private mode / quota): a failed read reports "not offered" so
 * the dialog can still help; a failed write is simply not persisted.
 */

const MIGRATION_OFFERED_KEY = "adaptive-learner.migration_offered";

/** True once the migration welcome has been offered + dismissed on this device. */
export function isMigrationOffered(): boolean {
  try {
    return localStorage.getItem(MIGRATION_OFFERED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persist that the migration welcome was offered, so it does not reappear. */
export function markMigrationOffered(): void {
  try {
    localStorage.setItem(MIGRATION_OFFERED_KEY, "true");
  } catch {
    /* storage unavailable — the dialog may reappear next launch, which is safe */
  }
}
