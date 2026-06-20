/**
 * useAppUpdate — detects when a newer build is deployed and exposes a
 * user-driven "apply" action (#613). Storage-agnostic (pure frontend).
 *
 * Two independent signals, either of which flags an update:
 *  1. **version.json** — fetched once on mount with ``cache: "no-store"``
 *     and compared with the built-in ``__APP_VERSION__`` / ``__BUILD_HASH__``.
 *  2. **Service worker** — a waiting worker (a new SW installed while the
 *     old one still controls the page) detected via the registration.
 *
 * Discreet by contract: the check runs ONCE on mount (not per navigation),
 * is SKIPPED while offline (the fetch would fail), and never surfaces an
 * error. ``dismiss`` ("Später") hides the prompt for the current app session
 * only — the in-memory state resets on the next full load, so a deferred
 * update is re-offered on the next start, not on every navigation.
 *
 * ``applyUpdate`` ("Aktualisieren") is a final decision (#846): it records the
 * accepted version + timestamp in localStorage and drives the SW activation in
 * the BACKGROUND with capped retries ({@link activateInBackground}). The
 * recorded acceptance makes {@link shouldShowUpdateBanner} suppress the banner
 * across a (possibly stale) reload, so the banner can never re-nag for an
 * already-accepted version — only a genuinely NEWER version re-offers it. Never
 * reloads on its own — only when a fresh worker takes control after a click.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnlineStatus } from "./useOnlineStatus";
import { fetchLatestVersion, isUpdateAvailable } from "../../lib/pwa/version-check";
import {
  activateInBackground,
  CURRENT_BUILD,
  versionJsonUrl,
} from "../../lib/pwa/sw-update";
import {
  recordUpdateAccepted,
  shouldShowUpdateBanner,
} from "../../lib/pwa/update-accept";

export interface AppUpdateState {
  /** True when a newer build is available and not yet dismissed. */
  updateAvailable: boolean;
  /** The build this tab is running. */
  currentVersion: string;
  /** The deployed version (from version.json), when known. */
  latestVersion: string | null;
  /** Skip-waiting (if a SW is waiting) + reload. User-triggered only. */
  applyUpdate: () => void;
  /** Hide the prompt until the next full app start (in-memory). */
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const online = useOnlineStatus();
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Guard so the version fetch + SW wiring run once, not on every
  // online-flip or re-render.
  const checkedRef = useRef(false);

  useEffect(() => {
    // Discreet: only check once, and only when online (an offline fetch
    // would fail). The SW path still applies on a later online start.
    if (checkedRef.current || !online) return;
    checkedRef.current = true;
    let cancelled = false;

    void (async () => {
      const latest = await fetchLatestVersion(versionJsonUrl());
      if (cancelled) return;
      if (latest) setLatestVersion(latest.version);
      if (isUpdateAvailable(CURRENT_BUILD, latest)) setHasUpdate(true);
    })();

    // Service-worker waiting-worker detection (complements version.json).
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (cancelled || !reg) return;
          if (reg.waiting) setHasUpdate(true);
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              // A worker reaching "installed" while one already controls
              // the page is an update (not the first install).
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller &&
                !cancelled
              ) {
                setHasUpdate(true);
              }
            });
          });
          // Proactively ask the SW to check for a new version.
          void reg.update().catch(() => {
            /* best-effort */
          });
        })
        .catch(() => {
          /* no SW — version.json path still covers it */
        });
    }

    return () => {
      cancelled = true;
    };
  }, [online]);

  const applyUpdate = useCallback(() => {
    // The click is a final decision: persist it (#846) so a stale reload (no
    // waiting SW -> old precache served, version.json still newer) can never
    // re-nag. Recording the accepted version + timestamp makes
    // shouldShowUpdateBanner suppress the banner across the reload, and from
    // then on only a NEWER version re-offers it.
    recordUpdateAccepted(latestVersion);
    // Close the banner immediately so the click ALWAYS has a visible effect
    // (#818), then drive the SW activation in the BACKGROUND with capped
    // retries (#846) — it reloads only when a fresh worker actually takes
    // control, never on a stale build, and gives up silently if it can't.
    setDismissed(true);
    void activateInBackground();
  }, [latestVersion]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // Suppress the banner once the user has accepted an update — within the quiet
  // window or for the already-accepted version (#846). Read per-render so the
  // suppression survives a reload (the in-memory ``dismissed`` does not).
  const suppressed = !shouldShowUpdateBanner(latestVersion);

  return {
    updateAvailable: hasUpdate && !dismissed && !suppressed,
    currentVersion: CURRENT_BUILD.version,
    latestVersion,
    applyUpdate,
    dismiss,
  };
}
