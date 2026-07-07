/**
 * UpdateCheckControl — an active "check for updates" control for the
 * Settings → About version card (#664), now reading the SHARED update store
 * (#1374).
 *
 * The PWA update banner ({@link useAppUpdate}) is PASSIVE and can be missed;
 * this control is the reliable, user-initiated path visible on every
 * device/browser. Both surfaces now read the same {@link useUpdateStore}
 * snapshot, so:
 *
 *  - **One click resolves in one pass.** The click sets a visible "checking"
 *    state immediately, then the store awaits the service-worker cycle +
 *    version.json ({@link checkUpdateNow}) and lands on available / current /
 *    a friendly error — no more "click two or three times" (#1374).
 *  - **A waiting update is shown without a click.** If the passive detection
 *    already found one, this control shows the Update action on open.
 *  - **Applying clears both.** {@link applyUpdateNow} records the acceptance,
 *    clears the banner and this control, and drives skip-waiting + reload.
 *
 * Token-backed Tailwind (theme-correct across all themes); no hardcoded
 * colours. Works in both storage modes (the update mechanism is pure frontend).
 */

import { useEffect } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { useUpdateStore } from "../../hooks/system/useUpdateStore";
import { Button } from "@/components/ui/button";
import {
  applyUpdateNow,
  checkUpdateNow,
  ensureUpdateStoreInit,
} from "../../lib/pwa/updateStore";

/** Human-friendly "x ago" using the built-in Intl.RelativeTimeFormat. */
function relativeTime(ts: number, lang: string): string {
  const sec = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(sec);
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  if (abs < 60) return rtf.format(sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  return rtf.format(Math.round(hr / 24), "day");
}

/** Active update-check button + result + apply action (#664, shared store #1374). */
export default function UpdateCheckControl() {
  const { t, lang } = useI18n();
  const online = useOnlineStatus();
  const { phase, updateAvailable, latestVersion, lastCheckedAt } =
    useUpdateStore();

  // A waiting update found passively should show here without a click.
  useEffect(() => {
    ensureUpdateStoreInit(online);
  }, [online]);

  const busy = phase === "checking";
  // #1382 — "preparing": a newer build is deployed but its service worker is
  // not fetchable yet (edge-cache window). No apply CTA (it would be dead);
  // the check button stays so "check again shortly" is one click away.
  const preparing = phase === "preparing";
  const showAvailable = updateAvailable && !busy && !preparing;

  return (
    <div data-testid="update-check" className="mt-3 flex flex-col gap-2">
      {showAvailable ? (
        // Update found: a prominent call-to-action replaces the check button.
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="update-check-status"
            data-status="available"
            role="status"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-primary"
          >
            <Zap size={16} aria-hidden="true" className="text-accent" />
            {t(
              "about.update_available",
              "Version {version} is available!",
            ).replace("{version}", latestVersion ?? "")}
          </span>
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            data-testid="update-check-apply"
            onClick={() => applyUpdateNow()}
          >
            {t("about.update_now", "Update now")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 self-start"
          data-testid="update-check-button"
          onClick={() => void checkUpdateNow()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2
              size={16}
              aria-hidden="true"
              className="mr-2 animate-spin"
            />
          ) : (
            <RefreshCw size={16} aria-hidden="true" className="mr-2" />
          )}
          {busy
            ? t("about.checking", "Checking…")
            : t("about.check_update", "Check for updates")}
        </Button>
      )}

      {preparing && (
        <p
          data-testid="update-check-status"
          data-status="preparing"
          role="status"
          className="m-0 text-sm font-medium text-fg-primary"
        >
          {t(
            "about.update_preparing",
            "A new build is available and is being prepared. Check again in a moment.",
          )}
        </p>
      )}

      {!showAvailable && phase === "current" && (
        <p
          data-testid="update-check-status"
          data-status="current"
          role="status"
          className="m-0 text-sm font-medium text-success"
        >
          {t("about.up_to_date", "You're using the latest version.")}
        </p>
      )}

      {!showAvailable && phase === "error" && (
        <p
          data-testid="update-check-status"
          data-status="error"
          role="alert"
          className="m-0 text-sm font-medium text-[var(--error)]"
        >
          {t("about.check_failed", "Check failed. Are you online?")}
        </p>
      )}

      <p
        data-testid="update-check-last"
        className="m-0 text-xs text-fg-secondary"
      >
        {lastCheckedAt !== null
          ? t("about.last_checked", "Last checked: {when}").replace(
              "{when}",
              relativeTime(lastCheckedAt, lang),
            )
          : t("about.never_checked", "Never checked")}
      </p>
    </div>
  );
}
