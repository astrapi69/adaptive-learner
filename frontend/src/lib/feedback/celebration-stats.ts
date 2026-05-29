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
    celebrateTierUpgrade,
} from "../praise/celebration-bus";
import type {MilestoneSnapshot} from "./milestones";
import {getStorage} from "../../storage";
import type {BadgeWithProgress} from "../../storage/types";

export interface CelebrationSnapshot extends MilestoneSnapshot {
    earnedBadgeKeys: string[];
    /** Earned badge key -> its tier, so a tier UPGRADE (already
     *  earned, tier climbed) can be detected across snapshots
     *  (Phase 57 / v1.40.0). */
    badgeTiers: Record<string, string>;
}

const EMPTY: CelebrationSnapshot = {
    level: 0,
    streakDays: 0,
    masteredCount: 0,
    earnedBadgeKeys: [],
    badgeTiers: {},
};

const TIER_RANK: Record<string, number> = {bronze: 0, silver: 1, gold: 2};

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
        const earned = badges.filter((b) => b.earned);
        return {
            level: state?.level ?? 0,
            streakDays: streak?.current_streak_days ?? 0,
            masteredCount: errors.filter((e) => e.mastered).length,
            earnedBadgeKeys: earned.map((b) => b.key),
            badgeTiers: Object.fromEntries(
                earned.map((b) => [b.key, b.tier]),
            ),
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
    /** Resolve the (i18n) overlay text for a tier UPGRADE — badge name
     *  + the reached-tier message. Optional: when omitted, tier
     *  upgrades still fire their sound + event but the overlay reuses
     *  the badge name with no tier word (Phase 57). */
    resolveTierUpgrade?: (
        badge: BadgeWithProgress,
        newTier: string,
    ) => {name: string; message: string},
): Promise<void> {
    if (!userId) return;
    const after = await captureCelebrationSnapshot(userId);
    celebrateMilestonesFromSnapshots(before, after);

    const beforeBadges = new Set(before.earnedBadgeKeys);
    try {
        const badges = await getStorage().gamification.listBadges(userId);
        for (const badge of badges) {
            if (badge.earned && !beforeBadges.has(badge.key)) {
                // Brand-new earn -> badge_earned celebration.
                const {name, description} = resolveBadge(badge);
                celebrateBadge(badge.key, name, description);
            } else if (badge.earned && beforeBadges.has(badge.key)) {
                // Already earned -> celebrate a tier CLIMB (silver/gold).
                const prevTier = before.badgeTiers[badge.key];
                const rankNow = TIER_RANK[badge.tier] ?? 0;
                const rankBefore = TIER_RANK[prevTier] ?? 0;
                if (prevTier && rankNow > rankBefore) {
                    const resolved = resolveTierUpgrade
                        ? resolveTierUpgrade(badge, badge.tier)
                        : {name: resolveBadge(badge).name, message: ""};
                    celebrateTierUpgrade({
                        key: badge.key,
                        oldTier: prevTier,
                        newTier: badge.tier,
                        name: resolved.name,
                        message: resolved.message,
                    });
                }
            }
        }
    } catch {
        /* no-op: badges are a nice-to-have on top of milestones */
    }
}
