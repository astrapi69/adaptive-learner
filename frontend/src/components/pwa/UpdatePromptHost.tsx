/**
 * UpdatePromptHost — app glue between {@link useAppUpdate} and the
 * presentational {@link UpdatePrompt} (#613).
 *
 * Mounted once at the app root. Renders nothing until a newer build is
 * detected; then shows the discreet update banner with translated copy.
 * This is the Dexie/PWA (service-worker) path; API/desktop mode has no
 * service worker and uses {@link DesktopUpdateHost} (GitHub Releases)
 * instead (#840), so this host stays out of the way in API mode.
 */

import UpdatePrompt from "../../shared/feedback/UpdatePrompt";
import { useAppUpdate } from "../../hooks/system/useAppUpdate";
import { useI18n } from "../../hooks/ui/useI18n";
import { isStandalone } from "../../lib/pwa/install";
import { isIosStandalone } from "../../lib/pwa/ios-install";
import { resolveStorageMode } from "../../storage";

/** Whether this tab is an installed iOS PWA (standalone display-mode). */
function detectIosStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosStandalone(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints ?? 0,
    isStandalone(),
  );
}

export default function UpdatePromptHost() {
  const { t } = useI18n();
  const { updateAvailable, applyUpdate, dismiss } = useAppUpdate();

  // #840 — SW banner is Dexie/PWA only; API/desktop uses DesktopUpdateHost.
  if (resolveStorageMode() === "api") return null;
  if (!updateAvailable) return null;

  // #1357 — on an installed iOS PWA, skip-waiting + reload often does not
  // activate the new worker; offer the clear-text "close and reopen" step so a
  // no-op reload never leaves the user stranded on the stale build.
  const iosHint = detectIosStandalone()
    ? t(
        "pwa.update.ios_restart_hint",
        "If nothing changes, close the app and reopen it.",
      )
    : undefined;

  return (
    <UpdatePrompt
      message={t("pwa.update.message", "A new version is available.")}
      updateLabel={t("pwa.update.action", "Update")}
      dismissLabel={t("pwa.update.later", "Later")}
      onUpdate={applyUpdate}
      onDismiss={dismiss}
      hint={iosHint}
    />
  );
}
