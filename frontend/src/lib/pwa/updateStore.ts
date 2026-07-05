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
 * Passive one-time detection: fetch version.json and wire the service-worker
 * waiting-worker detection. Only ever RAISES ``updateAvailable`` — an explicit
 * check is what can clear it. Kicks in once; skipped while offline so a later
 * online start still runs it.
 */
export function ensureUpdateStoreInit(online: boolean): void {
  if (initStarted || !online) return;
  initStarted = true;

  void (async () => {
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
  })();

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return;
        if (reg.waiting) setState({ updateAvailable: true });
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
        void reg.update().catch(() => {
          /* best-effort */
        });
      })
      .catch(() => {
        /* no SW — version.json path still covers it */
      });
  }
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
  listeners.clear();
}
