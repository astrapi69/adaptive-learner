/**
 * Avatar-frame catalog (#2850) - decorative rings around the user
 * avatar, the Stufe-C progression reward: three unlock by level,
 * one by an earned badge, two are purchasable with XP (the
 * ``xp/spend`` economy), and "none" is the always-available default.
 *
 * Rings are pure CSS ``box-shadow`` values built ONLY from design
 * tokens - they render inline (style on the avatar wrapper), where
 * ``var()`` resolves, so the ring recolors with every theme. The
 * bronze/silver/gold metals are new theme-agnostic tokens beside
 * ``--method-*`` in ``styles/legacy/00-head.css``.
 *
 * Unlock evaluation is pure ({@link isFrameUnlocked}); ownership of
 * purchased frames lives in ``avatar-frame-store``; affordability of
 * a purchase is the CALLER's check - ``gamification.spendXp`` clamps
 * at 0 and never rejects.
 */

export type AvatarFrameUnlock =
    | {kind: "default"}
    | {kind: "level"; level: number}
    | {kind: "badge"; badgeKey: string}
    | {kind: "xp"; cost: number};

export interface AvatarFrame {
    /** Stable id, also the i18n suffix (``settings.avatar_frame_<id>``). */
    id: string;
    /** ``box-shadow`` value (token-only), or ``null`` for no ring. */
    ring: string | null;
    unlock: AvatarFrameUnlock;
}

function ring(token: string): string {
    return `0 0 0 2px var(--bg-primary), 0 0 0 4px var(${token})`;
}

/** The catalog, in picker display order (cheapest condition first). */
export const AVATAR_FRAMES: readonly AvatarFrame[] = [
    {id: "none", ring: null, unlock: {kind: "default"}},
    {id: "bronze", ring: ring("--frame-bronze"), unlock: {kind: "level", level: 2}},
    {id: "silver", ring: ring("--frame-silver"), unlock: {kind: "level", level: 5}},
    {id: "gold", ring: ring("--frame-gold"), unlock: {kind: "level", level: 10}},
    {
        id: "flame",
        ring: ring("--method-contextual"),
        unlock: {kind: "badge", badgeKey: "streak_3_days"},
    },
    {id: "star", ring: ring("--star"), unlock: {kind: "xp", cost: 150}},
    {id: "accent", ring: ring("--accent"), unlock: {kind: "xp", cost: 300}},
];

/** The frame for ``id``, falling back to the "none" default. */
export function avatarFrameById(id: string | null | undefined): AvatarFrame {
    return AVATAR_FRAMES.find((f) => f.id === id) ?? AVATAR_FRAMES[0];
}

export interface FrameUnlockContext {
    level: number;
    earnedBadgeKeys: ReadonlySet<string>;
    purchased: ReadonlySet<string>;
}

/** Whether ``frame`` is available to a user in ``ctx``. */
export function isFrameUnlocked(
    frame: AvatarFrame,
    ctx: FrameUnlockContext,
): boolean {
    switch (frame.unlock.kind) {
        case "default":
            return true;
        case "level":
            return ctx.level >= frame.unlock.level;
        case "badge":
            return ctx.earnedBadgeKeys.has(frame.unlock.badgeKey);
        case "xp":
            return ctx.purchased.has(frame.id);
    }
}
