/**
 * Level-milestone ladder (#727) — the level thresholds around the
 * learner's current level, used by the Level-Detail popover to document
 * the level system visually.
 *
 * The level system is the existing exponential curve the XP service uses:
 * ``threshold(n) = 50 * n * (n - 1)`` — the cumulative XP to REACH level
 * n. Level 1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000 XP; each gap grows
 * by 100. Pure + deterministic.
 */

import { levelThreshold } from "../../storage/gamification/gamification";

/** One step on the level ladder, with whether the learner has reached it. */
export interface LevelMilestone {
  level: number;
  /** Cumulative XP required to reach this level. */
  xp: number;
  reached: boolean;
}

/**
 * Build the milestone ladder: levels 1 through ``level + lookahead`` with
 * their XP thresholds and reached state (decided by ``currentXp``). This
 * is what visually documents the level thresholds in the detail view.
 *
 * @param level - the learner's current level.
 * @param currentXp - their total XP (decides ``reached``).
 * @param lookahead - how many future levels to include (default 3).
 */
export function buildLevelMilestones(
  level: number,
  currentXp: number,
  lookahead = 3,
): LevelMilestone[] {
  const top = Math.max(1, Math.floor(level)) + Math.max(1, lookahead);
  const out: LevelMilestone[] = [];
  for (let n = 1; n <= top; n++) {
    const xp = levelThreshold(n);
    out.push({ level: n, xp, reached: currentXp >= xp });
  }
  return out;
}
