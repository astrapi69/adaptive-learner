/**
 * App-specific status badges + toggles for the top Navigation bar
 * (extracted for the complexity burn-down #451). These encode
 * Adaptive-Learner concepts (app mode, the theme) and use the app
 * i18n, so they stay app-specific — unlike the generic
 * `shared/MenuToggleButton`.
 *
 * The cryptic nav status dots were removed in #852: sync pairing lives
 * in Settings > Data > Sync, and offline state is the `OfflineIndicator`
 * banner — neither belongs as a bare dot in the nav.
 */

import { Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../hooks/ui/useI18n";

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
