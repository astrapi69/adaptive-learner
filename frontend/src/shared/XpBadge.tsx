/**
 * XpBadge — a compact, accessible experience-points display: an
 * optional leading icon, an optional level label, the total XP, and
 * an optional "+N" gain pill (for "you just earned N points" moments).
 *
 * Fully presentational and app-agnostic: every value, every label, and
 * every class name is caller-supplied, and it imports nothing
 * app-specific (no i18n, no storage, no icon library). Bring your own
 * icon node and your own translated labels. Reusable anywhere a points
 * total needs surfacing — a nav bar, a lesson summary, a dashboard
 * card, a leaderboard row.
 *
 * Rendering order is icon -> level -> total -> gain. Any segment whose
 * value is omitted (or, for `gain`, not a positive number) is skipped,
 * so the same component covers "Level 4 · 1200 XP" in a header and a
 * standalone "+80 XP" celebration pill.
 *
 * @example
 * // Header badge: icon + level + total
 * <XpBadge
 *   xp={1200}
 *   level={4}
 *   icon={<Zap size={14} aria-hidden="true" />}
 *   xpLabel="XP"
 *   levelLabel="Level"
 *   ariaLabel="Level 4, 1200 total experience points"
 *   className="nav-xp-badge"
 *   testId="nav-xp-badge"
 * />
 *
 * @example
 * // Lesson summary: a standalone "+80 XP" gain pill (no total)
 * <XpBadge
 *   gain={80}
 *   icon={<Zap size={16} aria-hidden="true" />}
 *   xpLabel="XP"
 *   gainClassName="lesson-summary-xp-gain"
 *   className="lesson-summary-xp-badge"
 *   testId="lesson-summary-xp"
 * />
 */

import type { ReactNode } from "react";

export interface XpBadgeProps {
  /** Total experience points to display. Omit to render a gain-only
   *  pill (e.g. a standalone "+80 XP"). */
  xp?: number;
  /** Optional current level; rendered as `{levelLabel} {level}`. */
  level?: number;
  /** Optional just-earned amount; rendered as a `+{gain}` pill when
   *  it is a positive number. Zero / negative / undefined hides it. */
  gain?: number;
  /** Leading icon node (caller-supplied; kept aria-hidden by you). */
  icon?: ReactNode;
  /** Unit label after the XP total, e.g. "XP". */
  xpLabel?: string;
  /** Word before the level number, e.g. "Level". */
  levelLabel?: string;
  /** Accessible name for the whole badge (recommended — the visual
   *  text is terse, so screen readers benefit from a full sentence). */
  ariaLabel?: string;
  /** Class for the root wrapper. */
  className?: string;
  /** Class for the icon wrapper. */
  iconClassName?: string;
  /** Class for the level segment. */
  levelClassName?: string;
  /** Class for the total-XP segment. */
  xpClassName?: string;
  /** Class for the gain pill. */
  gainClassName?: string;
  /** `data-testid` for the root wrapper. */
  testId?: string;
  /** `data-testid` for the level segment. */
  levelTestId?: string;
  /** `data-testid` for the total-XP segment. */
  xpTestId?: string;
  /** `data-testid` for the gain pill. */
  gainTestId?: string;
}

/** Compact icon + level + total + optional "+N" gain experience badge. */
export default function XpBadge({
  xp,
  level,
  gain,
  icon,
  xpLabel = "XP",
  levelLabel = "Level",
  ariaLabel,
  className,
  iconClassName,
  levelClassName,
  xpClassName,
  gainClassName,
  testId,
  levelTestId,
  xpTestId,
  gainTestId,
}: XpBadgeProps) {
  const showLevel = typeof level === "number";
  const showTotal = typeof xp === "number";
  const showGain = typeof gain === "number" && gain > 0;
  return (
    <span className={className} data-testid={testId} aria-label={ariaLabel}>
      {icon != null && <span className={iconClassName}>{icon}</span>}
      {showLevel && (
        <span className={levelClassName} data-testid={levelTestId}>
          {levelLabel} {level}
        </span>
      )}
      {showTotal && (
        <span className={xpClassName} data-testid={xpTestId}>
          {xp} {xpLabel}
        </span>
      )}
      {showGain && (
        <span className={gainClassName} data-testid={gainTestId}>
          +{gain} {xpLabel}
        </span>
      )}
    </span>
  );
}
