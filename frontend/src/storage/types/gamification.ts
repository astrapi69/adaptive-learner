/**
 * XP / badges / streak shapes + namespace.
 *
 * Split out of the former ``storage/types.ts`` god-file (#354).
 */

export interface XPState {
  user_id: string;
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_to_next_level: number;
  next_level_threshold: number;
  updated_at?: string;
}

export interface XPAwardResult {
  xp_earned: number;
  xp_total: number;
  level: number;
  level_up: boolean;
  multiplier: number;
  breakdown: Record<string, number>;
  reason: string;
}

/**
 * Badge catalog + earn state combined (Phase 29B). The frontend
 * receives the full catalog with per-user ``earned`` + ``earned_at``
 * fields so the showcase can render locked + unlocked badges in
 * one roundtrip.
 */
export interface BadgeWithProgress {
  key: string;
  name_key: string;
  description_key: string;
  icon: string;
  category: string;
  // Phase 57 / v1.40.0. ``tier`` is the user's earned tier when
  // earned, else the badge's locked ``base_tier``. ``tier_thresholds``
  // drives the next-tier progress bar for DYNAMIC badges.
  base_tier: string;
  tier: string;
  tier_thresholds: Record<string, { threshold: number; xp_bonus: number }> | null;
  earned: boolean;
  earned_at: string | null;
  progress: string | null;
}

/** A badge tier transition (Phase 57 / v1.40.0). ``old_tier`` is null
 *  on a dynamic badge's first earn. Drives the celebration bus. */
export interface BadgeTierUpgrade {
  key: string;
  old_tier: string | null;
  new_tier: string;
  xp_awarded: number;
}

/** Result of an evaluation pass: newly-earned badge keys + tier
 *  upgrades. Shared shape across ApiStorage + DexieStorage. */
export interface BadgeEvaluationResult {
  earned: string[];
  upgrades: BadgeTierUpgrade[];
}

export interface StreakStateOut {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  freezes_available: number;
  weekend_mode: boolean;
  last_freeze_earned_on: string | null;
  last_freeze_used_on: string | null;
}

export interface HeatmapEntryOut {
  date: string;
  count: number;
}

export interface IGamificationNamespace {
  getState(userId: string): Promise<XPState>;
  awardAssessment(userId: string): Promise<XPAwardResult>;
  awardImport(userId: string): Promise<XPAwardResult>;
  listBadges(userId: string): Promise<BadgeWithProgress[]>;
  evaluateBadges(userId: string): Promise<BadgeEvaluationResult>;
  getStreak(userId: string): Promise<StreakStateOut>;
  getStreakHeatmap(userId: string, days?: number): Promise<HeatmapEntryOut[]>;
  setWeekendMode(userId: string, enabled: boolean): Promise<StreakStateOut>;
  /** Destructive: wipes XP, badges, streak. Used by Settings. */
  resetProgress(userId: string): Promise<{
    xp_deleted: number;
    badges_deleted: number;
    streak_deleted: number;
  }>;
}
