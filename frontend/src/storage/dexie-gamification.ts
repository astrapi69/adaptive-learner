/**
 * Dexie implementation of ``IStorageService.gamification`` (#354).
 *
 * Extracted from ``dexie-storage.ts``: thin wiring over the XP /
 * badge / streak engines in ``./gamification``, ``./badges`` and
 * ``./streaks``, plus the gamification-progress reset that clears
 * the userXp / userBadges / userStreaks tables. Badge evaluation
 * after a flat award is best-effort — a failure is logged, never
 * thrown, so the XP award itself always lands.
 */

import { evaluateBadgesForUser, listBadgesWithProgress } from "./badges";
import { getDb } from "./db";
import { awardXPFlat, getXPState, spendXP } from "./gamification";
import {
  calendarHeatmap,
  getStreakState,
  setWeekendMode as setWeekendModeStorage,
} from "./streaks";
import type { IStorageService } from "./types";

export const dexieGamification: IStorageService["gamification"] = {
  getState: (userId) => getXPState(userId),
  spendXp: (userId, amount) => spendXP(userId, amount),
  awardAssessment: async (userId) => {
    const award = await awardXPFlat(userId, 100, "assessment_complete");
    try {
      await evaluateBadgesForUser(userId);
    } catch (err) {
      console.warn("badge evaluate (assessment) failed", err);
    }
    return award;
  },
  awardImport: async (userId) => {
    const award = await awardXPFlat(userId, 75, "conversation_imported");
    try {
      await evaluateBadgesForUser(userId);
    } catch (err) {
      console.warn("badge evaluate (import) failed", err);
    }
    return award;
  },
  listBadges: (userId) => listBadgesWithProgress(userId),
  evaluateBadges: (userId) => evaluateBadgesForUser(userId),
  getStreak: (userId) => getStreakState(userId),
  getStreakHeatmap: (userId, days) => calendarHeatmap(userId, days ?? 365),
  setWeekendMode: (userId, enabled) => setWeekendModeStorage(userId, enabled),
  async resetProgress(userId) {
    const db = getDb();
    const xp = await db.userXp.where({ user_id: userId }).toArray();
    const badges = await db.userBadges.where({ user_id: userId }).toArray();
    const streak = await db.userStreaks.where({ user_id: userId }).toArray();
    const xpDeleted = await db.userXp.where({ user_id: userId }).delete();
    const badgesDeleted = await db.userBadges
      .where({ user_id: userId })
      .delete();
    const streakDeleted = await db.userStreaks
      .where({ user_id: userId })
      .delete();
    return {
      xp_deleted: xpDeleted || xp.length,
      badges_deleted: badgesDeleted || badges.length,
      streak_deleted: streakDeleted || streak.length,
    };
  },
};
