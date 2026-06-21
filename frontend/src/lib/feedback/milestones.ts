/**
 * Milestone detection (EXP-008 / Phase 55D).
 *
 * Pure functions that compare a before/after snapshot of the
 * learner's gamification state and return the milestones crossed.
 * No side effects, no storage access - the caller (the
 * celebration bus, 55G) supplies the numbers and routes the
 * results to the celebration queue.
 *
 * Thresholds are deliberately sparse so a milestone feels EARNED:
 *   - streak:  7, 30, 100 consecutive days
 *   - mastery: 50, 100, 500 mastered elements
 *   - level:   any level increase
 */

export type MilestoneType = "streak" | "level_up" | "mastery" | "badge";

export interface Milestone {
    /** Stable identity, used for React keys + de-duplication. */
    id: string;
    type: MilestoneType;
    /** The headline number: streak days / new level / mastered
     *  count. For badges this is unused (0). */
    value: number;
    badgeId?: string;
    badgeName?: string;
    badgeDescription?: string;
}

export const STREAK_THRESHOLDS = [7, 30, 100] as const;
export const MASTERY_THRESHOLDS = [50, 100, 500] as const;

/** Highest threshold in ``thresholds`` newly crossed when the
 *  value moves from ``prev`` to ``next``. Returns null when none
 *  was crossed. */
function highestCrossed(
    prev: number,
    next: number,
    thresholds: readonly number[],
): number | null {
    let crossed: number | null = null;
    for (const threshold of thresholds) {
        if (prev < threshold && next >= threshold) {
            crossed = threshold;
        }
    }
    return crossed;
}

/** The highest streak threshold (7/30/100 days) newly crossed
 *  between ``prev`` and ``next``, or null when none was crossed. */
export function detectStreakMilestone(
    prev: number,
    next: number,
): Milestone | null {
    const value = highestCrossed(prev, next, STREAK_THRESHOLDS);
    if (value === null) return null;
    return {id: `streak-${value}`, type: "streak", value};
}

/** The highest mastery threshold (50/100/500 mastered elements)
 *  newly crossed between ``prev`` and ``next``, or null when none
 *  was crossed. */
export function detectMasteryMilestone(
    prev: number,
    next: number,
): Milestone | null {
    const value = highestCrossed(prev, next, MASTERY_THRESHOLDS);
    if (value === null) return null;
    return {id: `mastery-${value}`, type: "mastery", value};
}

/** Any level increase is a milestone; the headline is the new
 *  (highest) level reached. */
export function detectLevelUp(
    prevLevel: number,
    nextLevel: number,
): Milestone | null {
    if (nextLevel <= prevLevel) return null;
    return {id: `level-${nextLevel}`, type: "level_up", value: nextLevel};
}

export interface MilestoneSnapshot {
    streakDays: number;
    masteredCount: number;
    level: number;
}

/**
 * Detect every milestone crossed between two snapshots. Ordered
 * streak -> level_up -> mastery so the celebration queue shows
 * the most "habitual" achievement first.
 */
export function detectMilestones(
    before: MilestoneSnapshot,
    after: MilestoneSnapshot,
): Milestone[] {
    const out: Milestone[] = [];
    const streak = detectStreakMilestone(before.streakDays, after.streakDays);
    if (streak) out.push(streak);
    const level = detectLevelUp(before.level, after.level);
    if (level) out.push(level);
    const mastery = detectMasteryMilestone(
        before.masteredCount,
        after.masteredCount,
    );
    if (mastery) out.push(mastery);
    return out;
}

/** Build a badge-earned milestone for the celebration queue. */
export function badgeMilestone(
    badgeId: string,
    name: string,
    description: string,
): Milestone {
    return {
        id: `badge-${badgeId}`,
        type: "badge",
        value: 0,
        badgeId,
        badgeName: name,
        badgeDescription: description,
    };
}
