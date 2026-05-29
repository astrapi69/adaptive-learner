/**
 * Celebration stats + completion wiring (EXP-008 / Phase 55H,
 * P-145).
 *
 * Gathers the gamification numbers that feed the milestone
 * threshold checks (level, streak days, mastered-element count)
 * plus the earned-badge set, and drives the completion-time
 * celebration: detect milestones crossed across a lesson/review
 * and queue the overlays + sounds via the celebration bus.
 *
 * "Best streak ever" (P-144) is the existing
 * ``UserStreak.longest_streak_days`` - already maintained as the
 * all-time max by the streak service and shown next to the
 * current streak in ``StreakWidget`` - so no new column / Dexie
 * bump is needed.
 *
 * Every read is defensive: a storage that lacks a namespace (or
 * an anonymous run with no userId) yields an empty snapshot and
 * no celebration, never a throw, so the lesson-completion path is
 * never broken by the celebration layer.
 */

import {
    celebrateBadge,
    celebrateMilestonesFromSnapshots,
} from "../praise/celebration-bus";
import type {MilestoneSnapshot} from "./milestones";
import {getStorage} from "../../storage";
import type {BadgeWithProgress} from "../../storage/types";

export interface CelebrationSnapshot extends MilestoneSnapshot {
    earnedBadgeKeys: string[];
}

const EMPTY: CelebrationSnapshot = {
    level: 0,
    streakDays: 0,
    masteredCount: 0,
    earnedBadgeKeys: [],
};

/** Snapshot the gamification state that milestone detection
 *  needs. Returns an empty snapshot for an anonymous run or when
 *  any read fails. */
export async function captureCelebrationSnapshot(
    userId: string,
): Promise<CelebrationSnapshot> {
    if (!userId) return {...EMPTY};
    try {
        const storage = getStorage();
        const [state, streak, errors, badges] = await Promise.all([
            storage.gamification.getState(userId),
            storage.gamification.getStreak(userId),
            storage.elementErrors.list(userId, {includeMastered: true}),
            storage.gamification.listBadges(userId),
        ]);
        return {
            level: state?.level ?? 0,
            streakDays: streak?.current_streak_days ?? 0,
            masteredCount: errors.filter((e) => e.mastered).length,
            earnedBadgeKeys: badges
                .filter((b) => b.earned)
                .map((b) => b.key),
        };
    } catch {
        return {...EMPTY};
    }
}

/**
 * Celebrate everything earned since the ``before`` snapshot:
 * milestones crossed (streak / level / mastery) and any newly
 * earned badge. ``resolveBadge`` turns a badge's i18n keys into
 * display text (the caller owns the ``t`` function).
 */
export async function celebrateProgressSince(
    userId: string,
    before: CelebrationSnapshot,
    resolveBadge: (badge: BadgeWithProgress) => {
        name: string;
        description: string;
    },
): Promise<void> {
    if (!userId) return;
    const after = await captureCelebrationSnapshot(userId);
    celebrateMilestonesFromSnapshots(before, after);

    const beforeBadges = new Set(before.earnedBadgeKeys);
    try {
        const badges = await getStorage().gamification.listBadges(userId);
        for (const badge of badges) {
            if (badge.earned && !beforeBadges.has(badge.key)) {
                const {name, description} = resolveBadge(badge);
                celebrateBadge(badge.key, name, description);
            }
        }
    } catch {
        /* no-op: badges are a nice-to-have on top of milestones */
    }
}
