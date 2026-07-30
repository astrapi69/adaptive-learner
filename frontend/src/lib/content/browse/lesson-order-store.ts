/**
 * Mode-agnostic display-order persistence for the lessons inside a content set
 * (#2172).
 *
 * ## Why this module exists
 *
 * "Lektionen verwalten" lists a set's lessons in whatever order the storage
 * layer returns them, which is a plain lexicographic sort of the lesson
 * FILENAMES (backend ``service.py`` ``sorted(...)``; frontend
 * ``content-loader-read`` ``.sort()``). For a book import whose filenames are
 * ``slugify(title)`` that is alphabetical-by-title, not reading order - and
 * there was no way to change it.
 *
 * ## The hard constraint: order is a separate field, identity is untouched
 *
 * A lesson's identity IS its filename: ``LessonProgress`` keys on
 * ``(user, source, set_id, lesson_filename)`` and SRS ``ElementError`` on
 * ``(user_id, set_id, lesson_id = filename, exercise_id, element_key)``.
 * Deriving order from the filename (a numeric ``NN-`` prefix) and then
 * renumbering on a move would CHANGE the identity and orphan every progress /
 * SRS row - the #2128 / EXP-045 hazard. So this store keeps the display order
 * as its OWN thing: a per-set ordered list OF the filenames. A move is a pure
 * permutation of existing identities; no filename is ever renamed, added, or
 * removed. Renumbering is impossible here by construction.
 *
 * ## The stable-exercise-identity question is elsewhere
 *
 * Stable, version-independent exercise/card identity is a schema concern owned
 * by ``learn-content-engine`` (EXP-045 / #2130). This store does not touch it:
 * lesson display order is a per-device UI preference (like ``set-status-store``
 * #2053 and ``dismissed-sets`` #1709), not content, so it needs no schema.
 *
 * ## Semantics (deliberately self-healing)
 *
 * - Keys are ``source::set-id`` (matching ``set-status-store`` /
 *   ``dismissed-sets``). Same id from two sources is independent.
 * - The stored value is an ordered array of lesson FILENAMES.
 * - {@link applyStoredLessonOrder} is the read overlay: the current filenames
 *   are ordered by the stored list; a filename not in the stored list keeps
 *   its natural position at the end (a lesson added after the order was saved);
 *   a stored filename no longer present is dropped (a deleted lesson). No
 *   stored order -> the natural order is returned unchanged (existing sets are
 *   never silently resorted).
 * - {@link moveLessonOrder} moves one lesson up/down and persists the full new
 *   order in one write; edges and unknown filenames are no-ops.
 * - Write-through mirrored into the Dexie ``userData`` store (#791 pattern) so
 *   the record survives a Dexie restore and rides in the ``.alb`` backup's
 *   localStorage snapshot - the key is registered in ``MANAGED_USER_DATA_KEYS``.
 *
 * All reads tolerate corrupt/absent storage by returning an empty map; writes
 * swallow quota errors (the order is a convenience, not load-bearing data).
 * Tests pass an explicit ``storage`` override and stay pure (no Dexie side
 * effect) - the same contract ``set-status-store`` uses.
 */

import { mirrorUserData } from "../../../storage/dexie/dexie-user-data";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.lesson-order";

/** Direction of a single-step move in "Lektionen verwalten". */
export type MoveDirection = "up" | "down";

function orderKey(source: string, setId: string): string {
  return `${source}::${setId}`;
}

function resolveStorage(override?: Storage): Storage | null {
  if (override) return override;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function read(storage: Storage): Record<string, string[]> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(val)) continue;
      // Drop any non-string entries rather than the whole order, so one
      // corrupt element can never blank a set's ordering.
      const filenames = val.filter((item): item is string => typeof item === "string");
      out[key] = filenames;
    }
    return out;
  } catch {
    return {};
  }
}

function write(storage: Storage, map: Record<string, string[]>, mirror: boolean): void {
  try {
    const raw = JSON.stringify(map);
    storage.setItem(STORAGE_KEY, raw);
    if (mirror) void mirrorUserData(STORAGE_KEY, raw);
  } catch {
    /* quota / disabled storage - worst case the order reverts on refresh */
  }
}

/** The full ``source::set-id`` -> ordered-filenames map, tolerant of corruption. */
export function readLessonOrders(storage?: Storage): Record<string, string[]> {
  const store = resolveStorage(storage);
  if (!store) return {};
  return read(store);
}

/** The stored order for one set, or ``null`` when none is recorded. */
export function getLessonOrder(
  source: string,
  setId: string,
  storage?: Storage,
): string[] | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  return read(store)[orderKey(source, setId)] ?? null;
}

/** Persist the full display order for one set (idempotent, mirrored). */
export function storeLessonOrder(
  source: string,
  setId: string,
  filenames: readonly string[],
  storage?: Storage,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const map = read(store);
  map[orderKey(source, setId)] = [...filenames];
  write(store, map, storage === undefined);
}

/**
 * Order the current filenames by the stored display order.
 *
 * Returns the SAME array reference when there is no stored order, so a set the
 * user has never reordered keeps its natural (storage-layer) order and
 * ``[lessons]``-keyed effects stay referentially stable. Otherwise: stored
 * filenames first (in stored order, minus any no longer present), then any
 * new filenames in their natural order.
 */
export function applyStoredLessonOrder(
  filenames: string[],
  source: string,
  setId: string,
  storage?: Storage,
): string[] {
  const store = resolveStorage(storage);
  if (!store) return filenames;
  const stored = read(store)[orderKey(source, setId)];
  if (!stored || stored.length === 0) return filenames;

  const present = new Set(filenames);
  const known = new Set<string>();
  const ordered: string[] = [];
  for (const filename of stored) {
    if (present.has(filename) && !known.has(filename)) {
      ordered.push(filename);
      known.add(filename);
    }
  }
  for (const filename of filenames) {
    if (!known.has(filename)) ordered.push(filename);
  }
  return ordered;
}

/**
 * Move one lesson one step up or down within the set, persist the new order,
 * and return it. A move at the edge (first up / last down) or of a filename
 * not in the set is a no-op: the input order is returned and nothing is
 * written. The move is a pure permutation - no filename is renamed, added, or
 * removed, so lesson progress and SRS rows stay attached.
 */
export function moveLessonOrder(
  source: string,
  setId: string,
  filenames: readonly string[],
  filename: string,
  direction: MoveDirection,
  storage?: Storage,
): string[] {
  const current = [...filenames];
  const index = current.indexOf(filename);
  if (index === -1) return current;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= current.length) return current;

  [current[index], current[target]] = [current[target], current[index]];
  storeLessonOrder(source, setId, current, storage);
  return current;
}
