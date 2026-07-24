/**
 * Persisted "explicitly removed by the user" state for content sets
 * (#1709).
 *
 * Deleting a set in "Meine Inhalte" purges its local cache, but the source
 * catalogue (bundled build assets, the official repo manifest, connected
 * user repos) keeps advertising it — so a bare Refresh used to bring every
 * deleted set straight back. This module remembers the deletion as a
 * *dismissal* so the Content page can keep the set hidden while it is not
 * cached.
 *
 * Semantics (kept deliberately self-healing):
 *
 * - A dismissal only suppresses an entry that is NOT cached. A cached set
 *   (the user re-downloaded it, e.g. via /discover) always wins over an old
 *   record, so a stale dismissal can never hide real local content.
 * - /discover intentionally ignores dismissals — that surface exists to
 *   (re-)discover content, so a deleted set stays one download away.
 * - Keys are ``source::set-id`` (the ``source``-scoped set identity), stored in
 *   localStorage (works in BOTH storage modes) and write-through-mirrored
 *   into the Dexie ``userData`` canonical store (#791 Teil B pattern), so
 *   the record survives a Dexie restore and rides in the ``.alb`` backup's
 *   localStorage snapshot.
 *
 * All reads tolerate corrupt/absent storage by returning an empty list;
 * writes swallow quota errors (the dismissal is a convenience, not
 * load-bearing data). Tests pass an explicit ``storage`` override and stay
 * pure (no Dexie side effect) — the same contract contribution-history uses.
 */

import { mirrorUserData } from "../../../storage/dexie/dexie-user-data";

const STORAGE_KEY = "adaptive-learner.dismissed-sets";

/** A ``source``/``setId`` pair, the unit of a dismissal (matches SetRef). */
export interface DismissedSetRef {
  source: string;
  setId: string;
}

function dismissalKey(source: string, setId: string): string {
  return `${source}::${setId}`;
}

function resolveStorage(override?: Storage): Storage | null {
  if (override) return override;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function read(storage: Storage): string[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}

function write(storage: Storage, keys: string[], mirror: boolean): void {
  try {
    const raw = JSON.stringify(keys);
    storage.setItem(STORAGE_KEY, raw);
    if (mirror) void mirrorUserData(STORAGE_KEY, raw);
  } catch {
    /* quota / disabled storage — worst case the set reappears on refresh */
  }
}

/** All recorded dismissal keys (``source::set-id``), tolerant of corruption. */
export function readDismissedSetKeys(storage?: Storage): string[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  return read(store);
}

/** True when the user explicitly deleted this set from "Meine Inhalte". */
export function isDismissedSet(
  source: string,
  setId: string,
  storage?: Storage,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  return read(store).includes(dismissalKey(source, setId));
}

/** Record a single set deletion (idempotent). */
export function dismissSet(
  source: string,
  setId: string,
  storage?: Storage,
): void {
  dismissSets([{ source, setId }], storage);
}

/** Record a bulk deletion in one write (idempotent per ref). */
export function dismissSets(
  refs: readonly DismissedSetRef[],
  storage?: Storage,
): void {
  if (refs.length === 0) return;
  const store = resolveStorage(storage);
  if (!store) return;
  const keys = new Set(read(store));
  for (const { source, setId } of refs) keys.add(dismissalKey(source, setId));
  write(store, [...keys], storage === undefined);
}

/** Clear a dismissal (the user re-downloaded the set). No-op when absent. */
export function undismissSet(
  source: string,
  setId: string,
  storage?: Storage,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const key = dismissalKey(source, setId);
  const keys = read(store);
  if (!keys.includes(key)) return;
  write(
    store,
    keys.filter((k) => k !== key),
    storage === undefined,
  );
}
