/**
 * UpdateCheckControl — an active "check for updates" control for the
 * Settings → About version card (#664).
 *
 * The PWA update banner ({@link useAppUpdate}) is PASSIVE: it only appears
 * when a service worker happens to detect a new build, and a bottom-anchored
 * banner can be missed. This control is the reliable, user-initiated path,
 * visible on every device/browser: it forces a ``version.json`` check and,
 * when a newer build is found, applies it with the SAME skip-waiting + reload
 * logic the banner uses ({@link activateAndReload}). It is the user's escape
 * hatch from a stale service-worker cache.
 *
 * States: idle → checking (spinner) → one of available / current / error.
 * "Available" swaps in a prominent Update button; the last-check time is
 * shown (persisted in ``sessionStorage``) so a repeat visit has context.
 *
 * Token-backed Tailwind (theme-correct across all themes); no hardcoded
 * colours. Works in both storage modes (the update mechanism is pure
 * frontend).
 */

import { useState } from "react";
import { Loader2, RefreshCw, Zap } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import { Button } from "@/components/ui/button";
import {
  activateAndReload,
  checkForUpdate,
  type UpdateCheckStatus,
} from "../../lib/pwa/sw-update";

const LAST_CHECKED_KEY = "adaptive-learner.update.lastCheckedAt";

type ViewState = "idle" | "checking" | UpdateCheckStatus;

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

/** Active update-check button + result + apply action (#664). */
export default function UpdateCheckControl() {
  const { t, lang } = useI18n();
  const [state, setState] = useState<ViewState>("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(() =>
    readLastChecked(),
  );

  const busy = state === "checking";

  async function handleCheck() {
    setState("checking");
    const outcome = await checkForUpdate();
    setLatestVersion(outcome.latestVersion);
    setState(outcome.status);
    const now = Date.now();
    setLastCheckedAt(now);
    writeLastChecked(now);
  }

  return (
    <div data-testid="update-check" className="mt-3 flex flex-col gap-2">
      {state === "available" ? (
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
            onClick={() => void activateAndReload()}
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
          onClick={() => void handleCheck()}
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

      {state === "current" && (
        <p
          data-testid="update-check-status"
          data-status="current"
          role="status"
          className="m-0 text-sm font-medium text-success"
        >
          {t("about.up_to_date", "You're using the latest version.")}
        </p>
      )}

      {state === "error" && (
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
