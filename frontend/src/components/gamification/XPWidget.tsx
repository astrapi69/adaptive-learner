/**
 * Dashboard XP widget (Phase 29A / v1.16.0).
 *
 * Reads the user's XP/level state from the active storage backing
 * and renders a level badge + progress bar + "XP to next level".
 *
 * The component is OPTIONAL — Settings > Gamification can disable
 * the broader system. When disabled, the Dashboard simply does
 * not render this widget. The component itself stays loosely
 * coupled: it takes ``state`` as a prop so tests + the Dashboard
 * fetch logic can short-circuit cleanly.
 */

import { Progress } from "@/components/ui/progress";
import { useI18n } from "../../hooks/ui/useI18n";
import ProgressRing from "../../shared/data-display/ProgressRing";
import type { XPState } from "../../storage/types";

interface XPWidgetProps {
  state: XPState | null;
}

export default function XPWidget({ state }: XPWidgetProps) {
  const { t } = useI18n();
  if (!state || state.total_xp === 0) {
    return (
      <div className="xp-widget xp-widget--empty" data-testid="xp-widget-empty">
        <p className="muted">{t("gamification.xp_no_data", "Complete a session to earn XP.")}</p>
      </div>
    );
  }
  const denom = state.xp_into_level + state.xp_to_next_level;
  const pct = denom > 0 ? Math.min(100, Math.round((state.xp_into_level / denom) * 100)) : 100;
  return (
    <div className="xp-widget" data-testid="xp-widget">
      <div
        className="xp-widget__header"
        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
      >
        <ProgressRing
          value={state.xp_into_level}
          max={denom}
          size={56}
          ariaLabel={`${t("gamification.level", "Level")} ${state.level} — ${pct}%`}
          testId="xp-widget-ring"
        >
          {state.level}
        </ProgressRing>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="xp-widget__level" data-testid="xp-widget-level">
            {t("gamification.level", "Level")} {state.level}
          </span>
          <span className="xp-widget__total" data-testid="xp-widget-total">
            {state.total_xp} {t("gamification.xp", "XP")}
          </span>
        </div>
      </div>
      <Progress
        value={pct}
        aria-label={`${t("gamification.level", "Level")} ${state.level} — ${pct}%`}
        className="my-1 h-2"
        data-testid="xp-widget-bar"
      />
      <div className="xp-widget__footer">
        <span data-testid="xp-widget-to-next">
          {state.xp_to_next_level > 0
            ? t(
                "gamification.xp_to_next_level",
                `${state.xp_to_next_level} XP to next level`,
              ).replace("{n}", String(state.xp_to_next_level))
            : t("gamification.max_level", "Max level reached")}
        </span>
      </div>
    </div>
  );
}
