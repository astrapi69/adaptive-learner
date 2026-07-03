/**
 * "Last seen content catalogue" anchor — powers the New-content indicator in
 * Discover (EXP-034 Content Discovery).
 *
 * Purely client-side: it persists the set of discover set keys the user has
 * already seen, so a set that appears in the catalogue for the first time
 * (e.g. a freshly-published set, or the first set in a new source language)
 * can be flagged **New** on the next Discover open / after a sync. No server
 * push, no notification infrastructure — just an old-vs-new key diff.
 *
 * Persisted under a single localStorage key — the same lightweight UI-pref
 * pattern as ``viewModePref`` / ``sourceLanguagePref``, so it works in Dexie /
 * offline mode with no backend. Library-grade: pure read/write, no React.
 */

const KEY = "adaptive-learner.discover_seen_sets";

export const SEEN_CATALOG_KEY = KEY;

/**
 * Read the persisted seen-set keys, or ``null`` when the anchor has never been
 * recorded (a first-ever Discover open). ``null`` is distinct from an empty set
 * so the caller can avoid flagging the entire catalogue as "New" the first time.
 */
export function readSeenCatalog(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return null;
  }
}

/** Persist ``keys`` as the seen catalogue (replaces the anchor). Never throws. */
export function writeSeenCatalog(keys: Iterable<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(keys)]));
  } catch {
    /* storage unavailable — the anchor simply is not persisted */
  }
}

/**
 * The keys in ``currentKeys`` that are NEW relative to the ``seen`` anchor.
 *
 * First run (``seen === null``) → an EMPTY set: the very first time the user
 * opens Discover, nothing is "New" (otherwise the whole catalogue would light
 * up). On every later run it is ``currentKeys − seen``.
 */
export function computeNewKeys(
  currentKeys: Iterable<string>,
  seen: Set<string> | null,
): Set<string> {
  const out = new Set<string>();
  if (seen === null) return out;
  for (const key of currentKeys) {
    if (!seen.has(key)) out.add(key);
  }
  return out;
}

/** New keys for ``currentKeys`` vs. the persisted anchor (convenience). */
export function newKeysAgainstSeen(currentKeys: Iterable<string>): Set<string> {
  return computeNewKeys(currentKeys, readSeenCatalog());
}

/**
 * Mark the current catalogue as seen (updates the anchor). Call this after the
 * user has viewed Discover / after a sync, so the sets flagged this time are no
 * longer "New" next time.
 */
export function markCatalogSeen(currentKeys: Iterable<string>): void {
  writeSeenCatalog(currentKeys);
}
