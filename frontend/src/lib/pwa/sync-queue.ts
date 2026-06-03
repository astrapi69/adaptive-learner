/**
 * S3 (PWA hardening) — offline background-sync queue.
 *
 * A small, dependency-free queue of pending mutating API requests that
 * failed because the device was offline. Persisted in localStorage (a
 * plain list of POSTs — no Dexie schema bump, no SW coupling) and
 * replayed from the window when connectivity returns.
 *
 * Why localStorage + a window-side replay (not the Background Sync API):
 * a service worker has NO access to localStorage, so an SW ``sync``
 * event could not read this queue. The ``online`` window event +
 * startup replay is the spec's stated fallback and the path that
 * actually works for a localStorage-backed queue. It replays whenever a
 * tab is open and reconnects.
 *
 * Scope (deliberately small — see docs/audits/performance-audit + the
 * PWA work): only lesson-progress upserts are enqueued today (the clear,
 * low-risk win: never lose lesson progress recorded while offline).
 * Destructive operations (delete / reset) are NEVER queued — those
 * require an explicit, online, user action.
 */

import { API_BASE } from "../constants";

const STORAGE_KEY = "adaptive-learner.sync-queue";
/** Cap the queue so a long offline session can't grow it unbounded. */
const MAX_ITEMS = 50;

export interface SyncQueueItem {
  id: string;
  /** API path relative to API_BASE, e.g. ``/users/{id}/lesson-progress``. */
  path: string;
  method: string;
  body: unknown;
  timestamp: number;
}

function readQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SyncQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota / disabled storage — nothing actionable; drop silently.
  }
}

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

/**
 * Append a pending request. Keeps only the most recent MAX_ITEMS
 * (oldest dropped first) so an extended offline session can't grow the
 * queue without bound.
 */
export function enqueueRequest(
  path: string,
  method: string,
  body: unknown,
): void {
  const items = readQueue();
  items.push({ id: newId(), path, method, body, timestamp: Date.now() });
  writeQueue(items.slice(-MAX_ITEMS));
}

export function getSyncQueue(): SyncQueueItem[] {
  return readQueue();
}

export function syncQueueSize(): number {
  return readQueue().length;
}

export function clearSyncQueue(): void {
  writeQueue([]);
}

/**
 * Replay the queue FIFO. A 2xx removes the item; a 4xx is treated as
 * permanent (bad/duplicate request) and dropped so it can't retry
 * forever; a 5xx or network failure STOPS the replay and keeps that
 * item plus everything after it, preserving order (a later completion
 * must never apply before an earlier step result).
 */
export async function replaySyncQueue(
  fetchImpl: typeof fetch = fetch,
): Promise<{ replayed: number; remaining: number }> {
  const items = readQueue();
  if (items.length === 0) return { replayed: 0, remaining: 0 };

  let replayed = 0;
  const remaining: SyncQueueItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const response = await fetchImpl(`${API_BASE}${item.path}`, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
      });
      if (response.ok) {
        replayed += 1;
        continue;
      }
      if (response.status >= 400 && response.status < 500) {
        // Permanent client error (e.g. already applied) — drop it.
        continue;
      }
      // 5xx — transient. Keep this item + the rest, in order.
      remaining.push(...items.slice(i));
      break;
    } catch {
      // Network failure — still offline. Keep this item + the rest.
      remaining.push(...items.slice(i));
      break;
    }
  }

  writeQueue(remaining);
  return { replayed, remaining: remaining.length };
}

let initialized = false;

/**
 * Wire the window-side replay triggers. Idempotent. Call once at app
 * startup. Replays on the ``online`` event and once immediately if the
 * app starts online with a non-empty queue.
 */
export function initSyncQueueReplay(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => {
    void replaySyncQueue();
  });
  if (
    typeof navigator !== "undefined" &&
    navigator.onLine &&
    syncQueueSize() > 0
  ) {
    void replaySyncQueue();
  }
}
