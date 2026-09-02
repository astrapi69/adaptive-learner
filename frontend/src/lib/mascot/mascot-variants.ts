/**
 * Mascot-variant catalog (#2861) - color schemes for the Lernfunke
 * playful-mode companion (#2849), the mascot's slice of the #2847
 * progression: free default, two level unlocks, one badge unlock,
 * one XP purchase (the ``xp/spend`` economy's third consumer).
 *
 * Colors are design tokens ONLY - the figure renders as an inline
 * SVG, where ``var()`` resolves, so every variant recolors with the
 * theme. All tokens are existing theme-agnostic brand values
 * (``--method-*``, ``--frame-gold``, ``--star``); no new CSS.
 *
 * Unlock evaluation delegates to the shared unlockables logic;
 * ownership of purchased variants lives in ``mascot-variant-store``.
 */

import {
    isUnlocked,
    type UnlockCondition,
    type UnlockContext,
} from "../gamification/unlockables";

export interface MascotVariant {
    /** Stable id, also the i18n suffix (``settings.mascot_variant_<id>``). */
    id: string;
    /** Body/flame fill (token ``var()`` value). */
    body: string;
    /** Celebrate-pose sparkle fill (token ``var()`` value). */
    spark: string;
    unlock: UnlockCondition;
}

/** The catalog, in picker display order (cheapest condition first). */
export const MASCOT_VARIANTS: readonly MascotVariant[] = [
    {
        id: "funke",
        body: "var(--method-contextual)",
        spark: "var(--star)",
        unlock: {kind: "default"},
    },
    {
        id: "ozean",
        body: "var(--method-deductive)",
        spark: "var(--star)",
        unlock: {kind: "level", level: 3},
    },
    {
        id: "wald",
        body: "var(--method-dialogic)",
        spark: "var(--star)",
        unlock: {kind: "level", level: 7},
    },
    {
        id: "geist",
        body: "var(--method-inductive)",
        spark: "var(--star)",
        unlock: {kind: "badge", badgeKey: "first_session"},
    },
    {
        id: "gold",
        body: "var(--frame-gold)",
        spark: "var(--star)",
        unlock: {kind: "xp", cost: 250},
    },
];

/** The variant for ``id``, falling back to the funke default. */
export function mascotVariantById(
    id: string | null | undefined,
): MascotVariant {
    return MASCOT_VARIANTS.find((v) => v.id === id) ?? MASCOT_VARIANTS[0];
}

/** Whether ``variant`` is available to a user in ``ctx``. */
export function isVariantUnlocked(
    variant: MascotVariant,
    ctx: UnlockContext,
): boolean {
    return isUnlocked(variant.id, variant.unlock, ctx);
}
