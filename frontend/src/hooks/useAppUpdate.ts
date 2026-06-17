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
 * error. ``dismiss`` hides the prompt for the current app session only —
 * the in-memory state resets on the next full load, so a deferred update
 * is re-offered on the next start, not on every navigation.
 *
 * ``applyUpdate`` asks any waiting SW to ``skipWaiting`` (so the new SW
 * takes control) and reloads; with no SW it falls back to a plain reload.
 * Never reloads on its own — only when the user calls it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnlineStatus } from "./useOnlineStatus";
import { fetchLatestVersion, isUpdateAvailable } from "../lib/pwa/version-check";
import {
  activateAndReload,
  CURRENT_BUILD,
  versionJsonUrl,
} from "../lib/pwa/sw-update";

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
    void activateAndReload();
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    updateAvailable: hasUpdate && !dismissed,
    currentVersion: CURRENT_BUILD.version,
    latestVersion,
    applyUpdate,
    dismiss,
  };
}
