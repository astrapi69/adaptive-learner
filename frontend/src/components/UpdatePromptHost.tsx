/**
 * UpdatePromptHost — app glue between {@link useAppUpdate} and the
 * presentational {@link UpdatePrompt} (#613).
 *
 * Mounted once at the app root. Renders nothing until a newer build is
 * detected; then shows the discreet update banner with translated copy.
 * Storage-mode-agnostic (the update mechanism is pure frontend), so it
 * works identically in API and Dexie / GitHub-Pages builds.
 */

import UpdatePrompt from "../shared/feedback/UpdatePrompt";
import { useAppUpdate } from "../hooks/useAppUpdate";
import { useI18n } from "../hooks/useI18n";

export default function UpdatePromptHost() {
  const { t } = useI18n();
  const { updateAvailable, applyUpdate, dismiss } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <UpdatePrompt
      message={t("pwa.update.message", "A new version is available.")}
      updateLabel={t("pwa.update.action", "Update")}
      dismissLabel={t("pwa.update.later", "Later")}
      onUpdate={applyUpdate}
      onDismiss={dismiss}
    />
  );
}
