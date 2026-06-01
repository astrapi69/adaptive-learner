/**
 * Local contribution history + recognition (Phase 64D).
 *
 * When a learner shares a lesson with the community, we remember it
 * LOCALLY (localStorage — no server, no auth) so the Content page can
 * show "My Contributions" with a count and a link back to each GitHub
 * submission, and award a local "Community Contributor" recognition at
 * 5+ shares.
 *
 * Status is best-effort: we only know a lesson was SUBMITTED (the
 * GitHub issue/PR was opened). A future enhancement may poll the
 * GitHub API for accepted/closed, but acceptance is never assumed —
 * the recognition text says "shared", not "accepted".
 *
 * Pure storage helpers; all reads tolerate corrupt/absent storage by
 * returning an empty history rather than throwing.
 */

const STORAGE_KEY = "adaptive-learner.contributions";

/** Threshold for the local "Community Contributor" recognition. */
export const CONTRIBUTOR_THRESHOLD = 5;

export type ContributionStatus = "submitted" | "accepted" | "rejected";

export interface SharedContribution {
  /** The shared lesson's id (or set id for a multi-lesson set). */
  lesson_id: string;
  title: string;
  /** ISO-8601 timestamp the share was recorded. Provided by the
   *  caller so this module stays deterministic + testable. */
  shared_at: string;
  /** The GitHub issue / PR URL the share opened. */
  github_url: string;
  status: ContributionStatus;
}

function read(storage: Storage): SharedContribution[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is SharedContribution =>
        e &&
        typeof e.lesson_id === "string" &&
        typeof e.title === "string" &&
        typeof e.github_url === "string",
    );
  } catch {
    return [];
  }
}

function write(storage: Storage, list: SharedContribution[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / disabled storage — history is a convenience, not load-bearing */
  }
}

function resolveStorage(override?: Storage): Storage | null {
  if (override) return override;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

/** All recorded contributions, newest first. */
export function listContributions(storage?: Storage): SharedContribution[] {
  const s = resolveStorage(storage);
  if (!s) return [];
  return read(s)
    .slice()
    .sort((a, b) => b.shared_at.localeCompare(a.shared_at));
}

/**
 * Record a share. De-duplicates by github_url (re-opening the same
 * submission does not double-count). Returns the updated list
 * (newest first).
 */
export function recordContribution(
  entry: SharedContribution,
  storage?: Storage,
): SharedContribution[] {
  const s = resolveStorage(storage);
  if (!s) return [entry];
  const existing = read(s).filter((e) => e.github_url !== entry.github_url);
  const next = [...existing, entry];
  write(s, next);
  return next.slice().sort((a, b) => b.shared_at.localeCompare(a.shared_at));
}

/** Number of distinct contributions recorded. */
export function contributionCount(storage?: Storage): number {
  return listContributions(storage).length;
}

/** Local recognition: the learner has shared at least
 *  {@link CONTRIBUTOR_THRESHOLD} lessons. */
export function isCommunityContributor(storage?: Storage): boolean {
  return contributionCount(storage) >= CONTRIBUTOR_THRESHOLD;
}

/** Remove all history (Settings/testing convenience). */
export function clearContributions(storage?: Storage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
