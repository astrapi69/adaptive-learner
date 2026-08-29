/**
 * VvPanelToggleFab (#2799) — a sticky (floating) toggle for the
 * viewport-diagnostics measurement bar.
 *
 * Strictly opt-in twice over: renders only while the tap & viewport
 * probe itself is on (#2782) AND the fab pref from Settings > General >
 * Diagnostics is enabled — normal users never see it. Pressing it does
 * exactly what the "Show measurement bar" toggle does (#2785): both
 * write the single ``adaptive-learner.vv_diag_panel`` flag through
 * {@link setVvPanelVisible}, so the button and the Settings checkbox
 * always agree; pressing again hides the bar.
 *
 * The corner is configurable (four positions, default bottom-left).
 * With the opt-in bottom tab bar active (#2790) the bottom corners
 * float above the bar's height on mobile so the tabs stay tappable.
 *
 * Probe hygiene: ``ViewportDiagnostic`` ignores pointerdowns on this
 * button (by its testid), so toggling never pollutes the tap protocol.
 */

import {Ruler} from "lucide-react";

import {cn} from "@/lib/utils";
import {useI18n} from "../../hooks/ui/useI18n";
import {useNavPosition} from "../../hooks/settings/useNavPosition";
import {
  setVvPanelVisible,
  useViewportDiagnostic,
  useVvFab,
  useVvPanelVisible,
  type VvFabPosition,
} from "../../hooks/settings/useViewportDiagnostic";

/** Corner classes; bottom corners clear the opt-in bottom tab bar. */
function positionClass(
  position: VvFabPosition,
  bottomNavActive: boolean,
): string {
  const bottomOffset = bottomNavActive ? "bottom-20 md:bottom-4" : "bottom-4";
  switch (position) {
    case "bottom-left":
      return cn("left-4", bottomOffset);
    case "bottom-right":
      return cn("right-4", bottomOffset);
    case "top-left":
      return "left-4 top-4";
    case "top-right":
      return "right-4 top-4";
  }
}

export default function VvPanelToggleFab() {
  const {t} = useI18n();
  const probeOn = useViewportDiagnostic();
  const {enabled, position} = useVvFab();
  const panelVisible = useVvPanelVisible();
  const navPosition = useNavPosition();

  if (!probeOn || !enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setVvPanelVisible(!panelVisible)}
      aria-pressed={panelVisible}
      aria-label={t(
        "settings.vvdiag_fab_aria",
        "Show or hide the measurement bar",
      )}
      title={t("settings.vvdiag_fab_aria", "Show or hide the measurement bar")}
      data-testid="vv-panel-fab"
      data-position={position}
      className={cn(
        // Above the z-[9999] bar so the button stays clickable in the
        // top corners even while the bar overlays them.
        "fixed z-[10000] flex min-h-11 min-w-11 items-center justify-center rounded-full border shadow-[var(--shadow-elevated)]",
        panelVisible
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-[var(--bg-elevated)] text-fg-primary",
        positionClass(position, navPosition === "bottom"),
      )}
    >
      <Ruler size={20} aria-hidden="true" />
    </button>
  );
}
