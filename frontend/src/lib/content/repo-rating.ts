/**
 * Local-only per-repo star ratings (EXP-023 Phase C slice).
 *
 * A learner can rate a connected repo 1-5 stars. The rating is stored
 * ON-DEVICE only (localStorage, one entry per source) — it is NOT shared
 * or aggregated across users. Community-aggregated ratings would need a
 * shared backend the project doesn't have yet (deferred). Labelled "Your
 * rating" in the UI so the local-only nature is honest.
 */

const PREFIX = "adaptive-learner.content_repo_rating::";

/** Clamp to an integer in 0..5 (0 = unrated). */
function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

/** Read the local rating for ``source`` (0 when unrated / unavailable). */
export function readRepoRating(source: string): number {
  try {
    return clamp(Number(localStorage.getItem(PREFIX + source)));
  } catch {
    return 0;
  }
}

/** Store the local rating (1-5) for ``source``; 0 clears it. */
export function writeRepoRating(source: string, rating: number): void {
  try {
    const value = clamp(rating);
    if (value > 0) localStorage.setItem(PREFIX + source, String(value));
    else localStorage.removeItem(PREFIX + source);
  } catch {
    /* storage unavailable — rating simply not kept */
  }
}

/** Remove the local rating for ``source`` (on disconnect). */
export function clearRepoRating(source: string): void {
  try {
    localStorage.removeItem(PREFIX + source);
  } catch {
    /* ignore */
  }
}
