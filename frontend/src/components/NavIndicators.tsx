/**
 * App-specific status badges + toggles for the top Navigation bar
 * (extracted for the complexity burn-down #451). These encode
 * Adaptive-Learner concepts (app mode, sync pairing, online state, the
 * theme) and use the app i18n, so they stay app-specific — unlike the
 * generic `shared/MenuToggleButton`.
 */

import { ArrowLeftRight, Circle, Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useI18n } from "../hooks/useI18n";
import OfflineBadge from "../shared/status/OfflineBadge";
import SyncStatusBadge from "../shared/status/SyncStatusBadge";

/** "AI+Content" vs "Content"-only mode badge (links to the content browser). */
export function NavModeBadge({ mode }: { mode: string }) {
  const { t } = useI18n();
  return (
    <NavLink
      to="/content"
      className={`nav-mode-badge nav-mode-badge-${mode}`}
      data-testid="nav-mode-badge"
      data-mode={mode}
      title={
        mode === "ai-augmented"
          ? t(
              "nav.mode_badge_tooltip_ai",
              "AI provider configured — exercises use AI for distractors + hints. Tap to browse content sets.",
            )
          : t(
              "nav.mode_badge_tooltip_content",
              "No API key configured — using pre-built content only. Add a key in Settings to enable AI features.",
            )
      }
      aria-label={
        mode === "ai-augmented"
          ? t("nav.mode_badge_label_ai", "Mode: AI + Content")
          : t("nav.mode_badge_label_content", "Mode: Content only")
      }
    >
      {mode === "ai-augmented"
        ? t("nav.mode_badge_ai", "AI+Content")
        : t("nav.mode_badge_content", "Content")}
    </NavLink>
  );
}

/** Sync paired / not-paired indicator (links to Settings > Sync), with
 *  an optional pending-changes count badge (SYNC-UI-GATE: the caller
 *  passes a non-zero count only in API mode where a sync queue exists). */
export function NavSyncIndicator({
  paired,
  pendingCount = 0,
}: {
  paired: boolean;
  pendingCount?: number;
}) {
  const { t } = useI18n();
  return (
    <NavLink
      to="/settings"
      className={`nav-sync-indicator${paired ? " is-paired" : " is-unpaired"}`}
      data-testid="nav-sync-indicator"
      data-sync-paired={paired ? "true" : "false"}
      style={{ position: "relative" }}
      title={
        pendingCount > 0
          ? t("nav.sync_pending", "{n} change(s) waiting to sync").replace(
              "{n}",
              String(pendingCount),
            )
          : paired
            ? t("nav.sync_paired", "Sync: paired (Settings > Sync)")
            : t("nav.sync_unpaired", "Sync: not paired (Settings > Sync)")
      }
      aria-label={
        paired
          ? t("nav.sync_paired", "Sync: paired")
          : t("nav.sync_unpaired", "Sync: not paired")
      }
    >
      {paired ? (
        <ArrowLeftRight size={16} aria-hidden="true" />
      ) : (
        <Circle size={16} aria-hidden="true" />
      )}
      <SyncStatusBadge
        pendingCount={pendingCount}
        className="nav-sync-pending"
        ariaLabel={t("nav.sync_pending", "{n} change(s) waiting to sync").replace(
          "{n}",
          String(pendingCount),
        )}
      />
    </NavLink>
  );
}

/** Online / offline live-status indicator (delegates to the reusable
 *  ``shared/OfflineBadge``, keeping the nav's themed classes). */
export function NavOnlineIndicator({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <OfflineBadge
      online={online}
      onlineLabel={t("nav.online", "Online")}
      offlineLabel={t("nav.offline", "Offline")}
      title={
        online
          ? t("nav.online", "Online")
          : t("nav.offline_long", "Offline — past sessions stay readable")
      }
      className={`nav-online-indicator${online ? " is-online" : " is-offline"}`}
      dotClassName="nav-online-dot"
      labelClassName="nav-online-label"
      testId="nav-online-indicator"
    />
  );
}

/** Light / dark theme toggle button. */
export function NavThemeToggle({
  theme,
  tooltipsOn,
  onToggle,
}: {
  theme: string;
  tooltipsOn: boolean;
  onToggle: () => void;
}) {
  const label = `Toggle ${theme === "dark" ? "light" : "dark"} theme`;
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      className="nav-theme-toggle"
      data-testid="nav-theme-toggle"
      onClick={onToggle}
      aria-label={label}
      title={tooltipsOn ? label : undefined}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </Button>
  );
}
