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
 * ## Provenance: import order vs the user's order (#2173)
 *
 * Import and the user's reorder write to the SAME store, so the value carries
 * WHO set it: an ``origin`` of ``"import"`` (prepopulated from the source order
 * at ``saveUserSet`` time) or ``"user"`` (a manual move). A re-import may only
 * replace an ``"import"`` order - {@link storeImportLessonOrder} is a no-op once
 * the user has arranged the set, so a content update never silently overwrites
 * the learner's work. A legacy #2172 value (a bare array, only ever written by
 * a user move) is read as ``"user"`` - conservative, so no import can clobber
 * an order that predates this field.
 *
 * ## Semantics (deliberately self-healing)
 *
 * - Keys are ``source::set-id`` (matching ``set-status-store`` /
 *   ``dismissed-sets``). Same id from two sources is independent.
 * - The stored value is ``{ order, origin }`` - an ordered array of lesson
 *   FILENAMES plus its provenance. A bare array (legacy #2172) reads as a
 *   user-origin order.
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
import type { ContentLessonList } from "../../../storage/types";
import { USER_GENERATED_SOURCE } from "../../../storage/types";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.lesson-order";

/** Direction of a single-step move in "Lektionen verwalten". */
export type MoveDirection = "up" | "down";

/** Who set a stored order. Only an ``"import"`` order may be replaced by a
 *  re-import; a ``"user"`` order is the learner's arrangement and wins. */
type OrderOrigin = "import" | "user";

/** The stored value per set: the ordered filenames plus their provenance. */
interface StoredOrder {
  order: string[];
  origin: OrderOrigin;
}

function orderKey(source: string, setId: string): string {
  return `${source}::${setId}`;
}

function onlyStrings(values: readonly unknown[]): string[] {
  return values.filter((item): item is string => typeof item === "string");
}

/**
 * Normalize one persisted value into a {@link StoredOrder}, or ``null`` to drop
 * it. Two accepted shapes: the current ``{ order, origin }`` object, and the
 * legacy #2172 bare array (read as user-origin, since it could only have come
 * from a manual move - an import must never overwrite it).
 */
function normalizeStored(value: unknown): StoredOrder | null {
  if (Array.isArray(value)) {
    return { order: onlyStrings(value), origin: "user" };
  }
  if (value && typeof value === "object" && Array.isArray((value as { order?: unknown }).order)) {
    const record = value as { order: unknown[]; origin?: unknown };
    const origin: OrderOrigin = record.origin === "import" ? "import" : "user";
    return { order: onlyStrings(record.order), origin };
  }
  return null;
}

function resolveStorage(override?: Storage): Storage | null {
  if (override) return override;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function read(storage: Storage): Record<string, StoredOrder> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, StoredOrder> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      // Drop a corrupt entry rather than the whole map; a bad element inside a
      // valid order is filtered (not blanked) by ``normalizeStored``.
      const record = normalizeStored(val);
      if (record) out[key] = record;
    }
    return out;
  } catch {
    return {};
  }
}

function write(storage: Storage, map: Record<string, StoredOrder>, mirror: boolean): void {
  try {
    const raw = JSON.stringify(map);
    storage.setItem(STORAGE_KEY, raw);
    if (mirror) void mirrorUserData(STORAGE_KEY, raw);
  } catch {
    /* quota / disabled storage - worst case the order reverts on refresh */
  }
}

/** Persist one set's ``{ order, origin }`` record (idempotent, mirrored). */
function storeOrderRecord(
  source: string,
  setId: string,
  record: StoredOrder,
  storage?: Storage,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const map = read(store);
  map[orderKey(source, setId)] = record;
  write(store, map, storage === undefined);
}

/** The full ``source::set-id`` -> ordered-filenames map, tolerant of corruption. */
export function readLessonOrders(storage?: Storage): Record<string, string[]> {
  const store = resolveStorage(storage);
  if (!store) return {};
  const out: Record<string, string[]> = {};
  for (const [key, record] of Object.entries(read(store))) out[key] = record.order;
  return out;
}

/** The stored order for one set, or ``null`` when none is recorded. */
export function getLessonOrder(
  source: string,
  setId: string,
  storage?: Storage,
): string[] | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  return read(store)[orderKey(source, setId)]?.order ?? null;
}

/** Persist the full display order for one set as the USER's arrangement
 *  (idempotent, mirrored). A user order wins over any later import. */
export function storeLessonOrder(
  source: string,
  setId: string,
  filenames: readonly string[],
  storage?: Storage,
): void {
  storeOrderRecord(source, setId, { order: [...filenames], origin: "user" }, storage);
}

/**
 * Prepopulate a set's display order from its SOURCE order at import time
 * (#2173), unless the user has already arranged it. The write is a no-op when
 * the stored order is user-origin, so a re-import / content update never
 * silently overwrites the learner's work; an existing import-origin order (the
 * user never touched it) is refreshed to the new source order. An empty list
 * is ignored (nothing to order).
 */
export function storeImportLessonOrder(
  source: string,
  setId: string,
  filenames: readonly string[],
  storage?: Storage,
): void {
  if (filenames.length === 0) return;
  const store = resolveStorage(storage);
  if (!store) return;
  const existing = read(store)[orderKey(source, setId)];
  if (existing?.origin === "user") return;
  storeOrderRecord(source, setId, { order: [...filenames], origin: "import" }, storage);
}

/**
 * Record a freshly-saved user set's authoring/source order as the import-origin
 * display order (#2173). The filename convention (``<lesson.id>.json``) mirrors
 * ``saveUserSet``'s cache layout in both storage modes; wired at the single
 * ``saveUserSet`` seam so every import path is covered without a second
 * ordering mechanism. Respects an existing user arrangement (see
 * {@link storeImportLessonOrder}).
 */
export function recordSavedSetOrder(
  setId: string,
  lessons: readonly { id: string }[] | undefined,
  storage?: Storage,
): void {
  if (!Array.isArray(lessons)) return;
  storeImportLessonOrder(
    USER_GENERATED_SOURCE,
    setId,
    lessons.map((lesson) => `${lesson.id}.json`),
    storage,
  );
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
  const stored = read(store)[orderKey(source, setId)]?.order;
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
 * Apply the stored display order to a ``listLessons`` result (#2212).
 *
 * Wired at the single ``IStorageService.contentLoader.listLessons`` seam in
 * BOTH storage modes, so the user's chosen order drives every consumer of the
 * sequence - opening a set, next-lesson auto-advance, export, the learning
 * path - not just the "Manage lessons" list widget (#2172 stopped at the
 * widget). Returns the SAME list object when the set was never reordered
 * (``applyStoredLessonOrder`` hands back the same array reference), so existing
 * sets keep their natural order and referential-stability is preserved.
 */
export function applyStoredLessonOrderToList(
  list: ContentLessonList,
  storage?: Storage,
): ContentLessonList {
  const ordered = applyStoredLessonOrder(
    list.lessons,
    list.source,
    list.set_id,
    storage,
  );
  return ordered === list.lessons ? list : { ...list, lessons: ordered };
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
