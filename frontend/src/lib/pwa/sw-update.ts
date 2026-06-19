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
