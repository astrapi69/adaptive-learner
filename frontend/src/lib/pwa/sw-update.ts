/**
 * pwa/sw-update — service-worker update primitives shared by the passive
 * update banner ({@link useAppUpdate}) and the active "check for updates"
 * control in Settings → About (#664).
 *
 * Keeping these in one module means the banner and the manual check apply
 * the SAME activation logic (skip-waiting + reload-on-takeover) and read the
 * SAME version manifest — they can never drift apart.
 */

import {
  fetchLatestVersion,
  isUpdateAvailable,
  type VersionManifest,
} from "./version-check";

/** The build this tab is running (build-time literals). */
export const CURRENT_BUILD: VersionManifest = {
  version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
  buildHash: typeof __BUILD_HASH__ === "string" ? __BUILD_HASH__ : "unknown",
};

/** Absolute URL of the deployed ``version.json`` (respects the Vite base). */
export function versionJsonUrl(): string {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";
  return `${base}version.json`;
}

/**
 * Ask the service worker to activate the fresh build, then reload once it
 * takes control so the page is served by the new precache (not the old one).
 *
 * Two paths (#818):
 *  - **A worker is already waiting** — tell it to ``SKIP_WAITING`` and reload
 *    on ``controllerchange``.
 *  - **No worker waiting** (the common version.json-only case) — a plain
 *    reload would be served stale from the old precache and the update banner
 *    would just reappear, so instead nudge ``reg.update()`` to fetch the new
 *    build and ``SKIP_WAITING`` whatever lands, then reload on takeover.
 *
 * Falls back to a plain reload when there is no SW registration at all. A
 * safety-net timeout guarantees a reload always happens even if no
 * ``controllerchange`` fires. Never reloads until called (user-triggered).
 */
export async function activateAndReload(): Promise<void> {
  const reload = () => window.location.reload();
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      reload();
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reload();
      return;
    }

    // Reload as soon as the fresh worker takes control. Wire this BEFORE
    // poking the worker so the controllerchange event is never missed.
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      // No worker parked yet: fetch the new build, then activate whatever
      // becomes available so the reload serves fresh assets, not the stale
      // precache that made the button look dead (#818).
      void reg
        .update()
        .then(() => reg.waiting?.postMessage({ type: "SKIP_WAITING" }))
        .catch(() => {
          /* best-effort — the safety-net reload below still fires */
        });
    }

    // Safety net: reload regardless after a short wait, so the click always
    // results in a fresh load even when no controllerchange fires.
    setTimeout(reloadOnce, 1200);
  } catch {
    reload();
  }
}

/** Options for {@link activateInBackground} (defaults injectable for tests). */
export interface BackgroundActivateOptions {
  /** Max activation attempts before giving up silently. Default 15. */
  maxAttempts?: number;
  /** First backoff delay in ms; doubles each attempt. Default 1000. */
  baseDelayMs?: number;
  /** Cap on a single backoff delay so 15 attempts fit ~60s. Default 8000. */
  maxDelayMs?: number;
  /** Hard ceiling on total elapsed time. Default 60000 (~60s). */
  maxTotalMs?: number;
  /** Reload impl (injectable for tests). Default ``window.location.reload``. */
  reload?: () => void;
  /** Epoch-ms clock (injectable for tests). Default ``Date.now``. */
  now?: () => number;
  /** Async delay (injectable for tests). Default ``setTimeout``-backed. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drive the service-worker activation in the BACKGROUND after the user clicked
 * "Aktualisieren", retrying on a capped exponential backoff (#846).
 *
 * Unlike {@link activateAndReload} (which fires an unconditional safety-net
 * reload after ~1.2s), this NEVER reloads on a stale build. It only reloads when
 * a fresh worker actually takes control (``controllerchange``). The skip-waiting
 * + reload handshake can race or fail (SW not yet parked, transient fetch
 * glitch), so each attempt re-nudges ``reg.update()`` and skip-waits whatever is
 * parked, with backoff between attempts (1s, 2s, 4s, 8s, capped at
 * ``maxDelayMs``). Whichever limit hits first — ``maxAttempts`` or
 * ``maxTotalMs`` — ends the loop.
 *
 * If it never takes within the budget, it gives up **silently**: no reload, no
 * banner. The next app start loads the new build anyway. Because the banner is
 * suppressed via {@link shouldShowUpdateBanner} the instant the user clicks,
 * even a stale reload mid-retry cannot make the banner reappear.
 */
export async function activateInBackground(
  options: BackgroundActivateOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 15;
  const baseDelay = options.baseDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 8000;
  const maxTotal = options.maxTotalMs ?? 60_000;
  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;

  // No service worker at all: there is no stale precache to serve, so a single
  // plain reload genuinely fetches the fresh build and can't loop. This keeps
  // the click meaningful on non-PWA browsers while never re-nagging.
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    reload();
    return;
  }

  let reg: ServiceWorkerRegistration | undefined;
  try {
    reg = await navigator.serviceWorker.getRegistration();
  } catch {
    reload();
    return;
  }
  if (!reg) {
    reload();
    return;
  }

  // Reload exactly once, when (and only when) the fresh worker takes control.
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

  const start = now();
  for (let attempt = 0; attempt < maxAttempts && !reloaded; attempt++) {
    try {
      await reg.update();
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      /* best-effort — retry on the next pass */
    }
    if (reloaded) break;

    const elapsed = now() - start;
    if (elapsed >= maxTotal) break;
    const delay = Math.min(baseDelay * 2 ** attempt, maxDelay, maxTotal - elapsed);
    await sleep(delay);
  }
  // Silent give-up: no reload, no banner. The next app start picks it up.
}

/** Outcome of an explicit user-triggered update check (#664). */
export type UpdateCheckStatus = "available" | "current" | "error";

export interface UpdateCheckOutcome {
  status: UpdateCheckStatus;
  /** The deployed version (from version.json), when it could be read. */
  latestVersion: string | null;
}

/**
 * Actively check whether a newer build is deployed (#664). Unlike the
 * passive banner (which only reacts to a SW that happens to detect an
 * update), this is user-triggered and ``version.json``-centric: it fetches
 * the deployed manifest (``cache: "no-store"``) and compares it with the
 * running build, so it works on every device/browser regardless of the
 * service-worker state. As a best-effort side-effect it also nudges any
 * registered SW to fetch the new build, so a subsequent
 * {@link activateAndReload} has a waiting worker to activate.
 *
 * Returns a discriminated outcome the UI maps to a message:
 *  - ``error`` — the manifest could not be read (offline / 404). Never a crash.
 *  - ``available`` — a newer ``version.json`` than the running build.
 *  - ``current`` — the running build matches the deployed one.
 *
 * @param current   The running build (defaults to {@link CURRENT_BUILD}).
 * @param url       version.json URL (defaults to {@link versionJsonUrl}).
 * @param fetchImpl Injectable fetch for tests.
 */
export async function checkForUpdate(
  current: VersionManifest = CURRENT_BUILD,
  url: string = versionJsonUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateCheckOutcome> {
  const latest = await fetchLatestVersion(url, fetchImpl);
  if (!latest) {
    return { status: "error", latestVersion: null };
  }
  // Best-effort: nudge a registered SW to fetch the new build so a following
  // ``activateAndReload`` can skip-waiting into it. Never gates the result.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    } catch {
      /* best-effort only */
    }
  }
  if (isUpdateAvailable(current, latest)) {
    return { status: "available", latestVersion: latest.version };
  }
  return { status: "current", latestVersion: latest.version };
}

/** Injectable seams for {@link checkForUpdateReliable} (defaults for prod). */
export interface ReliableCheckDeps {
  /** The running build (defaults to {@link CURRENT_BUILD}). */
  current?: VersionManifest;
  /** version.json URL (defaults to {@link versionJsonUrl}). */
  url?: string;
  /** Injectable fetch (defaults to the global fetch). */
  fetchImpl?: typeof fetch;
  /** Resolve the current SW registration (default: navigator.serviceWorker). */
  getRegistration?: () => Promise<
    ServiceWorkerRegistration | null | undefined
  >;
  /** Whether a SW currently controls the page (default: reads controller). */
  hasController?: () => boolean;
  /** Max time to await the SW install cycle before resolving. Default 8000. */
  timeoutMs?: number;
}

function defaultGetRegistration(): Promise<
  ServiceWorkerRegistration | null | undefined
> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(undefined);
  }
  return navigator.serviceWorker.getRegistration();
}

function defaultHasController(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    !!navigator.serviceWorker.controller
  );
}

/**
 * Await the service-worker update cycle and report whether a fresh worker is
 * (or becomes) ready — the piece missing from {@link checkForUpdate} that made
 * the About check need several clicks (#1374).
 *
 * Resolves ``true`` when a worker is already ``waiting`` or an ``installing``
 * worker reaches ``installed`` while the page is controlled (a real update, not
 * the first install). Resolves ``false`` when ``reg.update()`` completes with no
 * new worker parked, or the install goes ``redundant``. A timeout resolves with
 * the current ``reg.waiting`` state so a slow/absent cycle never hangs the UI.
 */
async function awaitServiceWorkerUpdate(
  getRegistration: () => Promise<
    ServiceWorkerRegistration | null | undefined
  >,
  hasController: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  let reg: ServiceWorkerRegistration | null | undefined;
  try {
    reg = await getRegistration();
  } catch {
    return false;
  }
  if (!reg) return false;
  if (reg.waiting) return true;

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish(!!reg?.waiting), timeoutMs);

    const watchInstalling = (installing: ServiceWorker | null | undefined) => {
      if (!installing) return;
      const onState = () => {
        if (installing.state === "installed" && hasController()) {
          finish(true);
        } else if (installing.state === "redundant") {
          finish(!!reg?.waiting);
        }
      };
      installing.addEventListener("statechange", onState);
      // In case the worker already reached its terminal state synchronously.
      onState();
    };

    reg.addEventListener("updatefound", () =>
      watchInstalling(reg?.installing),
    );

    // Kick the SW to look for a new build. When the check resolves with no
    // installing/waiting worker, there is nothing new — resolve fast so an
    // up-to-date app does not wait the full timeout.
    void reg
      .update()
      .then(() => {
        if (reg?.waiting) return finish(true);
        if (reg?.installing) return watchInstalling(reg.installing);
        finish(false);
      })
      .catch(() => finish(!!reg?.waiting));
  });
}

/**
 * Reliable, one-pass update check for the About control (#1374).
 *
 * Runs BOTH signals concurrently and awaits them: it fetches ``version.json``
 * AND awaits the service-worker install cycle ({@link awaitServiceWorkerUpdate})
 * with a timeout. This is what makes a single click on the About page resolve
 * correctly — the old {@link checkForUpdate} only compared version.json and
 * fired ``reg.update()`` fire-and-forget, so the first click saw a stale SW
 * state.
 *
 * Outcome:
 *  - ``available`` — a waiting/fresh worker OR a newer ``version.json``.
 *  - ``error`` — version.json unreadable AND no waiting worker (offline/timeout).
 *  - ``current`` — deployed build matches and no worker is waiting.
 */
export async function checkForUpdateReliable(
  deps: ReliableCheckDeps = {},
): Promise<UpdateCheckOutcome> {
  const current = deps.current ?? CURRENT_BUILD;
  const url = deps.url ?? versionJsonUrl();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const getRegistration = deps.getRegistration ?? defaultGetRegistration;
  const hasController = deps.hasController ?? defaultHasController;
  const timeoutMs = deps.timeoutMs ?? 8000;

  const [latest, swWaiting] = await Promise.all([
    fetchLatestVersion(url, fetchImpl),
    awaitServiceWorkerUpdate(getRegistration, hasController, timeoutMs),
  ]);

  if (swWaiting || isUpdateAvailable(current, latest)) {
    return {
      status: "available",
      latestVersion: latest?.version ?? current.version,
    };
  }
  if (!latest) {
    return { status: "error", latestVersion: null };
  }
  return { status: "current", latestVersion: latest.version };
}
