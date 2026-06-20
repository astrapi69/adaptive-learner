/**
 * DesktopUpdateCheckControl — the API/desktop-mode "Check for updates"
 * control for Settings → About (#840).
 *
 * The PWA/Dexie path keeps its existing service-worker control
 * ({@link ./UpdateCheckControl}); this is its API-mode counterpart. It
 * queries the GitHub Releases API, shows the result inline, and — when a
 * newer release exists — surfaces the release notes plus an "Open release
 * page" link (desktop apps update by downloading, not by SW reload).
 *
 * Records ``last_check_at`` on every check so the Settings → Updates panel
 * can show it. Token-backed Tailwind across all themes.
 */

import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../hooks/ui/useI18n";
import { CURRENT_BUILD } from "../../lib/pwa/sw-update";
import { checkForUpdate, type UpdateCheckResult } from "../../lib/utils/updateChecker";
import { writeUpdatePrefs } from "../../lib/utils/updatePrefs";
import ReleaseNotes from "./ReleaseNotes";

type ViewState = "idle" | "checking" | UpdateCheckResult["status"];

/** API-mode update check button + GitHub result (#840). */
export default function DesktopUpdateCheckControl() {
  const { t } = useI18n();
  const [state, setState] = useState<ViewState>("idle");
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  const busy = state === "checking";

  async function handleCheck() {
    setState("checking");
    const outcome = await checkForUpdate(CURRENT_BUILD.version);
    setResult(outcome);
    setState(outcome.status);
    writeUpdatePrefs({ last_check_at: new Date().toISOString() });
  }

  return (
    <div data-testid="desktop-update-check" className="mt-3 flex flex-col gap-2">
      {state === "update-available" && result ? (
        <div className="flex flex-col gap-2">
          <span
            data-testid="desktop-update-status"
            data-status="update-available"
            role="status"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-primary"
          >
            <Zap size={16} aria-hidden="true" className="text-accent" />
            {t("about.update_available", "Version {version} is available!").replace(
              "{version}",
              `v${result.latestVersion ?? ""}`,
            )}
          </span>
          {result.releaseNotes && (
            <ReleaseNotes notes={result.releaseNotes} releaseUrl={result.releaseUrl} t={t} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {result.releaseUrl && (
              <Button asChild size="sm" className="min-h-11" data-testid="desktop-update-open">
                <a href={result.releaseUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} aria-hidden="true" className="mr-2" />
                  {t("about.update.open_release", "Open release page")}
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              data-testid="desktop-update-dismiss"
              onClick={() => {
                if (result.latestVersion) {
                  writeUpdatePrefs({ dismissed_version: result.latestVersion });
                }
                setState("idle");
                setResult(null);
              }}
            >
              {t("about.update.later", "Later")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 self-start"
          data-testid="desktop-update-button"
          onClick={() => void handleCheck()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 size={16} aria-hidden="true" className="mr-2 animate-spin" />
          ) : (
            <RefreshCw size={16} aria-hidden="true" className="mr-2" />
          )}
          {busy ? t("about.checking", "Checking…") : t("about.check_update", "Check for updates")}
        </Button>
      )}

      {state === "up-to-date" && (
        <p
          data-testid="desktop-update-status"
          data-status="up-to-date"
          role="status"
          className="m-0 text-sm font-medium text-success"
        >
          {t("about.up_to_date_version", "You have the latest version. (v{version})").replace(
            "{version}",
            result?.currentVersion ?? CURRENT_BUILD.version,
          )}
        </p>
      )}

      {state === "error" && (
        <p
          data-testid="desktop-update-status"
          data-status="error"
          role="alert"
          className="m-0 text-sm font-medium text-[var(--error)]"
        >
          {t("about.check_failed", "Check failed. Are you online?")}
        </p>
      )}
    </div>
  );
}
