/**
 * NavXpBadge — the persistent XP/level indicator in the top
 * Navigation bar (#505), now two-line with a level-detail popover
 * (#730).
 *
 * App-specific glue around the generic, presentational
 * `shared/XpBadge` + `shared/LevelDetail`: it resolves the active
 * learner, reads the XP state from whichever storage backing is active
 * (ApiStorage or DexieStorage — both expose `gamification.getState`),
 * supplies the translated labels, and keeps the badge live. It refreshes
 * on mount, on route change, when the tab regains focus, and whenever an
 * XP-affecting celebration fires (lesson complete, level up, a completed
 * mission, a badge / tier award) so a freshly-earned point total shows
 * without a reload.
 *
 * Clicking the badge opens a small popover with the level-progress
 * detail (progress bar + "{n} XP to next level") and a link to the
 * Dashboard. Renders nothing until a learner + a loaded XP state exist,
 * so the badge never flashes a placeholder on a fresh / anonymous
 * install.
 */

import { Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import LevelProgressCard from "../../shared/gamification/LevelProgressCard";
import XpBadge from "../../shared/gamification/XpBadge";
import { useI18n } from "../../hooks/ui/useI18n";
import { readLearnerState } from "../../lib/learning/learnerState";
import { buildLevelMilestones } from "../../lib/gamification/levelMilestones";
import { subscribeCelebration } from "../../lib/praise/celebration-bus";
import { XP_SPENT_EVENT } from "../../lib/gamification/xp-spent-event";
import { getStorage } from "../../storage";
import type { CelebrationType } from "../../lib/praise/celebration-bus";
import type { HeatmapEntryOut, XPState } from "../../storage/types";

/** Celebration events that can move the XP total — a refresh trigger. */
const XP_AFFECTING: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  "lesson_complete",
  "level_up",
  "mission_complete",
  "all_missions_complete",
  "badge_earned",
  "badge_tier_upgrade",
]);

/** Persistent header XP/level badge with a level-detail popover. */
export default function NavXpBadge() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [state, setState] = useState<XPState | null>(null);
  // #594 Hint Economy — briefly flash the badge red when XP is spent.
  const [spent, setSpent] = useState(false);
  // #730 — level-detail popover open state.
  const [open, setOpen] = useState(false);
  // #727 — last 7 days of activity, loaded when the popover opens.
  const [history, setHistory] = useState<HeatmapEntryOut[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  // Close the popover on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Dismiss the popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // #727 — fetch the last 7 days of activity when the popover opens.
  useEffect(() => {
    if (!open) return;
    const userId = readLearnerState().userId;
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const days = await getStorage().gamification.getStreakHeatmap(userId, 7);
        if (!cancelled) setHistory(days.slice(-7));
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!state) return null;

  const levelLabel = t("gamification.level", "Level");
  const xpLabel = t("gamification.xp", "XP");
  const toNextLabel =
    state.xp_to_next_level > 0
      ? t("gamification.xp_to_next_level", "{n} XP to next level").replace(
          "{n}",
          String(state.xp_to_next_level),
        )
      : t("gamification.max_level", "Max level reached");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className={`nav-xp-badge${spent ? " nav-xp-badge--spent" : ""}`}
        data-testid="nav-xp-badge"
        data-spent={spent ? "true" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("gamification.xp_header_tooltip", "Your experience points")}
        aria-label={t(
          "gamification.xp_header_aria",
          "Level {level}, {xp} total XP",
        )
          .replace("{level}", String(state.level))
          .replace("{xp}", String(state.total_xp))}
        onClick={() => setOpen((o) => !o)}
      >
        <XpBadge
          xp={state.total_xp}
          level={state.level}
          icon={<Zap size={14} aria-hidden="true" />}
          xpLabel={xpLabel}
          levelLabel={levelLabel}
          // #756 — the LAYOUT grid lives HERE (the XpBadge root span, the
          // direct parent of icon/level/total) so the row placement
          // actually applies. The icon spans both rows on the left; "Level
          // N" is row 1, the XP total row 2 → two lines. Tailwind only.
          className="grid grid-cols-[auto_auto] items-center gap-x-1.5 text-left leading-tight"
          iconClassName="col-start-1 row-start-1 row-span-2 inline-flex items-center text-[var(--star)]"
          levelClassName="col-start-2 row-start-1 opacity-[0.85]"
          xpClassName="col-start-2 row-start-2 font-bold"
          testId="nav-xp-badge-content"
          xpTestId="nav-xp-badge-total"
          levelTestId="nav-xp-badge-level"
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("gamification.level_detail_title", "Level progress")}
          className="absolute right-0 z-50 mt-2 max-h-[80vh] w-64 overflow-y-auto rounded-app border border-border bg-card p-3 shadow-elevated"
          data-testid="nav-xp-badge-popover"
        >
          <LevelProgressCard
            level={state.level}
            xpIntoLevel={state.xp_into_level}
            xpToNext={state.xp_to_next_level}
            levelLabel={levelLabel}
            toNextLabel={toNextLabel}
            progressAriaLabel={t(
              "gamification.level_detail_title",
              "Level progress",
            )}
            history={history}
            milestones={buildLevelMilestones(state.level, state.total_xp)}
            labels={{
              activityTitle: t(
                "gamification.level_detail.activity",
                "Activity (last 7 days)",
              ),
              activityUnit: t(
                "gamification.level_detail.activity_unit",
                "sessions",
              ),
              activityEmpty: t(
                "gamification.level_detail.activity_empty",
                "No activity in the last 7 days.",
              ),
              milestonesTitle: t(
                "gamification.level_detail.milestones",
                "Milestones",
              ),
              milestoneLevel: t(
                "gamification.level_detail.ms_level",
                "Level {level}",
              ),
              milestoneXp: t("gamification.level_detail.ms_xp", "{xp} XP"),
              reached: t("gamification.level_detail.reached", "reached"),
              locked: t("gamification.level_detail.locked", "locked"),
              howItWorks: t(
                "gamification.level_detail.how",
                "Levels rise on a growing XP curve: 0, 100, 300, 600, 1000 XP — each step needs 100 XP more than the last.",
              ),
            }}
          />
          <NavLink
            to="/dashboard"
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
            data-testid="nav-xp-badge-dashboard-link"
            onClick={() => setOpen(false)}
          >
            {t("nav.dashboard", "Dashboard")}
          </NavLink>
        </div>
      )}
    </div>
  );
}
