/**
 * NavXpBadge — the persistent XP/level indicator in the top
 * Navigation bar (#505).
 *
 * App-specific glue around the generic, presentational
 * `shared/XpBadge`: it resolves the active learner, reads the XP
 * state from whichever storage backing is active (ApiStorage or
 * DexieStorage — both expose `gamification.getState`), supplies the
 * translated labels, and keeps the badge live. It refreshes on mount,
 * on route change, when the tab regains focus, and whenever an
 * XP-affecting celebration fires (lesson complete, level up, a
 * completed mission, a badge / tier award) so a freshly-earned point
 * total shows without a reload.
 *
 * Renders nothing until a learner + a loaded XP state exist, so the
 * badge never flashes a placeholder on a fresh / anonymous install.
 * The whole badge links to the Dashboard, where the full XP widget,
 * streak, and badge gallery live.
 */

import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import XpBadge from "../shared/XpBadge";
import { useI18n } from "../hooks/useI18n";
import { readLearnerState } from "../lib/learnerState";
import { subscribeCelebration } from "../lib/praise/celebration-bus";
import { XP_SPENT_EVENT } from "../lib/gamification/xp-spent-event";
import { getStorage } from "../storage";
import type { CelebrationType } from "../lib/praise/celebration-bus";
import type { XPState } from "../storage/types";

/** Celebration events that can move the XP total — a refresh trigger. */
const XP_AFFECTING: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  "lesson_complete",
  "level_up",
  "mission_complete",
  "all_missions_complete",
  "badge_earned",
  "badge_tier_upgrade",
]);

/** Persistent header XP/level badge, linking to the Dashboard. */
export default function NavXpBadge() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [state, setState] = useState<XPState | null>(null);
  // #594 Hint Economy — briefly flash the badge red when XP is spent.
  const [spent, setSpent] = useState(false);

  useEffect(() => {
    const userId = readLearnerState().userId;
    if (!userId) {
      setState(null);
      return;
    }
    let cancelled = false;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      try {
        const next = await getStorage().gamification.getState(userId!);
        if (!cancelled) setState(next);
      } catch {
        // XP is supplementary chrome — never surface a read failure
        // to the user; keep the last-known value.
      }
    }
    void refresh();
    // Re-read when the tab regains focus (XP may have changed in
    // another tab) and whenever an XP-affecting celebration fires.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const onSpent = () => {
      void refresh();
      if (cancelled) return;
      setSpent(true);
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (!cancelled) setSpent(false);
      }, 700);
    };
    window.addEventListener(XP_SPENT_EVENT, onSpent);
    const unsubscribe = subscribeCelebration((event) => {
      if (XP_AFFECTING.has(event.type)) void refresh();
    });
    return () => {
      cancelled = true;
      if (flashTimer) clearTimeout(flashTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(XP_SPENT_EVENT, onSpent);
      unsubscribe();
    };
  }, [pathname]);

  if (!state) return null;

  const levelLabel = t("gamification.level", "Level");
  const xpLabel = t("gamification.xp", "XP");
  return (
    <NavLink
      to="/dashboard"
      className={`nav-xp-badge${spent ? " nav-xp-badge--spent" : ""}`}
      data-testid="nav-xp-badge"
      data-spent={spent ? "true" : undefined}
      title={t("gamification.xp_header_tooltip", "Your experience points")}
      aria-label={t(
        "gamification.xp_header_aria",
        "Level {level}, {xp} total XP",
      )
        .replace("{level}", String(state.level))
        .replace("{xp}", String(state.total_xp))}
    >
      <XpBadge
        xp={state.total_xp}
        level={state.level}
        icon={<Zap size={14} aria-hidden="true" />}
        xpLabel={xpLabel}
        levelLabel={levelLabel}
        iconClassName="nav-xp-badge__icon"
        levelClassName="nav-xp-badge__level"
        xpClassName="nav-xp-badge__total"
        xpTestId="nav-xp-badge-total"
        levelTestId="nav-xp-badge-level"
      />
    </NavLink>
  );
}
