/**
 * Diagnostics & Support tab of the Settings page (#2789).
 *
 * Unites what used to be scattered across two unrelated tabs, because all
 * three pieces serve the same job: helping the developer see what happened on
 * a user's device.
 *
 *   - "Create error report" (EXP-028) — moved here from Settings > About >
 *     Support.
 *   - The tap/viewport probe + its persistent protocol (#2782/#2785/#2801) —
 *     moved here from Settings > General.
 *   - Developer Mode (DEV-MODE-FRIENDLY-ERRORS-01) — moved here from
 *     Settings > General > Interface, the same debugging concern as the DEV
 *     badge it controls.
 *
 * Extracted verbatim (state + handlers unchanged) from `GeneralPanel` /
 * `SupportSection`; the panel stays mounted (`hidden` when inactive) so deep
 * links and `data-testid` assertions keep working.
 *
 * @example
 * <DiagnosticsPanel active={activeTab === "diagnostics"} />
 */

import { LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { setDevModeEnabled, useDevMode } from "../../../../hooks/settings/useDevMode";
import {
  setViewportDiagnosticEnabled,
  setVvFabEnabled,
  setVvFabPosition,
  setVvPanelVisible,
  useViewportDiagnostic,
  useVvFab,
  useVvPanelVisible,
  VV_FAB_POSITIONS,
} from "../../../../hooks/settings/useViewportDiagnostic";
import type { VvFabPosition } from "../../../../hooks/settings/useViewportDiagnostic";
import { clearVvLog, vvLogAsText, vvLogCount } from "../../../../lib/diagnostics/vv-log";
import FormHint from "../../../../shared/forms/FormHint";
import { SettingsSection } from "../../../../components/settings/SettingsSection";

interface DiagnosticsPanelProps {
  /** Whether the Diagnostics tab is the active tab (drives ``hidden``). */
  active: boolean;
}

const FAB_POSITION_FALLBACKS: Record<VvFabPosition, string> = {
  "bottom-right": "Bottom right",
  "bottom-left": "Bottom left",
  "top-right": "Top right",
  "top-left": "Top left",
};

export default function DiagnosticsPanel({ active }: DiagnosticsPanelProps) {
  const { t } = useI18n();

  const openReport = () => {
    window.dispatchEvent(
      new CustomEvent("adaptive-learner:open-error-report", {
        detail: {
          message: t(
            "settings.support.report_default_message",
            "User-initiated report",
          ),
          proactive: true,
        },
      }),
    );
  };

  // DEV-MODE-FRIENDLY-ERRORS-01 — Developer Mode toggle.
  // When ON, error toasts show full technical detail and the
  // Navigation bar carries a DEV badge. Off by default —
  // production users only see friendly status-code-mapped
  // messages.
  const devModeOn = useDevMode();
  const handleDevModeToggle = (next: boolean) => {
    setDevModeEnabled(next);
  };

  // Diagnostics probe (#2782): toggle shares the ?vvdiag flag; the
  // persistent protocol is exportable/clearable right here so a mis-tap
  // noticed later is still recoverable.
  const vvDiagOn = useViewportDiagnostic();
  const vvPanelOn = useVvPanelVisible();
  const { enabled: vvFabOn, position: vvFabPos } = useVvFab();
  const [vvLogEntries, setVvLogEntries] = useState(() => vvLogCount());
  const [vvLogCopied, setVvLogCopied] = useState(false);
  useEffect(() => {
    setVvLogEntries(vvLogCount());
  }, [vvDiagOn]);
  const handleVvLogCopy = () => {
    setVvLogEntries(vvLogCount());
    const done = () => {
      setVvLogCopied(true);
      window.setTimeout(() => setVvLogCopied(false), 1500);
    };
    try {
      void navigator.clipboard?.writeText(vvLogAsText()).then(done, done);
    } catch {
      done();
    }
  };
  const handleVvLogClear = () => {
    clearVvLog();
    setVvLogEntries(0);
  };

  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-diagnostics"
    >
      <SettingsSection
        testid="settings-support-section"
        title={t("settings.support.heading", "Support")}
      >
        <p className="mt-0 mx-0 mb-3 text-[0.875rem] text-[var(--fg-muted)]">
          {t(
            "settings.support.description",
            "Something not working as expected? Create a report of your recent actions to help the developer reproduce it. You review everything before it leaves your browser.",
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={openReport}
          data-testid="settings-create-error-report"
          className="gap-1.5"
        >
          <LifeBuoy size={16} />
          {t("settings.support.create_report", "Create error report")}
        </Button>
      </SettingsSection>

      <SettingsSection
        testid="settings-diagnostics"
        title={t("settings.section_diagnostics", "Diagnostics")}
      >
        <label className="flex items-center justify-between gap-2">
          <span className="flex flex-col gap-0.5">
            <span className="text-[0.95rem] font-medium">
              {t("settings.developer_mode", "Developer Mode")}
            </span>
            <FormHint as="span">
              {t(
                "settings.developer_mode_description",
                "Show full technical detail (status code, endpoint, stack trace) in error toasts. A 'DEV' badge appears in the navigation bar while this is on. Off by default; opt-in for debugging.",
              )}
            </FormHint>
          </span>
          <input
            type="checkbox"
            className="m-0 size-4 flex-none p-0"
            data-testid="settings-developer-mode-toggle"
            checked={devModeOn}
            onChange={(e) => handleDevModeToggle(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="flex flex-col gap-0.5">
            <span className="text-[0.95rem] font-medium">
              {t("settings.vvdiag_toggle", "Tap & viewport probe")}
            </span>
            <FormHint as="span">
              {t(
                "settings.vvdiag_description",
                "Shows a measurement bar and keeps a persistent protocol of tap positions and viewport changes while the probe is on. Helps pin down hard-to-reproduce display bugs (e.g. taps landing below their target) after the fact. Can also be enabled via the ?vvdiag=1 URL parameter.",
              )}
            </FormHint>
          </span>
          <input
            type="checkbox"
            className="m-0 size-4 flex-none p-0"
            data-testid="settings-vvdiag-toggle"
            checked={vvDiagOn}
            onChange={(e) => setViewportDiagnosticEnabled(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="flex flex-col gap-0.5">
            <span className="text-[0.95rem] font-medium">
              {t("settings.vvdiag_panel_toggle", "Show measurement bar")}
            </span>
            <FormHint as="span">
              {t(
                "settings.vvdiag_panel_description",
                "Off: the probe keeps recording invisibly without showing the bar at the top - the header and menu stay fully reachable.",
              )}
            </FormHint>
          </span>
          <input
            type="checkbox"
            className="m-0 size-4 flex-none p-0"
            data-testid="settings-vvdiag-panel-toggle"
            checked={vvPanelOn}
            onChange={(e) => setVvPanelVisible(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="flex flex-col gap-0.5">
            <span className="text-[0.95rem] font-medium">
              {t("settings.vvdiag_fab_toggle", "Sticky button for the measurement bar")}
            </span>
            <FormHint as="span">
              {t(
                "settings.vvdiag_fab_description",
                "Shows a floating button that toggles the measurement bar with one tap - handy for quickly switching the bar on and off while testing. Visible only while the probe is on.",
              )}
            </FormHint>
          </span>
          <input
            type="checkbox"
            className="m-0 size-4 flex-none p-0"
            data-testid="settings-vvdiag-fab-toggle"
            checked={vvFabOn}
            onChange={(e) => setVvFabEnabled(e.target.checked)}
          />
        </label>
        {vvFabOn && (
          <div className="flex flex-col gap-1">
            <span className="text-[0.95rem] font-medium">
              {t("settings.vvdiag_fab_position", "Button position")}
            </span>
            <div className="mt-1 flex flex-wrap gap-4">
              {VV_FAB_POSITIONS.map((pos) => (
                <label key={pos} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vvdiag-fab-position"
                    className="m-0 size-4 flex-none p-0"
                    data-testid={`settings-vvdiag-fab-pos-${pos}`}
                    checked={vvFabPos === pos}
                    onChange={() => setVvFabPosition(pos)}
                  />
                  {t(
                    `settings.vvdiag_fab_pos_${pos.replace("-", "_")}`,
                    FAB_POSITION_FALLBACKS[pos],
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="settings-vvdiag-copy-log"
            onClick={handleVvLogCopy}
          >
            {vvLogCopied
              ? t("settings.vvdiag_copied", "Copied!")
              : t("settings.vvdiag_copy_log", "Copy protocol")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="settings-vvdiag-clear-log"
            onClick={handleVvLogClear}
          >
            {t("settings.vvdiag_clear_log", "Clear protocol")}
          </Button>
          <span className="muted" data-testid="settings-vvdiag-log-count">
            {t("settings.vvdiag_log_count", "{count} recorded events").replace(
              "{count}",
              String(vvLogEntries),
            )}
          </span>
        </div>
      </SettingsSection>
    </div>
  );
}
