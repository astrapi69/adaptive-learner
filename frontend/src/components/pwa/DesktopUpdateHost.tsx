/**
 * DesktopUpdateHost — app-start silent update check + banner (#840).
 *
 * Mounted once at the app root. In API/desktop mode ONLY (the Dexie/PWA
 * path keeps its service-worker banner via {@link UpdatePromptHost}), it:
 *   1. on mount, when online + auto-check is on + the interval elapsed,
 *      silently queries the GitHub Releases API and records the check time;
 *   2. if a newer (non-dismissed) release exists, shows a discreet
 *      bottom-anchored banner with "What's new?" (release notes modal),
 *      "Release page", and "Later" (which remembers the dismissed version
 *      so the same release never nags again — a newer one will).
 *
 * Renders nothing in Dexie mode and when no actionable update is found.
 * Token-backed Tailwind across all themes.
 */

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { useI18n } from "../../hooks/ui/useI18n";
import { useOnlineStatus } from "../../hooks/system/useOnlineStatus";
import { resolveStorageMode } from "../../storage";
import { CURRENT_BUILD } from "../../lib/pwa/update-store";
import {
  checkForUpdate,
  shouldNotifyForUpdate,
  type UpdateCheckResult,
} from "../../lib/utils/updateChecker";
import { isCheckDue, readUpdatePrefs, writeUpdatePrefs } from "../../lib/utils/updatePrefs";
import ReleaseNotes, { RELEASE_NOTES_LIMIT } from "../about/ReleaseNotes";

export default function DesktopUpdateHost() {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    if (resolveStorageMode() !== "api") return;
    if (!online) return;
    const prefs = readUpdatePrefs();
    if (!isCheckDue(prefs)) return;
    checkedRef.current = true;
    let cancelled = false;
    void (async () => {
      const outcome = await checkForUpdate(CURRENT_BUILD.version);
      writeUpdatePrefs({ last_check_at: new Date().toISOString() });
      if (cancelled) return;
      if (shouldNotifyForUpdate(outcome, readUpdatePrefs().dismissed_version)) {
        setResult(outcome);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  if (!result || dismissed) return null;

  const version = `v${result.latestVersion ?? ""}`;

  function dismiss() {
    if (result?.latestVersion) {
      writeUpdatePrefs({ dismissed_version: result.latestVersion });
    }
    setModalOpen(false);
    setDismissed(true);
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        data-testid="desktop-update-banner"
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-fg-primary shadow-md"
      >
        <div className="flex min-w-0 items-center gap-2">
          <RefreshCw size={16} aria-hidden="true" className="shrink-0 text-fg-secondary" />
          <span className="truncate text-fg-primary">
            {t("update.banner.message", "New version {version} available").replace(
              "{version}",
              version,
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {result.releaseNotes && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              data-testid="desktop-update-banner-whatsnew"
              className="inline-flex min-h-[44px] items-center rounded-app px-3 font-medium text-accent hover:bg-bg-elevated"
            >
              {t("update.banner.whats_new", "What's new?")}
            </button>
          )}
          {result.releaseUrl && (
            <a
              href={result.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="desktop-update-banner-release"
              className="inline-flex min-h-[44px] items-center rounded-app bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              {t("update.banner.release_page", "Release page")}
            </a>
          )}
          <button
            type="button"
            onClick={dismiss}
            data-testid="desktop-update-banner-later"
            className="inline-flex min-h-[44px] items-center rounded-app px-3 text-fg-secondary hover:bg-bg-elevated"
          >
            {t("update.banner.later", "Later")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("update.banner.later", "Later")}
            data-testid="desktop-update-banner-close"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-app text-fg-secondary hover:bg-bg-elevated"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {modalOpen && result.releaseNotes && (
        <div className="modal-overlay" data-testid="desktop-update-modal">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-update-modal-title"
          >
            <h2 id="desktop-update-modal-title" className="modal-title">
              {t("update.banner.whats_new_title", "What's new in {version}").replace(
                "{version}",
                version,
              )}
            </h2>
            <ReleaseNotes
              notes={result.releaseNotes}
              releaseUrl={result.releaseUrl}
              t={t}
              limit={RELEASE_NOTES_LIMIT * 8}
            />
            <div className="form-actions">
              {result.releaseUrl && (
                <a
                  href={result.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="desktop-update-modal-release"
                  className="inline-flex min-h-[44px] items-center rounded-app bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover"
                >
                  {t("update.banner.release_page", "Release page")}
                </a>
              )}
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                data-testid="desktop-update-modal-close"
                className="inline-flex min-h-[44px] items-center rounded-app border border-border px-4 text-fg-primary hover:bg-bg-elevated"
              >
                {t("common.close", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
