/**
 * UpdatesSettingsSection — desktop/API-mode update preferences (#840).
 *
 * Rendered in Settings → General ONLY in API mode (the Dexie/PWA path uses
 * the service worker and never shows this). Lets the user toggle the silent
 * app-start update check and pick how often it runs; shows the last check
 * time and the running version. Persists to localStorage via updatePrefs.
 *
 * Token-backed Tailwind across all themes.
 */

import { useState } from "react";

import { useI18n } from "../../hooks/ui/useI18n";
import { CURRENT_BUILD } from "../../lib/pwa/sw-update";
import {
  readUpdatePrefs,
  writeUpdatePrefs,
  type UpdateInterval,
} from "../../lib/utils/updatePrefs";

const INTERVAL_OPTIONS: UpdateInterval[] = ["daily", "weekly", "monthly", "never"];

/** Human "x ago" via the built-in Intl.RelativeTimeFormat. */
function relativeTime(iso: string, lang: string): string | null {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const sec = Math.round((ts - Date.now()) / 1000);
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  return rtf.format(Math.round(hr / 24), "day");
}

function intervalLabel(interval: UpdateInterval, t: (k: string, f?: string) => string): string {
  switch (interval) {
    case "daily":
      return t("settings.updates.interval_daily", "Daily");
    case "weekly":
      return t("settings.updates.interval_weekly", "Weekly");
    case "monthly":
      return t("settings.updates.interval_monthly", "Monthly");
    case "never":
      return t("settings.updates.interval_never", "Never");
  }
}

/** Update-check preferences panel (API mode only). */
export default function UpdatesSettingsSection() {
  const { t, lang } = useI18n();
  const [prefs, setPrefs] = useState(readUpdatePrefs);

  const lastChecked = prefs.last_check_at ? relativeTime(prefs.last_check_at, lang) : null;

  return (
    <section className="settings-section" data-testid="settings-section-updates">
      <h2 className="settings-section-title">{t("settings.updates.title", "Updates")}</h2>

      <label className="flex items-center justify-between gap-3 py-2">
        <span className="text-fg-primary">
          {t("settings.updates.auto_check", "Automatic update check")}
        </span>
        <input
          type="checkbox"
          data-testid="update-auto-check-toggle"
          checked={prefs.auto_check}
          onChange={(e) => setPrefs(writeUpdatePrefs({ auto_check: e.target.checked }))}
        />
      </label>

      <label className="flex flex-col gap-1 py-2">
        <span className="text-fg-primary">
          {t("settings.updates.interval", "Check interval")}
        </span>
        <select
          data-testid="update-interval-select"
          value={prefs.check_interval}
          disabled={!prefs.auto_check}
          onChange={(e) =>
            setPrefs(writeUpdatePrefs({ check_interval: e.target.value as UpdateInterval }))
          }
          className="rounded-app border border-border bg-bg-surface px-2 py-1 text-fg-primary disabled:opacity-50"
        >
          {INTERVAL_OPTIONS.map((interval) => (
            <option key={interval} value={interval}>
              {intervalLabel(interval, t)}
            </option>
          ))}
        </select>
      </label>

      <p className="m-0 text-sm text-fg-secondary" data-testid="update-last-check">
        {lastChecked
          ? t("settings.updates.last_check", "Last check: {when}").replace("{when}", lastChecked)
          : t("settings.updates.never_checked", "Never checked")}
      </p>
      <p className="m-0 text-sm text-fg-secondary" data-testid="update-current-version">
        {t("settings.updates.current_version", "Current version: v{version}").replace(
          "{version}",
          CURRENT_BUILD.version,
        )}
      </p>
    </section>
  );
}
