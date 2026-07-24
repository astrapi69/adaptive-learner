/**
 * Mode-agnostic lifecycle-status persistence for content sets.
 *
 * A set in "Meine Inhalte" carries a per-device lifecycle status
 * (active / deferred / completed, #1300). That status is NOT synced learner
 * data — it is a local UI decision, exactly like a deletion
 * ({@link ../browse/dismissed-sets}) — so its home is one localStorage store
 * that behaves IDENTICALLY in both storage modes.
 *
 * ## Why this module exists (the recurring status-reset bug)
 *
 * The original #1300/#1351 implementation stored the status ONLY on the Dexie
 * content-cache row. ``ApiStorage.setSetStatus`` was a documented no-op, so in
 * API (server / desktop) mode nothing was ever persisted: the optimistic React
 * update made the change look applied until the page reloaded its data, then
 * every set read back as the default "active". A fix that works in one of two
 * storage modes is not a fix — this store removes the divergence by being the
 * single source of truth read by the page's data hook on every load, in both
 * modes.
 *
 * ## Semantics (deliberately self-healing)
 *
 * - Keys are ``source::set-id`` (the source-scoped set identity, matching
 *   ``dismissed-sets``). Same id from two repos is independent.
 * - {@link storeSetStatus} records EVERY transition, including a return to
 *   "active": an explicit stored "active" must win over a stale non-active
 *   value left on a pre-upgrade Dexie row, so re-activation actually sticks.
 * - {@link applyStoredStatuses} is the read overlay: a stored value wins;
 *   absent, the entry keeps whatever the storage layer returned (so an
 *   existing Dexie deferral survives the upgrade until the user touches it).
 * - Write-through mirrored into the Dexie ``userData`` canonical store
 *   (#791 pattern) so the record survives a Dexie restore and rides in the
 *   ``.alb`` backup's localStorage snapshot — the key is registered in
 *   ``MANAGED_USER_DATA_KEYS``.
 *
 * All reads tolerate corrupt/absent storage by returning an empty map; writes
 * swallow quota errors (the status is a convenience, not load-bearing data).
 * Tests pass an explicit ``storage`` override and stay pure (no Dexie side
 * effect) — the same contract ``dismissed-sets`` uses.
 */

import { mirrorUserData } from "../../../storage/dexie/dexie-user-data";
import type { SetStatus } from "../../../storage/types";

/** localStorage key; registered in ``MANAGED_USER_DATA_KEYS``. */
const STORAGE_KEY = "adaptive-learner.set-status";

const VALID: readonly SetStatus[] = ["active", "deferred", "completed"];

/** A ``source``/``setId`` pair, the unit of a status write (matches SetRef). */
export interface SetStatusRef {
  source: string;
  setId: string;
}

function statusKey(source: string, setId: string): string {
  return `${source}::${setId}`;
}

function resolveStorage(override?: Storage): Storage | null {
  if (override) return override;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function isSetStatus(value: unknown): value is SetStatus {
  return typeof value === "string" && (VALID as readonly string[]).includes(value);
}

function read(storage: Storage): Record<string, SetStatus> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, SetStatus> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isSetStatus(val)) out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function write(storage: Storage, map: Record<string, SetStatus>, mirror: boolean): void {
  try {
    const raw = JSON.stringify(map);
    storage.setItem(STORAGE_KEY, raw);
    if (mirror) void mirrorUserData(STORAGE_KEY, raw);
  } catch {
    /* quota / disabled storage — worst case the status reverts on refresh */
  }
}

/** The full ``source::set-id`` → status map, tolerant of corruption. */
export function readSetStatuses(storage?: Storage): Record<string, SetStatus> {
  const store = resolveStorage(storage);
  if (!store) return {};
  return read(store);
}

/** The stored status for one set, or ``null`` when none is recorded. */
export function getSetStatus(
  source: string,
  setId: string,
  storage?: Storage,
): SetStatus | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  return read(store)[statusKey(source, setId)] ?? null;
}

/** Record a single set's lifecycle status (idempotent). */
export function storeSetStatus(
  source: string,
  setId: string,
  status: SetStatus,
  storage?: Storage,
): void {
  storeSetStatuses([{ source, setId }], status, storage);
}

/** Record a bulk transition in one write (idempotent per ref). */
export function storeSetStatuses(
  refs: readonly SetStatusRef[],
  status: SetStatus,
  storage?: Storage,
): void {
  if (refs.length === 0) return;
  const store = resolveStorage(storage);
  if (!store) return;
  const map = read(store);
  for (const { source, setId } of refs) map[statusKey(source, setId)] = status;
  write(store, map, storage === undefined);
}

/** Minimal shape the overlay needs off a content entry. */
interface StatusableEntry {
  source: string;
  id: string;
  status?: SetStatus;
}

/**
 * Overlay the persisted status onto a freshly-loaded set list. A stored value
 * wins; absent, the entry keeps its own status. Returns the SAME array
 * reference when nothing changes, so the page's ``[sets]``-keyed effects stay
 * referentially stable between renders.
 */
export function applyStoredStatuses<T extends StatusableEntry>(
  entries: T[],
  storage?: Storage,
): T[] {
  const store = resolveStorage(storage);
  if (!store) return entries;
  const map = read(store);
  let changed = false;
  const next = entries.map((entry) => {
    const stored = map[statusKey(entry.source, entry.id)];
    const desired = stored ?? entry.status ?? "active";
    if ((entry.status ?? "active") === desired) return entry;
    changed = true;
    return { ...entry, status: desired };
  });
  return changed ? next : entries;
}
