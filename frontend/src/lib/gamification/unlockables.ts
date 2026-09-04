/**
 * Shared unlockable-condition model (#2861) - one progression
 * vocabulary for every cosmetic reward surface: an item is free by
 * default, unlocks at a level, unlocks with an earned badge, or is
 * purchasable with XP. Extracted from the avatar-frame catalog
 * (#2850) when the mascot variants became the second consumer.
 *
 * Evaluation is pure; ownership of purchased items lives in the
 * per-surface selection store, and affordability of a purchase is
 * the CALLER's check - ``gamification.spendXp`` clamps at 0 and
 * never rejects.
 */

export type UnlockCondition =
    | {kind: "default"}
    | {kind: "level"; level: number}
    | {kind: "badge"; badgeKey: string}
    | {kind: "xp"; cost: number};

export interface UnlockContext {
    level: number;
    earnedBadgeKeys: ReadonlySet<string>;
    purchased: ReadonlySet<string>;
}

/** Whether the item ``id`` guarded by ``unlock`` is available in ``ctx``. */
export function isUnlocked(
    id: string,
    unlock: UnlockCondition,
    ctx: UnlockContext,
): boolean {
    switch (unlock.kind) {
        case "default":
            return true;
        case "level":
            return ctx.level >= unlock.level;
        case "badge":
            return ctx.earnedBadgeKeys.has(unlock.badgeKey);
        case "xp":
            return ctx.purchased.has(id);
    }
}
