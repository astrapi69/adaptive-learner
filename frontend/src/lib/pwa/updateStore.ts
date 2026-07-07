/**
 * pwa/updateStore — the SINGLE source of truth for the app-update state,
 * shared by the discreet global banner ({@link useAppUpdate}) and the active
 * "check for updates" control in Settings → About ({@link UpdateCheckControl})
 * (#1374).
 *
 * Before this store the two surfaces held independent state and never
 * synchronised: the About check could report "available" while the bottom
 * banner stayed active, and applying at one place did not clear the other.
 * Now both read the same module-level snapshot via {@link useUpdateStore}, so:
 *
 *  - A waiting update detected passively is shown on the About page WITHOUT a
 *    click.
 *  - Applying at either surface (skip-waiting + reload) clears BOTH.
 *
 * Storage-agnostic (pure frontend). A module singleton by design — the update
 * state is a single global fact about this tab. ``resetUpdateStore`` exists for
 * test isolation only.
 */

import {
  activateInBackground,
  checkForUpdateReliable,
  CURRENT_BUILD,
  versionJsonUrl,
  type UpdateCheckStatus,
} from "./sw-update";
import {
  recordUpdateAccepted,
  shouldShowUpdateBanner,
} from "./update-accept";
import {
  fetchLatestVersion,
  isUpdateAvailable,
  knownBuildHash,
} from "./version-check";

const LAST_CHECKED_KEY = "adaptive-learner.update.lastCheckedAt";

/**
 * Minimum gap between two PASSIVE foreground re-checks (#1357). A backgrounded
 * iOS standalone PWA suspends its version.json poll and its service worker, so
 * the ONLY reliable moment to re-detect a new build is when the user brings the
 * app back to the foreground. We re-check on ``visibilitychange`` — but not on
 * every focus flip: 15 minutes is chosen because GitHub Pages serves
 * ``version.json`` with ``max-age=600`` (10 min, see version-check.ts), so
 * checking more often than the edge-cache TTL yields no new signal, while a user
 * genuinely returning after a break (the common iOS case) is always past the
 * window and gets an immediate check. Rapid tab-switching costs at most ~4
 * network round-trips per hour.
 */
export const FOREGROUND_RECHECK_THROTTLE_MS = 15 * 60 * 1000;

/** Result phase of the last EXPLICIT check (About page). */
export type CheckPhase = "idle" | "checking" | UpdateCheckStatus;

export interface UpdateStoreState {
  /** Outcome of the most recent explicit check (idle until one runs). */
  phase: CheckPhase;
  /** A newer build is available (SW waiting or version.json newer). */
  updateAvailable: boolean;
  /** The deployed version (from version.json / a check), when known. */
  latestVersion: string | null;
  /** The deployed build hash (from version.json / a check), when known (#1382). */
  latestHash: string | null;
  /** In-memory banner dismiss ("Später"/X) for the current app session. */
  dismissed: boolean;
  /** Epoch-ms of the last completed explicit check, or ``null``. */
  lastCheckedAt: number | null;
}

function readLastChecked(): number | null {
  try {
    const raw = sessionStorage.getItem(LAST_CHECKED_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastChecked(ts: number): void {
  try {
    sessionStorage.setItem(LAST_CHECKED_KEY, String(ts));
  } catch {
    /* sessionStorage unavailable (private mode) — non-fatal */
  }
}

function initialState(): UpdateStoreState {
  return {
    phase: "idle",
    updateAvailable: false,
    latestVersion: null,
    latestHash: null,
    dismissed: false,
    lastCheckedAt: readLastChecked(),
  };
}

let state: UpdateStoreState = initialState();
let initStarted = false;
/**
 * Epoch-ms of the last PASSIVE poll (init or foreground re-check), in memory
 * only. On iOS the PWA is suspended, not reloaded, when backgrounded, so this
 * value survives the background→foreground round-trip that a reload-based
 * tracker would lose; a genuine app relaunch runs {@link ensureUpdateStoreInit}
 * afresh anyway. Used solely to throttle {@link maybeRecheckForUpdate}.
 */
let lastPassiveCheckAt: number | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<UpdateStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

/** Subscribe to store changes (for ``useSyncExternalStore``). */
export function subscribeUpdateStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current snapshot (stable reference until the next change). */
export function getUpdateSnapshot(): UpdateStoreState {
  return state;
}

/**
 * Repeatable passive poll (#1357): fetch version.json, ask the service worker
 * to re-check for a new build, and raise ``updateAvailable`` on a newer
 * version/hash or a waiting worker. Only ever RAISES the flag — an explicit
 * check is what can clear it. Records the poll time so the foreground re-check
 * can throttle itself. ``now`` is injectable for tests.
 */
async function runPassivePoll(online: boolean, now: number): Promise<void> {
  if (!online) return;
  lastPassiveCheckAt = now;

  const latest = await fetchLatestVersion(versionJsonUrl());
  if (latest) {
    setState({
      latestVersion: latest.version,
      latestHash: knownBuildHash(latest),
    });
  }
  if (isUpdateAvailable(CURRENT_BUILD, latest)) {
    setState({ updateAvailable: true });
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      if (reg.waiting) setState({ updateAvailable: true });
      await reg.update().catch(() => {
        /* best-effort — version.json path still covers it */
      });
      if (reg.waiting) setState({ updateAvailable: true });
    } catch {
      /* no SW — version.json path already ran */
    }
  }
}

/**
 * Wire the one-time service-worker ``updatefound`` listener so a new worker that
 * finishes installing AFTER a poll returns still raises ``updateAvailable``.
 * Attached once (from {@link ensureUpdateStoreInit}); the repeatable
 * {@link runPassivePoll} covers the already-waiting case on every foreground.
 */
function wireServiceWorkerListener(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  void navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (!reg) return;
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setState({ updateAvailable: true });
          }
        });
      });
    })
    .catch(() => {
      /* no SW — version.json path covers it */
    });
}

/**
 * Passive detection at app start: run the first poll and wire the SW listener.
 * Kicks in once; skipped while offline so a later online start still runs it.
 * ``now`` is injectable for tests.
 */
export function ensureUpdateStoreInit(online: boolean, now = Date.now()): void {
  if (initStarted || !online) return;
  initStarted = true;
  wireServiceWorkerListener();
  void runPassivePoll(online, now);
}

/**
 * Re-run passive detection when the app returns to the foreground (#1357).
 * Bound to ``visibilitychange`` by {@link useAppUpdate}. Throttled to at most
 * one poll per {@link FOREGROUND_RECHECK_THROTTLE_MS}; skipped while offline.
 * If detection never started (a first foreground before mount effects ran), it
 * defers to {@link ensureUpdateStoreInit}. ``now`` is injectable for tests.
 */
export function maybeRecheckForUpdate(online: boolean, now = Date.now()): void {
  if (!online) return;
  if (!initStarted) {
    ensureUpdateStoreInit(online, now);
    return;
  }
  if (
    lastPassiveCheckAt !== null &&
    now - lastPassiveCheckAt < FOREGROUND_RECHECK_THROTTLE_MS
  ) {
    return;
  }
  void runPassivePoll(online, now);
}

/**
 * Run an explicit, reliable one-pass check (About "Auf Updates prüfen").
 * Sets a visible ``checking`` phase immediately, then resolves to
 * ``available`` / ``current`` / ``error`` in a single pass by awaiting the SW
 * cycle + version.json ({@link checkForUpdateReliable}).
 */
export async function checkUpdateNow(): Promise<void> {
  setState({ phase: "checking" });
  const outcome = await checkForUpdateReliable();
  const now = Date.now();
  writeLastChecked(now);
  if (outcome.status === "available" || outcome.status === "preparing") {
    // preparing (#1382): a newer build IS deployed (the hash is the truth),
    // only the fresh service worker is not fetchable yet — keep the update
    // flagged and let the UI show the honest "being prepared" state.
    setState({
      phase: outcome.status,
      updateAvailable: true,
      latestVersion: outcome.latestVersion,
      latestHash: outcome.latestHash,
      lastCheckedAt: now,
    });
  } else if (outcome.status === "current") {
    setState({
      phase: "current",
      updateAvailable: false,
      latestVersion: outcome.latestVersion,
      latestHash: outcome.latestHash,
      lastCheckedAt: now,
    });
  } else {
    // error — leave any previously-known waiting update in place.
    setState({ phase: "error", lastCheckedAt: now });
  }
}

/**
 * Apply the update from EITHER surface: record the acceptance (so the banner
 * can never re-nag, #846), clear both indicators, and drive the SW activation
 * in the background (reloads only when a fresh worker takes control).
 */
export function applyUpdateNow(): void {
  recordUpdateAccepted(state.latestVersion, state.latestHash);
  setState({ updateAvailable: false, dismissed: true, phase: "idle" });
  void activateInBackground();
}

/** Dismiss the banner for this app session ("Später"/X). */
export function dismissUpdate(): void {
  setState({ dismissed: true });
}

/**
 * Whether the discreet global banner should show right now. Composes the store
 * state with the persisted-acceptance suppression ({@link shouldShowUpdateBanner},
 * read per-call so it survives a reload the in-memory ``dismissed`` does not).
 */
export function bannerVisible(): boolean {
  return (
    state.updateAvailable &&
    !state.dismissed &&
    shouldShowUpdateBanner(state.latestVersion, state.latestHash)
  );
}

/** Reset module state — TEST ONLY. */
export function resetUpdateStore(): void {
  state = initialState();
  initStarted = false;
  lastPassiveCheckAt = null;
  listeners.clear();
}
