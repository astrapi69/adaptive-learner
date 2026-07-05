/**
 * useAppUpdate — the discreet global update banner's view of the shared update
 * store (#613, #846, #1374). A thin adapter: it starts the passive detection
 * once, reads the shared {@link useUpdateStore} snapshot, and exposes the
 * banner's public API. The banner and the About "check for updates" control now
 * read the SAME store, so applying at one place clears both (#1374).
 *
 * Discreet by contract: the passive check runs ONCE (via the store), is SKIPPED
 * while offline, and never surfaces an error. ``dismiss`` ("Später") hides the
 * banner for the current app session only.
 *
 * ``applyUpdate`` ("Aktualisieren") is a final decision (#846): the store records
 * the accepted version + timestamp so {@link shouldShowUpdateBanner} suppresses
 * the banner across a (possibly stale) reload, then drives the SW activation in
 * the background with capped retries — reloading only when a fresh worker takes
 * control, never on its own.
 */

import { useEffect } from "react";

import { useOnlineStatus } from "./useOnlineStatus";
import { useUpdateStore } from "./useUpdateStore";
import { CURRENT_BUILD } from "../../lib/pwa/sw-update";
import { shouldShowUpdateBanner } from "../../lib/pwa/update-accept";
import {
  applyUpdateNow,
  dismissUpdate,
  ensureUpdateStoreInit,
} from "../../lib/pwa/updateStore";

export interface AppUpdateState {
  /** True when a newer build is available and not yet dismissed/suppressed. */
  updateAvailable: boolean;
  /** The build this tab is running. */
  currentVersion: string;
  /** The deployed version (from version.json), when known. */
  latestVersion: string | null;
  /** Record acceptance + drive background activation. User-triggered only. */
  applyUpdate: () => void;
  /** Hide the banner until the next full app start (in-memory). */
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const online = useOnlineStatus();
  const snapshot = useUpdateStore();

  useEffect(() => {
    ensureUpdateStoreInit(online);
  }, [online]);

  // Suppress the banner once the user has accepted an update — within the quiet
  // window or for the already-accepted version (#846). Read per-render so the
  // suppression survives a reload (the in-memory ``dismissed`` does not).
  const suppressed = !shouldShowUpdateBanner(
    snapshot.latestVersion,
    snapshot.latestHash,
  );

  return {
    updateAvailable:
      snapshot.updateAvailable && !snapshot.dismissed && !suppressed,
    currentVersion: CURRENT_BUILD.version,
    latestVersion: snapshot.latestVersion,
    applyUpdate: applyUpdateNow,
    dismiss: dismissUpdate,
  };
}
