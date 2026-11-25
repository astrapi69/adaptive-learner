/**
 * The "this app is out of date" hint on the set link's not-found state.
 *
 * An installed app keeps running the build it was installed with until the
 * learner accepts an update. An older build cannot resolve every set a newer
 * one can, so a set link that misses asks the update store for a newer build
 * before the learner is sent to Discover. Updating reloads the same address,
 * so the set the link named is not lost.
 *
 * The hint reads the store's ``updateAvailable`` itself, not the banner's
 * visibility: a banner the learner dismissed with "Later" must not hide the
 * one update that would open this link.
 *
 * Service-worker builds only. API and desktop mode have no service worker and
 * update through the desktop update host, so the hint stays out there.
 *
 * @example
 * {resolution === "not_found" && <SetLinkUpdateHint />}
 */

import { useEffect, useSyncExternalStore } from "react";
import type { UpdateStore } from "@astrapi69/pwa-update";

import { Button } from "@/components/ui/button";

import { useI18n } from "../../hooks/ui/useI18n";
import { appUpdateStore } from "../../lib/pwa/update-store";
import { resolveStorageMode } from "../../storage";

interface SetLinkUpdateHintProps {
  /** The update store to ask. Defaults to the app's single instance. */
  store?: UpdateStore;
}

/** Whether this runtime can be asked for an update right now. */
function canCheck(): boolean {
  if (resolveStorageMode() === "api") return false;
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export default function SetLinkUpdateHint({ store = appUpdateStore }: SetLinkUpdateHintProps) {
  const { t } = useI18n();
  const enabled = canCheck();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    // A failed check leaves the plain not-found state, which is still correct.
    void store.checkNow().catch(() => undefined);
  }, [enabled, store]);

  if (!enabled || !state.updateAvailable) return null;

  return (
    <div
      className="mt-4 rounded-md border border-border bg-bg-elevated p-3"
      role="status"
      aria-live="polite"
      data-testid="set-link-update-hint"
    >
      <p className="m-0 text-sm">{t("pwa.update.message", "A new version is available.")}</p>
      {state.needsFullRestart && (
        <p className="mt-1 text-sm text-fg-muted" data-testid="set-link-update-restart">
          {t(
            "pwa.update.ios_restart_hint",
            "If nothing changes, close the app and reopen it.",
          )}
        </p>
      )}
      <Button
        type="button"
        className="mt-3 min-h-11"
        onClick={() => store.apply()}
        data-testid="set-link-update-apply"
      >
        {t("pwa.update.action", "Update")}
      </Button>
    </div>
  );
}
